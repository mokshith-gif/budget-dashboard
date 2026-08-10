import { useCallback, useEffect, useRef, useState } from "react";
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Cell,
} from "recharts";
import { api } from "../api";
import { fmtINRShort } from "../utils";
import { Card, CardHeader, Spinner, ErrorBanner } from "./ui";

const EXAMPLES = [
  "how much did education get this year vs last year",
  "what did police spend in 2025-26",
  "compare health and education in 2025-26",
  "how much of its budget did rural development use in 2025-26",
  "what was the total budget in 2024-25",
];

function SpeechRecognitionAPI() {
  return typeof window !== "undefined"
    ? window.SpeechRecognition || window.webkitSpeechRecognition || null
    : null;
}

function MoneyTooltip({ active, payload, label }) {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-lg bg-slate-900/95 px-3 py-2 text-xs text-white shadow-xl">
      <p className="font-semibold">{label}</p>
      {payload.map((p) => (
        <p key={String(p.dataKey)}>
          <span className="font-semibold">{fmtINRShort(p.value)}</span>{" "}
          {p.payload && p.payload.comparison ? "" : ""}
        </p>
      ))}
    </div>
  );
}

function IntentChip({ label, value }) {
  if (!value) return null;
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-600">
      {label}: <span className="text-brand-700">{value}</span>
    </span>
  );
}

export default function AskBudget() {
  const [question, setQuestion] = useState("");
  const [state, setState] = useState({ loading: false, data: null, error: null });
  const [listening, setListening] = useState(false);
  const recognitionRef = useRef(null);

  const submit = useCallback(
    async (text) => {
      const q = (text ?? question).trim();
      if (!q || state.loading) return;
      setState({ loading: true, data: null, error: null });
      try {
        const data = await api.ask(q);
        setState({ loading: false, data, error: null });
      } catch (err) {
        setState({ loading: false, data: null, error: err.message || String(err) });
      }
    },
    [question, state.loading]
  );

  // Voice input with graceful fallback for browsers without Web Speech API.
  useEffect(() => {
    const SR = SpeechRecognitionAPI();
    if (!SR) return;

    const rec = new SR();
    rec.lang = "en-IN";
    rec.interimResults = false;
    rec.maxAlternatives = 1;

    rec.onstart = () => setListening(true);
    rec.onend = () => setListening(false);
    rec.onerror = (event) => {
      setListening(false);
      if (event.error !== "aborted" && event.error !== "no-speech") {
        setState((s) => ({
          ...s,
          error: "Voice recognition failed (" + event.error + "). Try typing instead.",
        }));
      }
    };
    rec.onresult = (event) => {
      const transcript = event.results[0][0].transcript;
      setQuestion(transcript);
      submit(transcript);
    };
    recognitionRef.current = rec;
    return () => {
      try {
        rec.abort();
      } catch (e) {
        /* noop */
      }
    };
  }, [submit]);

  const toggleMic = () => {
    const rec = recognitionRef.current;
    if (!rec) {
      setState((s) => ({
        ...s,
        error: "Voice input is not supported in this browser — please type your question.",
      }));
      return;
    }
    if (listening) {
      rec.stop();
    } else {
      try {
        rec.start();
      } catch (e) {
        setState((s) => ({
          ...s,
          error: "Could not start the microphone — please type your question.",
        }));
      }
    }
  };

  const d = state.data;
  const chartData = d?.chart || [];
  const twoBar = chartData.length >= 2;

  return (
    <div className="space-y-6 max-w-4xl">
      <div className="px-1">
        <h2 className="text-xl font-extrabold text-slate-900">Ask the Budget</h2>
        <p className="text-sm text-slate-500 mt-0.5">
          Ask a plain-language question about the budget. The AI translates it into a safe,
          parameterized database query — it never runs SQL itself.
        </p>
      </div>

      <Card className="p-5">
        <div className="flex items-center gap-2">
          <div className="relative flex-1">
            <svg
              className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400"
              viewBox="0 0 24 24"
              fill="none"
            >
              <circle cx="11" cy="11" r="7" stroke="currentColor" strokeWidth="2" />
              <path d="M21 21l-4.35-4.35" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
            </svg>
            <input
              className="input !pl-9 !py-2.5"
              placeholder="e.g. how much did education get this year vs last year?"
              value={question}
              onChange={(e) => setQuestion(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && submit()}
              disabled={state.loading}
            />
          </div>
          <button
            onClick={toggleMic}
            title="Ask by voice (uses your browser's microphone)"
            className={`inline-flex h-10 w-10 items-center justify-center rounded-lg border transition-colors ${
              listening
                ? "bg-rose-500 border-rose-500 text-white animate-pulse"
                : "bg-white border-slate-300 text-slate-600 hover:bg-slate-50"
            }`}
          >
            <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none">
              <rect x="9" y="3" width="6" height="11" rx="3" stroke="currentColor" strokeWidth="2" />
              <path
                d="M5 11a7 7 0 0014 0M12 18v3"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
              />
            </svg>
          </button>
          <button className="btn-primary h-10" onClick={() => submit()} disabled={state.loading}>
            {state.loading ? "Thinking…" : "Ask"}
          </button>
        </div>
        {listening && (
          <p className="mt-2 text-xs font-medium text-rose-600">
            Listening… speak your question now.
          </p>
        )}
        <div className="mt-3 flex flex-wrap items-center gap-2">
          <span className="text-xs text-slate-400">Try:</span>
          {EXAMPLES.map((ex) => (
            <button
              key={ex}
              onClick={() => {
                setQuestion(ex);
                submit(ex);
              }}
              className="rounded-full bg-slate-50 ring-1 ring-slate-200 px-3 py-1 text-xs text-slate-600 hover:bg-brand-50 hover:text-brand-700 hover:ring-brand-300 transition-colors"
            >
              {ex}
            </button>
          ))}
        </div>
      </Card>

      {state.error && <ErrorBanner message={state.error} />}

      {state.loading && <Spinner label="Asking the budget…" />}

      {d && !state.loading && (
        <>
          <Card className="p-6">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="flex-1 min-w-64">
                <p className="text-xs font-semibold uppercase tracking-wide text-slate-500 mb-1">
                  Answer — based on FY {d.primary_year}
                  {d.comparison_year ? " vs " + d.comparison_year : ""}
                </p>
                <p className="text-lg font-bold leading-snug text-slate-900">{d.answer}</p>
              </div>
              {d.mode === "mock" && (
                <span className="rounded-full bg-amber-50 ring-1 ring-amber-200 px-3 py-1 text-xs font-semibold text-amber-700">
                  Offline mode — no GEMINI_API_KEY set
                </span>
              )}
              {d.mode === "live" && (
                <span className="rounded-full bg-emerald-50 ring-1 ring-emerald-200 px-3 py-1 text-xs font-semibold text-emerald-700">
                  Gemini interpreted this question
                </span>
              )}
            </div>
            <div className="mt-3 flex flex-wrap gap-2">
              <IntentChip label="Metric" value={String(d.metric)} />
              <IntentChip label="Department" value={d.department || "All departments"} />
              {d.comparison_department && (
                <IntentChip label="vs" value={d.comparison_department} />
              )}
              <IntentChip label="Primary year" value={String(d.primary_year)} />
              {d.comparison_year && <IntentChip label="Comparison year" value={String(d.comparison_year)} />}
              <span className="inline-flex items-center gap-1.5 rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-500">
                Safety: intent → parameterized SQL, no raw LLM SQL
              </span>
            </div>
          </Card>

          <Card className="p-5">
            <CardHeader title="The numbers behind the answer" subtitle="₹ crore · safe parameterized query" />
            <div className="pt-4" style={{ height: 260 }}>
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={chartData} margin={{ top: 5, right: 10, left: 0, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" vertical={false} />
                  <XAxis dataKey="label" tick={{ fontSize: 13, fill: "#334155", fontWeight: 600 }} />
                  <YAxis tickFormatter={(v) => fmtINRShort(v)} tick={{ fontSize: 11, fill: "#64748b" }} width={80} />
                  <Tooltip content={<MoneyTooltip />} cursor={{ fill: "#f1f5f9" }} />
                  <Bar dataKey="value" name="Value" radius={[4, 4, 0, 0]}>
                    {chartData.map((entry, i) => (
                      <Cell
                        key={String(entry.label) + i}
                        fill={
                          twoBar
                            ? i === chartData.length - 1
                              ? "#6366f1"
                              : "#c7d2fe"
                            : "#6366f1"
                        }
                      />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </Card>
        </>
      )}
    </div>
  );
}