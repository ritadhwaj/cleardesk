import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { useCaseSocket } from "../hooks/useCaseSocket";
import { getCase, postReviewAction } from "../api/client";
import { useAuth } from "../store/auth";
import AgentFeed from "../components/AgentFeed";
import ScorecardPanel from "../components/ScorecardPanel";
import PipelineStepper from "../components/PipelineStepper";
import DiscrepancyCard from "../components/DiscrepancyCard";

type Tab = "agents" | "documents" | "review";

interface Field { id: string; name: string; value: string | null; confidence: number; round: number }
interface Doc { id: string; status: string; doc_type: string; confidence: number; fields: Field[] }
interface Discrepancy {
  id: string; kind: string; severity: string; title: string;
  detail: Record<string, unknown>; resolution: string;
}
interface Detail {
  status: string; inferred_process: string | null; inference_confidence: number;
  documents: Doc[]; discrepancies: Discrepancy[];
}

export default function CaseDetail() {
  const { caseId } = useParams();
  const { events, connected } = useCaseSocket(caseId);
  const [tab, setTab] = useState<Tab>("agents");
  const [detail, setDetail] = useState<Detail | null>(null);
  const role = useAuth((s) => s.role);

  const refresh = () => { if (caseId) getCase(caseId).then(setDetail).catch(() => {}); };
  // refetch when pipeline milestones arrive + on mount
  useEffect(refresh, [caseId,
    events.filter((e) => e.type === "completed" || e.type === "finding").length]);

  const decide = async (action: "APPROVE_CASE" | "REJECT_CASE") => {
    if (!caseId) return;
    await postReviewAction(caseId, { action });
    refresh();
  };

  const conf = (c: number) =>
    c >= 90 ? "text-green-600" : c >= 70 ? "text-amber-600" : "text-red-600";

  return (
    <div className="max-w-5xl mx-auto p-8">
      <div className="flex justify-between items-center mb-2">
        <h1 className="text-2xl font-bold text-slate-800">
          Case <span className="font-mono text-lg">{caseId?.slice(0, 8)}</span>
        </h1>
        <div className="flex items-center gap-3">
          {detail?.inferred_process && (
            <span className="text-xs bg-indigo-100 text-indigo-700 px-3 py-1 rounded-full">
              Best fit: {detail.inferred_process} ({detail.inference_confidence.toFixed(0)}%)
            </span>
          )}
          <span className="text-xs bg-slate-200 px-3 py-1 rounded-full">{detail?.status}</span>
          <span className={`text-xs ${connected ? "text-green-600" : "text-slate-400"}`}>
            {connected ? "● live" : "○ offline"}
          </span>
        </div>
      </div>

      <PipelineStepper events={events} />

      <div className="flex gap-2 my-4">
        {(["agents", "documents", "review"] as Tab[]).map((t) => (
          <button key={t} onClick={() => setTab(t)}
                  className={`px-4 py-2 rounded-lg text-sm capitalize
                              ${tab === t ? "bg-slate-800 text-white" : "bg-white text-slate-600"}`}>
            {t === "agents" ? "Agent activity" : t}
          </button>
        ))}
      </div>

      {tab === "agents" && <AgentFeed events={events} />}

      {tab === "documents" && (
        <div className="space-y-4">
          {detail?.documents.map((d) => (
            <div key={d.id} className="bg-white rounded-xl shadow-sm p-4">
              <div className="flex justify-between mb-2">
                <span className="font-medium text-slate-800">{d.doc_type}</span>
                <span className="text-xs text-slate-500">
                  {d.status} · classified {d.confidence.toFixed(0)}%
                </span>
              </div>
              <table className="w-full text-sm">
                <tbody>
                  {d.fields.map((f) => (
                    <tr key={f.id} className="border-t">
                      <td className="py-1.5 text-slate-500">{f.name}</td>
                      <td className="py-1.5 font-mono">{f.value ?? "—"}</td>
                      <td className={`py-1.5 text-right ${conf(f.confidence)}`}>
                        {f.confidence.toFixed(0)}%{f.round > 1 && ` (round ${f.round})`}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ))}
          {!detail?.documents.length && <p className="text-slate-500">No documents yet.</p>}
        </div>
      )}

      {tab === "review" && caseId && (
        <div className="space-y-4">
          <ScorecardPanel caseId={caseId} events={events} />
          <h2 className="font-semibold text-slate-700">
            Flagged for human judgment ({detail?.discrepancies.filter((x) => x.resolution === "OPEN").length ?? 0} open)
          </h2>
          {detail?.discrepancies.map((d) => (
            <DiscrepancyCard key={d.id} caseId={caseId} d={d} onResolved={refresh} />
          ))}
          {!detail?.discrepancies.length && (
            <p className="text-slate-500">Nothing flagged — all findings auto-verified.</p>
          )}
          {role === "reviewer" && detail?.status === "IN_REVIEW" && (
            <div className="flex gap-3 pt-2">
              <button onClick={() => decide("APPROVE_CASE")}
                      className="bg-green-600 text-white px-6 py-2.5 rounded-lg">
                Approve & process further
              </button>
              <button onClick={() => decide("REJECT_CASE")}
                      className="bg-red-600 text-white px-6 py-2.5 rounded-lg">
                Reject case
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
