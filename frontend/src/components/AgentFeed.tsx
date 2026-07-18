import { useEffect, useRef, useState } from "react";
import { ChevronDown } from "lucide-react";
import type { AgentEvent } from "../api/client";

const AGENT_STYLE: Record<string, { chip: string; align: string; avatar: string }> = {
  doc_agent:   { chip: "chip-blue",    align: "justify-start",  avatar: "bg-blue-600" },
  audit_agent: { chip: "chip-purple",  align: "justify-end",    avatar: "bg-purple-600" },
  scorecard:   { chip: "chip-emerald", align: "justify-center", avatar: "bg-emerald-600" },
  pipeline:    { chip: "chip-slate",   align: "justify-center", avatar: "bg-slate-400 dark:bg-slate-600" },
};

const TYPE_ICON: Record<string, string> = {
  doc_claim: "📄", challenge: "⚔️", defend: "🛡️", concede: "🤝",
  verdict: "✅", docs_complete: "🏁", audit_complete: "🏁", error: "❌",
};

const RENDER_WINDOW = 150; // lazy log rendering: only the latest N messages hit the DOM

/** The two agents' live conversation — Doc Agent left, Audit Agent right.
 *  Smart-scrolls: follows the log only while you're at the bottom. */
export default function AgentFeed({ events }: { events: AgentEvent[] }) {
  const boxRef = useRef<HTMLDivElement>(null);
  const [pinned, setPinned] = useState(true);   // are we following the tail?
  const visible = events.slice(-RENDER_WINDOW);

  useEffect(() => {
    if (pinned && boxRef.current) {
      boxRef.current.scrollTo({ top: boxRef.current.scrollHeight, behavior: "smooth" });
    }
  }, [events.length, pinned]);

  const onScroll = () => {
    const el = boxRef.current;
    if (!el) return;
    setPinned(el.scrollHeight - el.scrollTop - el.clientHeight < 80);
  };

  return (
    <div className="relative">
      <div ref={boxRef} onScroll={onScroll}
           className="card p-5 h-[480px] overflow-y-auto space-y-2.5">
        {events.length > RENDER_WINDOW && (
          <p className="text-center text-xs text-slate-400 dark:text-slate-500">
            {events.length - RENDER_WINDOW} earlier messages hidden
          </p>
        )}
        {visible.map((e) => {
          const s = AGENT_STYLE[e.agent] ?? AGENT_STYLE.pipeline;
          return (
            <div key={e.id} className={`flex ${s.align} animate-fade-up`}>
              <div className="max-w-[82%] flex gap-2.5 items-start">
                <span className={`shrink-0 w-7 h-7 rounded-full ${s.avatar} text-white text-[10px]
                                  font-bold flex items-center justify-center mt-0.5`}>
                  {e.agent === "doc_agent" ? "DA" : e.agent === "audit_agent" ? "AA" : "•"}
                </span>
                <div className={`rounded-2xl px-3.5 py-2.5 transition-colors duration-500 ${
                    e.type === "error"
                      ? "bg-red-50 border border-red-100 dark:bg-red-500/10 dark:border-red-500/20"
                      : "bg-slate-50 dark:bg-slate-800/70"}`}>
                  <div className="flex items-center gap-2 mb-0.5">
                    <span className={`text-[10px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded ${s.chip}`}>
                      {e.agent.replace("_", " ")}
                    </span>
                    <span className="text-[10px] text-slate-400 dark:text-slate-500">
                      {new Date(e.at).toLocaleTimeString(undefined,
                        { hour: "2-digit", minute: "2-digit", second: "2-digit" })}
                    </span>
                    <span className="text-xs">{TYPE_ICON[e.type] ?? ""}</span>
                  </div>
                  <p className="text-sm text-slate-700 dark:text-slate-200 leading-relaxed break-words">
                    {String(e.payload?.message ?? "")}
                  </p>
                </div>
              </div>
            </div>
          );
        })}
        {events.length === 0 && (
          <div className="h-full flex flex-col items-center justify-center text-slate-400 dark:text-slate-500 gap-2">
            <span className="flex gap-1">
              {[0, 1, 2].map((i) => (
                <span key={i} className="w-2 h-2 rounded-full bg-slate-300 dark:bg-slate-600 animate-bounce"
                      style={{ animationDelay: `${i * 150}ms` }} />
              ))}
            </span>
            <p className="text-sm">Waiting for the agents to start talking…</p>
          </div>
        )}
      </div>

      {!pinned && (
        <button onClick={() => setPinned(true)}
                className="absolute bottom-4 right-4 btn btn-primary !rounded-full !p-2.5 shadow-lg animate-scale-in">
          <ChevronDown size={16} />
        </button>
      )}
    </div>
  );
}
