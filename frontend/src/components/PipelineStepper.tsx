import type { AgentEvent } from "../api/client";

const STEPS = ["intake", "classifier", "extractor", "verifier", "cross_verifier", "compliance", "scorecard"];

/** Horizontal progress: which agent is done / running / pending. */
export default function PipelineStepper({ events }: { events: AgentEvent[] }) {
  const done = new Set(events.filter((e) => e.type === "completed").map((e) => e.agent));
  const started = new Set(events.filter((e) => e.type === "started").map((e) => e.agent));

  return (
    <div className="flex items-center gap-1 overflow-x-auto">
      {STEPS.map((step, i) => {
        const state = done.has(step) ? "done" : started.has(step) ? "active" : "pending";
        return (
          <div key={step} className="flex items-center gap-1">
            {i > 0 && <div className="w-4 h-px bg-slate-300" />}
            <span className={`text-xs px-2 py-1 rounded-full whitespace-nowrap
              ${state === "done" ? "bg-green-100 text-green-700"
                : state === "active" ? "bg-blue-100 text-blue-700 animate-pulse"
                : "bg-slate-100 text-slate-400"}`}>
              {step.replace("_", "-")}
            </span>
          </div>
        );
      })}
    </div>
  );
}
