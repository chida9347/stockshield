import base64
import binascii
import hashlib
import hmac
import json
import os
import time
import csv
import io
from datetime import datetime, timezone

from fastapi import Depends, FastAPI, File, Header, HTTPException, UploadFile
from fastapi.responses import StreamingResponse
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field

from risk_engine import analyze_inventory
from recovery_engine import generate_recovery_strategies
from simulator import simulate_all_strategies
from disruption_engine import inject_disruption
from ai_service import answer_inventory_question, generate_inventory_insights
from alert_service import generate_alerts, send_alert_digest
from ml_service import forecast_demand
from supplier_service import build_supplier_scorecards
from database import (
    authenticate_user,
    create_inventory,
    delete_inventory,
    get_inventory_history,
    get_demand_history,
    create_recovery_plan,
    get_recovery_plans,
    update_recovery_plan_status,
    load_data,
    record_inventory_snapshot,
    update_inventory,
    update_user_password,
)


app = FastAPI(
    title="StockShield API",
    description="AI-Powered Inventory Disruption Recovery Agent"
)


# --------------------------------------------------
# CORS Configuration
# --------------------------------------------------

app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:5173",
        "http://127.0.0.1:5173",
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# --------------------------------------------------
# Request Model
# --------------------------------------------------

class DisruptionRequest(BaseModel):
    type: str

    # Demand shock fields
    product_id: str | None = None
    region_id: str | None = None
    increase_percentage: float | None = None

    # Supplier shock fields
    supplier_id: str | None = None
    delay_days: int | None = None


class LoginRequest(BaseModel):
    username: str
    password: str


class PasswordChangeRequest(BaseModel):
    current_password: str
    new_password: str = Field(min_length=6, max_length=128)


class InventoryUpdateRequest(BaseModel):
    supplier_id: str
    quantity: float = Field(ge=0)
    capacity: float = Field(gt=0)


class InventoryCreateRequest(InventoryUpdateRequest):
    product_id: str
    region_id: str


class AIQuestionRequest(BaseModel):
    question: str = Field(min_length=3, max_length=1000)


class ScenarioRequest(BaseModel):
    disruptions: list[DisruptionRequest] = Field(min_length=1, max_length=10)


class RecoveryPlanRequest(BaseModel):
    product_id: str
    region_id: str
    strategy: dict


class RecoveryStatusRequest(BaseModel):
    status: str


TOKEN_SECRET = os.getenv("STOCKSHIELD_TOKEN_SECRET", "change-this-secret")


def create_token(user):
    payload = {
        "user_id": user["id"],
        "username": user["username"],
        "role": user["role"],
        "expires": int(time.time()) + 60 * 60 * 8,
    }
    encoded = base64.urlsafe_b64encode(json.dumps(payload).encode()).decode()
    signature = hmac.new(
        TOKEN_SECRET.encode(), encoded.encode(), hashlib.sha256
    ).hexdigest()
    return f"{encoded}.{signature}"


def current_user(authorization: str | None = Header(default=None)):
    if not authorization or not authorization.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="Authentication required")
    try:
        encoded, signature = authorization.removeprefix("Bearer ").split(".", 1)
        expected = hmac.new(
            TOKEN_SECRET.encode(), encoded.encode(), hashlib.sha256
        ).hexdigest()
        if not hmac.compare_digest(signature, expected):
            raise ValueError
        payload = json.loads(base64.urlsafe_b64decode(encoded).decode())
        if payload["expires"] < time.time():
            raise ValueError
        return payload
    except (ValueError, KeyError, json.JSONDecodeError, binascii.Error):
        raise HTTPException(status_code=401, detail="Invalid or expired token")


def require_admin(user=Depends(current_user)):
    if user["role"] != "admin":
        raise HTTPException(status_code=403, detail="Admin role required")
    return user


# --------------------------------------------------
# Basic API
# --------------------------------------------------

@app.get("/")
def root():
    return {
        "message": "StockShield API is running"
    }


@app.post("/api/auth/login")
def login(request: LoginRequest):
    user = authenticate_user(request.username, request.password)
    if not user:
        raise HTTPException(status_code=401, detail="Invalid username or password")
    return {"token": create_token(user), "user": user}


@app.get("/api/auth/me")
def me(user=Depends(current_user)):
    return {"user": user}


@app.patch("/api/auth/password")
def change_password(request: PasswordChangeRequest, user=Depends(current_user)):
    try:
        update_user_password(user["user_id"], request.current_password, request.new_password)
        return {"status": "Password updated"}
    except ValueError as error:
        raise HTTPException(status_code=400, detail=str(error))


@app.put("/api/inventory/{product_id}/{region_id}")
def edit_inventory(
    product_id: str,
    region_id: str,
    request: InventoryUpdateRequest,
    user=Depends(require_admin),
):
    try:
        update_inventory(
            product_id,
            region_id,
            request.supplier_id,
            request.quantity,
            request.capacity,
        )
        return {"status": "Inventory updated", "updated_by": user["username"]}
    except ValueError as error:
        raise HTTPException(status_code=404, detail=str(error))


@app.post("/api/inventory")
def add_inventory(
    request: InventoryCreateRequest,
    user=Depends(require_admin),
):
    try:
        create_inventory(
            request.product_id,
            request.region_id,
            request.supplier_id,
            request.quantity,
            request.capacity,
        )
        return {"status": "Inventory created", "created_by": user["username"]}
    except ValueError as error:
        raise HTTPException(status_code=400, detail=str(error))


@app.delete("/api/inventory/{product_id}/{region_id}")
def remove_inventory(
    product_id: str,
    region_id: str,
    user=Depends(require_admin),
):
    try:
        delete_inventory(product_id, region_id)
        return {"status": "Inventory removed", "deleted_by": user["username"]}
    except ValueError as error:
        raise HTTPException(status_code=404, detail=str(error))


@app.get("/api/inventory-analysis")
def inventory_analysis():
    analysis = analyze_inventory()
    record_inventory_snapshot(analysis)
    return {
        "analysis": analysis
    }


@app.get("/api/inventory-export")
def inventory_export():
    output = io.StringIO()
    analysis = analyze_inventory()
    fields = [
        "product_name",
        "region_name",
        "current_inventory",
        "daily_demand",
        "days_of_stock",
        "supplier_name",
        "risk_level",
        "expected_lost_revenue",
    ]
    writer = csv.DictWriter(output, fieldnames=fields)
    writer.writeheader()
    writer.writerows({field: row[field] for field in fields} for row in analysis)
    output.seek(0)
    return StreamingResponse(
        iter([output.getvalue()]),
        media_type="text/csv",
        headers={"Content-Disposition": "attachment; filename=stockshield-risk-report.csv"},
    )


@app.post("/api/inventory-import")
async def inventory_import(
    file: UploadFile = File(...),
    user=Depends(require_admin),
):
    if not file.filename or not file.filename.lower().endswith(".csv"):
        raise HTTPException(status_code=400, detail="Upload a CSV file")
    content = await file.read()
    try:
        rows = list(csv.DictReader(io.StringIO(content.decode("utf-8-sig"))))
        required = {
            "product_id",
            "region_id",
            "supplier_id",
            "current_inventory",
            "capacity",
        }
        if not rows or not required.issubset(rows[0]):
            raise ValueError(
                "CSV must contain product_id, region_id, supplier_id, "
                "current_inventory, and capacity columns"
            )
        for row in rows:
            update_inventory(
                row["product_id"],
                row["region_id"],
                row["supplier_id"],
                float(row["current_inventory"]),
                float(row["capacity"]),
            )
        return {"updated": len(rows), "updated_by": user["username"]}
    except (UnicodeDecodeError, ValueError, KeyError) as error:
        raise HTTPException(status_code=400, detail=f"Invalid CSV: {error}")


@app.get("/api/ai-insights")
def ai_insights():
    return generate_inventory_insights(analyze_inventory())


@app.get("/api/alerts")
def alerts():
    return generate_alerts(analyze_inventory())


@app.post("/api/alerts/notify")
def notify_alerts(user=Depends(require_admin)):
    result = send_alert_digest(generate_alerts(analyze_inventory()))
    if not result["sent"]:
        raise HTTPException(status_code=503, detail=result["message"])
    return result


@app.get("/api/ml-forecast")
def ml_forecast():
    data = load_data()
    return {
        "forecasts": forecast_demand(
            get_demand_history(),
            data["products"],
            data["regions"],
        ),
        "horizon_days": 7,
    }


@app.get("/api/supplier-scorecards")
def supplier_scorecards():
    data = load_data()
    return {
        "suppliers": build_supplier_scorecards(data, analyze_inventory())
    }


@app.post("/api/ai-chat")
def ai_chat(request: AIQuestionRequest):
    return answer_inventory_question(request.question, analyze_inventory())


@app.get("/api/recovery-plans")
def recovery_plans():
    return {"plans": get_recovery_plans()}


@app.post("/api/recovery-plans")
def save_recovery_plan(
    request: RecoveryPlanRequest,
    user=Depends(require_admin),
):
    try:
        strategy = dict(request.strategy)
        strategy["quantity"] = strategy.get(
            "quantity", strategy.get("recovery_quantity", 0)
        )
        strategy["estimated_cost"] = strategy.get(
            "estimated_cost", strategy.get("recovery_cost", 0)
        )
        if not strategy["strategy"] or not strategy["description"]:
            raise ValueError("Recovery strategy is incomplete")
        plan_id = create_recovery_plan(
            request.product_id,
            request.region_id,
            strategy,
        )
        return {"id": plan_id, "status": "Recommended"}
    except (KeyError, ValueError) as error:
        raise HTTPException(status_code=400, detail=str(error))


@app.patch("/api/recovery-plans/{plan_id}")
def change_recovery_status(
    plan_id: int,
    request: RecoveryStatusRequest,
    user=Depends(require_admin),
):
    allowed = {"Recommended", "Approved", "Ordered", "In Transit", "Delivered", "Cancelled"}
    if request.status not in allowed:
        raise HTTPException(status_code=400, detail="Invalid recovery status")
    try:
        update_recovery_plan_status(plan_id, request.status)
        return {"id": plan_id, "status": request.status}
    except ValueError as error:
        raise HTTPException(status_code=404, detail=str(error))


@app.get("/api/inventory-history")
def inventory_history():
    return {"history": get_inventory_history()}


# --------------------------------------------------
# Recovery Strategies
# --------------------------------------------------

@app.get("/api/recovery-strategies/{product_id}/{region_id}")
def recovery_strategies(
    product_id: str,
    region_id: str
):

    try:
        strategies = generate_recovery_strategies(
            product_id,
            region_id
        )

        return {
            "product_id": product_id,
            "region_id": region_id,
            "strategies": strategies
        }

    except StopIteration:
        raise HTTPException(
            status_code=404,
            detail="Product or region inventory not found"
        )


# --------------------------------------------------
# Baseline Strategy Simulation
# --------------------------------------------------

@app.get("/api/simulate-recovery/{product_id}/{region_id}")
def simulate_recovery(
    product_id: str,
    region_id: str
):

    try:

        strategies = generate_recovery_strategies(
            product_id,
            region_id
        )

        simulation_results = simulate_all_strategies(
            product_id,
            region_id,
            strategies
        )

        recommended_strategy = (
            simulation_results[0]
            if simulation_results
            else None
        )

        return {
            "product_id": product_id,
            "region_id": region_id,
            "strategies_compared": len(simulation_results),
            "recommended_strategy": recommended_strategy,
            "strategy_comparison": simulation_results
        }

    except StopIteration:
        raise HTTPException(
            status_code=404,
            detail="Product or region inventory not found"
        )


# --------------------------------------------------
# Judge Disruption Injection + Re-Planning
# --------------------------------------------------

@app.post("/api/inject-disruption")
def inject_and_replan(
    request: DisruptionRequest
):

    try:

        disruption_request = request.model_dump(
            exclude_none=True
        )

        # Step 1: Create the disrupted scenario
        scenario = inject_disruption(
            disruption_request
        )

        disrupted_data = scenario["data"]
        disruption = scenario["disruption"]

        # Step 2: Re-analyze all inventory risks
        analysis = analyze_inventory(
            data=disrupted_data,
            disruption=disruption
        )

        # Determine affected product/region
        if disruption["type"] == "demand_shock":

            product_id = disruption["product_id"]
            region_id = disruption["region_id"]

        elif disruption["type"] == "supplier_shock":

            supplier_id = disruption["supplier_id"]

            affected_item = next(
                item
                for item in disrupted_data["inventory"]
                if item["supplier_id"] == supplier_id
            )

            product_id = affected_item["product_id"]
            region_id = affected_item["region_id"]

        else:
            raise ValueError(
                "Unsupported disruption type"
            )

        # Step 3: Generate new recovery strategies
        strategies = generate_recovery_strategies(
            product_id=product_id,
            region_id=region_id,
            data=disrupted_data,
            disruption=disruption
        )

        # Step 4: Simulate every strategy
        simulation_results = simulate_all_strategies(
            product_id=product_id,
            region_id=region_id,
            strategies=strategies,
            data=disrupted_data,
            disruption=disruption
        )

        # Step 5: Select the best strategy
        recommended_strategy = (
            simulation_results[0]
            if simulation_results
            else None
        )

        return {
            "status": "Disruption detected and recovery plan generated",

            "disruption": disruption,

            "affected_product_id": product_id,
            "affected_region_id": region_id,

            "risk_analysis": analysis,

            "strategies_compared": len(simulation_results),

            "recommended_strategy": recommended_strategy,

            "strategy_comparison": simulation_results
        }

    except (ValueError, KeyError, StopIteration) as error:

        raise HTTPException(
            status_code=400,
            detail=str(error)
        )


@app.post("/api/simulate-scenario")
def simulate_scenario(request: ScenarioRequest):
    disruptions = [
        disruption.model_dump(exclude_none=True)
        for disruption in request.disruptions
    ]
    for disruption in disruptions:
        if disruption["type"] == "demand_shock":
            disruption["shock_multiplier"] = 1 + (
                disruption["increase_percentage"] / 100
            )
    try:
        baseline = analyze_inventory()
        scenario = analyze_inventory(disruption=disruptions)
        baseline_exposure = sum(
            item["expected_lost_revenue"] for item in baseline
        )
        scenario_exposure = sum(
            item["expected_lost_revenue"] for item in scenario
        )
        return {
            "scenario_id": datetime.now(timezone.utc).strftime("%Y%m%d%H%M%S%f"),
            "disruptions": disruptions,
            "baseline_revenue_at_risk": round(baseline_exposure, 2),
            "scenario_revenue_at_risk": round(scenario_exposure, 2),
            "additional_revenue_at_risk": round(
                max(scenario_exposure - baseline_exposure, 0), 2
            ),
            "high_risk_locations": sum(
                item["risk_level"] in ("Critical", "High") for item in scenario
            ),
            "risk_analysis": scenario,
        }
    except (ValueError, KeyError, StopIteration) as error:
        raise HTTPException(status_code=400, detail=str(error))