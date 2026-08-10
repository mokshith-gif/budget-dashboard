import { api } from "../api";
import { useFetch } from "../utils";
import { Card, CardHeader, Spinner, ErrorBanner } from "./ui";

export default function InsightsList({ year, onOpenAsk }) {
  const insights = useFetch(() => api.insights(year), [year]);

  return (
    <Card>
      <CardHeader
        title="In a sentence — what these numbers mean"
        subtitle={`Plain-language take-aways per department, FY ${year}${insights.data?.mode === "live" ? " · generated with Gemini" : " · deterministic template (set GEMINI_API_KEY for AI-generated)"}`}
        right={
          <button className="btn-ghost !py-1.5 !px-3 text-xs" onClick={onOpenAsk}>
            Ask a question instead →
          </button>
        }
      />
      <div className="px-5 py-4">
        {insights.loading ? (
          <Spinner label="Writing one-liners…" />
        ) : insights.error ? (
          <ErrorBanner message={insights.error} />
        ) : (
          <ul className="grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-3">
            {(insights.data?.insights
              ? Object.entries(insights.data.insights)
              : []
            ).map(([name, text]) => (
              <li key={name} className="flex items-start gap-2.5 text-sm">
                <span className="mt-0.5 h-5 w-1.5 shrink-0 rounded-full bg-brand-500" />
                <p>
                  <span className="font-bold text-slate-800">{name}: </span>
                  <span className="text-slate-600">{text}</span>
                </p>
              </li>
            ))}
          </ul>
        )}
      </div>
    </Card>
  );
}