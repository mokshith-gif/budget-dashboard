const TABS = [
  { id: "overview", label: "Overview" },
  { id: "departments", label: "Departments" },
  { id: "compare", label: "Compare" },
  { id: "ask", label: "Ask the Budget" },
  { id: "flags", label: "Red Flags" },
];

export default function Header({ tab, setTab, geminiMode }) {
  return (
    <header className="bg-slate-900 sticky top-0 z-40 shadow-lg">
      <div className="max-w-7xl mx-auto px-4 sm:px-6">
        <div className="flex flex-wrap items-center justify-between gap-3 py-4">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-lg bg-brand-600 flex items-center justify-center shadow-lift">
              <svg className="h-6 w-6 text-white" viewBox="0 0 24 24" fill="none">
                <path d="M4 18h2V10H4v8zm7 0h2V6h-2v12zm7 0h2V3h-2v15z" fill="currentColor" />
                <path d="M3 21h18" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
              </svg>
            </div>
            <div>
              <h1 className="text-lg font-extrabold text-white leading-tight tracking-tight">
                Budget Transparency Dashboard
              </h1>
              <p className="text-xs text-slate-400">
                Central government budgets — sample data · ₹ crore · FY 2023-24 to 2025-26
              </p>
            </div>
          </div>

          <div
            className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-semibold ring-1 ${
              geminiMode === "live"
                ? "bg-emerald-500/10 text-emerald-300 ring-emerald-500/30"
                : "bg-amber-500/10 text-amber-300 ring-amber-500/30"
            }`}
            title={
              geminiMode === "live"
                ? "Gemini connected via GEMINI_API_KEY"
                : "No GEMINI_API_KEY — deterministic offline fallback active"
            }
          >
            <span
              className={`h-1.5 w-1.5 rounded-full ${
                geminiMode === "live" ? "bg-emerald-400" : "bg-amber-400"
              }`}
            />
            {geminiMode === "live" ? "Gemini connected" : "Offline AI mode (mock)"}
          </div>
        </div>

        <nav className="flex flex-wrap gap-1 pb-3">
          {TABS.map((t) => (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              className={`nav-pill ${tab === t.id ? "active" : ""}`}
            >
              {t.label}
            </button>
          ))}
        </nav>
      </div>
    </header>
  );
}