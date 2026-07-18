import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { ArrowLeft, ArrowRight, Clock, CheckCircle2, XCircle } from "lucide-react";
import { getInsights, fmtDateTime, type Insights } from "../api/client";

const META: Record<string, { title: string; Icon: typeof Clock; tint: string }> = {
  IN_REVIEW: { title: "Awaiting review", Icon: Clock, tint: "text-amber-500" },
  APPROVED:  { title: "Approved cases", Icon: CheckCircle2, tint: "text-emerald-500" },
  REJECTED:  { title: "Rejected cases", Icon: XCircle, tint: "text-red-500" },
};

/** Animated SVG donut: on-time (emerald) vs overdue (red). */
function Donut({ onTime, overdue }: { onTime: number; overdue: number }) {
  const [mounted, setMounted] = useState(false);
  useEffect(() => { const t = setTimeout(() => setMounted(true), 60); return () => clearTimeout(t); }, []);
  const total = Math.max(onTime + overdue, 1);
  const R = 70, C = 2 * Math.PI * R;
  const onFrac = (onTime / total) * C;
  const overFrac = (overdue / total) * C;

  return (
    <div className="relative w-56 h-56 shrink-0">
      <svg viewBox="0 0 180 180" className="w-full h-full -rotate-90">
        <circle cx="90" cy="90" r={R} fill="none" strokeWidth="22"
                className="stroke-slate-200 dark:stroke-slate-700 transition-colors" />
        <circle cx="90" cy="90" r={R} fill="none" stroke="#10b981" strokeWidth="22"
                strokeDasharray={`${mounted ? onFrac : 0} ${C}`} strokeLinecap="butt"
                style={{ transition: "stroke-dasharray 0.9s cubic-bezier(0.16,1,0.3,1)" }} />
        <circle cx="90" cy="90" r={R} fill="none" stroke="#ef4444" strokeWidth="22"
                strokeDasharray={`${mounted ? overFrac : 0} ${C}`}
                strokeDashoffset={-onFrac} strokeLinecap="butt"
                style={{ transition: "stroke-dasharray 0.9s cubic-bezier(0.16,1,0.3,1) 0.2s" }} />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="text-4xl font-extrabold h-page tabular-nums">{onTime + overdue}</span>
        <span className="text-[11px] uppercase tracking-wider text-slate-400 font-semibold">cases</span>
      </div>
    </div>
  );
}

export default function InsightsPage() {
  const { status = "" } = useParams();
  const [data, setData] = useState<Insights | null>(null);
  const meta = META[status] ?? META.IN_REVIEW;

  useEffect(() => { getInsights(status).then(setData).catch(() => {}); }, [status]);

  const pct = (n: number) => data && data.total > 0
    ? `${((n / data.total) * 100).toFixed(0)}%` : "—";

  return (
    <div className="max-w-6xl mx-auto px-6 py-8">
      <div className="flex items-center gap-3 mb-7 animate-fade-up">
        <Link to="/" className="w-9 h-9 rounded-xl border border-slate-200 dark:border-slate-600
                                flex items-center justify-center text-slate-400
                                hover:text-slate-700 hover:bg-slate-50
                                dark:hover:text-slate-200 dark:hover:bg-slate-800 transition-colors">
          <ArrowLeft size={16} />
        </Link>
        <div>
          <h1 className="text-2xl font-bold tracking-tight h-page flex items-center gap-2.5">
            <meta.Icon className={meta.tint} size={24} /> {meta.title}
          </h1>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-0.5">
            SLA: {data?.sla_hours ?? 24}h — {status === "IN_REVIEW"
              ? "cases waiting longer are overdue"
              : "decisions taken later than this were overdue"}
          </p>
        </div>
      </div>

      <div className="grid lg:grid-cols-2 gap-5 mb-6">
        {/* donut + legend */}
        <div className="card p-6 flex items-center gap-8 animate-scale-in">
          {data ? <Donut onTime={data.on_time} overdue={data.overdue} />
                : <div className="skeleton w-56 h-56 !rounded-full" />}
          <div className="space-y-4">
            <div className="flex items-center gap-3">
              <span className="w-3.5 h-3.5 rounded-full bg-emerald-500" />
              <div>
                <p className="font-bold h-page text-xl tabular-nums">
                  {data?.on_time ?? "–"} <span className="text-sm font-semibold text-slate-400">({pct(data?.on_time ?? 0)})</span>
                </p>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  {status === "IN_REVIEW" ? "within SLA window" : "actioned on time"}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <span className="w-3.5 h-3.5 rounded-full bg-red-500" />
              <div>
                <p className="font-bold h-page text-xl tabular-nums">
                  {data?.overdue ?? "–"} <span className="text-sm font-semibold text-slate-400">({pct(data?.overdue ?? 0)})</span>
                </p>
                <p className="text-xs text-slate-500 dark:text-slate-400">overdue</p>
              </div>
            </div>
          </div>
        </div>

        {/* pivot table: process × on-time/overdue */}
        <div className="card p-6 animate-fade-up">
          <h2 className="font-bold h-page mb-4">By business process</h2>
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-xs font-semibold uppercase tracking-wider text-slate-400
                             border-b border-slate-100 dark:border-slate-700">
                <th className="py-2">Process</th>
                <th className="py-2 text-right text-emerald-600 dark:text-emerald-300">On time</th>
                <th className="py-2 text-right text-red-600 dark:text-red-300">Overdue</th>
                <th className="py-2 text-right">Total</th>
              </tr>
            </thead>
            <tbody>
              {data?.pivot.map((r) => (
                <tr key={r.process} className="border-b border-slate-50 dark:border-slate-800/60 last:border-0">
                  <td className="py-2.5 font-medium text-slate-700 dark:text-slate-200">{r.process}</td>
                  <td className="py-2.5 text-right tabular-nums">{r.on_time}</td>
                  <td className="py-2.5 text-right tabular-nums">{r.overdue}</td>
                  <td className="py-2.5 text-right tabular-nums font-bold h-page">{r.on_time + r.overdue}</td>
                </tr>
              ))}
              {data && data.pivot.length > 0 && (
                <tr className="border-t-2 border-slate-200 dark:border-slate-600">
                  <td className="py-2.5 font-bold h-page">All</td>
                  <td className="py-2.5 text-right tabular-nums font-bold text-emerald-600 dark:text-emerald-300">{data.on_time}</td>
                  <td className="py-2.5 text-right tabular-nums font-bold text-red-600 dark:text-red-300">{data.overdue}</td>
                  <td className="py-2.5 text-right tabular-nums font-bold h-page">{data.total}</td>
                </tr>
              )}
              {data && data.pivot.length === 0 && (
                <tr><td colSpan={4} className="py-8 text-center text-slate-400">No cases in this bucket.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* case list */}
      <div className="card overflow-hidden animate-fade-up" style={{ animationDelay: "80ms" }}>
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-xs font-semibold uppercase tracking-wider text-slate-400
                           border-b border-slate-100 dark:border-slate-700">
              <th className="px-5 py-3">Case</th>
              <th className="px-5 py-3 hidden sm:table-cell">Process</th>
              <th className="px-5 py-3 hidden md:table-cell">Created</th>
              <th className="px-5 py-3 hidden lg:table-cell">Actioned</th>
              <th className="px-5 py-3">SLA</th>
              <th className="px-5 py-3 w-10" />
            </tr>
          </thead>
          <tbody>
            {data?.cases.map((c) => (
              <tr key={c.id} className="border-b border-slate-50 dark:border-slate-800/60 last:border-0
                                        hover:bg-slate-50/70 dark:hover:bg-slate-800/40 transition-colors">
                <td className="px-5 py-3.5">
                  <Link to={`/cases/${c.id}`} className="group block">
                    <span className="block font-medium text-slate-700 dark:text-slate-200
                                     group-hover:text-slate-900 dark:group-hover:text-white">{c.name}</span>
                    <span className="block font-mono text-[11px] text-slate-400 dark:text-slate-500">{c.ref_no}</span>
                  </Link>
                </td>
                <td className="px-5 py-3.5 hidden sm:table-cell">
                  <span className="chip-indigo text-[11px] font-bold px-2 py-0.5 rounded-full">{c.process}</span>
                </td>
                <td className="px-5 py-3.5 hidden md:table-cell font-mono text-xs text-slate-500 dark:text-slate-400">
                  {fmtDateTime(c.created_at)}
                </td>
                <td className="px-5 py-3.5 hidden lg:table-cell font-mono text-xs text-slate-500 dark:text-slate-400">
                  {c.actioned_at ? fmtDateTime(c.actioned_at) : "—"}
                </td>
                <td className="px-5 py-3.5">
                  <span className={`text-[11px] font-bold px-2 py-0.5 rounded-full
                                    ${c.overdue ? "chip-red" : "chip-emerald"}`}>
                    {c.overdue ? "OVERDUE" : "ON TIME"}
                  </span>
                </td>
                <td className="px-5 py-3.5">
                  <Link to={`/cases/${c.id}`} className="text-slate-300 hover:text-slate-600 transition-colors">
                    <ArrowRight size={15} />
                  </Link>
                </td>
              </tr>
            ))}
            {data && data.cases.length === 0 && (
              <tr><td colSpan={6} className="px-5 py-12 text-center text-slate-400">Nothing here yet.</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
