import { useEffect, useRef, useState } from "react";
import "./App.css";

const API_URL = (import.meta.env.VITE_API_URL || "http://127.0.0.1:8000").replace(/\/$/, "");

function App() {
  const [analysis, setAnalysis] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [aiInsights, setAiInsights] = useState(null);
  const [history, setHistory] = useState([]);
  const [hoveredHistoryPoint, setHoveredHistoryPoint] = useState(null);
  const [aiQuestion, setAiQuestion] = useState("");
  const [aiAnswer, setAiAnswer] = useState(null);
  const [aiLoading, setAiLoading] = useState(false);
  const [alerts, setAlerts] = useState([]);
  const [notificationMessage, setNotificationMessage] = useState("");
  const [forecasts, setForecasts] = useState([]);
  const [activePage, setActivePage] = useState("overview");
  const [assistantOpen, setAssistantOpen] = useState(false);
  const [assistantPosition, setAssistantPosition] = useState({
    right: 24,
    bottom: 24,
  });
  const [draggingAssistant, setDraggingAssistant] = useState(false);
  const assistantMovedRef = useRef(false);
  const [user, setUser] = useState(
    JSON.parse(localStorage.getItem("stockshield_user") || "null")
  );
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [loginError, setLoginError] = useState("");
  const [loginRole, setLoginRole] = useState("admin");
  const [editQuantity, setEditQuantity] = useState("");
  const [editCapacity, setEditCapacity] = useState("");
  const [profileOpen, setProfileOpen] = useState(false);
  const [passwordChangeOpen, setPasswordChangeOpen] = useState(false);
  const [passwordForm, setPasswordForm] = useState({ current: "", next: "" });
  const [passwordMessage, setPasswordMessage] = useState("");

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
  const [scenarioResult, setScenarioResult] = useState(null);
  const [scenarioLoading, setScenarioLoading] = useState(false);
  const [recoveryPlans, setRecoveryPlans] = useState([]);
  const [supplierScorecards, setSupplierScorecards] = useState([]);
  const [importMessage, setImportMessage] = useState("");

  // --------------------------------------------------
  // LOAD INVENTORY ANALYSIS
  // --------------------------------------------------

  useEffect(() => {
    fetch(`${API_URL}/api/inventory-analysis`)
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
        return fetch(`${API_URL}/api/inventory-history`);
      })
      .then((response) => {
        if (!response.ok) {
          throw new Error("Failed to fetch inventory history");
        }
        return response.json();
      })
      .then((data) => {
        setHistory(data.history || []);
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
    fetch(`${API_URL}/api/supplier-scorecards`)
      .then((response) => {
        if (!response.ok) throw new Error("Failed to fetch supplier scorecards");
        return response.json();
      })
      .then((data) => setSupplierScorecards(data.suppliers || []))
      .catch((supplierError) => console.error(supplierError));
  }, []);

  useEffect(() => {
    fetch(`${API_URL}/api/recovery-plans`)
      .then((response) => response.json())
      .then((data) => setRecoveryPlans(data.plans || []))
      .catch((plansError) => console.error(plansError));
  }, []);

  useEffect(() => {
    fetch(`${API_URL}/api/ml-forecast`)
      .then((response) => {
        if (!response.ok) throw new Error("Failed to fetch ML forecasts");
        return response.json();
      })
      .then((data) => setForecasts(data.forecasts || []))
      .catch((forecastError) => console.error(forecastError));
  }, []);

  useEffect(() => {
    fetch(`${API_URL}/api/alerts`)
      .then((response) => {
        if (!response.ok) throw new Error("Failed to fetch alerts");
        return response.json();
      })
      .then((data) => setAlerts(data.alerts || []))
      .catch((alertError) => console.error(alertError));
  }, []);

  useEffect(() => {
    fetch(`${API_URL}/api/ai-insights`)
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

  const historicalPoints = history.map((snapshot, index) => {
    const x = history.length === 1 ? 400 : (index / (history.length - 1)) * 760 + 20;
    const values = history.map((item) => item.revenue_at_risk);
    const minRisk = Math.min(...values);
    const maxRisk = Math.max(...values);
    const range = maxRisk - minRisk || 1;
    const y = 170 - ((snapshot.revenue_at_risk - minRisk) / range) * 125;
    return { ...snapshot, x, y, pointIndex: index };
  });
  const historicalLine = historicalPoints.map((point) => `${point.x},${point.y}`).join(" ");
  const historicalExposureIsFlat = history.every(
    (snapshot) => snapshot.revenue_at_risk === history[0]?.revenue_at_risk
  );

  const formatCurrency = (value) => {
    return new Intl.NumberFormat("en-IN", {
      style: "currency",
      currency: "INR",
      maximumFractionDigits: 0,
    }).format(value || 0);
  };

  const askAI = () => {
    if (!aiQuestion.trim()) return;
    setAiLoading(true);
    fetch(`${API_URL}/api/ai-chat`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ question: aiQuestion }),
    })
      .then((response) => {
        return response.json().then((data) => {
          if (!response.ok) {
            throw new Error(data.detail || data.error || "AI assistant request failed");
          }
          return data;
        });
      })
      .then((data) => {
        setAiAnswer(data);
        setAiLoading(false);
      })
      .catch((chatError) => {
        setAiAnswer({
          answer: chatError.message,
          model: "Assistant error",
          source: "error",
        });
        setAiLoading(false);
      });
  };

  const handleLogin = () => {
    setLoginError("");
    fetch(`${API_URL}/api/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username, password }),
    })
      .then((response) => {
        if (!response.ok) {
          throw new Error("Invalid username or password");
        }
        return response.json();
      })
      .then((data) => {
        localStorage.setItem("stockshield_token", data.token);
        localStorage.setItem("stockshield_user", JSON.stringify(data.user));
        setUser(data.user);
        setPassword("");
      })
      .catch((loginException) => setLoginError(loginException.message));
  };

  const signInPanel = (
    <div className="signin-screen">
      <div className="signin-brand">
        <span className="signin-mark">S</span>
        <div>
          <strong>StockShield</strong>
          <span>Supply chain risk intelligence</span>
        </div>
      </div>
      <div className="signin-card">
        <span className="ai-eyebrow">Secure workspace access</span>
        <h1>Sign in to StockShield</h1>
        <p>Choose your access type to continue to the risk dashboard.</p>
        <div className="role-switcher">
          {[
            ["admin", "Administrator", "Manage inventory and recovery"],
            ["viewer", "User", "View insights and forecasts"],
          ].map(([role, label, description]) => (
            <button type="button" key={role} className={loginRole === role ? "selected" : ""} onClick={() => setLoginRole(role)}>
              <strong>{label}</strong>
              <span>{description}</span>
            </button>
          ))}
        </div>
        <label htmlFor="signin-username">Username</label>
        <input id="signin-username" placeholder={loginRole === "admin" ? "admin" : "user"} value={username} onChange={(event) => setUsername(event.target.value)} />
        <label htmlFor="signin-password">Password</label>
        <input id="signin-password" type="password" placeholder="Enter password" value={password} onChange={(event) => setPassword(event.target.value)} onKeyDown={(event) => event.key === "Enter" && handleLogin()} />
        <button className="signin-button" onClick={handleLogin}>Sign in</button>
        {loginError && <span className="login-error">{loginError}</span>}
      </div>
      <small>Authorized users only · StockShield decision support</small>
    </div>
  );

  const saveInventory = () => {
    if (!selectedItem || user?.role !== "admin") return;
    fetch(
      `${API_URL}/api/inventory/${selectedItem.product_id}/${selectedItem.region_id}`,
      {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${localStorage.getItem("stockshield_token")}`,
        },
        body: JSON.stringify({
          supplier_id: selectedItem.supplier_id,
          quantity: Number(editQuantity),
          capacity: Number(editCapacity),
        }),
      }
    )
      .then((response) => {
        if (!response.ok) throw new Error("Failed to update inventory");
        window.location.reload();
      })
      .catch((saveError) => setError(saveError.message));
  };

  const changePassword = () => {
    setPasswordMessage("");
    fetch(`${API_URL}/api/auth/password`, {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${localStorage.getItem("stockshield_token")}`,
      },
      body: JSON.stringify({
        current_password: passwordForm.current,
        new_password: passwordForm.next,
      }),
    })
      .then((response) => response.json().then((data) => {
        if (!response.ok) throw new Error(data.detail || "Password update failed");
        return data;
      }))
      .then((data) => {
        setPasswordMessage(data.status);
        setPasswordForm({ current: "", next: "" });
      })
      .catch((passwordError) => setPasswordMessage(passwordError.message));
  };

  const importInventory = (event) => {
    const file = event.target.files?.[0];
    if (!file || user?.role !== "admin") return;
    const formData = new FormData();
    formData.append("file", file);
    setImportMessage("Importing...");
    fetch(`${API_URL}/api/inventory-import`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${localStorage.getItem("stockshield_token")}`,
      },
      body: formData,
    })
      .then((response) => response.json().then((data) => {
        if (!response.ok) throw new Error(data.detail || "Import failed");
        return data;
      }))
      .then((data) => {
        setImportMessage(`${data.updated} inventory rows updated.`);
        window.location.reload();
      })
      .catch((importError) => setImportMessage(importError.message));
  };

  const saveRecoveryPlan = () => {
    if (!simulation?.recommended_strategy || !selectedItem || user?.role !== "admin") {
      return;
    }
    fetch(`${API_URL}/api/recovery-plans`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${localStorage.getItem("stockshield_token")}`,
      },
      body: JSON.stringify({
        product_id: selectedItem.product_id,
        region_id: selectedItem.region_id,
        strategy: simulation.recommended_strategy,
      }),
    })
      .then((response) => {
        return response.json().then((data) => {
          if (!response.ok) {
            throw new Error(data.detail || "Failed to save recovery plan");
          }
          return data;
        });
      })
      .then(() => fetch(`${API_URL}/api/recovery-plans`))
      .then((response) => response.json())
      .then((data) => setRecoveryPlans(data.plans || []))
      .catch((planError) => setSimulationError(planError.message));
  };

  const updatePlanStatus = (planId, status) => {
    fetch(`${API_URL}/api/recovery-plans/${planId}`, {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${localStorage.getItem("stockshield_token")}`,
      },
      body: JSON.stringify({ status }),
    })
      .then((response) => {
        if (!response.ok) throw new Error("Failed to update recovery plan");
        return response.json();
      })
      .then(() => setRecoveryPlans((plans) =>
        plans.map((plan) => plan.id === planId ? { ...plan, status } : plan)
      ))
      .catch((planError) => setSimulationError(planError.message));
  };

  const sendAlertDigest = () => {
    setNotificationMessage("");
    fetch(`${API_URL}/api/alerts/notify`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${localStorage.getItem("stockshield_token")}`,
      },
    })
      .then((response) => response.json().then((data) => {
        if (!response.ok) {
          throw new Error(data.detail || "Unable to send alert digest");
        }
        return data;
      }))
      .then((data) => setNotificationMessage(data.message))
      .catch((notificationError) => setNotificationMessage(notificationError.message));
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
    setEditQuantity(item.current_inventory);
    setEditCapacity(item.capacity || item.current_inventory);

    setSimulation(null);
    setSimulationError("");
    setSimulationLoading(true);

    fetch(
      `${API_URL}/api/simulate-recovery/${item.product_id}/${item.region_id}`
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
      `${API_URL}/api/inject-disruption`,
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

  const handleScenarioSimulation = () => {
    const disruptions = [];
    if (selectedProduct && selectedRegion) {
      disruptions.push({
        type: "demand_shock",
        product_id: selectedProduct,
        region_id: selectedRegion,
        increase_percentage: Number(increasePercentage),
      });
    }
    if (selectedSupplier) {
      disruptions.push({
        type: "supplier_shock",
        supplier_id: selectedSupplier,
        delay_days: Number(delayDays),
      });
    }
    if (disruptions.length < 2) {
      setDisruptionError(
        "Select both a demand shock and supplier delay to compare a combined scenario"
      );
      return;
    }
    setScenarioLoading(true);
    setScenarioResult(null);
    fetch(`${API_URL}/api/simulate-scenario`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ disruptions }),
    })
      .then((response) => {
        if (!response.ok) throw new Error("Failed to simulate combined scenario");
        return response.json();
      })
      .then((data) => {
        setScenarioResult(data);
        setScenarioLoading(false);
      })
      .catch((scenarioError) => {
        setDisruptionError(scenarioError.message);
        setScenarioLoading(false);
      });
  };

  const clearDisruptionForm = () => {
    setDisruptionType("demand_shock");
    setSelectedProduct("");
    setSelectedRegion("");
    setIncreasePercentage(50);
    setSelectedSupplier("");
    setDelayDays(3);
    setDisruptionResult(null);
    setScenarioResult(null);
    setDisruptionError("");
  };

  const handleAssistantDrag = (event) => {
    event.preventDefault();
    assistantMovedRef.current = false;
    setDraggingAssistant(true);
    const startX = event.clientX;
    const startY = event.clientY;
    const startPosition = assistantPosition;

    const moveAssistant = (moveEvent) => {
      assistantMovedRef.current = true;
      setAssistantPosition({
        right: Math.max(
          12,
          Math.min(
            window.innerWidth - 80,
            startPosition.right - (moveEvent.clientX - startX)
          )
        ),
        bottom: Math.max(
          12,
          Math.min(
            window.innerHeight - 70,
            startPosition.bottom - (moveEvent.clientY - startY)
          )
        ),
      });
    };

    const stopAssistantDrag = () => {
      setDraggingAssistant(false);
      window.removeEventListener("mousemove", moveAssistant);
      window.removeEventListener("mouseup", stopAssistantDrag);
    };

    window.addEventListener("mousemove", moveAssistant);
    window.addEventListener("mouseup", stopAssistantDrag);
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

  if (!user) {
    return signInPanel;
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

        <div className="header-actions">
          <div className="status">● LIVE ANALYSIS</div>
          <div className="profile-menu">
            <button className="profile-button" onClick={() => setProfileOpen(!profileOpen)}>
              <span className="profile-avatar">{user.username.charAt(0).toUpperCase()}</span>
              <span>Profile</span>
              <span>⌄</span>
            </button>
            {profileOpen && (
              <div className="profile-dropdown">
                <strong>{user.username}</strong>
                <span className="profile-role">{user.role === "admin" ? "Administrator" : "User"}</span>
                {!passwordChangeOpen ? (
                  <button
                    className="profile-password-toggle"
                    onClick={() => {
                      setPasswordChangeOpen(true);
                      setPasswordMessage("");
                    }}
                  >
                    Change password
                  </button>
                ) : (
                  <>
                    <label>Current password</label>
                    <input
                      type="password"
                      value={passwordForm.current}
                      onChange={(event) => setPasswordForm({ ...passwordForm, current: event.target.value })}
                    />
                    <label>New password</label>
                    <input
                      type="password"
                      value={passwordForm.next}
                      onChange={(event) => setPasswordForm({ ...passwordForm, next: event.target.value })}
                    />
                    <button className="secondary-button" onClick={changePassword}>Update password</button>
                    <button
                      className="profile-cancel"
                      onClick={() => {
                        setPasswordChangeOpen(false);
                        setPasswordForm({ current: "", next: "" });
                        setPasswordMessage("");
                      }}
                    >
                      Cancel
                    </button>
                    {passwordMessage && <small>{passwordMessage}</small>}
                  </>
                )}
                <button
                  className="profile-signout"
                  onClick={() => {
                    localStorage.removeItem("stockshield_token");
                    localStorage.removeItem("stockshield_user");
                    setUser(null);
                    setProfileOpen(false);
                    setPasswordChangeOpen(false);
                  }}
                >
                  Sign out
                </button>
              </div>
            )}
          </div>
        </div>

      </header>

      <nav className="page-nav" aria-label="Dashboard sections">
        {[
          ["overview", "Overview"],
          ["inventory", "Inventory"],
          ["disruptions", "Disruptions"],
        ].map(([page, label]) => (
          <button
            className={activePage === page ? "active" : ""}
            key={page}
            onClick={() => setActivePage(page)}
          >
            {label}
          </button>
        ))}
      </nav>

      <main className="dashboard">

        {/* HERO */}

        <section className={`hero page-section ${activePage !== "overview" ? "hidden-page" : ""}`}>
          <div className="hero-content">
            <span className="hero-kicker">Command center · Live intelligence</span>
            <h2>
              Supply Chain Risk Overview
            </h2>
            <p>
              Identify inventory shortages before they
              cause stockouts and revenue loss.
            </p>
          </div>
          <div className="hero-signal">
            <span className="hero-signal-label">Current posture</span>
            <strong>{criticalRisk + highRisk > 0 ? "Attention required" : "Stable operations"}</strong>
            <span>{criticalRisk + highRisk} high-priority locations</span>
          </div>
        </section>

        {alerts.length > 0 && (
          <section className={`alerts-panel page-section ${activePage !== "overview" ? "hidden-page" : ""}`}>
            <div className="alerts-heading">
              <div>
                <span className="ai-eyebrow">Live monitoring</span>
                <h2>Action required</h2>
              </div>
              <span className="alert-count">{alerts.length} alerts</span>
            </div>
            <div className="alerts-list">
              {alerts.slice(0, 5).map((alert, index) => (
                <div className={`alert-item ${alert.severity.toLowerCase()}`} key={`${alert.title}-${index}`}>
                  <span className="alert-icon">
                    {alert.severity === "Critical" ? "!" : "⚠"}
                  </span>
                  <div>
                    <strong>{alert.title}</strong>
                    <p>{alert.message}</p>
                  </div>
                  {alert.expected_lost_revenue > 0 && (
                    <b>{formatCurrency(alert.expected_lost_revenue)}</b>
                  )}
                </div>
              ))}
            </div>
            {user?.role === "admin" && (
              <div className="notification-action">
                <button className="clear-button" onClick={sendAlertDigest}>
                  Send alert digest
                </button>
                {notificationMessage && <span>{notificationMessage}</span>}
              </div>
            )}
          </section>
        )}


        {/* STATS */}

        <section className={`stats-grid page-section ${activePage !== "overview" ? "hidden-page" : ""}`}>

          <div className="stat-card">
            <div className="stat-card-heading"><span className="stat-icon">⌖</span><p>Total Locations</p></div>
            <h2>
              {analysis.length}
            </h2>
          </div>


          <div className="stat-card high-card">
            <div className="stat-card-heading"><span className="stat-icon">!</span><p>High Risk</p></div>
            <h2>
              {highRisk}
            </h2>
          </div>


          <div className="stat-card medium-card">
            <div className="stat-card-heading"><span className="stat-icon">~</span><p>Medium Risk</p></div>
            <h2>
              {mediumRisk}
            </h2>
          </div>


          <div className="stat-card low-card">
            <div className="stat-card-heading"><span className="stat-icon">✓</span><p>Low Risk</p></div>
            <h2>
              {lowRisk}
            </h2>
          </div>


          <div className="stat-card revenue-card">
            <div className="stat-card-heading"><span className="stat-icon">$</span><p>Potential Revenue at Risk</p></div>
            <h2>
              {formatCurrency(totalLostRevenue)}
            </h2>
          </div>

        </section>

        <section className={`insights-grid page-section ${activePage !== "overview" ? "hidden-page" : ""}`}>
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
          <div className="visualization-card regional-demand-card">
            <div className="section-header">
              <h2>Regional Demand Map</h2>
              <p>Demand intensity by operating region.</p>
            </div>
            <div className="regional-demand-grid">
              {regions.map((region) => {
                const demand = analysis
                  .filter((item) => item.region_id === region.id)
                  .reduce((total, item) => total + item.daily_demand, 0);
                const maxDemand = Math.max(
                  ...regions.map((candidate) =>
                    analysis
                      .filter((item) => item.region_id === candidate.id)
                      .reduce((total, item) => total + item.daily_demand, 0)
                  ),
                  1
                );
                return (
                  <div
                    className="regional-demand-tile"
                    key={region.id}
                    style={{ "--demand-intensity": 0.12 + (demand / maxDemand) * 0.88 }}
                  >
                    <strong>{region.name}</strong>
                    <span>{demand.toFixed(1)} units/day</span>
                    <small>{region.demand_multiplier}× demand multiplier</small>
                  </div>
                );
              })}
            </div>
          </div>
        </section>

        {aiInsights && (
          <section className={`ai-insights page-section ${activePage !== "overview" ? "hidden-page" : ""}`}>
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

        {assistantOpen && (
        <section className="assistant-card floating-assistant">
          <div className="section-header">
            <span className="ai-eyebrow">✦ Ask StockShield</span>
            <h2>Operations Assistant</h2>
            <p>Ask NVIDIA Llama about risk, inventory, suppliers, or the next best action.</p>
          </div>
          <div className="assistant-form">
            <input
              value={aiQuestion}
              onChange={(event) => setAiQuestion(event.target.value)}
              onKeyDown={(event) => event.key === "Enter" && askAI()}
              placeholder="Which location should I prioritize today?"
            />
            <button className="inject-button" onClick={askAI} disabled={aiLoading}>
              {aiLoading ? "Thinking..." : "Ask AI"}
            </button>
          </div>
          {aiAnswer && (
            <div className="assistant-answer">
              <strong>
                {aiAnswer.model} · {aiAnswer.source}
              </strong>
              <p>{aiAnswer.answer}</p>
              {aiAnswer.provider_error && (
                <small>
                  NVIDIA Llama was unavailable, so the local risk assistant answered this question.
                  {" "}Provider detail: {aiAnswer.provider_error}
                </small>
              )}
            </div>
          )}
        </section>
        )}

        <section className={`history-card page-section ${activePage !== "overview" ? "hidden-page" : ""}`}>
          <div className="section-header">
            <h2>Historical Exposure</h2>
            <p>Daily snapshots persisted in the StockShield database.</p>
          </div>
          {history.length ? (
            <>
              <div className="history-chart" role="img" aria-label="Historical revenue exposure line graph">
                <svg viewBox="0 0 800 240" preserveAspectRatio="xMidYMid meet">
                <line x1="20" y1="45" x2="780" y2="45" className="history-gridline" />
                <line x1="20" y1="107" x2="780" y2="107" className="history-gridline" />
                <line x1="20" y1="170" x2="780" y2="170" className="history-axis" />
                <polyline points={historicalLine} className="history-line" />
                {historicalPoints.map((point) => (
                  <g key={`${point.captured_at}-${point.pointIndex}`}>
                    <circle
                      cx={point.x}
                      cy={point.y}
                      r="5"
                      className="history-dot"
                      onMouseEnter={() => setHoveredHistoryPoint(point)}
                      onMouseLeave={() => setHoveredHistoryPoint(null)}
                    >
                      <title>
                        {`${formatCurrency(point.revenue_at_risk)} at risk`}
                      </title>
                    </circle>
                    {hoveredHistoryPoint?.pointIndex === point.pointIndex && (
                      <g className="history-tooltip" pointerEvents="none">
                        <rect
                          x={Math.min(Math.max(point.x - 70, 8), 652)}
                          y={Math.max(point.y - 54, 6)}
                          width="140"
                          height="42"
                          rx="7"
                        />
                        <text
                          x={Math.min(Math.max(point.x, 78), 722)}
                          y={Math.max(point.y - 33, 27)}
                          textAnchor="middle"
                        >
                          {formatCurrency(point.revenue_at_risk)}
                        </text>
                        <text
                          x={Math.min(Math.max(point.x, 78), 722)}
                          y={Math.max(point.y - 18, 42)}
                          textAnchor="middle"
                        >
                          {new Date(point.captured_at).toLocaleString("en-IN", {
                            day: "2-digit",
                            month: "short",
                            hour: "2-digit",
                            minute: "2-digit",
                          })}
                        </text>
                      </g>
                    )}
                    <text x={point.x} y="224" textAnchor="middle">
                      {new Date(point.captured_at).toLocaleDateString("en-IN", {
                        day: "2-digit",
                        month: "short",
                      })}
                    </text>
                  </g>
                ))}
                </svg>
              </div>
              {historicalExposureIsFlat && history.length > 1 && (
                <p className="history-note">
                  Exposure is unchanged across the recorded snapshots. New snapshots after
                  inventory or disruption changes will show upward or downward movement.
                </p>
              )}
            </>
          ) : (
            <p className="history-empty">
              Your first snapshot will appear here after the next analysis refresh.
            </p>
          )}
        </section>

        <section className={`forecast-card page-section ${activePage !== "overview" ? "hidden-page" : ""}`}>
          <div className="section-header">
            <h2>ML Demand Forecast</h2>
            <p>Seven-day demand prediction from historical observations.</p>
          </div>
          <div className="forecast-grid">
            {forecasts.slice(0, 6).map((forecast) => (
              <div className="forecast-item" key={`${forecast.product_id}-${forecast.region_id}`}>
                <strong>{forecast.product_name}</strong>
                <span>{forecast.region_name}</span>
                <b>{forecast.predicted_daily_demand} units/day</b>
                <small>Trend error ±{forecast.forecast_error}</small>
              </div>
            ))}
          </div>
        </section>


        {/* INVENTORY TABLE */}

        <section className={`risk-section page-section ${activePage !== "inventory" ? "hidden-page" : ""}`}>

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
            <a
              className="export-button"
              href={`${API_URL}/api/inventory-export`}
              download="stockshield-risk-report.csv"
            >
              Export CSV
            </a>
            {user?.role === "admin" && (
              <label className="import-button">
                Import CSV
                <input type="file" accept=".csv,text/csv" onChange={importInventory} />
              </label>
            )}
            {importMessage && <span className="import-message">{importMessage}</span>}

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
                      <small className="stockout-date">
                        Stockout: {new Date(`${item.predicted_stockout_date}T00:00:00`).toLocaleDateString("en-IN", {
                          day: "2-digit",
                          month: "short",
                          year: "numeric",
                        })}
                      </small>
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

        {user?.role === "admin" && selectedItem && (
            <div className="admin-editor">
              <h3>Editing {selectedItem.product_name} · {selectedItem.region_name}</h3>
              <input
                type="number"
                min="0"
                value={editQuantity}
                onChange={(event) => setEditQuantity(event.target.value)}
                placeholder="Quantity"
              />
              <input
                type="number"
                min="1"
                value={editCapacity}
                onChange={(event) => setEditCapacity(event.target.value)}
                placeholder="Capacity"
              />
              <button className="inject-button" onClick={saveInventory}>Save inventory</button>
            </div>
          )}


        {/* RECOVERY STRATEGIES */}

        {selectedItem && (

          <section className={`recovery-section page-section ${activePage !== "inventory" ? "hidden-page" : ""}`}>

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
                  {user?.role === "admin" && (
                    <button className="inject-button" onClick={saveRecoveryPlan}>
                      Track this recovery plan
                    </button>
                  )}


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
                  <div className="recovery-revenue-grid">
                    <div>
                      <span>Lost revenue without recovery</span>
                      <strong>{formatCurrency(simulation.recommended_strategy.baseline_lost_revenue)}</strong>
                    </div>
                    <div>
                      <span>Lost revenue after recovery</span>
                      <strong>{formatCurrency(simulation.recommended_strategy.total_expected_lost_revenue)}</strong>
                    </div>
                    <div>
                      <span>Revenue protected</span>
                      <strong>{formatCurrency(simulation.recommended_strategy.revenue_protected)}</strong>
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

        <section className={`plans-section page-section ${activePage !== "inventory" ? "hidden-page" : ""}`}>
          <div className="section-header">
            <h2>Recovery Execution</h2>
            <p>Track approved plans through delivery.</p>
          </div>
          {recoveryPlans.length === 0 && <p className="history-empty">No recovery plans tracked yet.</p>}
          <div className="plans-grid">
            {recoveryPlans.map((plan) => (
              <div className="plan-card" key={plan.id}>
                <strong>{plan.strategy}</strong>
                <span>{plan.product_id} · {plan.region_id}</span>
                <p>{plan.description}</p>
                <select
                  value={plan.status}
                  disabled={user?.role !== "admin"}
                  onChange={(event) => updatePlanStatus(plan.id, event.target.value)}
                >
                  {["Recommended", "Approved", "Ordered", "In Transit", "Delivered", "Cancelled"].map((status) => (
                    <option value={status} key={status}>{status}</option>
                  ))}
                </select>
              </div>
            ))}
          </div>
        </section>

        <section className={`supplier-section page-section ${activePage !== "inventory" ? "hidden-page" : ""}`}>
          <div className="section-header">
            <h2>Supplier Intelligence</h2>
            <p>Performance scorecards for replenishment decisions.</p>
          </div>
          <div className="supplier-grid">
            {supplierScorecards.map((supplier) => (
              <div className="supplier-card" key={supplier.supplier_id}>
                <div className="supplier-card-heading">
                  <strong>{supplier.supplier_name}</strong>
                  <b>{supplier.performance_score}/100</b>
                </div>
                <div className="supplier-meter">
                  <span style={{ width: `${supplier.performance_score}%` }} />
                </div>
                <p>{supplier.recommendation}</p>
                <div className="supplier-stats">
                  <span>Risk <b>{supplier.risk_level}</b></span>
                  <span>Reliability <b>{Math.round(supplier.reliability * 100)}%</b></span>
                  <span>Lead time <b>{supplier.lead_time_days} days</b></span>
                  <span>High risk <b>{supplier.high_risk_locations}</b></span>
                  <span>Exposure <b>{formatCurrency(supplier.revenue_exposure)}</b></span>
                </div>
              </div>
            ))}
          </div>
        </section>

        <section className={`disruption-section page-section ${activePage !== "disruptions" ? "hidden-page" : ""}`}>

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
           <button
             className="scenario-button"
             onClick={handleScenarioSimulation}
             disabled={scenarioLoading}
           >
             {scenarioLoading
               ? "Comparing Scenario..."
               : "Simulate Combined Scenario"}
           </button>
           <button
             className="clear-button"
             onClick={clearDisruptionForm}
             disabled={disruptionLoading || scenarioLoading}
           >
             Clear selections
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

                        {scenarioResult && (
                          <div className="scenario-result">
                            <h2>Combined Scenario Impact</h2>
                            <p>
                              {scenarioResult.disruptions.length} disruptions modeled together.
                              {" "}Scenario {scenarioResult.scenario_id}
                            </p>
                            <div className="scenario-tags">
                              {scenarioResult.disruptions.map((disruption, index) => (
                                <span key={`${disruption.type}-${index}`}>
                                  {disruption.type === "demand_shock"
                                    ? `Demand +${disruption.increase_percentage}% · ${disruption.product_id}/${disruption.region_id}`
                                    : `Supplier delay +${disruption.delay_days} days · ${disruption.supplier_id}`}
                                </span>
                              ))}
                            </div>
                            <div className="disruption-info">
                              <div>
                                <span>Baseline Risk</span>
                                <strong>{formatCurrency(scenarioResult.baseline_revenue_at_risk)}</strong>
                              </div>
                              <div>
                                <span>Scenario Risk</span>
                                <strong>{formatCurrency(scenarioResult.scenario_revenue_at_risk)}</strong>
                              </div>
                              <div>
                                <span>Additional Exposure</span>
                                <strong>{formatCurrency(scenarioResult.additional_revenue_at_risk)}</strong>
                              </div>
                              <div>
                                <span>High-Risk Locations</span>
                                <strong>{scenarioResult.high_risk_locations}</strong>
                              </div>
                            </div>
                          </div>
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

      <button
        className={`assistant-launcher ${draggingAssistant ? "dragging" : ""}`}
        style={{
          right: `${assistantPosition.right}px`,
          bottom: `${assistantPosition.bottom}px`,
        }}
        onMouseDown={handleAssistantDrag}
        onClick={() => {
          if (!assistantMovedRef.current) {
            setAssistantOpen((isOpen) => !isOpen);
          }
          assistantMovedRef.current = false;
        }}
        aria-label="Open AI assistant"
        title="Drag to move, click to open AI assistant"
      >
        <span>✦</span>
        <b>Ask AI</b>
      </button>

    </div>
  );
}

export default App;