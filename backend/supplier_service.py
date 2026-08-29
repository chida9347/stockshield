def build_supplier_scorecards(data, analysis):
    """Rank suppliers using reliability, speed, and observed risk exposure."""
    analysis_by_supplier = {}
    for item in analysis:
        summary = analysis_by_supplier.setdefault(
            item["supplier_id"],
            {"locations": 0, "high_risk": 0, "revenue": 0},
        )
        summary["locations"] += 1
        summary["high_risk"] += item["risk_level"] in ("Critical", "High")
        summary["revenue"] += item["expected_lost_revenue"]

    scorecards = []
    for supplier in data["suppliers"]:
        summary = analysis_by_supplier.get(
            supplier["id"], {"locations": 0, "high_risk": 0, "revenue": 0}
        )
        reliability_score = supplier["reliability"] * 60
        speed_score = max(0, 30 - supplier["lead_time_days"] * 2)
        risk_penalty = min(summary["high_risk"] * 5, 10)
        score = round(max(reliability_score + speed_score - risk_penalty, 0), 1)
        scorecards.append(
            {
                "supplier_id": supplier["id"],
                "supplier_name": supplier["name"],
                "reliability": supplier["reliability"],
                "lead_time_days": supplier["lead_time_days"],
                "managed_locations": summary["locations"],
                "high_risk_locations": summary["high_risk"],
                "revenue_exposure": round(summary["revenue"], 2),
                "performance_score": score,
                "risk_level": (
                    "High"
                    if summary["high_risk"] > 0 or score < 55
                    else "Medium"
                    if score < 75
                    else "Low"
                ),
                "recommendation": (
                    "Preferred for urgent replenishment"
                    if score >= 70
                    else "Review capacity and delivery reliability"
                ),
            }
        )
    return sorted(scorecards, key=lambda item: item["performance_score"], reverse=True)
