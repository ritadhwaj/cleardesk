import { Link } from "react-router-dom";
import { Activity, FileSpreadsheet, FileDown } from "lucide-react";
import { getMyActivity, exportMyActivity, fmtDateTime, type ActivityItem } from "../api/client";
import DataTable, { type Column } from "../components/DataTable";

const CATEGORY_CHIP: Record<string, string> = {
  AUTH: "chip-slate", CASE: "chip-blue", DOCUMENT: "chip-indigo",
  REVIEW: "chip-emerald", RETRY: "chip-amber", EXPORT: "chip-purple",
};

export const ACTIVITY_COLUMNS: Column<ActivityItem>[] = [
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
    filter: { options: ["AUTH", "CASE", "DOCUMENT", "REVIEW", "RETRY", "EXPORT"] },
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
    key: "case", label: "Case", className: "whitespace-nowrap",
    render: (a) => a.case_id ? (
      <Link to={`/cases/${a.case_id}`}
            className="font-mono text-xs text-indigo-600 dark:text-indigo-400 hover:underline">
        {a.case}
      </Link>
    ) : <span className="text-slate-300 dark:text-slate-600">—</span>,
  },
];

export default function ActivityLog() {
  return (
    <div className="max-w-6xl mx-auto px-6 py-8">
      <div className="flex flex-wrap items-end justify-between gap-4 mb-7 animate-fade-up">
        <div>
          <h1 className="text-2xl font-bold tracking-tight h-page flex items-center gap-2.5">
            <Activity className="text-indigo-500" size={24} /> My activity
          </h1>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
            Everything you've done on this desk — filterable, sortable, exportable.
          </p>
        </div>
        <div className="flex gap-2">
          <button onClick={() => exportMyActivity("xlsx")} className="btn btn-ghost !px-3 !py-2">
            <FileSpreadsheet size={15} /> Excel
          </button>
          <button onClick={() => exportMyActivity("pdf")} className="btn btn-ghost !px-3 !py-2">
            <FileDown size={15} /> PDF
          </button>
        </div>
      </div>

      <div className="animate-fade-up" style={{ animationDelay: "80ms" }}>
        <DataTable<ActivityItem>
          columns={ACTIVITY_COLUMNS}
          fetcher={getMyActivity}
          rowKey={(a) => a.id}
          defaultSort="when"
          emptyText="No activity recorded yet."
        />
      </div>
    </div>
  );
}
