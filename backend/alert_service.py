import json
import os
from urllib.error import HTTPError, URLError
from urllib.request import Request, urlopen


def generate_alerts(analysis, revenue_threshold=100000):
    """Build actionable in-app alerts from the current risk analysis."""
    alerts = []
    for item in analysis:
        if item["risk_level"] in ("Critical", "High"):
            alerts.append(
                {
                    "severity": item["risk_level"],
                    "title": f"{item['risk_level']} stockout risk",
                    "message": (
                        f"{item['product_name']} in {item['region_name']} has "
                        f"{item['days_of_stock']:.1f} days of stock against a "
                        f"{item['supplier_lead_time_days']}-day supplier lead time."
                    ),
                    "product_id": item["product_id"],
                    "region_id": item["region_id"],
                    "expected_lost_revenue": item["expected_lost_revenue"],
                }
            )

    total_exposure = sum(item["expected_lost_revenue"] for item in analysis)
    if total_exposure >= revenue_threshold:
        alerts.insert(
            0,
            {
                "severity": "High",
                "title": "Revenue exposure threshold exceeded",
                "message": (
                    f"Modeled exposure is ₹{total_exposure:,.0f}, above the "
                    f"₹{revenue_threshold:,.0f} alert threshold."
                ),
                "product_id": None,
                "region_id": None,
                "expected_lost_revenue": total_exposure,
            },
        )

    return {
        "alerts": alerts,
        "count": len(alerts),
        "critical_count": sum(alert["severity"] == "Critical" for alert in alerts),
    }


def send_alert_digest(alert_data):
    """Send alerts to an optional Slack/Teams-compatible incoming webhook."""
    webhook_url = os.getenv("ALERT_WEBHOOK_URL")
    if not webhook_url:
        return {
            "sent": False,
            "message": "ALERT_WEBHOOK_URL is not configured.",
        }

    lines = [
        f"*StockShield alert digest* — {alert_data['count']} active alert(s)",
    ]
    lines.extend(
        f"- {alert['severity']}: {alert['title']} — {alert['message']}"
        for alert in alert_data["alerts"][:10]
    )
    request = Request(
        webhook_url,
        data=json.dumps({"text": "\n".join(lines)}).encode("utf-8"),
        headers={"Content-Type": "application/json"},
        method="POST",
    )
    try:
        with urlopen(request, timeout=10) as response:
            if response.status < 200 or response.status >= 300:
                raise RuntimeError(f"Webhook returned HTTP {response.status}")
        return {"sent": True, "message": "Alert digest sent successfully."}
    except (HTTPError, URLError, TimeoutError, RuntimeError) as error:
        return {"sent": False, "message": f"Unable to send alert digest: {error}"}
