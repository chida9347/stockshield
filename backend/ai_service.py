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
