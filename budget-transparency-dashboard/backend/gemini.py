"""Gemini wrapper + safe deterministic fallback for the Budget Transparency Dashboard.

* Reads GEMINI_API_KEY from the environment (or backend/.env via python-dotenv).
* If the key is missing (or the API call fails), the app falls back to a
  deterministic keyword-based intent parser so the demo always works offline.
* Generates a strict JSON intent from a plain-language question. The LLM NEVER
  executes SQL — it only produces a JSON intent which the backend translates
  into whitelisted, parameterized SQL.
* Retries with exponential backoff when the API returns HTTP 429 (rate limit).
"""
import json
import os
import random
import time

import google.generativeai as genai
from dotenv import load_dotenv

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
load_dotenv(os.path.join(BASE_DIR, ".env"))

MODEL_NAME = "gemini-2.5-flash"

DEPARTMENTS = [
    "Health", "Education", "Agriculture", "Infrastructure",
    "Rural Development", "Water Resources", "Social Welfare",
    "Police", "Transport", "IT & Electronics",
]
YEARS = ["2023-24", "2024-25", "2025-26"]

METRICS = ["allocated", "spent", "utilization"]


class GeminiUnavailable(Exception):
    """Raised when no API key is configured."""


def has_key():
    return bool(os.environ.get("GEMINI_API_KEY", "").strip())


def _client():
    key = os.environ.get("GEMINI_API_KEY", "").strip()
    if not key:
        raise GeminiUnavailable("GEMINI_API_KEY is not set")
    genai.configure(api_key=key)


def generate_json(prompt, retries=3):
    """Ask the model for a JSON object, retrying on HTTP 429 rate limits.

    Raises GeminiUnavailable if no key is set, otherwise the last exception.
    """
    _client()
    model = genai.GenerativeModel(MODEL_NAME)
    last_error = None
    for attempt in range(max(1, retries)):
        try:
            response = model.generate_content(
                prompt,
                generation_config=genai.types.GenerationConfig(
                    temperature=0.1,
                    response_mime_type="application/json",
                ),
            )
            text = (response.text or "").strip()
            if text.startswith("```"):
                text = text.strip("`")
                if text.startswith("json"):
                    text = text[4:]
            data = json.loads(text)
            if isinstance(data, dict):
                return data
            raise ValueError("Gemini returned a non-object JSON payload")
        except Exception as exc:  # includes google 429 ResourceExhausted
            status = getattr(exc, "status_code", None) or getattr(exc, "status", None)
            is_429 = status == 429 or "429" in str(exc)
            last_error = exc
            if is_429 and attempt < retries - 1:
                backoff = 2 ** attempt * 2 + random.uniform(0, 1)
                time.sleep(backoff)
                continue
            raise


# --------------------------------------------------------------------------
# Intent prompts (NO SQL is ever sent to the model)
# --------------------------------------------------------------------------

def build_intent_prompt(question):
    return (
        "You translate a citizen's plain-English question about a government budget "
        "database into a strict JSON intent. You NEVER produce SQL; you only emit JSON.\n\n"
        "SCHEMA SUMMARY\n"
        "- departments: name of a government department\n"
        "- schemes: individual programmes; each scheme belongs to exactly one department\n"
        "- allocations: per scheme and fiscal year: allocated (₹ crore) and spent (₹ crore)\n\n"
        "AVAILABLE FISCAL YEARS: " + ", ".join(YEARS) + "\n"
        "DEPARTMENT NAMES (use exactly): " + "; ".join(DEPARTMENTS) + "\n\n"
        "INTENT FORMAT (output ONLY this JSON, no prose):\n"
        '{"metric": "allocated" | "spent" | "utilization", '
        '"department": "<name or null>", '
        '"primary_year": "<year or null>", '
        '"comparison_year": "<year or null>", '
        '"comparison_department": "<name or null>"}\n\n'
        "INTERPRETATION RULES\n"
        '- "this year" / "current year" / "this financial year" means 2025-26.\n'
        '- "last year" / "previous year" means 2024-25.\n'
        '- "vs", "versus", "compared to/with", "than" indicate a comparison; put the '
        "earlier reference in comparison_year.\n"
        '- "how much did X get / receive / was allocated" -> metric "allocated".\n'
        '- "spend/expenditure/used money" -> metric "spent".\n'
        '- "utilization/utilisation/utilised/absorbed" -> metric "utilization".\n'
        '- If the question mentions two departments and a comparison word, set '
        "comparison_department to the second one.\n"
        "- If something is unclear, prefer the most plausible guess and use null "
        "rather than inventing values.\n\n"
        'QUESTION: """%s"""' % question
    )


def build_insights_prompt(year, rows):
    lines = "\n".join(
        "- %s: allocated ₹%.0f crore, spent ₹%.0f crore (%.1f%% utilized)"
        % (r["name"], r["allocated"], r["spent"], r["utilization"])
        for r in rows
    )
    return (
        "You are a public-finance explainer for ordinary citizens. For each department "
        "above, write ONE short plain-language sentence (max 140 characters, no markdown, "
        "no emoji) that explains what the numbers mean to a citizen - signposting "
        "anomalies like big jumps or unspent money.\n\n"
        "OUTPUT ONLY JSON of the form: {\"insights\": {\"<department name>\": \"<sentence>\", ...}}\n\n"
        "RULES\n"
        "- Use each department's exact name as the JSON key.\n"
        "- If utilization is below 40%, mention that most of the money went unspent.\n"
        "- If utilization is above 95%, say money is reaching the ground.\n"
        "- Do not invent numbers that are not in the list above.\n\n"
        "YEAR: %s\n\nDEPARTMENTS:\n%s" % (year, lines)
    )


# --------------------------------------------------------------------------
# Deterministic mock fallback (works without any API key)
# --------------------------------------------------------------------------

def _match_department(text):
    for name in DEPARTMENTS:
        if name.lower() in text:
            return name
    if "it and electronics" in text or text.strip() == "it" or " it " in text:
        return "IT & Electronics"
    return None


def mock_intent(question):
    """Keyword-based intent parser; the exact same JSON shape as the Gemini path."""
    q = " " + question.lower().strip() + " "

    if any(w in q for w in ["utiliz", "utilis", "absorbed", "absorb"]):
        metric = "utilization"
    elif ("% of" in q or "percentage of" in q or "percent of" in q) and "used" in q:
        metric = "utilization"
    elif (" use " in q or " used " in q) and ("budget" in q or "allocat" in q):
        metric = "utilization"
    elif any(w in q for w in ["spent", "spend", "spending", "expenditure"]):
        metric = "spent"
    else:
        metric = "allocated"

    mentions = []
    for y in YEARS:
        if y in q:
            mentions.append(y)
    if "this year" in q or "current year" in q or "this financial year" in q:
        mentions.append("2025-26")
    if "last year" in q or "previous year" in q or "last financial year" in q:
        mentions.append("2024-25")
    mentions = sorted(set(mentions), key=YEARS.index)

    comparison = any(w in q for w in [" vs ", " vs.", "versus", "compared", "compared to",
                                      "compared with", " than ", "compare "])

    if comparison and len(mentions) >= 2:
        primary_year = mentions[-1]
        comparison_year = mentions[0]
    else:
        primary_year = mentions[0] if mentions else None
        comparison_year = None

    dept = _match_department(q)
    depts_found = [n for n in DEPARTMENTS if n.lower() in q]
    comparison_department = None
    if comparison and len(depts_found) >= 2:
        dept, comparison_department = depts_found[0], depts_found[1]

    return {
        "metric": metric,
        "department": dept,
        "primary_year": primary_year,
        "comparison_year": comparison_year,
        "comparison_department": comparison_department,
    }