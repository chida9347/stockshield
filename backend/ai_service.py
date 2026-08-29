import json
import os
from pathlib import Path
from urllib.error import HTTPError, URLError
from urllib.request import Request, urlopen
from dotenv import load_dotenv


load_dotenv(Path(__file__).with_name(".env"))


def generate_inventory_insights(analysis):
    """Generate concise, explainable AI insights from current risk signals."""
    if not analysis:
        return {
            "summary": "No inventory records are available for analysis.",
            "priorities": [],
            "model": "StockShield Risk Copilot",
        }

    ranked = sorted(
        analysis,
        key=lambda item: (
            {"Critical": 0, "High": 1, "Medium": 2, "Low": 3}[item["risk_level"]],
            -item["expected_lost_revenue"],
        ),
    )
    urgent = [item for item in ranked if item["risk_level"] in ("Critical", "High")]
    exposure = sum(item["expected_lost_revenue"] for item in analysis)
    summary = (
        f"Prioritize {len(urgent)} high-impact location(s). "
        f"Current modeled exposure is ₹{exposure:,.0f}; "
        f"{urgent[0]['product_name']} in {urgent[0]['region_name']} "
        f"has the most urgent risk."
        if urgent
        else (
            f"Inventory is currently stable across {len(analysis)} locations, "
            f"with modeled exposure of ₹{exposure:,.0f}."
        )
    )
    priorities = [
        {
            "product": item["product_name"],
            "region": item["region_name"],
            "risk": item["risk_level"],
            "reason": (
                f"{item['days_of_stock']:.1f} days of stock remaining against "
                f"{item['supplier_lead_time_days']} days supplier lead time; "
                f"₹{item['expected_lost_revenue']:,.0f} revenue at risk."
            ),
        }
        for item in ranked[:3]
    ]
    return {
        "summary": summary,
        "priorities": priorities,
        "model": "StockShield Risk Copilot",
    }


def _local_answer(question, analysis):
    normalized_question = question.lower()
    insights = generate_inventory_insights(analysis)
    if "supplier" in normalized_question:
        suppliers = {}
        for item in analysis:
            supplier = suppliers.setdefault(
                item["supplier_name"],
                {"risk": 0, "revenue": 0, "lead_time": item["supplier_lead_time_days"]},
            )
            supplier["risk"] += item["risk_level"] in ("Critical", "High")
            supplier["revenue"] += item["expected_lost_revenue"]
        best_supplier = max(suppliers, key=lambda name: suppliers[name]["risk"])
        return (
            f"{best_supplier} has {suppliers[best_supplier]['risk']} high-risk "
            f"location(s), {suppliers[best_supplier]['lead_time']}-day lead time, "
            f"and ₹{suppliers[best_supplier]['revenue']:,.0f} associated exposure."
        )
    if "region" in normalized_question:
        by_region = {}
        for item in analysis:
            by_region[item["region_name"]] = (
                by_region.get(item["region_name"], 0)
                + item["expected_lost_revenue"]
            )
        region = max(by_region, key=by_region.get)
        return f"{region} has the highest modeled regional exposure at ₹{by_region[region]:,.0f}."
    if "revenue" in normalized_question or "cost" in normalized_question:
        exposure = sum(item["expected_lost_revenue"] for item in analysis)
        return f"Total modeled revenue exposure is ₹{exposure:,.0f}. Focus first on the highest-risk rows."
    if "how many" in normalized_question or "count" in normalized_question:
        return (
            f"There are {len(analysis)} locations analyzed: "
            f"{sum(item['risk_level'] == 'Critical' for item in analysis)} Critical, "
            f"{sum(item['risk_level'] == 'High' for item in analysis)} High, "
            f"{sum(item['risk_level'] == 'Medium' for item in analysis)} Medium, "
            f"and {sum(item['risk_level'] == 'Low' for item in analysis)} Low."
        )

    top_priority = insights["priorities"][0] if insights["priorities"] else None
    if top_priority:
        return (
            f"{insights['summary']} Based on your question, start with "
            f"{top_priority['product']} in {top_priority['region']}: "
            f"{top_priority['reason']}"
        )
    return insights["summary"]


def answer_inventory_question(question, analysis):
    """Answer with NVIDIA Llama, Gemini fallback, or local logic."""
    provider = os.getenv("AI_PROVIDER", "nvidia").lower()
    if provider == "local":
        return _local_result(question, analysis)
    if provider not in ("nvidia", "gemini"):
        return {
            "answer": _local_answer(question, analysis),
            "model": "StockShield Risk Copilot (local fallback)",
            "source": "local_fallback",
            "provider_error": f"Unsupported AI_PROVIDER: {provider}",
        }
    if provider == "gemini":
        return _answer_with_gemini(question, analysis, os.getenv("GEMINI_API_KEY"))

    nvidia_result = _answer_with_nvidia(question, analysis, os.getenv("NVIDIA_API_KEY"))
    if nvidia_result.get("source") == "nvidia_nim":
        return nvidia_result
    gemini_key = os.getenv("GEMINI_API_KEY")
    if gemini_key:
        gemini_result = _answer_with_gemini(question, analysis, gemini_key)
        if gemini_result.get("source") == "gemini":
            gemini_result["fallback_from"] = "nvidia_nim"
            return gemini_result
        nvidia_result["provider_error"] = (
            f"{nvidia_result.get('provider_error', 'NVIDIA unavailable')}; "
            f"Gemini: {gemini_result.get('provider_error', 'unavailable')}"
        )
    return nvidia_result


def _local_result(question, analysis):
    return {
        "answer": _local_answer(question, analysis),
        "model": "StockShield Risk Copilot (local)",
        "source": "local",
    }


def _build_prompt(question, analysis):
    return (
        "You are StockShield, a concise supply-chain operations assistant. "
        "Use only the supplied inventory analysis. Give practical recommendations "
        "and cite product/region names.\n\n"
        f"Inventory analysis: {json.dumps(analysis, separators=(',', ':'))}\n"
        f"Question: {question}"
    )


def _provider_timeout():
    return float(os.getenv("AI_PROVIDER_TIMEOUT_SECONDS", "60"))


def _answer_with_nvidia(question, analysis, api_key):
    if not api_key:
        return {
            "answer": _local_answer(question, analysis),
            "model": "StockShield Risk Copilot (NVIDIA fallback)",
            "source": "local_fallback",
            "provider_error": "NVIDIA_API_KEY is not configured",
        }
    model = os.getenv("NVIDIA_MODEL", "nvidia/llama-3.1-nemotron-70b-instruct")
    endpoint = os.getenv(
        "NVIDIA_API_URL",
        "https://integrate.api.nvidia.com/v1/chat/completions",
    )
    payload = {
        "model": model,
        "messages": [{"role": "user", "content": _build_prompt(question, analysis)}],
        "temperature": 0.2,
        "max_tokens": 500,
    }
    request = Request(
        endpoint,
        data=json.dumps(payload).encode("utf-8"),
        headers={
            "Content-Type": "application/json",
            "Authorization": f"Bearer {api_key}",
        },
        method="POST",
    )
    try:
        with urlopen(request, timeout=_provider_timeout()) as response:
            result = json.loads(response.read().decode("utf-8"))
        answer = result["choices"][0]["message"]["content"]
        return {"answer": answer, "model": model, "source": "nvidia_nim"}
    except HTTPError as error:
        provider_error = error.read().decode("utf-8", errors="replace")
        return {
            "answer": _local_answer(question, analysis),
            "model": "StockShield Risk Copilot (NVIDIA fallback)",
            "source": "local_fallback",
            "provider_error": f"NVIDIA NIM HTTP {error.code}: {provider_error[:500]}",
        }
    except (
        URLError,
        TimeoutError,
        KeyError,
        IndexError,
        json.JSONDecodeError,
    ) as error:
        return {
            "answer": _local_answer(question, analysis),
            "model": "StockShield Risk Copilot (NVIDIA fallback)",
            "source": "local_fallback",
            "provider_error": str(error),
        }


def _answer_with_gemini(question, analysis, api_key):
    if not api_key:
        return {
            "answer": _local_answer(question, analysis),
            "model": "StockShield Risk Copilot (Gemini fallback)",
            "source": "local_fallback",
            "provider_error": "GEMINI_API_KEY is not configured",
        }
    model = os.getenv("GEMINI_MODEL", "gemini-3.6-flash")
    endpoint = os.getenv(
        "GEMINI_API_URL",
        f"https://generativelanguage.googleapis.com/v1beta/models/{model}:generateContent",
    )
    payload = {
        "contents": [{"parts": [{"text": _build_prompt(question, analysis)}]}],
        "generationConfig": {"temperature": 0.2},
    }
    request = Request(
        f"{endpoint}{'&' if '?' in endpoint else '?'}key={api_key}",
        data=json.dumps(payload).encode("utf-8"),
        headers={"Content-Type": "application/json"},
        method="POST",
    )
    try:
        with urlopen(request, timeout=_provider_timeout()) as response:
            result = json.loads(response.read().decode("utf-8"))
        answer = result["candidates"][0]["content"]["parts"][0]["text"]
        return {"answer": answer, "model": model, "source": "gemini"}
    except HTTPError as error:
        provider_error = error.read().decode("utf-8", errors="replace")
        return {
            "answer": _local_answer(question, analysis),
            "model": "StockShield Risk Copilot (Gemini fallback)",
            "source": "local_fallback",
            "provider_error": f"Gemini HTTP {error.code}: {provider_error[:500]}",
        }
    except (
        URLError,
        TimeoutError,
        KeyError,
        IndexError,
        json.JSONDecodeError,
    ) as error:
        return {
            "answer": _local_answer(question, analysis),
            "model": "StockShield Risk Copilot (Gemini fallback)",
            "source": "local_fallback",
            "provider_error": str(error),
        }
