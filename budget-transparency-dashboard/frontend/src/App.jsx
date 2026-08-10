import { useEffect, useState } from "react";
import Header from "./components/Header";
import Overview from "./components/Overview";
import DepartmentDrillDown from "./components/DepartmentDrillDown";
import Comparison from "./components/Comparison";
import AskBudget from "./components/AskBudget";
import RedFlags from "./components/RedFlags";
import { api } from "./api";

export default function App() {
  const [tab, setTab] = useState("overview");
  const [year, setYear] = useState("2025-26");
  const [department, setDepartment] = useState(null);
  const [geminiMode, setGeminiMode] = useState("unknown");

  useEffect(() => {
    api
      .health()
      .then((h) => setGeminiMode(h?.gemini || "mock"))
      .catch(() => setGeminiMode("mock"));
  }, []);

  const openDepartment = (name) => {
    setDepartment(name);
    setTab("departments");
  };

  const openAsk = () => setTab("ask");

  return (
    <div className="min-h-screen flex flex-col">
      <Header tab={tab} setTab={setTab} geminiMode={geminiMode} />

      <main className="flex-1 w-full max-w-7xl mx-auto px-4 sm:px-6 py-6">
        {tab === "overview" && (
          <Overview
            year={year}
            setYear={setYear}
            onOpenDepartment={openDepartment}
            onOpenAsk={openAsk}
          />
        )}
        {tab === "departments" && (
          <DepartmentDrillDown
            year={year}
            department={department}
            setDepartment={setDepartment}
          />
        )}
        {tab === "compare" && <Comparison year={year} />}
        {tab === "ask" && <AskBudget />}
        {tab === "flags" && (
          <RedFlags onOpenDepartment={openDepartment} onOpenAsk={openAsk} />
        )}
      </main>

      <footer className="border-t border-slate-200 bg-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-4 flex flex-col sm:flex-row items-center justify-between gap-2 text-xs text-slate-500">
          <p>
            Budget Transparency Dashboard · Built for hackathon demo · Data is
            simulated sample data, not official figures.
          </p>
          <p>All amounts in ₹ crore (1 crore = 10 million)</p>
        </div>
      </footer>
    </div>
  );
}