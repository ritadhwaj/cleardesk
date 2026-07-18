import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { ClipboardCheck, ArrowRight, PartyPopper } from "lucide-react";
import { listCases, type CaseSummary } from "../api/client";

/** Reviewer inbox: only cases waiting on a human. */
export default function ReviewQueue() {
  const [cases, setCases] = useState<CaseSummary[] | null>(null);

  useEffect(() => {
    let live = true;
    const load = () => listCases("IN_REVIEW").then((c) => live && setCases(c)).catch(() => {});
    load();
    const t = setInterval(load, 8000);
    return () => { live = false; clearInterval(t); };
  }, []);

  return (
    <div className="max-w-4xl mx-auto px-6 py-8">
      <div className="mb-7 animate-fade-up">
        <h1 className="text-2xl font-bold tracking-tight h-page flex items-center gap-2.5">
          <ClipboardCheck className="text-amber-500" size={24} /> Review queue
        </h1>
        <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
          Cases the agents couldn't fully settle — your judgment needed.
        </p>
      </div>

      <div className="space-y-3">
        {cases === null && [...Array(2)].map((_, i) => (
          <div key={i} className="skeleton h-16 w-full" />
        ))}
        {cases?.map((c, i) => (
          <Link key={c.id} to={`/cases/${c.id}`}
                className="card card-hover flex items-center justify-between px-5 py-4 animate-fade-up"
                style={{ animationDelay: `${i * 50}ms` }}>
            <div>
              <span className="font-mono font-semibold text-slate-800 dark:text-slate-200">
                {c.id.slice(0, 8)}
              </span>
              <p className="text-xs text-slate-400 dark:text-slate-500 mt-0.5">
                submitted {new Date(c.created_at).toLocaleString(undefined,
                  { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" })}
              </p>
            </div>
            <div className="flex items-center gap-3">
              <span className="text-xs font-semibold chip-amber px-2.5 py-1 rounded-full">
                needs review
              </span>
              <ArrowRight size={16} className="text-slate-300 dark:text-slate-600" />
            </div>
          </Link>
        ))}
        {cases !== null && cases.length === 0 && (
          <div className="card p-12 text-center text-slate-400 dark:text-slate-500 animate-fade-up">
            <PartyPopper className="mx-auto mb-3 text-emerald-500" size={28} />
            <p className="font-semibold text-slate-600 dark:text-slate-300">Queue is clear</p>
            <p className="text-sm mt-1">Every submitted case has been decided.</p>
          </div>
        )}
      </div>
    </div>
  );
}
