import { useEffect, useState } from "react";
import "./App.css";

function App() {
  const [analysis, setAnalysis] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [aiInsights, setAiInsights] = useState(null);

  // Recovery simulation
  const [selectedItem, setSelectedItem] = useState(null);
  const [simulation, setSimulation] = useState(null);
  const [simulationLoading, setSimulationLoading] = useState(false);
  const [simulationError, setSimulationError] = useState("");

  // Disruption injection
  const [disruptionType, setDisruptionType] =
    useState("demand_shock");

  const [selectedProduct, setSelectedProduct] =
    useState("");

  const [selectedRegion, setSelectedRegion] =
    useState("");

  const [increasePercentage, setIncreasePercentage] =
    useState(50);

  const [selectedSupplier, setSelectedSupplier] =
    useState("");

  const [delayDays, setDelayDays] =
    useState(3);

  const [disruptionResult, setDisruptionResult] =
    useState(null);

  const [disruptionLoading, setDisruptionLoading] =
    useState(false);

  const [disruptionError, setDisruptionError] =
    useState("");

  // --------------------------------------------------
  // LOAD INVENTORY ANALYSIS
  // --------------------------------------------------

  useEffect(() => {
    fetch("http://127.0.0.1:8000/api/inventory-analysis")
      .then((response) => {
        if (!response.ok) {
          throw new Error(
            "Failed to fetch inventory analysis"
          );
        }

        return response.json();
      })
      .then((data) => {
        setAnalysis(data.analysis || []);
        setLoading(false);
      })
      .catch((error) => {
        console.error(error);

        setError(
          "Failed to connect to StockShield backend"
        );

        setLoading(false);
      });
  }, []);

  useEffect(() => {
    fetch("http://127.0.0.1:8000/api/ai-insights")
      .then((response) => {
        if (!response.ok) {
          throw new Error("Failed to fetch AI insights");
        }
        return response.json();
      })
      .then(setAiInsights)
      .catch((insightError) => {
        console.error(insightError);
      });
  }, []);

  // --------------------------------------------------
  // DASHBOARD CALCULATIONS
  // --------------------------------------------------

  const highRisk = analysis.filter(
    (item) => item.risk_level === "High"
  ).length;

  const criticalRisk = analysis.filter(
    (item) => item.risk_level === "Critical"
  ).length;

  const mediumRisk = analysis.filter(
    (item) => item.risk_level === "Medium"
  ).length;

  const lowRisk = analysis.filter(
    (item) => item.risk_level === "Low"
  ).length;

  const totalLostRevenue = analysis.reduce(
    (total, item) =>
      total + item.expected_lost_revenue,
    0
  );

  const formatCurrency = (value) => {
    return new Intl.NumberFormat("en-IN", {
      style: "currency",
      currency: "INR",
      maximumFractionDigits: 0,
    }).format(value || 0);
  };

  // --------------------------------------------------
  // UNIQUE PRODUCTS
  // --------------------------------------------------

  const products = [
    ...new Map(
      analysis.map((item) => [
        item.product_id,
        {
          id: item.product_id,
          name: item.product_name,
        },
      ])
    ).values(),
  ];

  // --------------------------------------------------
  // UNIQUE REGIONS
  // --------------------------------------------------

  const regions = [
    ...new Map(
      analysis.map((item) => [
        item.region_id,
        {
          id: item.region_id,
          name: item.region_name,
        },
      ])
    ).values(),
  ];

  // --------------------------------------------------
  // UNIQUE SUPPLIERS
  // --------------------------------------------------

  const suppliers = [
    ...new Map(
      analysis.map((item) => [
        item.supplier_id,
        {
          id: item.supplier_id,
          name: item.supplier_name,
        },
      ])
    ).values(),
  ];

  // --------------------------------------------------
  // PRODUCT CLICK → RECOVERY SIMULATION
  // --------------------------------------------------

  const handleProductClick = (item) => {
    setSelectedItem(item);

    setSimulation(null);
    setSimulationError("");
    setSimulationLoading(true);

    fetch(
      `http://127.0.0.1:8000/api/simulate-recovery/${item.product_id}/${item.region_id}`
    )
      .then((response) => {
        if (!response.ok) {
          throw new Error(
            "Failed to fetch recovery strategies"
          );
        }

        return response.json();
      })
      .then((data) => {
        setSimulation(data);
        setSimulationLoading(false);
      })
      .catch((error) => {
        console.error(error);

        setSimulationError(
          "Failed to load recovery strategies"
        );

        setSimulationLoading(false);
      });
  };

  // --------------------------------------------------
  // INJECT DISRUPTION
  // --------------------------------------------------

  const handleInjectDisruption = () => {
    setDisruptionError("");
    setDisruptionResult(null);

    let requestBody = {};

    if (disruptionType === "demand_shock") {
      if (!selectedProduct || !selectedRegion) {
        setDisruptionError(
          "Please select a product and region"
        );

        return;
      }

      requestBody = {
        type: "demand_shock",
        product_id: selectedProduct,
        region_id: selectedRegion,
        increase_percentage:
          Number(increasePercentage),
      };
    }

    if (disruptionType === "supplier_shock") {
      if (!selectedSupplier) {
        setDisruptionError(
          "Please select a supplier"
        );

        return;
      }

      requestBody = {
        type: "supplier_shock",
        supplier_id: selectedSupplier,
        delay_days: Number(delayDays),
      };
    }

    setDisruptionLoading(true);

    fetch(
      "http://127.0.0.1:8000/api/inject-disruption",
      {
        method: "POST",

        headers: {
          "Content-Type": "application/json",
        },

        body: JSON.stringify(requestBody),
      }
    )
      .then((response) => {
        if (!response.ok) {
          throw new Error(
            "Failed to inject disruption"
          );
        }

        return response.json();
      })
      .then((data) => {
        setDisruptionResult(data);
        setDisruptionLoading(false);
      })
      .catch((error) => {
        console.error(error);

        setDisruptionError(
          "Failed to simulate disruption"
        );

        setDisruptionLoading(false);
      });
  };

  // --------------------------------------------------
  // LOADING
  // --------------------------------------------------

  if (loading) {
    return (
      <div className="loading-screen">
        <h1>StockShield</h1>

        <p>
          Analyzing inventory risks...
        </p>
      </div>
    );
  }

  // --------------------------------------------------
  // ERROR
  // --------------------------------------------------

  if (error) {
    return (
      <div className="loading-screen">
        <h1>StockShield</h1>

        <p>{error}</p>
      </div>
    );
  }

  // --------------------------------------------------
  // MAIN UI
  // --------------------------------------------------

  return (
    <div className="app">

      {/* HEADER */}

      <header className="header">

        <div>
          <h1>StockShield</h1>

          <p>
            AI-Powered Supply Chain Risk Intelligence
          </p>
        </div>

        <div className="status">
          ● LIVE ANALYSIS
        </div>

      </header>


      <main className="dashboard">

        {/* HERO */}

        <section className="hero">

          <div>
            <h2>
              Supply Chain Risk Overview
            </h2>

            <p>
              Identify inventory shortages before they
              cause stockouts and revenue loss.
            </p>
          </div>

        </section>


        {/* STATS */}

        <section className="stats-grid">

          <div className="stat-card">

            <p>Total Locations</p>

            <h2>
              {analysis.length}
            </h2>

          </div>


          <div className="stat-card high-card">

            <p>High Risk</p>

            <h2>
              {highRisk}
            </h2>

          </div>


          <div className="stat-card medium-card">

            <p>Medium Risk</p>

            <h2>
              {mediumRisk}
            </h2>

          </div>


          <div className="stat-card low-card">

            <p>Low Risk</p>

            <h2>
              {lowRisk}
            </h2>

          </div>


          <div className="stat-card revenue-card">

            <p>Potential Revenue at Risk</p>

            <h2>
              {formatCurrency(totalLostRevenue)}
            </h2>

          </div>

        </section>

        <section className="insights-grid">
          <div className="visualization-card">
            <div className="section-header">
              <h2>Risk Distribution</h2>
              <p>Locations grouped by current stockout risk.</p>
            </div>
            <div className="risk-chart">
              <div
                className="risk-donut"
                style={{
                  background: `conic-gradient(#ef4444 0 ${criticalRisk / Math.max(analysis.length, 1) * 100}%, #f97316 ${criticalRisk / Math.max(analysis.length, 1) * 100}% ${(criticalRisk + highRisk) / Math.max(analysis.length, 1) * 100}%, #f59e0b ${(criticalRisk + highRisk) / Math.max(analysis.length, 1) * 100}% ${(criticalRisk + highRisk + mediumRisk) / Math.max(analysis.length, 1) * 100}%, #22c55e ${(criticalRisk + highRisk + mediumRisk) / Math.max(analysis.length, 1) * 100}% 100%)`,
                }}
              >
                <strong>{analysis.length}</strong>
                <span>locations</span>
              </div>
              <div className="chart-legend">
                {[
                  ["Critical", criticalRisk, "#ef4444"],
                  ["High", highRisk, "#f97316"],
                  ["Medium", mediumRisk, "#f59e0b"],
                  ["Low", lowRisk, "#22c55e"],
                ].map(([label, value, color]) => (
                  <div key={label}>
                    <span className="legend-dot" style={{ background: color }} />
                    <span>{label}</span>
                    <strong>{value}</strong>
                  </div>
                ))}
              </div>
            </div>
          </div>
          <div className="visualization-card">
            <div className="section-header">
              <h2>Revenue Exposure by Region</h2>
              <p>Modeled lost revenue requiring attention.</p>
            </div>
            <div className="bar-chart">
              {regions.map((region) => {
                const regionExposure = analysis
                  .filter((item) => item.region_id === region.id)
                  .reduce((total, item) => total + item.expected_lost_revenue, 0);
                const maxExposure = Math.max(
                  ...regions.map((candidate) =>
                    analysis
                      .filter((item) => item.region_id === candidate.id)
                      .reduce((total, item) => total + item.expected_lost_revenue, 0)
                  ),
                  1
                );
                return (
                  <div className="bar-row" key={region.id}>
                    <span>{region.name}</span>
                    <div className="bar-track">
                      <div
                        className="bar-fill"
                        style={{ width: `${(regionExposure / maxExposure) * 100}%` }}
                      />
                    </div>
                    <strong>{formatCurrency(regionExposure)}</strong>
                  </div>
                );
              })}
            </div>
          </div>
        </section>

        {aiInsights && (
          <section className="ai-insights">
            <div>
              <span className="ai-eyebrow">✦ {aiInsights.model}</span>
              <h2>AI Operations Brief</h2>
              <p>{aiInsights.summary}</p>
            </div>
            <div className="ai-priorities">
              {aiInsights.priorities.map((priority) => (
                <div className="ai-priority" key={`${priority.product}-${priority.region}`}>
                  <span className={`risk-badge ${priority.risk.toLowerCase()}`}>
                    {priority.risk}
                  </span>
                  <strong>{priority.product} · {priority.region}</strong>
                  <p>{priority.reason}</p>
                </div>
              ))}
            </div>
          </section>
        )}


        {/* INVENTORY TABLE */}

        <section className="risk-section">

          <div className="section-header">

            <div>

              <h2>
                Inventory Risk Analysis
              </h2>

              <p>
                Click any inventory item to generate
                recovery strategies.
              </p>

            </div>

          </div>


          <div className="table-container">

            <table>

              <thead>

                <tr>

                  <th>Product</th>
                  <th>Region</th>
                  <th>Inventory</th>
                  <th>Daily Demand</th>
                  <th>Days Left</th>
                  <th>Supplier</th>
                  <th>Risk</th>
                  <th>Revenue at Risk</th>

                </tr>

              </thead>


              <tbody>

                {analysis.map((item) => (

                  <tr
                    key={`${item.product_id}-${item.region_id}`}
                    onClick={() =>
                      handleProductClick(item)
                    }
                    style={{
                      cursor: "pointer",
                    }}
                  >

                    <td className="product-name">
                      {item.product_name}
                    </td>


                    <td>
                      {item.region_name}
                    </td>


                    <td>
                      {item.current_inventory}
                    </td>


                    <td>
                      {item.daily_demand}
                    </td>


                    <td>
                      {item.days_of_stock.toFixed(1)} days
                    </td>


                    <td>
                      {item.supplier_name}
                    </td>


                    <td>

                      <span
                        className={`risk-badge ${item.risk_level.toLowerCase()}`}
                      >
                        {item.risk_level}
                      </span>

                    </td>


                    <td className="revenue">

                      {formatCurrency(
                        item.expected_lost_revenue
                      )}

                    </td>

                  </tr>

                ))}

              </tbody>

            </table>

          </div>

        </section>


        {/* RECOVERY STRATEGIES */}

        {selectedItem && (

          <section className="recovery-section">

            <div className="section-header">

              <h2>
                Recovery Strategy Intelligence
              </h2>

              <p>

                Recovery options for{" "}

                <strong>
                  {selectedItem.product_name}
                </strong>

                {" "}in{" "}

                <strong>
                  {selectedItem.region_name}
                </strong>

              </p>

            </div>


            {simulationLoading && (

              <div className="simulation-loading">

                <p>
                  Analyzing recovery strategies...
                </p>

              </div>

            )}


            {simulationError && (

              <div className="simulation-error">

                <p>
                  {simulationError}
                </p>

              </div>

            )}


            {simulation &&
              simulation.recommended_strategy && (

              <>

                <div className="recommended-card">

                  <h3>
                    🏆 Recommended Strategy
                  </h3>


                  <h2>
                    {
                      simulation.recommended_strategy
                        .strategy
                    }
                  </h2>


                  <p>
                    {
                      simulation.recommended_strategy
                        .description
                    }
                  </p>


                  <div className="recommendation-details">

                    <div>

                      <span>
                        Recovery Cost
                      </span>

                      <strong>

                        {formatCurrency(
                          simulation
                            .recommended_strategy
                            .recovery_cost
                        )}

                      </strong>

                    </div>


                    <div>

                      <span>
                        Arrival Time
                      </span>

                      <strong>

                        {
                          simulation
                            .recommended_strategy
                            .arrival_days
                        } days

                      </strong>

                    </div>


                    <div>

                      <span>
                        Quantity
                      </span>

                      <strong>

                        {
                          simulation
                            .recommended_strategy
                            .recovery_quantity
                        } units

                      </strong>

                    </div>


                    <div>

                      <span>
                        Net Benefit
                      </span>

                      <strong>

                        {formatCurrency(
                          simulation
                            .recommended_strategy
                            .net_benefit
                        )}

                      </strong>

                    </div>

                  </div>

                </div>


                <div className="strategies-grid">

                  {simulation.strategy_comparison?.map(
                    (strategy, index) => (

                      <div
                        className="strategy-card"
                        key={index}
                      >

                        <h3>
                          {strategy.strategy}
                        </h3>


                        <p>
                          {strategy.description}
                        </p>


                        <div className="strategy-info">

                          <p>

                            <strong>
                              Cost:
                            </strong>{" "}

                            {formatCurrency(
                              strategy.recovery_cost
                            )}

                          </p>


                          <p>

                            <strong>
                              Arrival:
                            </strong>{" "}

                            {strategy.arrival_days} days

                          </p>


                          <p>

                            <strong>
                              Quantity:
                            </strong>{" "}

                            {strategy.recovery_quantity} units

                          </p>


                          <p>

                            <strong>
                              Net Benefit:
                            </strong>{" "}

                            {formatCurrency(
                              strategy.net_benefit
                            )}

                          </p>

                        </div>

                      </div>

                    )
                  )}

                </div>

              </>

            )}

          </section>

        )}


        {/* DISRUPTION INJECTION */}

        <section className="disruption-section">

          <div className="section-header">

            <h2>
              ⚠ Inject Supply Chain Disruption
            </h2>

            <p>
              Simulate a real-world disruption and let
              StockShield automatically generate a new
              recovery plan.
            </p>

          </div>


          <div className="disruption-form">


            {/* DISRUPTION TYPE */}

            <div className="form-group">

              <label>
                Disruption Type
              </label>


              <select
                value={disruptionType}
                onChange={(event) =>
                  setDisruptionType(
                    event.target.value
                  )
                }
              >

                <option value="demand_shock">
                  Demand Shock
                </option>

                <option value="supplier_shock">
                  Supplier Delay
                </option>

              </select>

            </div>


            {/* DEMAND SHOCK */}

            {disruptionType ===
              "demand_shock" && (

              <>

                <div className="form-group">

                  <label>
                    Product
                  </label>


                  <select
                    value={selectedProduct}
                    onChange={(event) =>
                      setSelectedProduct(
                        event.target.value
                      )
                    }
                  >

                    <option value="">
                      Select Product
                    </option>


                    {products.map((product) => (

                      <option
                        key={product.id}
                        value={product.id}
                      >

                        {product.name}

                      </option>

                    ))}

                  </select>

                </div>


                <div className="form-group">

                  <label>
                    Region
                  </label>


                  <select
                    value={selectedRegion}
                    onChange={(event) =>
                      setSelectedRegion(
                        event.target.value
                      )
                    }
                  >

                    <option value="">
                      Select Region
                    </option>


                    {regions.map((region) => (

                      <option
                        key={region.id}
                        value={region.id}
                      >

                        {region.name}

                      </option>

                    ))}

                  </select>

                </div>


                <div className="form-group">

                  <label>
                    Demand Increase (%)
                  </label>


                  <input
                    type="number"
                    value={increasePercentage}
                    onChange={(event) =>
                      setIncreasePercentage(
                        event.target.value
                      )
                    }
                  />

                </div>

              </>

            )}


            {/* SUPPLIER SHOCK */}

            {disruptionType ===
              "supplier_shock" && (

              <>

                <div className="form-group">

                  <label>
                    Supplier
                  </label>


                  <select
                    value={selectedSupplier}
                    onChange={(event) =>
                      setSelectedSupplier(
                        event.target.value
                      )
                    }
                  >

                    <option value="">
                      Select Supplier
                    </option>


                    {suppliers.map((supplier) => (

                      <option
                        key={supplier.id}
                        value={supplier.id}
                      >

                        {supplier.name}

                      </option>

                    ))}

                  </select>

                </div>


                <div className="form-group">

                  <label>
                    Delay (Days)
                  </label>


                  <input
                    type="number"
                    value={delayDays}
                    onChange={(event) =>
                      setDelayDays(
                        event.target.value
                      )
                    }
                  />

                </div>

              </>

            )}


            {/* BUTTON */}

            <button
              className="inject-button"
              onClick={handleInjectDisruption}
              disabled={disruptionLoading}
            >

              {disruptionLoading
                ? "Analyzing Disruption..."
                : "Inject Disruption & Replan"}

            </button>

          </div>


          {/* ERROR */}

          {disruptionError && (

            <div className="simulation-error">

              <p>
                {disruptionError}
              </p>

            </div>

          )}


          {/* DISRUPTION RESULT */}

          {disruptionResult && (

            <div className="disruption-result">

              <h2>
                🚨 Disruption Detected
              </h2>


              <p>
                {
                  disruptionResult.status
                }
              </p>


              <div className="disruption-info">

                <div>

                  <span>
                    Affected Product
                  </span>

                  <strong>
                    {
                      disruptionResult
                        .affected_product_id
                    }
                  </strong>

                </div>


                <div>

                  <span>
                    Affected Region
                  </span>

                  <strong>
                    {
                      disruptionResult
                        .affected_region_id
                    }
                  </strong>

                </div>


                <div>

                  <span>
                    Strategies Compared
                  </span>

                  <strong>
                    {
                      disruptionResult
                        .strategies_compared
                    }
                  </strong>

                </div>

              </div>


              {disruptionResult
                .recommended_strategy && (

                <div className="disruption-recommendation">

                  <h3>
                    🏆 New Recommended Recovery Plan
                  </h3>


                  <h2>

                    {
                      disruptionResult
                        .recommended_strategy
                        .strategy
                    }

                  </h2>


                  <p>

                    {
                      disruptionResult
                        .recommended_strategy
                        .description
                    }

                  </p>


                  <div className="recommendation-details">

                    <div>

                      <span>
                        Revenue Protected
                      </span>

                      <strong>

                        {formatCurrency(

                          disruptionResult
                            .recommended_strategy
                            .revenue_protected

                        )}

                      </strong>

                    </div>


                    <div>

                      <span>
                        Recovery Cost
                      </span>

                      <strong>

                        {formatCurrency(

                          disruptionResult
                            .recommended_strategy
                            .recovery_cost

                        )}

                      </strong>

                    </div>


                    <div>

                      <span>
                        Net Benefit
                      </span>

                      <strong>

                        {formatCurrency(

                          disruptionResult
                            .recommended_strategy
                            .net_benefit

                        )}

                      </strong>

                    </div>

                  </div>

                </div>

              )}

            </div>

          )}

        </section>

      </main>

    </div>
  );
}

export default App;