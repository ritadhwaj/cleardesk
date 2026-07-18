import { useEffect, useRef } from "react";
import type { AgentEvent } from "../api/client";

const AGENT_STYLE: Record<string, { chip: string; align: string }> = {
  doc_agent: { chip: "bg-blue-100 text-blue-700", align: "justify-start" },
  audit_agent: { chip: "bg-purple-100 text-purple-700", align: "justify-end" },
  scorecard: { chip: "bg-green-100 text-green-700", align: "justify-center" },
  pipeline: { chip: "bg-slate-100 text-slate-500", align: "justify-center" },
};

const TYPE_ICON: Record<string, string> = {
  doc_claim: "📄",
  challenge: "⚔️",
  defend: "🛡️",
  concede: "🤝",
  verdict: "✅",
  docs_complete: "🏁",
  audit_complete: "🏁",
  error: "❌",
};

/** The two agents' live conversation, rendered like a chat:
 *  Doc Agent on the left, Audit Agent on the right. The demo star. */
export default function AgentFeed({ events }: { events: AgentEvent[] }) {
  const bottomRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [events]);

  return (
    <div className="bg-white rounded-xl shadow-sm p-4 h-96 overflow-y-auto space-y-2">
      {events.map((e) => {
        const style = AGENT_STYLE[e.agent] ?? AGENT_STYLE.pipeline;
        return (
          <div key={e.id} className={`flex ${style.align}`}>
            <div className="max-w-[80%] flex gap-2 items-start text-sm bg-slate-50 rounded-lg p-2">
              <span className={`shrink-0 px-2 py-0.5 rounded-full text-xs font-medium ${style.chip}`}>
                {e.agent.replace("_", " ")}
              </span>
              <span>{TYPE_ICON[e.type] ?? ""}</span>
              <span className="text-slate-700">{String(e.payload?.message ?? "")}</span>
            </div>
          </div>
        );
      })}
      {events.length === 0 && (
        <p className="text-slate-400 text-sm">
          The Doc Agent and Audit Agent will converse here once the pipeline runs…
        </p>
      )}
      <div ref={bottomRef} />
    </div>
  );
}
