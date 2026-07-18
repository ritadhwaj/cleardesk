import { useState } from "react";
import { useParams } from "react-router-dom";
import { useCaseSocket } from "../hooks/useCaseSocket";
import AgentFeed from "../components/AgentFeed";
import ScorecardPanel from "../components/ScorecardPanel";
import PipelineStepper from "../components/PipelineStepper";

type Tab = "agents" | "documents" | "scorecard";

export default function CaseDetail() {
  const { caseId } = useParams();
  const { events, connected } = useCaseSocket(caseId);
  const [tab, setTab] = useState<Tab>("agents");

  return (
    <div className="max-w-5xl mx-auto p-8">
      <div className="flex justify-between items-center mb-4">
        <h1 className="text-2xl font-bold text-slate-800">
          Case <span className="font-mono text-lg">{caseId?.slice(0, 8)}</span>
        </h1>
        <span className={`text-xs ${connected ? "text-green-600" : "text-slate-400"}`}>
          {connected ? "● live" : "○ offline"}
        </span>
      </div>

      <PipelineStepper events={events} />

      <div className="flex gap-2 my-4">
        {(["agents", "documents", "scorecard"] as Tab[]).map((t) => (
          <button key={t} onClick={() => setTab(t)}
                  className={`px-4 py-2 rounded-lg text-sm capitalize
                              ${tab === t ? "bg-slate-800 text-white" : "bg-white text-slate-600"}`}>
            {t === "agents" ? "Agent activity" : t}
          </button>
        ))}
      </div>

      {tab === "agents" && <AgentFeed events={events} />}
      {tab === "documents" && (
        <p className="text-slate-500">DocViewer with field-highlight overlays — TODO.</p>
      )}
      {tab === "scorecard" && caseId && <ScorecardPanel caseId={caseId} events={events} />}
    </div>
  );
}
