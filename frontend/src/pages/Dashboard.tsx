import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { Search, FolderOpen, Clock, CheckCircle2, ArrowRight } from "lucide-react";
import { listCases, type CaseSummary } from "../api/client";

const STATUS_STYLE: Record<string, { chip: string; dot: string }> = {
  UPLOADED:   { chip: "bg-slate-100 text-slate-600",   dot: "bg-slate-400" },
  PROCESSING: { chip: "bg-blue-50 text-blue-700",      dot: "bg-blue-500 animate-pulse" },
  SCORED:     { chip: "bg-indigo-50 text-indigo-700",  dot: "bg-indigo-500" },
  IN_REVIEW:  { chip: "bg-amber-50 text-amber-700",    dot: "bg-amber-500" },
  APPROVED:   { chip: "bg-emerald-50 text-emerald-700", dot: "bg-emerald-500" },
  REJECTED:   { chip: "bg-red-50 text-red-700",        dot: "bg-red-500" },
  RETURNED:   { chip: "bg-orange-50 text-orange-700",  dot: "bg-orange-500" },
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

export default function Dashboard() {
  const [cases, setCases] = useState<CaseSummary[] | null>(null);
  const [query, setQuery] = useState("");

  useEffect(() => {
    let live = true;
    const load = () => listCases().then((c) => live && setCases(c)).catch(() => {});
    load();
    const t = setInterval(load, 8000); // background refresh keeps statuses current
    return () => { live = false; clearInterval(t); };
  }, []);

  const filtered = useMemo(
    () => (cases ?? []).filter((c) =>
      c.id.includes(query.toLowerCase()) || c.status.toLowerCase().includes(query.toLowerCase())),
    [cases, query]
  );

  const stat = (s: string) => (cases ?? []).filter((c) => c.status === s).length;

  return (
    <div className="max-w-6xl mx-auto px-6 py-8">
      <div className="flex flex-wrap items-end justify-between gap-4 mb-8 animate-fade-up">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">Verification cases</h1>
          <p className="text-sm text-slate-500 mt-1">
            Every submission, scored by agents and decided by humans.
          </p>
        </div>
        <Link to="/cases/new" className="btn btn-primary">
          New case <ArrowRight size={15} />
        </Link>
      </div>

      {/* stats */}
      <div className="grid grid-cols-3 gap-4 mb-8">
        {[
          { label: "Total cases", value: cases?.length, icon: FolderOpen, tint: "text-slate-500 bg-slate-100" },
          { label: "Awaiting review", value: stat("IN_REVIEW"), icon: Clock, tint: "text-amber-600 bg-amber-50" },
          { label: "Approved", value: stat("APPROVED"), icon: CheckCircle2, tint: "text-emerald-600 bg-emerald-50" },
        ].map(({ label, value, icon: Icon, tint }, i) => (
          <div key={label} className="card p-5 animate-fade-up" style={{ animationDelay: `${i * 60}ms` }}>
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs font-semibold uppercase tracking-wider text-slate-400">{label}</p>
                <p className="text-3xl font-bold text-slate-900 mt-1">
                  {cases === null ? "–" : value}
                </p>
              </div>
              <span className={`w-11 h-11 rounded-xl flex items-center justify-center ${tint}`}>
                <Icon size={20} />
              </span>
            </div>
          </div>
        ))}
      </div>

      {/* search */}
      <div className="relative mb-4">
        <Search size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
        <input placeholder="Search by case ID or status…" value={query}
               onChange={(e) => setQuery(e.target.value)}
               className="w-full rounded-xl border border-slate-200 bg-white pl-10 pr-4 py-2.5 text-sm
                          focus:outline-none focus:ring-2 focus:ring-slate-900/10 focus:border-slate-400
                          transition-shadow" />
      </div>

      {/* case table */}
      <div className="card overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-xs font-semibold uppercase tracking-wider text-slate-400 border-b border-slate-100">
              <th className="px-5 py-3.5">Case</th>
              <th className="px-5 py-3.5">Status</th>
              <th className="px-5 py-3.5 hidden sm:table-cell">Created</th>
              <th className="px-5 py-3.5 w-10" />
            </tr>
          </thead>
          <tbody>
            {cases === null &&
              [...Array(3)].map((_, i) => (
                <tr key={i} className="border-b border-slate-50">
                  <td className="px-5 py-4" colSpan={4}><div className="skeleton h-5 w-full" /></td>
                </tr>
              ))}
            {filtered.map((c, i) => (
              <tr key={c.id} className="border-b border-slate-50 last:border-0 hover:bg-slate-50/70
                                        transition-colors animate-fade-up"
                  style={{ animationDelay: `${Math.min(i, 8) * 40}ms` }}>
                <td className="px-5 py-4">
                  <Link to={`/cases/${c.id}`} className="font-mono font-medium text-slate-700 hover:text-slate-900">
                    {c.id.slice(0, 8)}
                  </Link>
                </td>
                <td className="px-5 py-4"><StatusBadge status={c.status} /></td>
                <td className="px-5 py-4 hidden sm:table-cell text-slate-500">
                  {new Date(c.created_at).toLocaleString(undefined,
                    { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" })}
                </td>
                <td className="px-5 py-4">
                  <Link to={`/cases/${c.id}`}
                        className="text-slate-300 hover:text-slate-600 transition-colors">
                    <ArrowRight size={16} />
                  </Link>
                </td>
              </tr>
            ))}
            {cases !== null && filtered.length === 0 && (
              <tr><td colSpan={4} className="px-5 py-12 text-center text-slate-400">
                No cases {query ? "match your search" : "yet — create your first one"}.
              </td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
