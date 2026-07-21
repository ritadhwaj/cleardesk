import { useState } from "react";
import { Link } from "react-router-dom";
import { FolderOpen, Clock, CheckCircle2, XCircle, ArrowRight } from "lucide-react";
import { listCases, fmtDateTime, type CaseSummary } from "../api/client";
import DataTable, { type Column } from "../components/DataTable";
import { useAuth } from "../store/auth";

const STATUS_STYLE: Record<string, { chip: string; dot: string }> = {
  UPLOADED:   { chip: "chip-slate",   dot: "bg-slate-400" },
  PROCESSING: { chip: "chip-blue",    dot: "bg-blue-500 animate-pulse" },
  SCORED:     { chip: "chip-indigo",  dot: "bg-indigo-500" },
  IN_REVIEW:  { chip: "chip-amber",   dot: "bg-amber-500" },
  APPROVED:   { chip: "chip-emerald", dot: "bg-emerald-500" },
  REJECTED:   { chip: "chip-red",     dot: "bg-red-500" },
  RETURNED:   { chip: "chip-amber",   dot: "bg-orange-500" },
};

function StatusBadge({ status }: { status: string }) {
  const s = STATUS_STYLE[status] ?? STATUS_STYLE.UPLOADED;
  return (
    <span className={`inline-flex items-center gap-1.5 text-xs font-semibold px-2.5 py-1 rounded-full ${s.chip}`}>
      <span className={`w-1.5 h-1.5 rounded-full ${s.dot}`} />
      {status.replace("_", " ")}
    </span>
  );
}

const COLUMNS: Column<CaseSummary>[] = [
  {
    key: "name", label: "Case", sortable: true, filter: "text",
    render: (c) => (
      <Link to={`/cases/${c.id}`} className="group block">
        <span className="block font-medium text-slate-700 dark:text-slate-200
                         group-hover:text-slate-900 dark:group-hover:text-white">
          {c.name || "Verification Case"}
        </span>
        <span className="block font-mono text-[11px] tracking-wider text-slate-400 dark:text-slate-500">
          {c.ref_no}
        </span>
      </Link>
    ),
  },
  {
    key: "status", label: "Status", sortable: true,
    filter: { options: ["UPLOADED", "PROCESSING", "IN_REVIEW", "APPROVED", "REJECTED", "RETURNED"] },
    render: (c) => <StatusBadge status={c.status} />,
  },
  {
    key: "created_by", label: "Created by", sortable: true, filter: "text",
    className: "hidden sm:table-cell",
    render: (c) => (
      <>
        <span className="block text-slate-600 dark:text-slate-300">{c.created_by}</span>
        <span className="block font-mono text-[11px] text-slate-400 dark:text-slate-500 whitespace-nowrap">
          {fmtDateTime(c.created_at)}
        </span>
      </>
    ),
  },
  {
    key: "updated_by", label: "Last updated by", sortable: true, filter: "text",
    className: "hidden lg:table-cell",
    render: (c) => (
      <>
        <span className="block text-slate-600 dark:text-slate-300">{c.updated_by}</span>
        <span className="block font-mono text-[11px] text-slate-400 dark:text-slate-500 whitespace-nowrap">
          {fmtDateTime(c.updated_at)}
        </span>
      </>
    ),
  },
  {
    key: "open", label: "", className: "w-10",
    render: (c) => (
      <Link to={`/cases/${c.id}`} className="text-slate-300 hover:text-slate-600 transition-colors">
        <ArrowRight size={16} />
      </Link>
    ),
  },
];

export default function Dashboard() {
  const [stats, setStats] = useState<Record<string, number>>({});
  const role = useAuth((s) => s.role);
  const canCreate = role === "uploader" || role === "admin";

  return (
    <div className="max-w-6xl mx-auto px-6 py-8">
      <div className="flex flex-wrap items-end justify-between gap-4 mb-8 animate-fade-up">
        <div>
          <h1 className="text-2xl font-bold tracking-tight h-page">Verification cases</h1>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
            Every submission, scored by agents and decided by humans.
          </p>
        </div>
        {canCreate && (
          <Link to="/cases/new" className="btn btn-primary">
            New case <ArrowRight size={15} />
          </Link>
        )}
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
        {[
          { label: "Total cases", value: stats.total, icon: FolderOpen, tint: "chip-slate", to: null },
          { label: "Awaiting review", value: stats.in_review, icon: Clock, tint: "chip-amber", to: "/insights/IN_REVIEW" },
          { label: "Approved", value: stats.approved, icon: CheckCircle2, tint: "chip-emerald", to: "/insights/APPROVED" },
          { label: "Rejected", value: stats.rejected, icon: XCircle, tint: "chip-red", to: "/insights/REJECTED" },
        ].map(({ label, value, icon: Icon, tint, to }, i) => {
          const body = (
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs font-semibold uppercase tracking-wider text-slate-400">{label}</p>
                <p className="text-3xl font-bold h-page mt-1">{value ?? "–"}</p>
                {to && <p className="text-[11px] text-indigo-500 dark:text-indigo-300 mt-0.5">
                  view insights →</p>}
              </div>
              <span className={`w-11 h-11 rounded-xl flex items-center justify-center ${tint}`}>
                <Icon size={20} />
              </span>
            </div>
          );
          return to ? (
            <Link key={label} to={to} className="card card-hover p-5 animate-fade-up cursor-pointer"
                  style={{ animationDelay: `${i * 60}ms` }}>
              {body}
            </Link>
          ) : (
            <div key={label} className="card p-5 animate-fade-up" style={{ animationDelay: `${i * 60}ms` }}>
              {body}
            </div>
          );
        })}
      </div>

      <div className="animate-fade-up" style={{ animationDelay: "120ms" }}>
        <DataTable<CaseSummary>
          columns={COLUMNS}
          fetcher={listCases}
          rowKey={(c) => c.id}
          defaultSort="created_at"
          onStats={setStats}
          emptyText="No cases yet — create your first one."
        />
      </div>
    </div>
  );
}
