"""Budget Transparency Dashboard - Flask REST API.

Run:  python app.py   ->  http://localhost:5000

CORS is enabled so the Vite dev server can call the API from another port.
The SQLite database is created and seeded automatically on first start.
"""
import os

from flask import Flask, jsonify, request
from flask_cors import CORS

import db
import gemini
import seed

app = Flask(__name__)
CORS(app, resources={r"/api/*": {"origins": "*"}})

LATEST_YEAR = "2025-26"
UNDERUTIL_THRESHOLD = 40.0   # utilization below this = red flag
SPIKE_THRESHOLD = 100.0      # yoy change above this = red flag

def seed_if_empty():
    db.init_db()

    if db.count("departments") == 0:
        seed.run()


seed_if_empty()

# --------------------------------------------------------------------------
# Formatting helpers
# --------------------------------------------------------------------------

def indian_comma(value):
    """Indian digit grouping, e.g. 662850 -> 6,62,850."""
    n = int(round(value))
    sign = "-" if n < 0 else ""
    s = str(abs(n))
    if len(s) <= 3:
        return sign + s
    last3 = s[-3:]
    rest = s[:-3]
    groups = []
    while rest:
        groups.insert(0, rest[-2:])
        rest = rest[:-2]
    return sign + ",".join(groups) + "," + last3


def money(value):
    return "₹" + indian_comma(value)


def pct_change(cur, prev):
    if prev in (None, 0):
        return None
    return (cur - prev) / prev * 100


def util(allocated, spent):
    return (spent / allocated * 100) if allocated else 0.0


# --------------------------------------------------------------------------
# Basic endpoints
# --------------------------------------------------------------------------

@app.get("/api/health")
def health():
    return jsonify({
        "status": "ok",
        "gemini": "live" if gemini.has_key() else "mock",
        "model": gemini.MODEL_NAME if gemini.has_key() else "offline-fallback",
        "database": db.DB_PATH,
    })


@app.get("/api/years")
def years():
    return jsonify(db.get_years())


@app.get("/api/departments")
def departments():
    return jsonify(db.get_departments())


@app.get("/api/overview")
def overview():
    year = request.args.get("year") or LATEST_YEAR
    if year not in db.get_years():
        return jsonify({"error": "Unknown fiscal year: %s" % year}), 400

    totals = db.totals_for(year=year)
    dept_rows = db.per_department(year)
    trend = db.trend()

    prev_year = None
    previous_allocated = None
    yoy_change = None
    years_list = db.get_years()
    if year in years_list:
        idx = years_list.index(year)
        if idx > 0:
            prev_year = years_list[idx - 1]
            previous_allocated = db.totals_for(year=prev_year)["allocated"]
            yoy_change = pct_change(totals["allocated"], previous_allocated)

    return jsonify({
        "year": year,
        "previous_year": prev_year,
        "total_allocated": totals["allocated"],
        "total_spent": totals["spent"],
        "utilization": util(totals["allocated"], totals["spent"]),
        "yoy_change_pct": yoy_change,
        "previous_allocated": previous_allocated,
        "departments": dept_rows,
        "trend": trend,
    })


@app.get("/api/department")
def department_detail():
    name = request.args.get("name", "").strip()
    year = request.args.get("year") or LATEST_YEAR
    if name not in {d["name"] for d in db.get_departments()}:
        return jsonify({"error": "Unknown department: %s" % name}), 404

    totals = db.totals_for(year=year, dept_name=name)
    trend = db.dept_trend(name)
    yoy_change = None
    prev_allocated = None
    if len(trend) >= 2 and trend[-1]["year"] == year:
        prev_row = trend[-2]
        prev_allocated = prev_row["allocated"]
        yoy_change = pct_change(totals["allocated"], prev_allocated)

    return jsonify({
        "department": name,
        "year": year,
        "allocated": totals["allocated"],
        "spent": totals["spent"],
        "utilization": util(totals["allocated"], totals["spent"]),
        "yoy_change_pct": yoy_change,
        "previous_allocated": prev_allocated,
        "trend": trend,
        "schemes": db.schemes_for(name, year),
    })


# --------------------------------------------------------------------------
# Comparison view
# --------------------------------------------------------------------------

@app.get("/api/compare")
def compare():
    ctype = request.args.get("type", "year")
    a = request.args.get("a", "")
    b = request.args.get("b", "")
    year = request.args.get("year") or LATEST_YEAR

    years_list = db.get_years()

    if ctype == "year":
        if a not in years_list or b not in years_list or a == b:
            return jsonify({"error": "Pick two different fiscal years"}), 400
        ta, tb = db.totals_for(year=a), db.totals_for(year=b)
        map_a = {r["name"]: r for r in db.per_department(a)}
        map_b = {r["name"]: r for r in db.per_department(b)}
        per_department = []
        for name, ra in map_a.items():
            rb = map_b[name]
            per_department.append({
                "name": ra["name"],
                "a_allocated": ra["allocated"], "a_spent": ra["spent"],
                "b_allocated": rb["allocated"], "b_spent": rb["spent"],
            })
        return jsonify({
            "type": "year",
            "a": {"label": a, "allocated": ta["allocated"], "spent": ta["spent"],
                  "utilization": util(ta["allocated"], ta["spent"])},
            "b": {"label": b, "allocated": tb["allocated"], "spent": tb["spent"],
                  "utilization": util(tb["allocated"], tb["spent"])},
            "per_department": per_department,
            "per_year": None,
        })

    # department comparison (within one fiscal year)
    names = {d["name"] for d in db.get_departments()}
    if a not in names or b not in names or a == b:
        return jsonify({"error": "Pick two different departments"}), 400

    ta, tb = db.totals_for(year=year, dept_name=a), db.totals_for(year=year, dept_name=b)
    return jsonify({
        "type": "department",
        "a": {"label": a, "allocated": ta["allocated"], "spent": ta["spent"],
              "utilization": util(ta["allocated"], ta["spent"]),
              "trend": db.dept_trend(a)},
        "b": {"label": b, "allocated": tb["allocated"], "spent": tb["spent"],
              "utilization": util(tb["allocated"], tb["spent"]),
              "trend": db.dept_trend(b)},
        "per_department": None,
        "per_year": [
            {"year": r["year"], "a": r_a["allocated"], "b": r_b["allocated"]}
            for r_a, r_b, r in
            zip(db.dept_trend(a), db.dept_trend(b), db.trend())
        ],
    })


# --------------------------------------------------------------------------
# Red flags & biggest movers (pure SQL-derived, no LLM involved)
# --------------------------------------------------------------------------

@app.get("/api/red-flags")
def red_flags():
    years_list = db.get_years()
    flags = []

    for i in range(1, len(years_list)):
        prev_y, cur_y = years_list[i - 1], years_list[i]
        rows_prev = {r["name"]: r for r in db.per_department(prev_y)}
        rows_cur = {r["name"]: r for r in db.per_department(cur_y)}
        for name, rc in rows_cur.items():
            rp = rows_prev[name]
            change = pct_change(rc["allocated"], rp["allocated"])
            if change is not None and change > SPIKE_THRESHOLD:
                flags.append({
                    "type": "spike",
                    "department": rc["name"],
                    "year": cur_y,
                    "from_year": prev_y,
                    "allocated": rc["allocated"],
                    "spent": rc["spent"],
                    "prev_allocated": rp["allocated"],
                    "prev_spent": rp["spent"],
                    "change_pct": change,
                    "detail": "%s was allocated ₹%s crore in %s, up ₹%s crore "
                              "(+%.1f%%) from ₹%s crore in %s."
                              % (rc["name"], indian_comma(rc["allocated"]), cur_y,
                                 indian_comma(rc["allocated"] - rp["allocated"]),
                                 change, indian_comma(rp["allocated"]), prev_y),
                })

    for y in years_list:
        for r in db.per_department(y):
            if r["allocated"] >= 2000 and r["utilization"] < UNDERUTIL_THRESHOLD:
                unspent = r["allocated"] - r["spent"]
                flags.append({
                    "type": "underutilization",
                    "department": r["name"],
                    "year": y,
                    "allocated": r["allocated"],
                    "spent": r["spent"],
                    "utilization": r["utilization"],
                    "unspent": unspent,
                    "detail": "%s spent only ₹%s crore of its ₹%s crore %s "
                              "allocation (%.1f%% utilized) — ₹%s crore appears unspent."
                              % (r["name"], indian_comma(r["spent"]),
                                 indian_comma(r["allocated"]), y, r["utilization"],
                                 indian_comma(unspent)),
                })

    flags.sort(key=lambda f: (-f.get("change_pct", 0) if f["type"] == "spike"
                              else -f.get("unspent", 0)))
    return jsonify({
        "flags": flags,
        "spike_threshold_pct": SPIKE_THRESHOLD,
        "underutil_threshold_pct": UNDERUTIL_THRESHOLD,
    })


@app.get("/api/movers")
def biggest_movers():
    years_list = db.get_years()
    if len(years_list) < 2:
        return jsonify({"error": "Not enough years"}), 400
    from_year, to_year = years_list[-2], years_list[-1]

    rows_prev = {r["name"]: r for r in db.per_department(from_year)}
    rows_cur = {r["name"]: r for r in db.per_department(to_year)}
    items = []
    for name, rc in rows_cur.items():
        rp = rows_prev[name]
        change = pct_change(rc["allocated"], rp["allocated"])
        items.append({
            "department": rc["name"],
            "from_year": from_year,
            "to_year": to_year,
            "allocated_from": rp["allocated"],
            "allocated_to": rc["allocated"],
            "change_pct": change,
            "change_abs": rc["allocated"] - rp["allocated"],
        })

    increases = sorted([i for i in items if i["change_abs"] > 0],
                       key=lambda i: i["change_pct"], reverse=True)[:3]
    decreases = sorted([i for i in items if i["change_abs"] < 0],
                       key=lambda i: i["change_pct"])[:3]
    return jsonify({
        "from_year": from_year,
        "to_year": to_year,
        "increases": increases,
        "decreases": decreases,
    })


# --------------------------------------------------------------------------
# Plain-language insights (Gemini, with deterministic template fallback)
# --------------------------------------------------------------------------

def template_insight(row, years_list):
    """One deterministic plain-language line per department. No LLM needed."""
    name, allocated, spent, util_pct = row["name"], row["allocated"], row["spent"], row["utilization"]
    unspent = allocated - spent
    yoy = None
    if len(years_list) >= 2 and years_list[-1] == "2025-26":
        prev = db.totals_for(year=years_list[-2], dept_name=name)
        yoy = pct_change(allocated, prev["allocated"]) if prev["allocated"] else None

    if util_pct < UNDERUTIL_THRESHOLD:
        return ("%s had ₹%s crore but spent only ₹%s crore (%.0f%% used in %s) — a large "
                "chunk looks unspent and is worth investigating."
                % (name, indian_comma(allocated), indian_comma(spent), util_pct, years_list[-1]))
    if yoy is not None and yoy > SPIKE_THRESHOLD:
        return ("%s's allocation jumped %.0f%% year on year — a surge this large deserves "
                "a closer look." % (name, yoy))
    if util_pct >= 95:
        return ("%s's spending almost matches its allocation (%.0f%% used) — funds appear "
                "to be reaching the ground." % (name, util_pct))
    if util_pct >= 80:
        return ("%s used %.0f%% of its %s allocation — healthy absorption of funds."
                % (name, util_pct, years_list[-1]))
    if util_pct >= 60:
        return ("%s used %.0f%% of its %s allocation — moderate slippage in spending pace."
                % (name, util_pct, years_list[-1]))
    return ("%s used only %.0f%% of its %s allocation — spending lagged badly, "
            "leaving ₹%s crore unspent." % (name, util_pct, years_list[-1], indian_comma(unspent)))


@app.get("/api/insights")
def insights():
    year = request.args.get("year") or LATEST_YEAR
    rows = db.per_department(year)
    years_list = db.get_years()
    fallback = {r["name"]: template_insight(r, years_list) for r in rows}

    if not gemini.has_key():
        return jsonify({"year": year, "mode": "fallback", "insights": fallback})

    try:
        data = gemini.generate_json(gemini.build_insights_prompt(year, rows))
        llm_map = data.get("insights", {}) if isinstance(data, dict) else {}
        merged = {}
        for r in rows:
            candidate = llm_map.get(r["name"])
            merged[r["name"]] = (str(candidate).strip() if candidate else None) or fallback[r["name"]]
        return jsonify({"year": year, "mode": "live", "insights": merged})
    except Exception:
        return jsonify({"year": year, "mode": "fallback", "insights": fallback})


# --------------------------------------------------------------------------
# Ask the Budget (highlight feature)
# --------------------------------------------------------------------------

def normalize_intent(intent):
    """Whitelist every field of the model-produced intent before using it."""
    metric = intent.get("metric")
    if metric not in gemini.METRICS:
        metric = "allocated"

    dept = match_department(intent.get("department"))
    cmp_dept = match_department(intent.get("comparison_department"))
    if cmp_dept == dept:
        cmp_dept = None

    years_list = db.get_years()
    y1 = intent.get("primary_year") or intent.get("year")
    y2 = intent.get("comparison_year")
    y1 = y1 if y1 in years_list else None
    y2 = y2 if (y2 in years_list and y2 != y1) else None

    return {
        "metric": metric,
        "department": dept,
        "comparison_department": cmp_dept,
        "primary_year": y1,
        "comparison_year": y2,
    }


def match_department(name):
    if not name:
        return None
    for d in db.get_departments():
        if d["name"].lower() == str(name).strip().lower():
            return d["name"]
    return None


def metric_value(metric, dept_name, year):
    """Translate the whitelisted metric into a (parameterized) DB lookup."""
    t = db.totals_for(year=year, dept_name=dept_name)
    if metric == "utilization":
        return util(t["allocated"], t["spent"])
    return t[metric]


def answer_from_intent(question, intent):
    metric = intent["metric"]
    dept = intent["department"]
    cmp_dept = intent["comparison_department"]
    y1 = intent["primary_year"] or LATEST_YEAR
    y2 = intent["comparison_year"]

    scope = dept or "the total budget across all departments"

    metric_phrases = {
        "allocated": "was allocated",
        "spent": "spent",
        "utilization": "used",
    }
    chart = []

    if cmp_dept:
        v_a = metric_value(metric, dept, y1)
        v_b = metric_value(metric, cmp_dept, y1)
        if metric == "utilization":
            answer = ("In %s, %s used %.1f%% of its budget while %s used %.1f%%."
                      % (y1, dept, v_a, cmp_dept, v_b))
            chart = [{"label": dept, "value": round(v_a, 1)},
                     {"label": cmp_dept, "value": round(v_b, 1)}]
        else:
            answer = ("In %s, %s %s %s, while %s %s %s."
                      % (y1, dept, metric_phrases[metric], money(v_a),
                         cmp_dept, metric_phrases[metric], money(v_b)))
            chart = [{"label": dept, "value": v_a}, {"label": cmp_dept, "value": v_b}]
        return {"answer": answer, "chart": chart}

    if y2:
        v_a = metric_value(metric, dept, y1)
        v_b = metric_value(metric, dept, y2)
        change = pct_change(v_a, v_b)
        if change is None:
            change_word = ""
        elif change >= 0:
            change_word = " — a rise of %.1f%%" % change
        else:
            change_word = " — a fall of %.1f%%" % abs(change)

        if metric == "utilization":
            answer = ("In %s, %s used %.1f%% of its budget, compared with %.1f%% in %s%s."
                      % (y1, scope, v_a, v_b, y2, change_word))
            chart = [{"label": y2, "value": round(v_b, 1)},
                     {"label": y1, "value": round(v_a, 1)}]
        else:
            answer = ("In %s, %s %s %s, compared with %s in %s%s."
                      % (y1, scope, metric_phrases[metric], money(v_a),
                         money(v_b), y2, change_word))
            chart = [{"label": y2, "value": v_b}, {"label": y1, "value": v_a}]
        return {"answer": answer, "chart": chart}

    v = metric_value(metric, dept, y1)
    if metric == "utilization":
        answer = "In %s, %s used %.1f%% of its budget." % (y1, scope, v)
    else:
        answer = "In %s, %s %s %s." % (y1, scope, metric_phrases[metric], money(v))
    return {"answer": answer, "chart": [{"label": y1, "value": v}]}


@app.post("/api/ask")
def ask():
    body = request.get_json(silent=True) or {}
    question = str(body.get("question", "")).strip()
    if not question:
        return jsonify({"error": "Please type a question first."}), 400

    mode = "live" if gemini.has_key() else "mock"
    intent = None
    if mode == "live":
        try:
            intent = gemini.generate_json(gemini.build_intent_prompt(question))
        except Exception:
            mode = "mock"
    if intent is None:
        intent = gemini.mock_intent(question)

    intent = normalize_intent(intent)
    result = answer_from_intent(question, intent)
    result.update({
        "question": question,
        "mode": mode,
        "intent": intent,
        "metric": intent["metric"],
        "department": intent["department"],
        "comparison_department": intent["comparison_department"],
        "primary_year": intent["primary_year"] or LATEST_YEAR,
        "comparison_year": intent["comparison_year"],
        "units": "₹ crore",
    })
    return jsonify(result)


if __name__ == "__main__":
    port = int(os.environ.get("PORT", "5000"))
    print("Budget Transparency Dashboard API on http://localhost:%d" % port)
    app.run(host="127.0.0.1", port=port, debug=True, use_reloader=False)