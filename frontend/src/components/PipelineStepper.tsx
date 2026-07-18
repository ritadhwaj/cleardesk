import type { AgentEvent } from "../api/client";

/** Progress for the parallel two-agent run:
 *  both agent lanes shown side by side, then convergence -> scorecard. */
export default function PipelineStepper({ events }: { events: AgentEvent[] }) {
  const started = events.some((e) => e.agent === "pipeline" && e.type === "started");
  const docsDone = events.some((e) => e.type === "docs_complete");
  const auditDone = events.some((e) => e.type === "audit_complete");
  const scored = events.some((e) => e.agent === "scorecard" && e.type === "completed");
  const disputes = events.filter((e) => e.type === "challenge").length;

  const lane = (label: string, active: boolean, done: boolean, chip: string) => (
    <span className={`text-xs px-3 py-1 rounded-full whitespace-nowrap
      ${done ? "bg-green-100 text-green-700"
        : active ? `${chip} animate-pulse`
        : "bg-slate-100 text-slate-400"}`}>
      {label}
    </span>
  );

  return (
    <div className="flex items-center gap-2 overflow-x-auto">
      <div className="flex flex-col gap-1">
        {lane("doc agent — documenting", started && !docsDone, docsDone, "bg-blue-100 text-blue-700")}
        {lane("audit agent — verifying", started && !auditDone, auditDone, "bg-purple-100 text-purple-700")}
      </div>
      <div className="w-6 h-px bg-slate-300" />
      {disputes > 0 && (
        <span className="text-xs px-3 py-1 rounded-full bg-amber-100 text-amber-700 whitespace-nowrap">
          ⚔️ {disputes} dispute{disputes > 1 ? "s" : ""}
        </span>
      )}
      <div className="w-6 h-px bg-slate-300" />
      {lane("scorecard", auditDone && !scored, scored, "bg-green-100 text-green-700")}
    </div>
  );
}
