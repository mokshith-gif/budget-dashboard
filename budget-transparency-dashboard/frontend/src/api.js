const BASE = import.meta.env.VITE_API_URL || "";

async function getJSON(path, params = {}) {
  const qs = new URLSearchParams(
    Object.entries(params).filter(([, v]) => v !== undefined && v !== null && v !== "")
  ).toString();
  const url = `${BASE}${path}${qs ? `?${qs}` : ""}`;
  const res = await fetch(url, { headers: { Accept: "application/json" } });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body?.error || `Request failed (${res.status})`);
  }
  return res.json();
}

async function postJSON(path, payload) {
  const res = await fetch(`${BASE}${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body?.error || `Request failed (${res.status})`);
  }
  return res.json();
}

export const api = {
  health: () => getJSON("/api/health"),
  years: () => getJSON("/api/years"),
  departments: () => getJSON("/api/departments"),
  overview: (year) => getJSON("/api/overview", { year }),
  department: (name, year) => getJSON("/api/department", { name, year }),
  compareYears: (a, b) => getJSON("/api/compare", { type: "year", a, b }),
  compareDepartments: (a, b, year) =>
    getJSON("/api/compare", { type: "department", a, b, year }),
  ask: (question) => postJSON("/api/ask", { question }),
  redFlags: () => getJSON("/api/red-flags"),
  movers: () => getJSON("/api/movers"),
  insights: (year) => getJSON("/api/insights", { year }),
};