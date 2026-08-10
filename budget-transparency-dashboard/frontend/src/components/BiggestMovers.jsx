import { Card, CardHeader, Spinner } from "./ui";
import { fmtINRShort, fmtPct } from "../utils";

function MoverRow({ item, tone }) {
  const up = tone === "up";
  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center justify-between gap-2">
        <button
          onClick={() => undefined}
          className="text-sm font-semibold text-slate-800 hover:text-brand-600"
        >
          {item.department}
        </button>
        <span className={up ? "delta-up" : "delta-down"}>
          {up ? "+" : ""}
          {item.change_pct === null || item.change_pct === undefined
            ? "—"
            : item.change_pct.toFixed(0) + "%"}
        </span>
      </div>
      <div className="text-xs text-slate-500">
        {fmtINRShort(item.allocated_from)} → {fmtINRShort(item.allocated_to)}
        <span className="text-slate-400">
          {" "}
          · FY {item.from_year} → FY {item.to_year}
        </span>
      </div>
    </div>
  );
}

export default function BiggestMovers({ movers, onOpenDepartment }) {
  return (
    <Card>
      <CardHeader
        title="Biggest movers"
        subtitle={`Allocation change, FY ${movers.data?.from_year ?? "—"} → FY ${
          movers.data?.to_year ?? "—"
        }`}
      />
      <div className="px-5 py-4 space-y-5">
        {movers.loading ? (
          <Spinner label="Computing movers…" />
        ) : (
          <>
            <div>
              <p className="section-title mb-2 text-emerald-700">Largest increases</p>
              <div className="space-y-3">
                {(movers.data?.increases ?? []).map((item) => (
                  <button
                    key={item.department}
                    onClick={() => onOpenDepartment(item.department)}
                    className="w-full text-left hover:bg-slate-50 rounded-lg -m-1 p-1 transition-colors"
                  >
                    <MoverRow item={item} tone="up" />
                  </button>
                ))}
                {!movers.data?.increases?.length && (
                  <p className="text-xs text-slate-400">No increases on record.</p>
                )}
              </div>
            </div>
            <div className="border-t border-slate-100 pt-4">
              <p className="section-title mb-2 text-rose-700">Largest decreases</p>
              <div className="space-y-3">
                {(movers.data?.decreases ?? []).map((item) => (
                  <button
                    key={item.department}
                    onClick={() => onOpenDepartment(item.department)}
                    className="w-full text-left hover:bg-slate-50 rounded-lg -m-1 p-1 transition-colors"
                  >
                    <MoverRow item={item} tone="down" />
                  </button>
                ))}
                {!movers.data?.decreases?.length && (
                  <p className="text-xs text-slate-400">No decreases on record.</p>
                )}
              </div>
            </div>
          </>
        )}
      </div>
    </Card>
  );
}