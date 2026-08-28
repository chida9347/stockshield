from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

from risk_engine import analyze_inventory
from recovery_engine import generate_recovery_strategies
from simulator import simulate_all_strategies
from disruption_engine import inject_disruption
from ai_service import generate_inventory_insights


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


# --------------------------------------------------
# Basic API
# --------------------------------------------------

@app.get("/")
def root():
    return {
        "message": "StockShield API is running"
    }


@app.get("/api/inventory-analysis")
def inventory_analysis():
    return {
        "analysis": analyze_inventory()
    }


@app.get("/api/ai-insights")
def ai_insights():
    return generate_inventory_insights(analyze_inventory())


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