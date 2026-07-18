import { useEffect, useRef } from "react";
import type { AgentEvent } from "../api/client";

const AGENT_COLORS: Record<string, string> = {
  intake: "bg-slate-200 text-slate-700",
  classifier: "bg-indigo-100 text-indigo-700",
  extractor: "bg-blue-100 text-blue-700",
  verifier: "bg-teal-100 text-teal-700",
  cross_verifier: "bg-purple-100 text-purple-700",
  compliance: "bg-orange-100 text-orange-700",
  scorecard: "bg-green-100 text-green-700",
  pipeline: "bg-slate-100 text-slate-500",
};

/** Chat-style live feed of everything the agents say and do — the demo star. */
export default function AgentFeed({ events }: { events: AgentEvent[] }) {
  const bottomRef = useRef<HTMLDivElement>(null);
  useEffect(() => bottomRef.current?.scrollIntoView({ behavior: "smooth" }), [events]);

  return (
    <div className="bg-white rounded-xl shadow-sm p-4 h-96 overflow-y-auto space-y-2">
      {events.map((e) => (
        <div key={e.id} className="flex gap-2 items-start text-sm">
          <span className={`shrink-0 px-2 py-0.5 rounded-full text-xs font-medium
                            ${AGENT_COLORS[e.agent] ?? "bg-slate-100"}`}>
            {e.agent.replace("_", "-")}
          </span>
          {e.type === "dispute" && <span title="dispute">⚔️</span>}
          <span className="text-slate-700">{String(e.payload?.message ?? "")}</span>
        </div>
      ))}
      {events.length === 0 && (
        <p className="text-slate-400 text-sm">Agents will report here once the pipeline runs…</p>
      )}
      <div ref={bottomRef} />
    </div>
  );
}
