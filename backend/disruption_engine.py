from copy import deepcopy

from risk_engine import load_data


def create_base_scenario():
    """
    Load a fresh copy of the inventory data.

    Every disruption starts from the original baseline.
    """
    return deepcopy(load_data())


def apply_demand_shock(
    data,
    product_id,
    region_id,
    increase_percentage
):
    """
    Apply a demand shock to one product in one region.

    Example:
    increase_percentage = 80
    means demand increases by 80%.
    """

    disrupted_data = deepcopy(data)

    for region in disrupted_data["regions"]:
        if region["id"] == region_id:

            original_multiplier = region["demand_multiplier"]

            # Product-specific shock information is stored
            # separately because changing the region multiplier
            # would affect every product in that region.
            shock_multiplier = 1 + (
                increase_percentage / 100
            )

            return {
                "data": disrupted_data,
                "disruption": {
                    "type": "demand_shock",
                    "product_id": product_id,
                    "region_id": region_id,
                    "increase_percentage": increase_percentage,
                    "shock_multiplier": shock_multiplier,
                    "original_region_multiplier": original_multiplier
                }
            }

    raise ValueError("Region not found")


def apply_supplier_shock(
    data,
    supplier_id,
    delay_days
):
    """
    Apply a supplier disruption.

    Example:
    delay_days = 7
    means supplier deliveries are delayed by 7 days.
    """

    disrupted_data = deepcopy(data)

    for supplier in disrupted_data["suppliers"]:
        if supplier["id"] == supplier_id:

            original_lead_time = supplier["lead_time_days"]

            supplier["lead_time_days"] += delay_days

            # Reliability decreases when a major disruption occurs
            supplier["reliability"] = max(
                supplier["reliability"] - 0.15,
                0.1
            )

            return {
                "data": disrupted_data,
                "disruption": {
                    "type": "supplier_shock",
                    "supplier_id": supplier_id,
                    "delay_days": delay_days,
                    "original_lead_time_days": original_lead_time,
                    "new_lead_time_days": supplier[
                        "lead_time_days"
                    ]
                }
            }

    raise ValueError("Supplier not found")


def inject_disruption(disruption_request):
    """
    Main entry point for judge-injected disruptions.

    Supported types:

    1. demand_shock
    2. supplier_shock
    """

    data = create_base_scenario()

    disruption_type = disruption_request.get("type")

    if disruption_type == "demand_shock":

        return apply_demand_shock(
            data=data,
            product_id=disruption_request["product_id"],
            region_id=disruption_request["region_id"],
            increase_percentage=disruption_request[
                "increase_percentage"
            ]
        )

    elif disruption_type == "supplier_shock":

        return apply_supplier_shock(
            data=data,
            supplier_id=disruption_request["supplier_id"],
            delay_days=disruption_request["delay_days"]
        )

    else:
        raise ValueError(
            "Unsupported disruption type. "
            "Use demand_shock or supplier_shock."
        )