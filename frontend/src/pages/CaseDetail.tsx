import { useEffect, useState } from "react";
import { useParams, Link } from "react-router-dom";
import { ArrowLeft, MessagesSquare, Files, ClipboardCheck, CheckCircle2, XCircle } from "lucide-react";
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

const TABS: { key: Tab; label: string; Icon: typeof Files }[] = [
  { key: "agents", label: "Agent activity", Icon: MessagesSquare },
  { key: "documents", label: "Documents", Icon: Files },
  { key: "review", label: "Review", Icon: ClipboardCheck },
];

export default function CaseDetail() {
  const { caseId } = useParams();
  const { events, connected } = useCaseSocket(caseId);
  const [tab, setTab] = useState<Tab>("agents");
  const [detail, setDetail] = useState<Detail | null>(null);
  const role = useAuth((s) => s.role);

  const refresh = () => { if (caseId) getCase(caseId).then(setDetail).catch(() => {}); };
  useEffect(refresh, [caseId,
    events.filter((e) => e.type === "completed" || e.type === "finding").length]);

  const decide = async (action: "APPROVE_CASE" | "REJECT_CASE") => {
    if (!caseId) return;
    await postReviewAction(caseId, { action });
    refresh();
  };

  const conf = (c: number) =>
    c >= 90 ? "text-emerald-600 dark:text-emerald-400"
    : c >= 70 ? "text-amber-600 dark:text-amber-400"
    : "text-red-600 dark:text-red-400";
  const openFlags = detail?.discrepancies.filter((x) => x.resolution === "OPEN").length ?? 0;

  return (
    <div className="max-w-6xl mx-auto px-6 py-8">
      {/* header */}
      <div className="flex flex-wrap items-center justify-between gap-3 mb-5 animate-fade-up">
        <div className="flex items-center gap-3">
          <Link to="/" className="w-9 h-9 rounded-xl border border-slate-200 dark:border-slate-700
                                  flex items-center justify-center text-slate-400
                                  hover:text-slate-700 hover:bg-slate-50
                                  dark:hover:text-slate-200 dark:hover:bg-slate-800 transition-colors">
            <ArrowLeft size={16} />
          </Link>
          <div>
            <h1 className="text-xl font-bold tracking-tight h-page">
              Case <span className="font-mono text-slate-500 dark:text-slate-400">{caseId?.slice(0, 8)}</span>
            </h1>
            <p className="text-xs text-slate-400 dark:text-slate-500 mt-0.5 flex items-center gap-1.5">
              <span className={`w-1.5 h-1.5 rounded-full ${connected ? "bg-emerald-500" : "bg-slate-300 dark:bg-slate-600"}`} />
              {connected ? "live feed connected" : "feed offline"}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {detail?.inferred_process && (
            <span className="text-xs font-semibold chip-indigo px-3 py-1.5 rounded-full">
              Best fit: {detail.inferred_process} · {detail.inference_confidence.toFixed(0)}%
            </span>
          )}
          <span className="text-xs font-semibold chip-slate px-3 py-1.5 rounded-full">
            {detail?.status?.replace("_", " ") ?? "…"}
          </span>
        </div>
      </div>

      <div className="animate-fade-up" style={{ animationDelay: "60ms" }}>
        <PipelineStepper events={events} />
      </div>

      {/* segmented tabs */}
      <div className="inline-flex bg-slate-100 dark:bg-slate-800/80 rounded-xl p-1 my-5
                      transition-colors duration-500 animate-fade-up"
           style={{ animationDelay: "100ms" }}>
        {TABS.map(({ key, label, Icon }) => (
          <button key={key} onClick={() => setTab(key)}
                  className={`relative flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm
                              font-semibold transition-all duration-200
                              ${tab === key
                                ? "bg-white text-slate-900 dark:bg-slate-950 dark:text-white shadow-sm"
                                : "text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200"}`}>
            <Icon size={15} /> {label}
            {key === "review" && openFlags > 0 && (
              <span className="ml-0.5 min-w-[18px] h-[18px] rounded-full bg-amber-500 text-white
                               text-[10px] font-bold flex items-center justify-center px-1">
                {openFlags}
              </span>
            )}
          </button>
        ))}
      </div>

      {tab === "agents" && <AgentFeed events={events} />}

      {tab === "documents" && (
        <div className="grid md:grid-cols-2 gap-4">
          {detail?.documents.map((d, i) => (
            <div key={d.id} className="card card-hover p-5 animate-fade-up"
                 style={{ animationDelay: `${i * 60}ms` }}>
              <div className="flex justify-between items-center mb-3">
                <span className="font-bold h-page">{d.doc_type}</span>
                <span className={`text-[11px] font-semibold px-2 py-0.5 rounded-full
                    ${d.status === "IDENTIFIED" ? "chip-emerald" : "chip-slate"}`}>
                  {d.status.toLowerCase()} · {d.confidence.toFixed(0)}%
                </span>
              </div>
              <table className="w-full text-sm">
                <tbody>
                  {d.fields.map((f) => (
                    <tr key={f.id} className="border-t border-slate-50 dark:border-slate-800/70">
                      <td className="py-2 text-slate-400 dark:text-slate-500 text-xs font-medium uppercase tracking-wide">
                        {f.name.replace(/_/g, " ")}
                      </td>
                      <td className="py-2 font-mono text-slate-800 dark:text-slate-200">{f.value ?? "—"}</td>
                      <td className={`py-2 text-right text-xs font-bold tabular-nums ${conf(f.confidence)}`}>
                        {f.confidence.toFixed(0)}%
                        {f.round > 1 && (
                          <span className="text-slate-400 dark:text-slate-500 font-normal"> · r{f.round}</span>
                        )}
                      </td>
                    </tr>
                  ))}
                  {d.fields.length === 0 && (
                    <tr><td className="py-3 text-slate-400 dark:text-slate-500 text-sm">No fields extracted</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          ))}
          {!detail?.documents.length && (
            <p className="text-slate-400 dark:text-slate-500 col-span-2 text-center py-10">
              No documents processed yet.
            </p>
          )}
        </div>
      )}

      {tab === "review" && caseId && (
        <div className="space-y-4">
          <ScorecardPanel caseId={caseId} events={events} />
          <div className="flex items-center justify-between pt-2">
            <h2 className="font-bold h-page">
              Flagged for human judgment
              <span className="ml-2 text-sm font-semibold text-amber-600 dark:text-amber-400">
                {openFlags} open
              </span>
            </h2>
          </div>
          {detail?.discrepancies.map((d) => (
            <DiscrepancyCard key={d.id} caseId={caseId} d={d} onResolved={refresh} />
          ))}
          {!detail?.discrepancies.length && (
            <p className="card p-6 text-slate-400 dark:text-slate-500 text-sm text-center">
              Nothing flagged — all findings auto-verified.
            </p>
          )}
          {role === "reviewer" && detail?.status === "IN_REVIEW" && (
            <div className="card p-5 flex flex-wrap items-center justify-between gap-3">
              <p className="text-sm text-slate-500 dark:text-slate-400">
                Final decision — the agents advise,{" "}
                <span className="font-semibold text-slate-700 dark:text-slate-200">you decide</span>.
              </p>
              <div className="flex gap-2.5">
                <button onClick={() => decide("APPROVE_CASE")} className="btn btn-success">
                  <CheckCircle2 size={16} /> Approve & process
                </button>
                <button onClick={() => decide("REJECT_CASE")} className="btn btn-danger">
                  <XCircle size={16} /> Reject
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
