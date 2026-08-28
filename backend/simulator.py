from risk_engine import (
    load_data,
    get_product,
    calculate_lost_revenue
)


def get_region(region_id, regions):
    return next(
        region
        for region in regions
        if region["id"] == region_id
    )


def get_regional_daily_demand(
    product,
    region,
    disruption=None
):
    """
    Calculate daily demand for a product in a region,
    including an optional demand shock.
    """

    daily_demand = (
        product["daily_demand"]
        * region["demand_multiplier"]
    )

    if (
        disruption
        and disruption["type"] == "demand_shock"
        and disruption.get("product_id") == product["id"]
        and disruption.get("region_id") == region["id"]
    ):
        daily_demand *= disruption["shock_multiplier"]

    return round(daily_demand, 2)


def simulate_strategy(
    product_id,
    region_id,
    strategy,
    simulation_days=7,
    data=None,
    disruption=None
):
    """
    Simulate one recovery strategy using either
    baseline data or a disrupted scenario.
    """

    if data is None:
        data = load_data()

    products = data["products"]
    regions = data["regions"]
    inventory = data["inventory"]

    product = get_product(
        product_id,
        products
    )

    region = get_region(
        region_id,
        regions
    )

    item = next(
        item
        for item in inventory
        if (
            item["product_id"] == product_id
            and item["region_id"] == region_id
        )
    )

    daily_demand = get_regional_daily_demand(
        product,
        region,
        disruption
    )

    current_inventory = item["quantity"]

    arrival_days = min(
        strategy["arrival_days"],
        simulation_days
    )

    # Demand before recovery arrives
    demand_before_arrival = (
        daily_demand * arrival_days
    )

    shortage_before_arrival = max(
        demand_before_arrival - current_inventory,
        0
    )

    lost_revenue_before_arrival = (
        shortage_before_arrival
        * product["price"]
    )

    # Inventory remaining when recovery arrives
    remaining_inventory = max(
        current_inventory - demand_before_arrival,
        0
    )

    # Add recovered inventory
    recovered_inventory = (
        remaining_inventory
        + strategy["quantity"]
    )

    # Demand after recovery arrives
    remaining_days = max(
        simulation_days - arrival_days,
        0
    )

    demand_after_arrival = (
        daily_demand * remaining_days
    )

    shortage_after_arrival = max(
        demand_after_arrival
        - recovered_inventory,
        0
    )

    lost_revenue_after_arrival = (
        shortage_after_arrival
        * product["price"]
    )

    total_lost_revenue = (
        lost_revenue_before_arrival
        + lost_revenue_after_arrival
    )

    # Baseline scenario: no recovery action
    total_forecast_demand = (
        daily_demand * simulation_days
    )

    baseline_revenue_risk = calculate_lost_revenue(
        current_inventory,
        total_forecast_demand,
        product["price"]
    )

    baseline_lost_revenue = (
        baseline_revenue_risk[
            "expected_lost_revenue"
        ]
    )

    # Revenue protected by this strategy
    revenue_protected = max(
        baseline_lost_revenue
        - total_lost_revenue,
        0
    )

    recovery_cost = strategy["estimated_cost"]

    net_benefit = (
        revenue_protected
        - recovery_cost
    )

    # Score used for ranking strategies
    outcome_score = max(
        net_benefit,
        0
    )

    return {
        "strategy": strategy["strategy"],
        "description": strategy["description"],

        "arrival_days": arrival_days,
        "recovery_quantity": strategy["quantity"],

        "daily_demand": daily_demand,
        "simulation_days": simulation_days,

        "shortage_before_recovery": round(
            shortage_before_arrival,
            2
        ),

        "shortage_after_recovery": round(
            shortage_after_arrival,
            2
        ),

        "total_expected_lost_revenue": round(
            total_lost_revenue,
            2
        ),

        "baseline_lost_revenue": round(
            baseline_lost_revenue,
            2
        ),

        "revenue_protected": round(
            revenue_protected,
            2
        ),

        "recovery_cost": round(
            recovery_cost,
            2
        ),

        "net_benefit": round(
            net_benefit,
            2
        ),

        "recovery_outcome_score": round(
            outcome_score,
            2
        )
    }


def simulate_all_strategies(
    product_id,
    region_id,
    strategies,
    simulation_days=7,
    data=None,
    disruption=None
):
    """
    Simulate all strategies and rank them by net benefit.
    """

    results = []

    for strategy in strategies:

        result = simulate_strategy(
            product_id=product_id,
            region_id=region_id,
            strategy=strategy,
            simulation_days=simulation_days,
            data=data,
            disruption=disruption
        )

        results.append(result)

    # Best strategy first
    results.sort(
        key=lambda result: result["net_benefit"],
        reverse=True
    )

    return results