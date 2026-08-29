from database import load_data


def get_product(product_id, products):
    """
    Find a product by ID.
    """

    return next(
        product
        for product in products
        if product["id"] == product_id
    )


def get_region(region_id, regions):
    """
    Find a region by ID.
    """

    return next(
        region
        for region in regions
        if region["id"] == region_id
    )


def get_supplier(supplier_id, suppliers):
    """
    Find a supplier by ID.
    """

    return next(
        supplier
        for supplier in suppliers
        if supplier["id"] == supplier_id
    )


def get_regional_daily_demand(
    product,
    region,
    disruption=None
):
    """
    Calculate daily demand for a product in a region.

    If a demand shock affects this product and region,
    apply the disruption multiplier.
    """

    daily_demand = (
        product["daily_demand"]
        * region["demand_multiplier"]
    )

    disruptions = disruption if isinstance(disruption, list) else [disruption]
    for current_disruption in disruptions:
        if (
            current_disruption
            and current_disruption["type"] == "demand_shock"
            and current_disruption.get("product_id") == product["id"]
            and current_disruption.get("region_id") == region["id"]
        ):
            daily_demand *= current_disruption["shock_multiplier"]

    return round(daily_demand, 2)


def calculate_days_of_stock(
    quantity,
    daily_demand
):
    """
    Calculate how many days the current inventory will last.
    """

    if daily_demand <= 0:
        return 0

    return round(
        quantity / daily_demand,
        2
    )


def calculate_stockout_risk(
    days_of_stock,
    supplier_lead_time
):
    """
    Calculate inventory risk based on whether stock
    will last until the supplier can replenish it.
    """

    if days_of_stock <= 0:
        return "Critical"

    if days_of_stock < supplier_lead_time:
        return "High"

    if days_of_stock < supplier_lead_time * 1.5:
        return "Medium"

    return "Low"


def calculate_lost_revenue(
    current_inventory,
    forecast_demand,
    product_price
):
    """
    Estimate potential revenue loss caused by insufficient stock.
    """

    shortage_units = max(
        forecast_demand - current_inventory,
        0
    )

    expected_lost_revenue = (
        shortage_units * product_price
    )

    return {
        "shortage_units": round(
            shortage_units,
            2
        ),
        "expected_lost_revenue": round(
            expected_lost_revenue,
            2
        )
    }


def analyze_inventory(
    data=None,
    disruption=None
):
    """
    Analyze all inventory records and calculate
    demand, stock coverage, stockout risk,
    and potential revenue loss.
    """

    if data is None:
        data = load_data()

    products = data["products"]
    regions = data["regions"]
    suppliers = data["suppliers"]
    inventory = data["inventory"]

    analysis_results = []

    for item in inventory:

        product = get_product(
            item["product_id"],
            products
        )

        region = get_region(
            item["region_id"],
            regions
        )

        supplier = get_supplier(
            item["supplier_id"],
            suppliers
        )

        daily_demand = get_regional_daily_demand(
            product,
            region,
            disruption
        )

        days_of_stock = calculate_days_of_stock(
            item["quantity"],
            daily_demand
        )

        supplier_lead_time = (
            supplier["lead_time_days"]
        )

        # Apply supplier disruption
        disruptions = disruption if isinstance(disruption, list) else [disruption]
        supplier_lead_time += sum(
            current_disruption["delay_days"]
            for current_disruption in disruptions
            if (
                current_disruption
                and current_disruption["type"] == "supplier_shock"
                and current_disruption.get("supplier_id") == supplier["id"]
            )
        )

        risk_level = calculate_stockout_risk(
            days_of_stock,
            supplier_lead_time
        )

        # Forecast demand during supplier lead time
        forecast_demand = (
            daily_demand
            * supplier_lead_time
        )

        revenue_risk = calculate_lost_revenue(
            item["quantity"],
            forecast_demand,
            product["price"]
        )

        analysis_results.append({
            "product_id": product["id"],
            "product_name": product["name"],

            "region_id": region["id"],
            "region_name": region["name"],

            "supplier_id": supplier["id"],
            "supplier_name": supplier["name"],

            "current_inventory": item["quantity"],
            "capacity": item["capacity"],

            "daily_demand": daily_demand,

            "days_of_stock": days_of_stock,

            "supplier_lead_time_days":
                supplier_lead_time,

            "risk_level": risk_level,

            "shortage_units":
                revenue_risk["shortage_units"],

            "expected_lost_revenue":
                revenue_risk[
                    "expected_lost_revenue"
                ]
        })

    # Critical risks first
    risk_priority = {
        "Critical": 0,
        "High": 1,
        "Medium": 2,
        "Low": 3
    }

    analysis_results.sort(
        key=lambda item: (
            risk_priority[item["risk_level"]],
            -item["expected_lost_revenue"]
        )
    )

    return analysis_results