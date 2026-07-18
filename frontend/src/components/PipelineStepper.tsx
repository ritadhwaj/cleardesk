import { FileSearch, ShieldQuestion, Swords, Gauge } from "lucide-react";
import type { AgentEvent } from "../api/client";

/** Progress for the parallel two-agent run: agent lanes -> disputes -> scorecard. */
export default function PipelineStepper({ events }: { events: AgentEvent[] }) {
  const started = events.some((e) => e.agent === "pipeline" && e.type === "started");
  const docsDone = events.some((e) => e.type === "docs_complete");
  const auditDone = events.some((e) => e.type === "audit_complete");
  const scored = events.some((e) => e.agent === "scorecard" && e.type === "completed");
  const disputes = events.filter((e) => e.type === "challenge").length;

  const lane = (label: string, Icon: typeof FileSearch, active: boolean, done: boolean, activeCls: string) => (
    <span className={`inline-flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-full
                      whitespace-nowrap transition-all duration-300
      ${done ? "bg-emerald-50 text-emerald-700"
        : active ? `${activeCls} animate-pulse`
        : "bg-slate-100 text-slate-400"}`}>
      <Icon size={13} />
      {label}
    </span>
  );

  return (
    <div className="card px-4 py-3 flex items-center gap-3 overflow-x-auto">
      <div className="flex flex-col gap-1.5">
        {lane("Doc Agent — documenting", FileSearch, started && !docsDone, docsDone, "bg-blue-50 text-blue-700")}
        {lane("Audit Agent — verifying", ShieldQuestion, started && !auditDone, auditDone, "bg-purple-50 text-purple-700")}
      </div>
      <div className="w-8 h-px bg-gradient-to-r from-slate-200 to-slate-300 shrink-0" />
      <span className={`inline-flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-full
                        whitespace-nowrap transition-all
        ${disputes ? "bg-amber-50 text-amber-700" : "bg-slate-100 text-slate-400"}`}>
        <Swords size={13} />
        {disputes ? `${disputes} dispute${disputes > 1 ? "s" : ""}` : "no disputes"}
      </span>
      <div className="w-8 h-px bg-gradient-to-r from-slate-200 to-slate-300 shrink-0" />
      {lane("Scorecard", Gauge, auditDone && !scored, scored, "bg-emerald-50 text-emerald-700")}
    </div>
  );
}
