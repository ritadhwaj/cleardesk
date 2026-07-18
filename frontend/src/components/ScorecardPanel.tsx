import { useEffect, useState } from "react";
import { getScorecard, type Scorecard, type AgentEvent } from "../api/client";

function scoreColor(score: number) {
  if (score >= 90) return "text-green-600";
  if (score >= 70) return "text-amber-600";
  return "text-red-600";
}

export default function ScorecardPanel({ caseId, events }: { caseId: string; events: AgentEvent[] }) {
  const [sc, setSc] = useState<Scorecard | null>(null);

  // Refresh when the scorecard agent completes (live via WS events).
  useEffect(() => {
    getScorecard(caseId).then(setSc).catch(() => setSc(null));
  }, [caseId, events.filter((e) => e.agent === "scorecard").length]);

  if (!sc) return <p className="text-slate-500">No scorecard yet — pipeline still running.</p>;

  return (
    <div className="bg-white rounded-xl shadow-sm p-6 space-y-4">
      <div className="flex items-end gap-4">
        <span className={`text-6xl font-bold ${scoreColor(sc.overall_score)}`}>
          {sc.overall_score}%
        </span>
        <span className="text-slate-500 mb-2">correctness · v{sc.version}</span>
      </div>
      <div className="grid grid-cols-3 gap-3 text-center">
        <div className="bg-green-50 rounded-lg p-3">
          <div className="text-2xl font-bold text-green-700">{sc.auto_verified}</div>
          <div className="text-xs text-green-700">auto-verified</div>
        </div>
        <div className="bg-amber-50 rounded-lg p-3">
          <div className="text-2xl font-bold text-amber-700">{sc.review_needed}</div>
          <div className="text-xs text-amber-700">needs review</div>
        </div>
        <div className="bg-red-50 rounded-lg p-3">
          <div className="text-2xl font-bold text-red-700">{sc.hard_fail}</div>
          <div className="text-xs text-red-700">hard fail</div>
        </div>
      </div>
      {sc.summary && <p className="text-sm text-slate-600 border-t pt-3">{sc.summary}</p>}
    </div>
  );
}
