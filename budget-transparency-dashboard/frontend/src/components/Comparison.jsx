import { useState } from "react";
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
import { useFetch, fmtINR, fmtINRShort, fmtPct, chartAxis, pctChange } from "../utils";
import { Card, CardHeader, Spinner, ErrorBanner, StatCard } from "./ui";

const ALLOC_COLOR = "#6366f1";
const SPEND_COLOR = "#10b981";
const A_COLOR = "#6366f1";
const B_COLOR = "#f59e0b";

function Select({ label, value, onChange, options }) {
  return (
    <label className="flex flex-col gap-1">
      <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">{label}</span>
      <select className="input !w-auto min-w-44" value={value} onChange={(e) => onChange(e.target.value)}>
        {options.map((o) => (
          <option key={o} value={o}>
            {o}
          </option>
        ))}
      </select>
    </label>
  );
}

function SideStats({ side, other }) {
  const change = pctChange(side.allocated, other?.allocated);
  return (
    <Card className="p-5">
      <div className="flex items-center justify-between mb-3">
        <p className="font-bold text-slate-800">{side.label}</p>
        {change !== null && change !== undefined && (
          <span className={change >= 0 ? "delta-up" : "delta-down"}>
            {change >= 0 ? "+" : ""}
            {change.toFixed(1)}% vs other
          </span>
        )}
      </div>
      <div className="grid grid-cols-3 gap-3 text-center">
        <div>
          <p className="text-xs text-slate-500 font-semibold">Allocated</p>
          <p className="text-base font-extrabold text-brand-700 tabular-nums">
            {fmtINRShort(side.allocated)}
          </p>
        </div>
        <div>
          <p className="text-xs text-slate-500 font-semibold">Spent</p>
          <p className="text-base font-extrabold text-emerald-600 tabular-nums">
            {fmtINRShort(side.spent)}
          </p>
        </div>
        <div>
          <p className="text-xs text-slate-500 font-semibold">Utilization</p>
          <p className="text-base font-extrabold text-slate-900 tabular-nums">
            {fmtPct(side.utilization)}
          </p>
        </div>
      </div>
    </Card>
  );
}

function MoneyTooltip({ active, payload, label }) {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-lg bg-slate-900/95 px-3 py-2 text-xs text-white shadow-xl">
      <p className="font-semibold mb-1">{label}</p>
      {payload.map((p) => (
        <p key={String(p.dataKey)}>
          <span className="font-semibold">{p.name}: </span>
          {fmtINRShort(p.value)}
        </p>
      ))}
    </div>
  );
}

export default function Comparison({ year }) {
  const [mode, setMode] = useState("year");
  const { data: yearsData } = useFetch(api.years, []);
  const { data: deptsData } = useFetch(api.departments, []);
  const years = yearsData || ["2023-24", "2024-25", "2025-26"];
  const depts = deptsData || [];

  const [yearA, setYearA] = useState("2024-25");
  const [yearB, setYearB] = useState("2025-26");
  const [deptA, setDeptA] = useState("Health");
  const [deptB, setDeptB] = useState("Education");
  const [deptYear, setDeptYear] = useState(year);

  const comp = useFetch(
    () =>
      mode === "year"
        ? api.compareYears(yearA, yearB)
        : api.compareDepartments(deptA, deptB, deptYear),
    [mode, yearA, yearB, deptA, deptB, deptYear]
  );

  const d = comp.data;
  const yearMode = mode === "year";

  return (
    <div className="space-y-6">
      <div className="px-1">
        <h2 className="text-xl font-extrabold text-slate-900">Comparison view</h2>
        <p className="text-sm text-slate-500 mt-0.5">
          Compare two fiscal years or two departments, side by side.
        </p>
        <div className="mt-4 inline-flex rounded-lg bg-white border border-slate-200 p-1 shadow-card">
          {[
            { id: "year", label: "Compare years" },
            { id: "department", label: "Compare departments" },
          ].map((m) => (
            <button
              key={m.id}
              onClick={() => setMode(m.id)}
              className={`px-4 py-1.5 rounded-md text-sm font-semibold transition-colors ${
                mode === m.id
                  ? "bg-brand-600 text-white shadow-sm"
                  : "text-slate-600 hover:bg-slate-100"
              }`}
            >
              {m.label}
            </button>
          ))}
        </div>
        <div className="mt-4 flex flex-wrap items-end gap-4">
          {yearMode ? (
            <>
              <Select label="From year" value={yearA} onChange={setYearA} options={years} />
              <Select label="To year" value={yearB} onChange={setYearB} options={years} />
            </>
          ) : (
            <>
              <Select label="Department A" value={deptA} onChange={setDeptA} options={depts.map((x) => x.name)} />
              <Select label="Department B" value={deptB} onChange={setDeptB} options={depts.map((x) => x.name)} />
              <Select label="For the year" value={deptYear} onChange={setDeptYear} options={years} />
            </>
          )}
        </div>
      </div>

      {comp.error ? (
        <ErrorBanner message={comp.error} />
      ) : comp.loading ? (
        <Spinner label="Comparing…" />
      ) : d ? (
        <>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <SideStats side={d.a} other={d.b} />
            <SideStats side={d.b} other={d.a} />
          </div>

          {yearMode ? (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              <Card className="p-5">
                <CardHeader
                  title="Allocated — department by department"
                  subtitle={`${d.a.label} vs ${d.b.label} · ₹ crore`}
                />
                <div className="pt-4" style={{ height: 320 }}>
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={d.per_department} margin={{ top: 5, right: 10, left: 0, bottom: 0 }} barGap={2}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" vertical={false} />
                      <XAxis dataKey="name" tick={{ fontSize: 10, fill: "#64748b" }} interval={0} angle={-22} textAnchor="end" height={64} />
                      <YAxis tickFormatter={chartAxis} tick={{ fontSize: 11, fill: "#64748b" }} width={64} />
                      <Tooltip content={<MoneyTooltip />} cursor={{ fill: "#f1f5f9" }} />
                      <Legend wrapperStyle={{ fontSize: 12 }} />
                      <Bar dataKey="a_allocated" name={d.a.label} fill={A_COLOR} radius={[3, 3, 0, 0]} />
                      <Bar dataKey="b_allocated" name={d.b.label} fill={B_COLOR} radius={[3, 3, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </Card>
              <Card className="p-5">
                <CardHeader
                  title="Spent — department by department"
                  subtitle={`${d.a.label} vs ${d.b.label} · ₹ crore`}
                />
                <div className="pt-4" style={{ height: 320 }}>
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={d.per_department} margin={{ top: 5, right: 10, left: 0, bottom: 0 }} barGap={2}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" vertical={false} />
                      <XAxis dataKey="name" tick={{ fontSize: 10, fill: "#64748b" }} interval={0} angle={-22} textAnchor="end" height={64} />
                      <YAxis tickFormatter={chartAxis} tick={{ fontSize: 11, fill: "#64748b" }} width={64} />
                      <Tooltip content={<MoneyTooltip />} cursor={{ fill: "#f1f5f9" }} />
                      <Legend wrapperStyle={{ fontSize: 12 }} />
                      <Bar dataKey="a_spent" name={d.a.label} fill={A_COLOR} radius={[3, 3, 0, 0]} />
                      <Bar dataKey="b_spent" name={d.b.label} fill={B_COLOR} radius={[3, 3, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </Card>
            </div>
          ) : (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              <Card className="p-5">
                <CardHeader
                  title={`${d.a.label} vs ${d.b.label} — alloc & spend, FY ${d.per_year?.length ? deptYear : year}`}
                  subtitle="₹ crore"
                />
                <div className="pt-4" style={{ height: 320 }}>
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart
                      data={[
                        { name: d.a.label, allocated: d.a.allocated, spent: d.a.spent },
                        { name: d.b.label, allocated: d.b.allocated, spent: d.b.spent },
                      ]}
                      margin={{ top: 5, right: 10, left: 0, bottom: 0 }}
                      barGap={4}
                    >
                      <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" vertical={false} />
                      <XAxis dataKey="name" tick={{ fontSize: 12, fill: "#64748b" }} />
                      <YAxis tickFormatter={chartAxis} tick={{ fontSize: 11, fill: "#64748b" }} width={64} />
                      <Tooltip content={<MoneyTooltip />} cursor={{ fill: "#f1f5f9" }} />
                      <Legend wrapperStyle={{ fontSize: 12 }} />
                      <Bar dataKey="allocated" name="Allocated" fill={ALLOC_COLOR} radius={[3, 3, 0, 0]} />
                      <Bar dataKey="spent" name="Spent" fill={SPEND_COLOR} radius={[3, 3, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </Card>
              <Card className="p-5">
                <CardHeader title="Allocation trend" subtitle="three fiscal years · ₹ crore" />
                <div className="pt-4" style={{ height: 320 }}>
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart
                      data={(d.per_year || []).map((row) => ({
                        year: row.year,
                        [d.a.label]: row.a,
                        [d.b.label]: row.b,
                      }))}
                      margin={{ top: 5, right: 10, left: 0, bottom: 0 }}
                    >
                      <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                      <XAxis dataKey="year" tick={{ fontSize: 12, fill: "#64748b" }} />
                      <YAxis tickFormatter={chartAxis} tick={{ fontSize: 11, fill: "#64748b" }} width={64} />
                      <Tooltip content={<MoneyTooltip />} />
                      <Legend wrapperStyle={{ fontSize: 12 }} />
                      <Line type="monotone" dataKey={d.a.label} stroke={A_COLOR} strokeWidth={3} dot={{ r: 5 }} activeDot={{ r: 7 }} />
                      <Line type="monotone" dataKey={d.b.label} stroke={B_COLOR} strokeWidth={3} dot={{ r: 5 }} activeDot={{ r: 7 }} />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              </Card>
            </div>
          )}
        </>
      ) : null}
    </div>
  );
}