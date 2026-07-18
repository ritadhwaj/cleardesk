import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { listCases, type CaseSummary } from "../api/client";
import { useAuth } from "../store/auth";

const STATUS_STYLE: Record<string, string> = {
  PROCESSING: "bg-blue-100 text-blue-700",
  IN_REVIEW: "bg-amber-100 text-amber-700",
  APPROVED: "bg-green-100 text-green-700",
  REJECTED: "bg-red-100 text-red-700",
};

export default function Dashboard() {
  const [cases, setCases] = useState<CaseSummary[]>([]);
  const role = useAuth((s) => s.role);

  useEffect(() => { listCases().then(setCases); }, []);

  return (
    <div className="max-w-4xl mx-auto p-8">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold text-slate-800">Cases</h1>
        <div className="space-x-3">
          {role === "reviewer" && (
            <Link to="/review" className="text-amber-700 underline">Review queue</Link>
          )}
          <Link to="/cases/new" className="bg-slate-800 text-white px-4 py-2 rounded-lg">
            New case
          </Link>
        </div>
      </div>
      <div className="space-y-2">
        {cases.map((c) => (
          <Link key={c.id} to={`/cases/${c.id}`}
                className="flex justify-between bg-white p-4 rounded-xl shadow-sm hover:shadow">
            <span className="font-mono text-sm text-slate-600">{c.id.slice(0, 8)}</span>
            <span className={`text-xs px-2 py-1 rounded-full ${STATUS_STYLE[c.status] ?? "bg-slate-100"}`}>
              {c.status}
            </span>
          </Link>
        ))}
        {cases.length === 0 && <p className="text-slate-500">No cases yet — create one.</p>}
      </div>
    </div>
  );
}
