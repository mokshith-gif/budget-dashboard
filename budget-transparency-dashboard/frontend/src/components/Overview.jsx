import { useRef } from "react";
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
  Cell,
} from "recharts";
import html2canvas from "html2canvas";
import { jsPDF } from "jspdf";
import { api } from "../api";
import { useFetch, fmtINR, fmtINRShort, fmtPct, chartAxis } from "../utils";
import { Card, CardHeader, StatCard, DeltaBadge, Spinner, ErrorBanner } from "./ui";
import BiggestMovers from "./BiggestMovers";
import InsightsList from "./InsightsList";

const ALLOC_COLOR = "#6366f1";
const SPEND_COLOR = "#10b981";

function ChartTooltip({ active, payload, label, money = true }) {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-lg bg-slate-900/95 px-3 py-2 text-xs text-white shadow-xl">
      <p className="font-semibold mb-1">{label}</p>
      {payload.map((p) => (
        <p key={p.dataKey} className="flex items-center gap-2">
          <span className="h-2 w-2 rounded-full" style={{ background: p.color || p.fill }} />
          <span className="capitalize">{p.name}:</span>
          <span className="font-semibold tabular-nums">
            {money ? fmtINRShort(p.value) : fmtPct(p.value)}
          </span>
        </p>
      ))}
    </div>
  );
}

function YearSelector({ year, setYear, years }) {
  return (
    <div className="inline-flex rounded-lg bg-white border border-slate-200 p-1 shadow-card">
      {years.map((y) => (
        <button
          key={y}
          onClick={() => setYear(y)}
          className={`px-4 py-1.5 rounded-md text-sm font-semibold transition-colors ${
            year === y
              ? "bg-brand-600 text-white shadow-sm"
              : "text-slate-600 hover:bg-slate-100"
          }`}
        >
          FY {y}
        </button>
      ))}
    </div>
  );
}

export default function Overview({ year, setYear, onOpenDepartment, onOpenAsk }) {
  const { data: yearsData } = useFetch(api.years, []);
  const years = yearsData || ["2023-24", "2024-25", "2025-26"];
  const yearsList = years;

  const overview = useFetch(() => api.overview(year), [year]);
  const movers = useFetch(api.movers, []);

  const printRef = useRef(null);

  const exportPdf = async () => {
    if (!printRef.current) return;
    const canvas = await html2canvas(printRef.current, {
      scale: 2,
      backgroundColor: "#f1f5f9",
      useCORS: true,
      logging: false,
    });
    const pdf = new jsPDF({ orientation: "landscape", unit: "mm", format: "a4" });
    const pageW = 297;
    const pageH = 210;
    const imgH = (canvas.height * pageW) / canvas.width;
    if (imgH <= pageH) {
      pdf.addImage(canvas.toDataURL("image/png"), "PNG", 0, 0, pageW, imgH);
    } else {
      pdf.addImage(canvas.toDataURL("image/png"), "PNG", 0, 0, pageW, imgH);
    }
    pdf.setProperties({ title: `Budget Transparency Dashboard — FY ${year}` });
    pdf.save(`budget-transparency-dashboard-FY${year.replace("-", "-")}.pdf`);
  };

  return (
    <div className="space-y-6">
      {overview.error ? (
        <ErrorBanner message={overview.error} />
      ) : overview.loading ? (
        <Spinner label="Loading budget data…" />
      ) : (
        <div ref={printRef}>
          <div className="flex flex-wrap items-center justify-between gap-3 mb-5 px-1">
            <div>
              <h2 className="text-xl font-extrabold text-slate-900">
                National budget overview
              </h2>
              <p className="text-sm text-slate-500 mt-0.5">
                FY {overview.data.year}
                {overview.data.previous_year
                  ? ` · compared with FY ${overview.data.previous_year}`
                  : ""}{" "}
                · click any department to drill down
              </p>
            </div>
            <div className="flex items-center gap-3">
              <YearSelector year={year} setYear={setYear} years={yearsList} />
              <button className="btn-primary" onClick={exportPdf}>
                <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none">
                  <path
                    d="M12 3v12m0 0l-4-4m4 4l4-4M4 17v2a2 2 0 002 2h12a2 2 0 002-2v-2"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </svg>
                Download PDF
              </button>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <StatCard
              label="Total allocated"
              value={fmtINRShort(overview.data.total_allocated)}
              sub="across all departments"
              accent="text-brand-700"
            />
            <StatCard
              label="Total spent"
              value={fmtINRShort(overview.data.total_spent)}
              sub="actual expenditure"
              accent="text-emerald-600"
            />
            <StatCard
              label="Utilization"
              value={fmtPct(overview.data.utilization)}
              sub={
                overview.data.total_allocated > 0
                  ? fmtINRShort(overview.data.total_allocated - overview.data.total_spent) + " unspent"
                  : undefined
              }
              accent="text-slate-900"
            />
            <StatCard
              label="YoY change in allocation"
              value={
                overview.data.yoy_change_pct === null
                  ? "—"
                  : (overview.data.yoy_change_pct >= 0 ? "+" : "") +
                    overview.data.yoy_change_pct.toFixed(1) + "%"
              }
              sub={
                overview.data.previous_year
                  ? `vs FY ${overview.data.previous_year} (${fmtINRShort(
                      overview.data.previous_allocated
                    )})`
                  : "earliest year on record"
              }
              accent={
                (overview.data.yoy_change_pct ?? 0) >= 0 ? "text-emerald-600" : "text-rose-600"
              }
            />
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 mt-4">
            <Card className="lg:col-span-2 p-5">
              <CardHeader
                title="Allocated vs spent, by department"
                subtitle={`FY ${year} · ₹ crore · bars are clickable`}
              />
              <div className="pt-4" style={{ height: 330 }}>
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart
                    data={overview.data.departments}
                    margin={{ top: 5, right: 10, left: 10, bottom: 5 }}
                    barGap={3}
                  >
                    <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" vertical={false} />
                    <XAxis
                      dataKey="name"
                      tick={{ fontSize: 11, fill: "#64748b" }}
                      interval={0}
                      angle={-20}
                      textAnchor="end"
                      height={70}
                    />
                    <YAxis
                      tickFormatter={chartAxis}
                      tick={{ fontSize: 11, fill: "#64748b" }}
                      width={70}
                    />
                    <Tooltip content={<ChartTooltip />} cursor={{ fill: "#f1f5f9" }} />
                    <Legend wrapperStyle={{ fontSize: 12 }} />
                    <Bar
                      dataKey="allocated"
                      name="Allocated"
                      fill={ALLOC_COLOR}
                      radius={[3, 3, 0, 0]}
                      onClick={(_d, i) => onOpenDepartment(overview.data.departments[i].name)}
                    >
                      {overview.data.departments.map((d, i) => (
                        <Cell
                          key={d.name}
                          cursor="pointer"
                          fill={d.utilization < 40 ? "#f43f5e" : ALLOC_COLOR}
                        />
                      ))}
                    </Bar>
                    <Bar
                      dataKey="spent"
                      name="Spent"
                      fill={SPEND_COLOR}
                      radius={[3, 3, 0, 0]}
                      onClick={(_d, i) => onOpenDepartment(overview.data.departments[i].name)}
                    >
                      {overview.data.departments.map((d) => (
                        <Cell key={d.name} cursor="pointer" fill={SPEND_COLOR} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </Card>

            <BiggestMovers movers={movers} onOpenDepartment={onOpenDepartment} />
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mt-4">
            <Card className="p-5">
              <CardHeader title="Top departments by allocation" subtitle={`FY ${year} · ₹ crore`} />
              <div className="pt-4" style={{ height: 320 }}>
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart
                    layout="vertical"
                    data={[...overview.data.departments]
                      .sort((a, b) => a.allocated - b.allocated)
                      .slice(-8)}
                    margin={{ top: 5, right: 15, left: 10, bottom: 5 }}
                  >
                    <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" horizontal={false} />
                    <XAxis type="number" tickFormatter={chartAxis} tick={{ fontSize: 11, fill: "#64748b" }} />
                    <YAxis
                      type="category"
                      dataKey="name"
                      width={135}
                      tick={{ fontSize: 11, fill: "#334155" }}
                    />
                    <Tooltip
                      content={<ChartTooltip />}
                      cursor={{ fill: "#f1f5f9" }}
                    />
                    <Bar dataKey="allocated" name="Allocated" fill={ALLOC_COLOR} radius={[0, 3, 3, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </Card>

            <Card className="p-5">
              <CardHeader
                title="Total budget trend"
                subtitle="All departments combined · FY 2023-24 → 2025-26 · ₹ crore"
              />
              <div className="pt-4" style={{ height: 320 }}>
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={overview.data.trend} margin={{ top: 5, right: 15, left: 10, bottom: 5 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                    <XAxis dataKey="year" tick={{ fontSize: 12, fill: "#64748b" }} />
                    <YAxis tickFormatter={chartAxis} tick={{ fontSize: 11, fill: "#64748b" }} width={70} />
                    <Tooltip content={<ChartTooltip />} />
                    <Legend wrapperStyle={{ fontSize: 12 }} />
                    <Line
                      type="monotone"
                      dataKey="allocated"
                      name="Allocated (₹ crore)"
                      stroke={ALLOC_COLOR}
                      strokeWidth={3}
                      dot={{ r: 5, fill: ALLOC_COLOR }}
                      activeDot={{ r: 7 }}
                    />
                    <Line
                      type="monotone"
                      dataKey="spent"
                      name="Spent (₹ crore)"
                      stroke={SPEND_COLOR}
                      strokeWidth={3}
                      dot={{ r: 5, fill: SPEND_COLOR }}
                      activeDot={{ r: 7 }}
                    />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </Card>
          </div>
        </div>
      )}

      <InsightsList year={year} onOpenAsk={onOpenAsk} />
    </div>
  );
}