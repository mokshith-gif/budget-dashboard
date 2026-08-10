export function Card({ className = "", children }) {
  return <div className={`card ${className}`}>{children}</div>;
}

export function CardHeader({ title, subtitle, right }) {
  return (
    <div className="flex items-start justify-between gap-3 px-5 pt-4 pb-3 border-b border-slate-100">
      <div>
        <h3 className="text-sm font-bold text-slate-800">{title}</h3>
        {subtitle && <p className="text-xs text-slate-500 mt-0.5">{subtitle}</p>}
      </div>
      {right}
    </div>
  );
}

export function StatCard({ label, value, sub, accent = "text-slate-900" }) {
  return (
    <Card className="p-5">
      <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">{label}</p>
      <p className={`mt-2 text-2xl font-bold tabular-nums ${accent}`}>{value}</p>
      {sub && <p className="mt-1 text-xs text-slate-500">{sub}</p>}
    </Card>
  );
}

export function DeltaBadge({ pct, label = "" }) {
  if (pct === null || pct === undefined || isNaN(pct)) return null;
  const up = pct >= 0;
  return (
    <span className={up ? "delta-up" : "delta-down"}>
      {up ? "▲" : "▼"} {Math.abs(pct).toFixed(1)}% {label}
    </span>
  );
}

export function ProgressBar({ value, className = "" }) {
  const color =
    value >= 80 ? "bg-emerald-500" : value >= 60 ? "bg-amber-500" : "bg-rose-500";
  return (
    <div className={`h-2 w-full rounded-full bg-slate-200 overflow-hidden ${className}`}>
      <div
        className={`h-full rounded-full ${color} transition-all`}
        style={{ width: `${Math.min(100, Math.max(0, value))}%` }}
      />
    </div>
  );
}

export function Spinner({ label = "Loading…" }) {
  return (
    <div className="flex flex-col items-center justify-center gap-3 py-16 text-slate-400">
      <svg className="animate-spin h-8 w-8 text-brand-500" viewBox="0 0 24 24" fill="none">
        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
        <path
          className="opacity-75"
          fill="currentColor"
          d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z"
        />
      </svg>
      <p className="text-sm">{label}</p>
    </div>
  );
}

export function ErrorBanner({ message, onRetry }) {
  return (
    <Card className="p-8">
      <div className="flex flex-col items-center gap-3 text-center">
        <div className="h-12 w-12 rounded-full bg-rose-100 flex items-center justify-center">
          <svg className="h-6 w-6 text-rose-600" viewBox="0 0 24 24" fill="none">
            <path
              d="M12 9v4m0 4h.01M10.3 3.9L1.8 18a2 2 0 001.7 3h17a2 2 0 001.7-3L13.7 3.9a2 2 0 00-3.4 0z"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </div>
        <div>
          <p className="font-semibold text-slate-800">Could not reach the backend</p>
          <p className="text-sm text-slate-500 mt-1 max-w-md">{message}</p>
          <p className="text-xs text-slate-400 mt-3 font-mono">python app.py  (in /backend)</p>
        </div>
        {onRetry && (
          <button className="btn-primary mt-2" onClick={onRetry}>
            Try again
          </button>
        )}
      </div>
    </Card>
  );
}