"""SQLite access layer for the Budget Transparency Dashboard.

The database is a single file (budget.db) created automatically next to this
module. There is no external database server: the app runs out of the box.
"""
import os
import sqlite3

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
DB_PATH = os.path.join(BASE_DIR, "budget.db")

SCHEMA = """
CREATE TABLE IF NOT EXISTS departments (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL UNIQUE
);

CREATE TABLE IF NOT EXISTS schemes (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    department_id INTEGER NOT NULL REFERENCES departments(id) ON DELETE CASCADE,
    name TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS allocations (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    scheme_id INTEGER NOT NULL REFERENCES schemes(id) ON DELETE CASCADE,
    fiscal_year TEXT NOT NULL,
    allocated REAL NOT NULL,
    spent REAL NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_allocations_year ON allocations(fiscal_year);
CREATE INDEX IF NOT EXISTS idx_allocations_scheme ON allocations(scheme_id);
"""

ALL_NAMES = ["Health", "Education", "Agriculture", "Infrastructure",
             "Rural Development", "Water Resources", "Social Welfare",
             "Police", "Transport", "IT & Electronics"]


def get_conn():
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    conn.execute("PRAGMA foreign_keys = ON")
    return conn


def init_db():
    conn = get_conn()
    try:
        conn.executescript(SCHEMA)
        conn.commit()
    finally:
        conn.close()


def count(table):
    conn = get_conn()
    try:
        return conn.execute("SELECT COUNT(*) AS n FROM %s" % table).fetchone()["n"]
    finally:
        conn.close()


def fetch_all(sql, params=()):
    conn = get_conn()
    try:
        return [dict(r) for r in conn.execute(sql, params).fetchall()]
    finally:
        conn.close()


def fetch_one(sql, params=()):
    conn = get_conn()
    try:
        row = conn.execute(sql, params).fetchone()
        return dict(row) if row else None
    finally:
        conn.close()


def get_years():
    rows = fetch_all("SELECT DISTINCT fiscal_year AS year FROM allocations ORDER BY fiscal_year")
    return [r["year"] for r in rows]


def get_departments():
    return fetch_all("SELECT id, name FROM departments ORDER BY name")


def totals_for(year=None, dept_name=None):
    """Allocated/spent totals, optionally filtered by fiscal year and department."""
    sql = """
        SELECT COALESCE(SUM(a.allocated), 0) AS allocated,
               COALESCE(SUM(a.spent), 0) AS spent
        FROM allocations a
        JOIN schemes s ON s.id = a.scheme_id
        JOIN departments d ON d.id = s.department_id
        WHERE 1 = 1
    """
    params = []
    if year:
        sql += " AND a.fiscal_year = ?"
        params.append(year)
    if dept_name:
        sql += " AND d.name = ?"
        params.append(dept_name)
    return fetch_one(sql, params)


def per_department(year):
    sql = """
        SELECT d.name AS name,
               COALESCE(SUM(a.allocated), 0) AS allocated,
               COALESCE(SUM(a.spent), 0) AS spent
        FROM departments d
        LEFT JOIN schemes s ON s.department_id = d.id
        LEFT JOIN allocations a ON a.scheme_id = s.id AND a.fiscal_year = ?
        GROUP BY d.id, d.name
        ORDER BY allocated DESC
    """
    rows = fetch_all(sql, [year])
    for r in rows:
        r["utilization"] = (r["spent"] / r["allocated"] * 100) if r["allocated"] else 0.0
    return rows


def trend():
    sql = """
        SELECT a.fiscal_year AS year,
               COALESCE(SUM(a.allocated), 0) AS allocated,
               COALESCE(SUM(a.spent), 0) AS spent
        FROM allocations a
        GROUP BY a.fiscal_year
        ORDER BY a.fiscal_year
    """
    return fetch_all(sql)


def dept_trend(name):
    sql = """
        SELECT a.fiscal_year AS year,
               COALESCE(SUM(a.allocated), 0) AS allocated,
               COALESCE(SUM(a.spent), 0) AS spent
        FROM departments d
        JOIN schemes s ON s.department_id = d.id
        JOIN allocations a ON a.scheme_id = s.id
        WHERE d.name = ?
        GROUP BY a.fiscal_year
        ORDER BY a.fiscal_year
    """
    return fetch_all(sql, [name])


def schemes_for(dept_name, year):
    sql = """
        SELECT s.name AS scheme,
               COALESCE(SUM(a.allocated), 0) AS allocated,
               COALESCE(SUM(a.spent), 0) AS spent
        FROM departments d
        JOIN schemes s ON s.department_id = d.id
        LEFT JOIN allocations a ON a.scheme_id = s.id AND a.fiscal_year = ?
        WHERE d.name = ?
        GROUP BY s.id, s.name
        ORDER BY allocated DESC
    """
    rows = fetch_all(sql, [year, dept_name])
    for r in rows:
        r["utilization"] = (r["spent"] / r["allocated"] * 100) if r["allocated"] else 0.0
    return rows