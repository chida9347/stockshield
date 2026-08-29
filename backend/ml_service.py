from collections import defaultdict


def _linear_forecast(values, horizon=7):
    """Fit a least-squares trend and forecast the next demand observations."""
    count = len(values)
    if count == 0:
        return 0, 0
    if count == 1:
        return round(values[0], 2), 0

    x_mean = (count - 1) / 2
    y_mean = sum(values) / count
    denominator = sum((index - x_mean) ** 2 for index in range(count))
    slope = sum(
        (index - x_mean) * (value - y_mean)
        for index, value in enumerate(values)
    ) / denominator
    intercept = y_mean - slope * x_mean
    forecast = max(intercept + slope * (count + horizon - 1), 0)
    residuals = [
        value - (intercept + slope * index)
        for index, value in enumerate(values)
    ]
    error = (sum(residual * residual for residual in residuals) / count) ** 0.5
    return round(forecast, 2), round(error, 2)


def forecast_demand(history, products, regions):
    grouped = defaultdict(list)
    for observation in history:
        grouped[(observation["product_id"], observation["region_id"])].append(
            observation["demand"]
        )
    product_names = {product["id"]: product["name"] for product in products}
    region_names = {region["id"]: region["name"] for region in regions}
    forecasts = []
    for (product_id, region_id), values in grouped.items():
        predicted, error = _linear_forecast(values)
        forecasts.append(
            {
                "product_id": product_id,
                "product_name": product_names[product_id],
                "region_id": region_id,
                "region_name": region_names[region_id],
                "predicted_daily_demand": predicted,
                "forecast_error": error,
                "training_observations": len(values),
                "model": "Linear demand trend",
            }
        )
    return forecasts
