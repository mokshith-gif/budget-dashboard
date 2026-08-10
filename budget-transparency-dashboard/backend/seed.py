"""Seed script for the Budget Transparency Dashboard.

Loads realistic sample Indian government budget data (₹ crore) into SQLite:
10 departments x 2-4 schemes x 3 fiscal years (2023-24, 2024-25, 2025-26).

A few deliberate anomalies are baked in so the red-flag engine has something
real to catch:
  * Police  & Transport allocations more than doubled between 2023-24 and 2024-25
  * IT & Electronics allocation jumped >100% between 2024-25 and 2025-26
  * Rural Development spent <40% of its 2025-26 allocation (MGNREGA wage backlog)
  * Transport spent <40% of its 2024-25 allocation (delayed urban mobility capex)

Run:  python seed.py            (no-op if data already loaded)
      python seed.py --force    (wipe and reload)
"""
import os
import sys

from db import DB_PATH, count, get_conn, init_db

DEPARTMENTS = {
    "Health": {
        "National Health Mission": {
            "2023-24": (16000, 15100),
            "2024-25": (16900, 16000),
            "2025-26": (17650, 16700),
        },
        "Ayushman Bharat": {
            "2023-24": (8100, 7200),
            "2024-25": (8800, 7900),
            "2025-26": (9500, 8600),
        },
        "PM Swasthya Suraksha Yojana": {
            "2023-24": (15400, 13900),
            "2024-25": (16200, 14800),
            "2025-26": (16900, 15500),
        },
        "Medical Education & Research": {
            "2023-24": (2600, 2300),
            "2024-25": (2800, 2500),
            "2025-26": (3100, 2800),
        },
    },
    "Education": {
        "Samagra Shiksha": {
            "2023-24": (37500, 36000),
            "2024-25": (38500, 36900),
            "2025-26": (40000, 38400),
        },
        "Higher Education & Research": {
            "2023-24": (16500, 15300),
            "2024-25": (17200, 16100),
            "2025-26": (18500, 17200),
        },
        "PM Poshan (School Nutrition)": {
            "2023-24": (12100, 11600),
            "2024-25": (12700, 12200),
            "2025-26": (13300, 12800),
        },
        "NEP Implementation Grants": {
            "2023-24": (3100, 2800),
            "2024-25": (4600, 4200),
            "2025-26": (5200, 4700),
        },
    },
    "Agriculture": {
        "PM-KISAN": {
            "2023-24": (60000, 58500),
            "2024-25": (57000, 55300),
            "2025-26": (51000, 49000),
        },
        "PM Fasal Bima Yojana": {
            "2023-24": (13800, 12000),
            "2024-25": (14200, 12600),
            "2025-26": (14200, 11900),
        },
        "Agriculture Infrastructure Fund": {
            "2023-24": (8900, 7600),
            "2024-25": (9300, 8200),
            "2025-26": (10100, 8900),
        },
        "Soil Health & Digital Agriculture": {
            "2023-24": (2400, 2100),
            "2024-25": (2500, 2200),
            "2025-26": (2700, 2300),
        },
    },
    "Infrastructure": {
        "National Highways": {
            "2023-24": (36000, 33400),
            "2024-25": (38500, 35900),
            "2025-26": (41000, 38300),
        },
        "Smart Cities Mission": {
            "2023-24": (9200, 8100),
            "2024-25": (10400, 9300),
            "2025-26": (11100, 10000),
        },
        "Metro Rail Projects": {
            "2023-24": (14800, 13300),
            "2024-25": (15600, 14200),
            "2025-26": (17100, 15600),
        },
        "PM Gati Shakti": {
            "2023-24": (4800, 4300),
            "2024-25": (5100, 4600),
            "2025-26": (5600, 5000),
        },
    },
    "Rural Development": {
        "MGNREGA": {
            "2023-24": (72000, 63400),
            "2024-25": (76000, 65200),
            "2025-26": (95000, 10200),
        },
        "PM Awas Yojana (Gramin)": {
            "2023-24": (26000, 22800),
            "2024-25": (26800, 24100),
            "2025-26": (27600, 25200),
        },
        "PM Gram Sadak Yojana": {
            "2023-24": (12500, 11400),
            "2024-25": (13100, 12000),
            "2025-26": (13600, 12600),
        },
        "DAY-NRLM": {
            "2023-24": (8200, 7600),
            "2024-25": (8600, 8000),
            "2025-26": (9200, 8500),
        },
    },
    "Water Resources": {
        "Jal Jeevan Mission": {
            "2023-24": (48000, 45200),
            "2024-25": (51000, 47600),
            "2025-26": (52000, 48800),
        },
        "Namami Gange": {
            "2023-24": (3400, 3100),
            "2024-25": (3600, 3200),
            "2025-26": (3900, 3500),
        },
        "PM Krishi Sinchayee Yojana": {
            "2023-24": (5400, 4800),
            "2024-25": (5800, 5200),
            "2025-26": (6200, 5600),
        },
        "Dam Safety & Rehabilitation": {
            "2023-24": (1100, 850),
            "2024-25": (1200, 980),
            "2025-26": (1300, 1050),
        },
    },
    "Social Welfare": {
        "National Social Assistance Programme": {
            "2023-24": (9800, 9200),
            "2024-25": (11300, 10600),
            "2025-26": (9900, 9300),
        },
        "Integrated Child Development Services": {
            "2023-24": (8500, 8000),
            "2024-25": (9400, 8900),
            "2025-26": (8600, 8100),
        },
        "Beti Bachao Beti Padhao": {
            "2023-24": (1800, 1600),
            "2024-25": (1900, 1700),
            "2025-26": (1700, 1500),
        },
        "Skill Development for Marginalised Groups": {
            "2023-24": (2400, 2100),
            "2024-25": (2800, 2600),
            "2025-26": (2400, 2100),
        },
    },
    "Police": {
        "Modernisation of Police Forces": {
            "2023-24": (12100, 10800),
            "2024-25": (31000, 27000),
            "2025-26": (32000, 28800),
        },
        "Central Armed Police Forces": {
            "2023-24": (18800, 17200),
            "2024-25": (33600, 30800),
            "2025-26": (34000, 31200),
        },
        "Smart Policing & Forensics": {
            "2023-24": (2100, 1800),
            "2024-25": (2900, 2500),
            "2025-26": (3200, 2800),
        },
        "Border Infrastructure": {
            "2023-24": (1000, 800),
            "2024-25": (1500, 1200),
            "2025-26": (1800, 1500),
        },
    },
    "Transport": {
        "High Speed Rail & Vande Bharat": {
            "2023-24": (7800, 6900),
            "2024-25": (8200, 7100),
            "2025-26": (9000, 7900),
        },
        "Urban Mobility (Metro & E-Buses)": {
            "2023-24": (4100, 2100),
            "2024-25": (26000, 2100),
            "2025-26": (29500, 24300),
        },
        "Airport Expansion & UDAN": {
            "2023-24": (4100, 3600),
            "2024-25": (4400, 3900),
            "2025-26": (4600, 4100),
        },
        "Inland Waterways & Ports": {
            "2023-24": (2800, 2400),
            "2024-25": (3000, 2600),
            "2025-26": (3200, 2800),
        },
        "Road Safety & Smart Signalling": {
            "2023-24": (900, 700),
            "2024-25": (1100, 800),
            "2025-26": (1200, 900),
        },
    },
    "IT & Electronics": {
        "Digital India Programme": {
            "2023-24": (6800, 6300),
            "2024-25": (7100, 6600),
            "2025-26": (7600, 7100),
        },
        "Semiconductor Mission": {
            "2023-24": (4200, 2300),
            "2024-25": (5800, 3400),
            "2025-26": (24800, 12400),
        },
        "AI & Emerging Technologies": {
            "2023-24": (1500, 1300),
            "2024-25": (1800, 1600),
            "2025-26": (2300, 2000),
        },
        "Cybersecurity & Data Protection": {
            "2023-24": (1000, 800),
            "2024-25": (1100, 950),
            "2025-26": (1300, 1100),
        },
    },
}


def _wipe(conn):
    conn.execute("DELETE FROM allocations")
    conn.execute("DELETE FROM schemes")
    conn.execute("DELETE FROM departments")


def run(force=False):
    init_db()
    if count("departments") > 0 and not force:
        print("[seed] Budget data already present in %s (use --force to reload)." % DB_PATH)
        return

    conn = get_conn()
    try:
        if force:
            _wipe(conn)
        for dept_name, schemes in DEPARTMENTS.items():
            cur = conn.execute("INSERT INTO departments (name) VALUES (?)", (dept_name,))
            dept_id = cur.lastrowid
            for scheme_name, years in schemes.items():
                cur = conn.execute(
                    "INSERT INTO schemes (department_id, name) VALUES (?, ?)",
                    (dept_id, scheme_name),
                )
                scheme_id = cur.lastrowid
                for year, (allocated, spent) in years.items():
                    conn.execute(
                        "INSERT INTO allocations (scheme_id, fiscal_year, allocated, spent) "
                        "VALUES (?, ?, ?, ?)",
                        (scheme_id, year, allocated, spent),
                    )
        conn.commit()
    except Exception:
        conn.rollback()
        raise
    finally:
        conn.close()

    print("[seed] Loaded %d departments and %d allocations into %s" % (
        len(DEPARTMENTS),
        sum(len(s) * 3 for s in DEPARTMENTS.values()),
        DB_PATH,
    ))


if __name__ == "__main__":
    run(force="--force" in sys.argv)