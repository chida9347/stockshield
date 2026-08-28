import json
import os
import sqlite3
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
