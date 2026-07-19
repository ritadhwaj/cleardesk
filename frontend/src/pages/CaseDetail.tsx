import { useEffect, useRef, useState } from "react";
import { useParams, Link } from "react-router-dom";
import {
  ArrowLeft, MessagesSquare, Files, ClipboardCheck, CheckCircle2, XCircle,
  History, FileSpreadsheet, FileDown, Pencil, Trash2, Plus, RotateCw, Loader2,
  ScrollText,
} from "lucide-react";
import { useCaseSocket } from "../hooks/useCaseSocket";
import {
  getCase, postReviewAction, deleteUpload, uploadFiles, resubmitCase, exportCase,
  getCaseActivity, exportCaseActivity, fmtDateTime,
  type RunAudit, type ActivityItem, type TableQuery,
} from "../api/client";
import DataTable, { type Column } from "../components/DataTable";
import { useAuth } from "../store/auth";
import { useTimezone } from "../store/timezone";
import AgentFeed from "../components/AgentFeed";
import ScorecardPanel from "../components/ScorecardPanel";
import PipelineStepper from "../components/PipelineStepper";
import DiscrepancyCard from "../components/DiscrepancyCard";

type Tab = "agents" | "documents" | "review" | "history" | "activity";

const CATEGORY_CHIP: Record<string, string> = {
  AUTH: "chip-slate", CASE: "chip-blue", DOCUMENT: "chip-indigo",
  REVIEW: "chip-emerald", RETRY: "chip-amber", EXPORT: "chip-purple",
};

const CASE_ACTIVITY_COLUMNS: Column<ActivityItem>[] = [
  {
    key: "when", label: "When", sortable: true, className: "whitespace-nowrap",
    render: (a) => (
      <span className="font-mono text-xs text-slate-500 dark:text-slate-400">
        {fmtDateTime(a.when)}
      </span>
    ),
  },
  {
    key: "category", label: "Category", sortable: true,
    filter: { options: ["CASE", "DOCUMENT", "REVIEW", "RETRY", "EXPORT"] },
    render: (a) => (
      <span className={`text-[11px] font-bold px-2 py-0.5 rounded-full ${CATEGORY_CHIP[a.category] ?? "chip-slate"}`}>
        {a.category}
      </span>
    ),
  },
  {
    key: "action", label: "Action", sortable: true, filter: "text",
    render: (a) => (
      <span className="font-mono text-xs font-semibold text-slate-700 dark:text-slate-200">
        {a.action}
      </span>
    ),
  },
  {
    key: "details", label: "Details", sortable: true, filter: "text",
    render: (a) => <span className="text-slate-600 dark:text-slate-300">{a.details}</span>,
  },
  {
    key: "user", label: "By", sortable: true, filter: "text",
    render: (a) => <span className="text-slate-600 dark:text-slate-300">{a.user}</span>,
  },
];

interface Field { id: string; name: string; value: string | null; confidence: number; round: number }
interface Doc { id: string; status: string; doc_type: string; confidence: number; fields: Field[] }
interface Discrepancy {
  id: string; kind: string; severity: string; title: string;
  detail: Record<string, unknown>; resolution: string;
}
interface Detail {
  ref_no: string; name: string; status: string;
  inferred_process: string | null; inference_confidence: number;
  scorecard_count: number;
  uploads: { id: string; filename: string }[];
  runs: RunAudit[];
  documents: Doc[]; discrepancies: Discrepancy[];
}

const TABS: { key: Tab; label: string; Icon: typeof Files }[] = [
  { key: "agents", label: "Agent activity", Icon: MessagesSquare },
  { key: "documents", label: "Documents", Icon: Files },
  { key: "review", label: "Review", Icon: ClipboardCheck },
  { key: "history", label: "Run history", Icon: History },
  { key: "activity", label: "Activity", Icon: ScrollText },
];

export default function CaseDetail() {
  const { caseId } = useParams();
  const { events, connected } = useCaseSocket(caseId);
  const [tab, setTab] = useState<Tab>("agents");
  const [detail, setDetail] = useState<Detail | null>(null);
  const [editing, setEditing] = useState(false);
  const [note, setNote] = useState("");
  const [newFiles, setNewFiles] = useState<File[]>([]);
  const [busy, setBusy] = useState(false);
  const fileInput = useRef<HTMLInputElement>(null);
  const role = useAuth((s) => s.role);
  useTimezone((s) => s.tz);

  const refresh = () => { if (caseId) getCase(caseId).then(setDetail).catch(() => {}); };
  useEffect(refresh, [caseId,
    events.filter((e) => e.type === "completed" || e.type === "finding").length]);

  const decide = async (action: "APPROVE_CASE" | "REJECT_CASE") => {
    if (!caseId) return;
    await postReviewAction(caseId, { action });
    refresh();
  };

  const doResubmit = async () => {
    if (!caseId) return;
    setBusy(true);
    try {
      if (newFiles.length) await uploadFiles(caseId, newFiles);
      await resubmitCase(caseId, note);
      setEditing(false);
      setNewFiles([]);
      setNote("");
      setTab("agents");
      refresh();
    } finally {
      setBusy(false);
    }
  };

  const removeUpload = async (uploadId: string) => {
    if (!caseId) return;
    await deleteUpload(caseId, uploadId);
    refresh();
  };

  const conf = (c: number) =>
    c >= 90 ? "text-emerald-600 dark:text-emerald-400"
    : c >= 70 ? "text-amber-600 dark:text-amber-400"
    : "text-red-600 dark:text-red-400";
  const openFlags = detail?.discrepancies.filter((x) => x.resolution === "OPEN").length ?? 0;
  const canEdit = detail && detail.status !== "PROCESSING";

  return (
    <div className="max-w-6xl mx-auto px-6 py-8">
      {/* header */}
      <div className="flex flex-wrap items-center justify-between gap-3 mb-5 animate-fade-up">
        <div className="flex items-center gap-3 min-w-0">
          <Link to="/" className="w-9 h-9 shrink-0 rounded-xl border border-slate-200 dark:border-slate-700
                                  flex items-center justify-center text-slate-400
                                  hover:text-slate-700 hover:bg-slate-50
                                  dark:hover:text-slate-200 dark:hover:bg-slate-800 transition-colors">
            <ArrowLeft size={16} />
          </Link>
          <div className="min-w-0">
            <h1 className="text-xl font-bold tracking-tight h-page truncate">
              {detail?.name ?? "Verification Case"}
            </h1>
            <p className="text-xs text-slate-400 dark:text-slate-500 mt-0.5 flex items-center gap-2">
              <span className="font-mono tracking-wider">{detail?.ref_no ?? "…"}</span>
              <span className={`w-1.5 h-1.5 rounded-full ${connected ? "bg-emerald-500" : "bg-slate-300 dark:bg-slate-600"}`} />
              {connected ? "live" : "offline"}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          {detail?.inferred_process && (
            <span className="text-xs font-semibold chip-indigo px-3 py-1.5 rounded-full">
              {detail.inferred_process} · {detail.inference_confidence.toFixed(0)}%
            </span>
          )}
          <span className="text-xs font-semibold chip-slate px-3 py-1.5 rounded-full">
            {detail?.status?.replace("_", " ") ?? "…"}
          </span>
          <button onClick={() => exportCase(caseId!, "xlsx")} title="Export to Excel"
                  className="btn btn-ghost !px-3 !py-2">
            <FileSpreadsheet size={15} /> Excel
          </button>
          <button onClick={() => exportCase(caseId!, "pdf")} title="Export to PDF"
                  className="btn btn-ghost !px-3 !py-2">
            <FileDown size={15} /> PDF
          </button>
          {canEdit && (
            <button onClick={() => setEditing((e) => !e)}
                    className={`btn !px-3 !py-2 ${editing ? "btn-primary" : "btn-ghost"}`}>
              <Pencil size={14} /> Edit & retry
            </button>
          )}
        </div>
      </div>

      {/* edit & resubmit panel */}
      {editing && canEdit && (
        <div className="card p-5 mb-5 space-y-4 animate-scale-in">
          <h3 className="font-bold h-page flex items-center gap-2">
            <RotateCw size={15} /> Edit case & rerun the agents
          </h3>
          <div className="grid sm:grid-cols-2 gap-4">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wider text-slate-400 mb-2">
                Current documents
              </p>
              <ul className="space-y-1.5">
                {detail?.uploads.map((u) => (
                  <li key={u.id} className="flex items-center justify-between rounded-lg
                                            bg-slate-50 dark:bg-slate-800/70 px-3 py-2 text-sm">
                    <span className="truncate text-slate-700 dark:text-slate-200">{u.filename}</span>
                    <button onClick={() => removeUpload(u.id)}
                            className="text-slate-300 dark:text-slate-600 hover:text-red-500 transition-colors">
                      <Trash2 size={14} />
                    </button>
                  </li>
                ))}
              </ul>
            </div>
            <div>
              <p className="text-xs font-semibold uppercase tracking-wider text-slate-400 mb-2">
                Add documents
              </p>
              <input ref={fileInput} type="file" multiple hidden
                     onChange={(e) => setNewFiles((p) => [...p, ...Array.from(e.target.files ?? [])])} />
              <button onClick={() => fileInput.current?.click()} className="btn btn-ghost w-full">
                <Plus size={15} /> Choose files
              </button>
              <ul className="mt-2 space-y-1">
                {newFiles.map((f) => (
                  <li key={f.name} className="text-xs text-emerald-600 dark:text-emerald-400">
                    + {f.name}
                  </li>
                ))}
              </ul>
            </div>
          </div>
          <input className="input w-full" value={note} onChange={(e) => setNote(e.target.value)}
                 placeholder="Reason for retry (recorded in the audit trail)…" />
          <div className="flex gap-2">
            <button onClick={doResubmit} disabled={busy} className="btn btn-primary">
              {busy ? <Loader2 size={15} className="animate-spin" /> : <RotateCw size={15} />}
              Resubmit — rerun agents & regenerate scorecard
            </button>
            <button onClick={() => setEditing(false)} className="btn btn-ghost">Cancel</button>
          </div>
        </div>
      )}

      <div className="animate-fade-up" style={{ animationDelay: "60ms" }}>
        <PipelineStepper events={events} />
      </div>

      {/* segmented tabs */}
      <div className="inline-flex bg-slate-100 dark:bg-slate-800/80 rounded-xl p-1 my-5
                      transition-colors duration-500 animate-fade-up flex-wrap"
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
            {key === "history" && (detail?.runs.length ?? 0) > 1 && (
              <span className="ml-0.5 min-w-[18px] h-[18px] rounded-full bg-indigo-500 text-white
                               text-[10px] font-bold flex items-center justify-center px-1">
                {detail!.runs.length}
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
            <span className="text-xs text-slate-400 dark:text-slate-500">
              {detail?.scorecard_count ?? 0} scorecard version(s) generated
            </span>
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

      {tab === "history" && (
        <div className="space-y-4">
          {detail?.runs.map((r) => (
            <div key={r.run_no} className="card p-5 animate-fade-up space-y-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex items-center gap-2.5">
                  <span className="w-8 h-8 rounded-lg chip-indigo flex items-center justify-center
                                   font-bold text-sm">
                    {r.run_no}
                  </span>
                  <div>
                    <p className="font-semibold h-page text-sm">
                      {r.trigger === "INITIAL" ? "Initial submission" : "Retry"}
                      {r.note && <span className="font-normal text-slate-500 dark:text-slate-400"> — "{r.note}"</span>}
                    </p>
                    <p className="text-xs text-slate-400 dark:text-slate-500">
                      {r.started_at && new Date(r.started_at).toLocaleString(undefined,
                        { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" })}
                      {r.finished_at ? " · completed" : " · running"}
                      {r.scorecard_version && ` · produced scorecard v${r.scorecard_version}`}
                    </p>
                  </div>
                </div>
              </div>

              {r.field_diff && (
                <div className="space-y-1.5 border-t border-slate-100 dark:border-slate-800 pt-3">
                  {r.field_diff.added.map((c) => (
                    <p key={`a${c.field}`} className="text-xs">
                      <span className="chip-emerald font-bold px-1.5 py-0.5 rounded mr-2">+ added</span>
                      <span className="font-mono text-slate-600 dark:text-slate-300">
                        {c.field} = "{c.value}"
                      </span>
                    </p>
                  ))}
                  {r.field_diff.updated.map((c) => (
                    <p key={`u${c.field}`} className="text-xs">
                      <span className="chip-amber font-bold px-1.5 py-0.5 rounded mr-2">~ updated</span>
                      <span className="font-mono text-slate-600 dark:text-slate-300">
                        {c.field}: <s className="text-red-500/80">"{c.old}"</s> → "{c.new}"
                      </span>
                    </p>
                  ))}
                  {r.field_diff.deleted.map((c) => (
                    <p key={`d${c.field}`} className="text-xs">
                      <span className="chip-red font-bold px-1.5 py-0.5 rounded mr-2">− deleted</span>
                      <span className="font-mono text-slate-600 dark:text-slate-300">
                        {c.field} (was "{c.old}")
                      </span>
                    </p>
                  ))}
                  {!r.field_diff.added.length && !r.field_diff.updated.length &&
                    !r.field_diff.deleted.length && (
                    <p className="text-xs text-slate-400 dark:text-slate-500">
                      No field changes vs previous run.
                    </p>
                  )}
                </div>
              )}
            </div>
          ))}
          {!detail?.runs.length && (
            <p className="card p-6 text-slate-400 dark:text-slate-500 text-sm text-center">
              No runs recorded yet.
            </p>
          )}
        </div>
      )}

      {tab === "activity" && caseId && (
        <div className="space-y-4">
          <div className="flex justify-end gap-2">
            <button onClick={() => exportCaseActivity(caseId, "xlsx")}
                    className="btn btn-ghost !px-3 !py-2">
              <FileSpreadsheet size={15} /> Excel
            </button>
            <button onClick={() => exportCaseActivity(caseId, "pdf")}
                    className="btn btn-ghost !px-3 !py-2">
              <FileDown size={15} /> PDF
            </button>
          </div>
          <DataTable<ActivityItem>
            columns={CASE_ACTIVITY_COLUMNS}
            fetcher={(q: TableQuery) => getCaseActivity(caseId, q)}
            rowKey={(a) => a.id}
            defaultSort="when"
            refreshKey={events.length}
            emptyText="No activity recorded for this case yet."
          />
        </div>
      )}
    </div>
  );
}
