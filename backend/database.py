import json
import hashlib
import os
import secrets
import sqlite3
from datetime import date, timedelta
import math
from datetime import datetime, timezone
from pathlib import Path


DATABASE_FILE = Path(
    os.getenv(
        "STOCKSHIELD_DB_PATH",
        Path(__file__).parent / "data" / "stockshield.db",
    )
)
SEED_FILE = Path(__file__).parent / "data" / "inventory.json"


def _connect():
    DATABASE_FILE.parent.mkdir(parents=True, exist_ok=True)
    connection = sqlite3.connect(DATABASE_FILE)
    connection.row_factory = sqlite3.Row
    return connection


def _initialize(connection):
    connection.executescript(
        """
        CREATE TABLE IF NOT EXISTS products (
            id TEXT PRIMARY KEY,
            name TEXT NOT NULL,
            price REAL NOT NULL,
            daily_demand REAL NOT NULL
        );
        CREATE TABLE IF NOT EXISTS regions (
            id TEXT PRIMARY KEY,
            name TEXT NOT NULL,
            demand_multiplier REAL NOT NULL
        );
        CREATE TABLE IF NOT EXISTS suppliers (
            id TEXT PRIMARY KEY,
            name TEXT NOT NULL,
            lead_time_days INTEGER NOT NULL,
            reliability REAL NOT NULL
        );
        CREATE TABLE IF NOT EXISTS inventory (
            product_id TEXT NOT NULL,
            region_id TEXT NOT NULL,
            supplier_id TEXT NOT NULL,
            quantity REAL NOT NULL,
            capacity REAL NOT NULL,
            PRIMARY KEY (product_id, region_id),
            FOREIGN KEY (product_id) REFERENCES products(id),
            FOREIGN KEY (region_id) REFERENCES regions(id),
            FOREIGN KEY (supplier_id) REFERENCES suppliers(id)
        );
        CREATE TABLE IF NOT EXISTS inventory_snapshots (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            captured_at TEXT NOT NULL,
            total_units REAL NOT NULL,
            revenue_at_risk REAL NOT NULL,
            critical_count INTEGER NOT NULL,
            high_count INTEGER NOT NULL,
            medium_count INTEGER NOT NULL,
            low_count INTEGER NOT NULL
        );
        CREATE TABLE IF NOT EXISTS users (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            username TEXT UNIQUE NOT NULL,
            password_hash TEXT NOT NULL,
            role TEXT NOT NULL CHECK (role IN ('admin', 'viewer'))
        );
        CREATE TABLE IF NOT EXISTS demand_history (
            observed_on TEXT NOT NULL,
            product_id TEXT NOT NULL,
            region_id TEXT NOT NULL,
            demand REAL NOT NULL,
            PRIMARY KEY (observed_on, product_id, region_id)
        );
        CREATE TABLE IF NOT EXISTS recovery_plans (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            product_id TEXT NOT NULL,
            region_id TEXT NOT NULL,
            strategy TEXT NOT NULL,
            description TEXT NOT NULL,
            quantity REAL NOT NULL,
            estimated_cost REAL NOT NULL,
            status TEXT NOT NULL CHECK (
                status IN ('Recommended', 'Approved', 'Ordered', 'In Transit', 'Delivered', 'Cancelled')
            ),
            created_at TEXT NOT NULL,
            updated_at TEXT NOT NULL
        );
        """
    )

    if connection.execute("SELECT COUNT(*) FROM products").fetchone()[0] == 0:
        with SEED_FILE.open("r", encoding="utf-8") as seed_file:
            seed = json.load(seed_file)
        connection.executemany(
            "INSERT INTO products VALUES (?, ?, ?, ?)",
            [
                (item["id"], item["name"], item["price"], item["daily_demand"])
                for item in seed["products"]
            ],
        )
        connection.executemany(
            "INSERT INTO regions VALUES (?, ?, ?)",
            [
                (item["id"], item["name"], item["demand_multiplier"])
                for item in seed["regions"]
            ],
        )
        connection.executemany(
            "INSERT INTO suppliers VALUES (?, ?, ?, ?)",
            [
                (
                    item["id"],
                    item["name"],
                    item["lead_time_days"],
                    item["reliability"],
                )
                for item in seed["suppliers"]
            ],
        )
        connection.executemany(
            "INSERT INTO inventory VALUES (?, ?, ?, ?, ?)",
            [
                (
                    item["product_id"],
                    item["region_id"],
                    item["supplier_id"],
                    item["quantity"],
                    item["capacity"],
                )
                for item in seed["inventory"]
            ],
        )
        connection.commit()

    if connection.execute("SELECT COUNT(*) FROM users").fetchone()[0] == 0:
        password = os.getenv("STOCKSHIELD_ADMIN_PASSWORD", "admin123")
        connection.execute(
            "INSERT INTO users (username, password_hash, role) VALUES (?, ?, ?)",
            ("admin", hash_password(password), "admin"),
        )
        connection.commit()

    if connection.execute("SELECT COUNT(*) FROM demand_history").fetchone()[0] == 0:
        products = connection.execute(
            "SELECT id, daily_demand FROM products"
        ).fetchall()
        regions = connection.execute(
            "SELECT id, demand_multiplier FROM regions"
        ).fetchall()
        observations = []
        for days_ago in range(30, 0, -1):
            observed_on = (date.today() - timedelta(days=days_ago)).isoformat()
            weekday_factor = 1 + (0.08 if days_ago % 7 in (1, 2) else -0.03)
            seasonal_factor = 1 + 0.06 * math.sin(days_ago / 4)
            for product in products:
                for region in regions:
                    demand = (
                        product["daily_demand"]
                        * region["demand_multiplier"]
                        * weekday_factor
                        * seasonal_factor
                    )
                    observations.append(
                        (observed_on, product["id"], region["id"], round(demand, 2))
                    )
        connection.executemany(
            "INSERT INTO demand_history VALUES (?, ?, ?, ?)",
            observations,
        )
        connection.commit()


def hash_password(password):
    return hashlib.sha256(password.encode("utf-8")).hexdigest()


def authenticate_user(username, password):
    with _connect() as connection:
        _initialize(connection)
        row = connection.execute(
            "SELECT id, username, password_hash, role FROM users WHERE username = ?",
            (username,),
        ).fetchone()
        if not row or not secrets.compare_digest(
            row["password_hash"], hash_password(password)
        ):
            return None
        return {"id": row["id"], "username": row["username"], "role": row["role"]}


def update_inventory(product_id, region_id, supplier_id, quantity, capacity):
    with _connect() as connection:
        _initialize(connection)
        connection.execute(
            """
            UPDATE inventory
            SET supplier_id = ?, quantity = ?, capacity = ?
            WHERE product_id = ? AND region_id = ?
            """,
            (supplier_id, quantity, capacity, product_id, region_id),
        )
        if connection.total_changes == 0:
            raise ValueError("Inventory record not found")
        connection.commit()


def create_inventory(product_id, region_id, supplier_id, quantity, capacity):
    with _connect() as connection:
        _initialize(connection)
        try:
            connection.execute(
                """
                INSERT INTO inventory
                (product_id, region_id, supplier_id, quantity, capacity)
                VALUES (?, ?, ?, ?, ?)
                """,
                (product_id, region_id, supplier_id, quantity, capacity),
            )
        except sqlite3.IntegrityError as error:
            raise ValueError(
                "Product, region, and supplier must exist; "
                "the inventory location may already exist"
            ) from error
        connection.commit()


def delete_inventory(product_id, region_id):
    with _connect() as connection:
        _initialize(connection)
        connection.execute(
            "DELETE FROM inventory WHERE product_id = ? AND region_id = ?",
            (product_id, region_id),
        )
        if connection.total_changes == 0:
            raise ValueError("Inventory record not found")
        connection.commit()


def load_data():
    """Return the inventory domain model from SQLite."""
    with _connect() as connection:
        _initialize(connection)
        tables = {
            "products": "SELECT id, name, price, daily_demand FROM products",
            "regions": "SELECT id, name, demand_multiplier FROM regions",
            "suppliers": (
                "SELECT id, name, lead_time_days, reliability FROM suppliers"
            ),
            "inventory": (
                "SELECT product_id, region_id, supplier_id, quantity, capacity "
                "FROM inventory"
            ),
        }
        return {
            name: [dict(row) for row in connection.execute(query)]
            for name, query in tables.items()
        }


def record_inventory_snapshot(analysis):
    """Persist one daily dashboard snapshot without duplicating the same day."""
    now = datetime.now(timezone.utc)
    captured_at = now.isoformat()
    day_start = now.date().isoformat()
    total_units = sum(item["current_inventory"] for item in analysis)
    revenue_at_risk = sum(item["expected_lost_revenue"] for item in analysis)
    counts = {
        level: sum(item["risk_level"] == level for item in analysis)
        for level in ("Critical", "High", "Medium", "Low")
    }

    with _connect() as connection:
        _initialize(connection)
        already_recorded = connection.execute(
            "SELECT 1 FROM inventory_snapshots WHERE captured_at LIKE ? LIMIT 1",
            (f"{day_start}%",),
        ).fetchone()
        if already_recorded:
            return
        connection.execute(
            """
            INSERT INTO inventory_snapshots
            (captured_at, total_units, revenue_at_risk, critical_count,
             high_count, medium_count, low_count)
            VALUES (?, ?, ?, ?, ?, ?, ?)
            """,
            (
                captured_at,
                total_units,
                revenue_at_risk,
                counts["Critical"],
                counts["High"],
                counts["Medium"],
                counts["Low"],
            ),
        )
        connection.commit()


def get_inventory_history(limit=30):
    """Return the latest persisted dashboard snapshots."""
    with _connect() as connection:
        _initialize(connection)
        rows = connection.execute(
            """
            SELECT captured_at, total_units, revenue_at_risk, critical_count,
                   high_count, medium_count, low_count
            FROM inventory_snapshots
            ORDER BY captured_at DESC
            LIMIT ?
            """,
            (limit,),
        )
        return [dict(row) for row in reversed(rows.fetchall())]


def get_demand_history():
    with _connect() as connection:
        _initialize(connection)
        rows = connection.execute(
            """
            SELECT observed_on, product_id, region_id, demand
            FROM demand_history
            ORDER BY observed_on ASC
            """
        )
        return [dict(row) for row in rows.fetchall()]


def create_recovery_plan(product_id, region_id, strategy):
    now = datetime.now(timezone.utc).isoformat()
    with _connect() as connection:
        _initialize(connection)
        cursor = connection.execute(
            """
            INSERT INTO recovery_plans
            (product_id, region_id, strategy, description, quantity,
             estimated_cost, status, created_at, updated_at)
            VALUES (?, ?, ?, ?, ?, ?, 'Recommended', ?, ?)
            """,
            (
                product_id,
                region_id,
                strategy["strategy"],
                strategy["description"],
                strategy["quantity"],
                strategy["estimated_cost"],
                now,
                now,
            ),
        )
        connection.commit()
        return cursor.lastrowid


def get_recovery_plans():
    with _connect() as connection:
        _initialize(connection)
        rows = connection.execute(
            "SELECT * FROM recovery_plans ORDER BY updated_at DESC"
        )
        return [dict(row) for row in rows.fetchall()]


def update_recovery_plan_status(plan_id, status):
    now = datetime.now(timezone.utc).isoformat()
    with _connect() as connection:
        _initialize(connection)
        cursor = connection.execute(
            "UPDATE recovery_plans SET status = ?, updated_at = ? WHERE id = ?",
            (status, now, plan_id),
        )
        if cursor.rowcount == 0:
            raise ValueError("Recovery plan not found")
        connection.commit()
