from risk_engine import (
    load_data,
    get_product,
    get_region,
    get_supplier,
    get_regional_daily_demand
)


def generate_reorder_strategy(
    item,
    product,
    region,
    supplier,
    disruption=None
):
    """
    Strategy 1:
    Reorder inventory from the current supplier.
    """

    daily_demand = get_regional_daily_demand(
        product,
        region,
        disruption
    )

    target_days = 14

    target_stock = daily_demand * target_days

    reorder_quantity = max(
        target_stock - item["quantity"],
        0
    )

    reorder_quantity = min(
        reorder_quantity,
        item["capacity"] - item["quantity"]
    )

    arrival_days = supplier["lead_time_days"]

    # Apply supplier disruption delay
    if (
        disruption
        and disruption["type"] == "supplier_shock"
        and disruption.get("supplier_id") == supplier["id"]
    ):
        arrival_days += disruption["delay_days"]

    return {
        "strategy": "Reorder",
        "description": (
            f"Order {round(reorder_quantity)} units "
            f"from {supplier['name']}"
        ),
        "supplier": supplier["name"],
        "quantity": round(reorder_quantity),
        "arrival_days": arrival_days,
        "estimated_cost": round(
            reorder_quantity * product["price"] * 0.65,
            2
        )
    }


def generate_supplier_switch_strategy(
    item,
    product,
    region,
    suppliers,
    disruption=None
):
    """
    Strategy 2:
    Switch to the fastest alternative supplier.
    """

    alternative_suppliers = [
        supplier
        for supplier in suppliers
        if supplier["id"] != item["supplier_id"]
    ]

    if not alternative_suppliers:
        return None

    best_supplier = min(
        alternative_suppliers,
        key=lambda supplier: supplier["lead_time_days"]
    )

    daily_demand = get_regional_daily_demand(
        product,
        region,
        disruption
    )

    target_days = 14

    target_stock = daily_demand * target_days

    order_quantity = max(
        target_stock - item["quantity"],
        0
    )

    order_quantity = min(
        order_quantity,
        item["capacity"] - item["quantity"]
    )

    return {
        "strategy": "Switch Supplier",
        "description": (
            f"Order {round(order_quantity)} units "
            f"from {best_supplier['name']} instead"
        ),
        "supplier": best_supplier["name"],
        "quantity": round(order_quantity),
        "arrival_days": best_supplier["lead_time_days"],
        "estimated_cost": round(
            order_quantity * product["price"] * 0.70,
            2
        )
    }


def generate_transfer_strategy(
    item,
    product,
    region,
    inventory,
    regions,
    disruption=None
):
    """
    Strategy 3:
    Transfer excess inventory from another region.
    """

    candidates = []

    for other_item in inventory:

        if (
            other_item["product_id"] == item["product_id"]
            and other_item["region_id"] != item["region_id"]
        ):

            other_region = get_region(
                other_item["region_id"],
                regions
            )

            other_daily_demand = (
                get_regional_daily_demand(
                    product,
                    other_region,
                    disruption
                )
            )

            safety_stock = other_daily_demand * 5

            transferable_units = max(
                other_item["quantity"] - safety_stock,
                0
            )

            if transferable_units > 0:
                candidates.append({
                    "region": other_region["name"],
                    "quantity": transferable_units
                })

    if not candidates:
        return None

    best_source = max(
        candidates,
        key=lambda candidate: candidate["quantity"]
    )

    daily_demand = get_regional_daily_demand(
        product,
        region,
        disruption
    )

    required_stock = daily_demand * 7

    needed_units = max(
        required_stock - item["quantity"],
        0
    )

    transfer_quantity = min(
        best_source["quantity"],
        needed_units
    )

    if transfer_quantity <= 0:
        return None

    return {
        "strategy": "Transfer Inventory",
        "description": (
            f"Transfer {round(transfer_quantity)} units "
            f"from {best_source['region']}"
        ),
        "source_region": best_source["region"],
        "quantity": round(transfer_quantity),
        "arrival_days": 1,
        "estimated_cost": round(
            transfer_quantity * product["price"] * 0.05,
            2
        )
    }


def generate_reallocation_strategy(
    item,
    product,
    region,
    inventory,
    regions,
    disruption=None
):
    """
    Strategy 4:
    Reallocate inventory from multiple regions.
    """

    daily_demand = get_regional_daily_demand(
        product,
        region,
        disruption
    )

    required_stock = daily_demand * 7

    needed_units = max(
        required_stock - item["quantity"],
        0
    )

    if needed_units <= 0:
        return None

    allocations = []
    total_available = 0

    for other_item in inventory:

        if (
            other_item["product_id"] == item["product_id"]
            and other_item["region_id"] != item["region_id"]
        ):

            other_region = get_region(
                other_item["region_id"],
                regions
            )

            other_demand = get_regional_daily_demand(
                product,
                other_region,
                disruption
            )

            safety_stock = other_demand * 4

            available = max(
                other_item["quantity"] - safety_stock,
                0
            )

            if available > 0:

                remaining_needed = (
                    needed_units - total_available
                )

                allocation = min(
                    available,
                    remaining_needed
                )

                if allocation > 0:

                    allocations.append({
                        "from_region": other_region["name"],
                        "quantity": round(allocation)
                    })

                    total_available += allocation

            if total_available >= needed_units:
                break

    if total_available <= 0:
        return None

    return {
        "strategy": "Reallocate Inventory",
        "description": (
            f"Reallocate {round(total_available)} units "
            f"from multiple regions"
        ),
        "allocations": allocations,
        "quantity": round(total_available),
        "arrival_days": 1,
        "estimated_cost": round(
            total_available * product["price"] * 0.07,
            2
        )
    }


def generate_recovery_strategies(
    product_id,
    region_id,
    data=None,
    disruption=None
):
    """
    Generate recovery strategies using either
    baseline data or disrupted scenario data.
    """

    if data is None:
        data = load_data()

    products = data["products"]
    regions = data["regions"]
    suppliers = data["suppliers"]
    inventory = data["inventory"]

    item = next(
        item
        for item in inventory
        if (
            item["product_id"] == product_id
            and item["region_id"] == region_id
        )
    )

    product = get_product(
        product_id,
        products
    )

    region = get_region(
        region_id,
        regions
    )

    supplier = get_supplier(
        item["supplier_id"],
        suppliers
    )

    strategies = []

    # Strategy 1: Reorder
    reorder_strategy = generate_reorder_strategy(
        item,
        product,
        region,
        supplier,
        disruption
    )

    strategies.append(reorder_strategy)

    # Strategy 2: Switch supplier
    supplier_switch_strategy = (
        generate_supplier_switch_strategy(
            item,
            product,
            region,
            suppliers,
            disruption
        )
    )

    if supplier_switch_strategy:
        strategies.append(
            supplier_switch_strategy
        )

    # Strategy 3: Transfer inventory
    transfer_strategy = generate_transfer_strategy(
        item,
        product,
        region,
        inventory,
        regions,
        disruption
    )

    if transfer_strategy:
        strategies.append(
            transfer_strategy
        )

    # Strategy 4: Reallocate inventory
    reallocation_strategy = (
        generate_reallocation_strategy(
            item,
            product,
            region,
            inventory,
            regions,
            disruption
        )
    )

    if reallocation_strategy:
        strategies.append(
            reallocation_strategy
        )

    return strategies