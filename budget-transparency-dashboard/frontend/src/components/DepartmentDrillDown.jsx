import { useMemo } from "react";
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  LineChart,
  Line,
} from "recharts";
import { api } from "../api";
import { useFetch, fmtINR, fmtINRShort, fmtPct, chartAxis } from "../utils";
import {
  Card,
  CardHeader,
  StatCard,
  DeltaBadge,
  Spinner,
  ErrorBanner,
  ProgressBar,
} from "./ui";

const ALLOC_COLOR = "#6366f1";
const SPEND_COLOR = "#10b981";

function DeptCard({ name, stats, active, onClick }) {
  return (
    <button
      onClick={onClick}
      className={`card p-4 text-left transition-all hover:-translate-y-0.5 hover:shadow-md ${
        active ? "ring-2 ring-brand-500 shadow-lift" : ""
      }`}
    >
      <div className="flex items-center justify-between gap-2">
        <p className="font-bold text-sm text-slate-800">{name}</p>
        {stats && (
          <span
            className={`text-xs font-bold px-2 py-0.5 rounded-full ${
              stats.utilization < 40
                ? "bg-rose-50 text-rose-600"
                : stats.utilization < 80
                ? "bg-amber-50 text-amber-600"
                : "bg-emerald-50 text-emerald-600"
            }`}
          >
            {fmtPct(stats.utilization)} used
          </span>
        )}
      </div>
      {stats && (
        <div className="mt-3 flex items-center justify-between text-xs text-slate-500">
          <span>Allocated {fmtINRShort(stats.allocated)}</span>
          <span>Spent {fmtINRShort(stats.spent)}</span>
        </div>
      )}
      {stats && <ProgressBar value={stats.utilization} className="mt-2" />}
    </button>
  );
}

export default function DepartmentDrillDown({ year, department, setDepartment }) {
  const overview = useFetch(() => api.overview(year), [year]);
  const detail = useFetch(
    () => (department ? api.department(department, year) : Promise.resolve(null)),
    [department, year]
  );

  const statsByName = useMemo(() => {
    const map = {};
    (overview.data?.departments || []).forEach((row) => (map[row.name] = row));
    return map;
  }, [overview.data]);

  const d = detail.data;
  const showDetail = department && !detail.loading && !detail.error && d;

  return (
    <div className="space-y-6">
      <div className="px-1">
        <h2 className="text-xl font-extrabold text-slate-900">Department drill-down</h2>
        <p className="text-sm text-slate-500 mt-0.5">
          Pick a department to see its schemes, spending pace and what it means · FY {year}
        </p>
      </div>

      {overview.error ? (
        <ErrorBanner message={overview.error} />
      ) : overview.loading ? (
        <Spinner />
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {overview.data.departments.map((dept) => (
            <DeptCard
              key={dept.name}
              name={dept.name}
              stats={statsByName[dept.name]}
              active={department === dept.name}
              onClick={() => setDepartment(dept.name)}
            />
          ))}
        </div>
      )}

      {department && detail.error ? (
        <ErrorBanner message={detail.error} />
      ) : department && detail.loading ? (
        <Spinner label={"Loading " + department + "..."} />
      ) : showDetail ? (
        <DepartmentDetail d={d} onBack={() => setDepartment(null)} />
      ) : null}
    </div>
  );
}

function DepartmentDetail({ d, onBack }) {
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-3">
        <h3 className="text-lg font-extrabold text-slate-900">{d.department}</h3>
        <DeltaBadge pct={d.yoy_change_pct} label="allocation vs prior year" />
        <button onClick={onBack} className="btn-ghost !py-1.5 !px-3 text-xs">
          {"<-"} Back to all departments
        </button>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <StatCard
          label={`Allocated - FY ${d.year}`}
          value={fmtINRShort(d.allocated)}
          sub={fmtINR(d.allocated) + " crore"}
          accent="text-brand-700"
        />
        <StatCard
          label={`Spent - FY ${d.year}`}
          value={fmtINRShort(d.spent)}
          sub={
            d.allocated > 0 ? fmtINRShort(d.allocated - d.spent) + " unspent" : undefined
          }
          accent="text-emerald-600"
        />
        <StatCard
          label="Utilization"
          value={fmtPct(d.utilization)}
          sub={
            d.yoy_change_pct !== null && d.yoy_change_pct !== undefined
              ? `YoY ${d.yoy_change_pct.toFixed(1)}%`
              : undefined
          }
          accent={
            d.utilization >= 80
              ? "text-emerald-600"
              : d.utilization >= 60
              ? "text-amber-600"
              : "text-rose-600"
          }
        />
      </div>

      <Card>
        <CardHeader
          title={`Schemes under ${d.department}`}
          subtitle={`FY ${d.year} - in ₹ crore - utilization = spent / allocated`}
        />
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-xs uppercase tracking-wide text-slate-500 border-b border-slate-100">
                <th className="px-5 py-3 font-semibold">Scheme</th>
                <th className="px-5 py-3 font-semibold text-right">Allocated</th>
                <th className="px-5 py-3 font-semibold text-right">Spent</th>
                <th className="px-5 py-3 font-semibold text-right">% utilized</th>
                <th className="px-5 py-3 font-semibold w-56">Pace</th>
              </tr>
            </thead>
            <tbody>
              {d.schemes.map((s) => (
                <tr key={s.scheme} className="border-b border-slate-50 hover:bg-slate-50/60">
                  <td className="px-5 py-3 font-semibold text-slate-800">{s.scheme}</td>
                  <td className="px-5 py-3 text-right tabular-nums text-slate-700">
                    {fmtINR(s.allocated)}
                  </td>
                  <td className="px-5 py-3 text-right tabular-nums text-slate-700">
                    {fmtINR(s.spent)}
                  </td>
                  <td className="px-5 py-3 text-right tabular-nums">
                    <span
                      className={`font-bold ${
                        s.utilization < 40
                          ? "text-rose-600"
                          : s.utilization < 80
                          ? "text-amber-600"
                          : "text-emerald-600"
                      }`}
                    >
                      {fmtPct(s.utilization)}
                    </span>
                  </td>
                  <td className="px-5 py-3">
                    <ProgressBar value={s.utilization} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Card className="p-5">
          <CardHeader title={`${d.department} - allocation & spending`} subtitle="₹ crore" />
          <div className="pt-4" style={{ height: 260 }}>
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={d.trend} margin={{ top: 5, right: 10, left: 0, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" vertical={false} />
                <XAxis dataKey="year" tick={{ fontSize: 12, fill: "#64748b" }} />
                <YAxis tickFormatter={chartAxis} tick={{ fontSize: 11, fill: "#64748b" }} width={70} />
                <Tooltip
                  wrapperStyle={{ borderRadius: 8 }}
                  formatter={(v, name) => [fmtINRShort(v), name]}
                />
                <Legend wrapperStyle={{ fontSize: 12 }} />
                <Bar dataKey="allocated" name="Allocated" fill={ALLOC_COLOR} radius={[3, 3, 0, 0]} />
                <Bar dataKey="spent" name="Spent" fill={SPEND_COLOR} radius={[3, 3, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </Card>

        <Card className="p-5">
          <CardHeader title="Utilization trend" subtitle="% of allocation actually spent" />
          <div className="pt-4" style={{ height: 260 }}>
            <ResponsiveContainer width="100%" height="100%">
              <LineChart
                data={d.trend.map((t) => ({
                  year: t.year,
                  utilization: t.allocated > 0 ? (t.spent / t.allocated) * 100 : 0,
                }))}
                margin={{ top: 5, right: 10, left: 0, bottom: 0 }}
              >
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                <XAxis dataKey="year" tick={{ fontSize: 12, fill: "#64748b" }} />
                <YAxis domain={[0, 100]} tick={{ fontSize: 11, fill: "#64748b" }} width={40} />
                <Tooltip formatter={(v) => [fmtPct(v), "Utilization"]} />
                <Line
                  type="monotone"
                  dataKey="utilization"
                  name="Utilization"
                  stroke="#f59e0b"
                  strokeWidth={3}
                  dot={{ r: 5, fill: "#f59e0b" }}
                  activeDot={{ r: 7 }}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </Card>
      </div>
    </div>
  );
}