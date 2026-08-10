import { api } from "../api";
import { useFetch, fmtINR, fmtPct } from "../utils";
import { Card, CardHeader, Spinner, ErrorBanner } from "./ui";

const TYPE_META = {
  spike: {
    title: "Budget jumped>100%",
    badge: "bg-rose-500",
    ring: "ring-rose-200",
    icon: "#f43f5e",
    note: "Allocation more than doubled in one year — sudden jumps deserve scrutiny.",
  },
  underutilization: {
    title: "Large unspent allocation",
    badge: "bg-amber-500",
    ring: "ring-amber-200",
    icon: "#f59e0b",
    note: "Less than 40% of the allocation was spent — money may be stuck, delayed or lapsed.",
  },
};

export default function RedFlags({ onOpenDepartment, onOpenAsk }) {
  const flags = useFetch(api.redFlags, []);

  return (
    <div className="space-y-6">
      <div className="px-1 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="text-xl font-extrabold text-slate-900">Worth a look</h2>
          <p className="text-sm text-slate-500 mt-0.5">
            Auto-detected anomalies — allocation spikes over 100% year-on-year and
            departments that used under 40% of their budget.
          </p>
        </div>
        {flags.data && (
          <p className="text-xs text-slate-400">
            {flags.data.flags.length} flag{flags.data.flags.length === 1 ? "" : "s"} detected ·
            thresholds: +{flags.data.spike_threshold_pct}% YoY,{" "}
            {flags.data.underutil_threshold_pct}% utilization
          </p>
        )}
      </div>

      {flags.error ? (
        <ErrorBanner message={flags.error} />
      ) : flags.loading ? (
        <Spinner label="Scanning the budget…" />
      ) : !flags.data.flags.length ? (
        <Card className="p-10 text-center">
          <p className="font-semibold text-slate-700">All clear — no anomalies detected.</p>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {flags.data.flags.map((f, i) => {
            const meta = TYPE_META[f.type];
            return (
              <Card key={f.type + f.department + f.year + i} className={`overflow-hidden ${meta.ring} ring-1`}>
                <div className={`h-1.5 w-full ${meta.badge}`} />
                <div className="p-5">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-center gap-3">
                      <div
                        className="h-10 w-10 rounded-lg flex items-center justify-center text-white"
                        style={{ background: meta.icon }}
                      >
                        <svg className="h-5 w-5" viewBox="0 0 24 24" fill="currentColor">
                          {f.type === "spike" ? (
                            <path d="M3 17l6-6 4 4 8-8v5h2V3h-9v2h5l-6 6-4-4-8 8z" />
                          ) : (
                            <path d="M12 2a7 7 0 00-7 7v6a7 7 0 0014 0V9a7 7 0 00-7-7zm-5 7a5 5 0 0110 0v1H7V9zm5 12a5 5 0 01-5-5v-1h10v1a5 5 0 01-5 5z" />
                          )}
                        </svg>
                      </div>
                      <div>
                        <p className="font-bold text-slate-900">{f.department}</p>
                        <p className="text-xs font-semibold text-slate-500">
                          {meta.title} · FY {f.year}
                          {f.from_year ? ` (vs FY ${f.from_year})` : ""}
                        </p>
                      </div>
                    </div>
                  </div>

                  <p className="mt-4 text-sm text-slate-700 leading-relaxed">{f.detail}</p>

                  <div className="mt-4 grid grid-cols-3 gap-3 text-center">
                    <div className="rounded-lg bg-slate-50 p-2.5">
                      <p className="text-[11px] font-semibold text-slate-500 uppercase">Allocated</p>
                      <p className="text-sm font-extrabold text-brand-700 tabular-nums">
                        {fmtINR(f.allocated)}
                      </p>
                    </div>
                    <div className="rounded-lg bg-slate-50 p-2.5">
                      <p className="text-[11px] font-semibold text-slate-500 uppercase">Spent</p>
                      <p className="text-sm font-extrabold text-emerald-600 tabular-nums">
                        {fmtINR(f.spent)}
                      </p>
                    </div>
                    <div className="rounded-lg bg-slate-50 p-2.5">
                      <p className="text-[11px] font-semibold text-slate-500 uppercase">
                        {f.type === "spike" ? "Increase" : "Utilization"}
                      </p>
                      <p className="text-sm font-extrabold text-slate-900 tabular-nums">
                        {f.type === "spike"
                          ? "+" + f.change_pct.toFixed(0) + "%"
                          : fmtPct(f.utilization)}
                      </p>
                    </div>
                  </div>

                  <div className="mt-4 flex items-center justify-between gap-3">
                    <p className="text-xs text-slate-400 italic">{meta.note}</p>
                    <button
                      onClick={() => onOpenDepartment(f.department)}
                      className="btn-ghost !py-1.5 !px-3 text-xs shrink-0"
                    >
                      Drill down →
                    </button>
                  </div>
                </div>
              </Card>
            );
          })}
        </div>
      )}

      <Card className="p-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="font-bold text-slate-800">Not sure what to ask?</p>
            <p className="text-sm text-slate-500 mt-0.5">
              Try “how much did health get this year vs last year” in Ask the Budget.
            </p>
          </div>
          <button className="btn-primary" onClick={onOpenAsk}>
            Ask the budget
          </button>
        </div>
      </Card>
    </div>
  );
}