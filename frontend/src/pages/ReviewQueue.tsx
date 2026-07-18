import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { listCases, type CaseSummary } from "../api/client";

/** Reviewer inbox: only cases waiting on a human. */
export default function ReviewQueue() {
  const [cases, setCases] = useState<CaseSummary[]>([]);

  useEffect(() => { listCases("IN_REVIEW").then(setCases); }, []);

  return (
    <div className="max-w-4xl mx-auto p-8">
      <h1 className="text-2xl font-bold text-slate-800 mb-6">Review queue</h1>
      <div className="space-y-2">
        {cases.map((c) => (
          <Link key={c.id} to={`/cases/${c.id}`}
                className="flex justify-between bg-white p-4 rounded-xl shadow-sm hover:shadow">
            <span className="font-mono text-sm">{c.id.slice(0, 8)}</span>
            <span className="text-xs bg-amber-100 text-amber-700 px-2 py-1 rounded-full">
              needs review
            </span>
          </Link>
        ))}
        {cases.length === 0 && <p className="text-slate-500">Queue is clear 🎉</p>}
      </div>
    </div>
  );
}
