import { useEffect, useRef, useState } from "react";
import { getScorecard, type Scorecard, type AgentEvent } from "../api/client";

function scoreColors(score: number) {
  if (score >= 90) return { text: "text-emerald-600", stroke: "#059669" };
  if (score >= 70) return { text: "text-amber-600", stroke: "#d97706" };
  return { text: "text-red-600", stroke: "#dc2626" };
}

/** Animated count-up hook for the score number. */
function useCountUp(target: number, ms = 900) {
  const [value, setValue] = useState(0);
  const raf = useRef<number>();
  useEffect(() => {
    const start = performance.now();
    const from = value;
    const tick = (t: number) => {
      const p = Math.min(1, (t - start) / ms);
      const eased = 1 - Math.pow(1 - p, 3);
      setValue(from + (target - from) * eased);
      if (p < 1) raf.current = requestAnimationFrame(tick);
    };
    raf.current = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf.current!);
  }, [target]); // eslint-disable-line react-hooks/exhaustive-deps
  return value;
}

export default function ScorecardPanel({ caseId, events }: { caseId: string; events: AgentEvent[] }) {
  const [sc, setSc] = useState<Scorecard | null>(null);
  const scored = events.filter((e) => e.agent === "scorecard" && e.type === "completed").length;

  useEffect(() => {
    getScorecard(caseId).then(setSc).catch(() => setSc(null));
  }, [caseId, scored]);

  const target = sc ? Number(sc.overall_score) : 0;
  const shown = useCountUp(target);
  const colors = scoreColors(target);
  const R = 56, C = 2 * Math.PI * R;

  if (!sc) {
    return (
      <div className="card p-6 flex items-center gap-4">
        <div className="skeleton w-32 h-32 !rounded-full" />
        <div className="flex-1 space-y-3">
          <div className="skeleton h-5 w-2/3" />
          <div className="skeleton h-5 w-1/2" />
          <p className="text-sm text-slate-400">Scorecard appears when the agents converge.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="card p-6 animate-scale-in">
      <div className="flex flex-wrap items-center gap-8">
        {/* progress ring */}
        <div className="relative w-36 h-36 shrink-0">
          <svg viewBox="0 0 128 128" className="w-full h-full -rotate-90">
            <circle cx="64" cy="64" r={R} fill="none" stroke="#e2e8f0" strokeWidth="10" />
            <circle cx="64" cy="64" r={R} fill="none" stroke={colors.stroke} strokeWidth="10"
                    strokeLinecap="round" strokeDasharray={C}
                    strokeDashoffset={C - (C * shown) / 100}
                    style={{ transition: "stroke-dashoffset 0.1s linear" }} />
          </svg>
          <div className="absolute inset-0 flex flex-col items-center justify-center">
            <span className={`text-3xl font-extrabold tabular-nums ${colors.text}`}>
              {shown.toFixed(0)}%
            </span>
            <span className="text-[10px] uppercase tracking-wider text-slate-400 font-semibold">
              correctness
            </span>
          </div>
        </div>

        <div className="flex-1 min-w-[240px] space-y-4">
          <div className="grid grid-cols-3 gap-3 text-center">
            {[
              { n: sc.auto_verified, label: "auto-verified", cls: "bg-emerald-50 text-emerald-700" },
              { n: sc.review_needed, label: "needs review", cls: "bg-amber-50 text-amber-700" },
              { n: sc.hard_fail, label: "hard fail", cls: "bg-red-50 text-red-700" },
            ].map(({ n, label, cls }) => (
              <div key={label} className={`rounded-xl p-3.5 ${cls}`}>
                <div className="text-2xl font-bold tabular-nums">{n}</div>
                <div className="text-[11px] font-semibold">{label}</div>
              </div>
            ))}
          </div>
          {sc.summary && (
            <p className="text-sm text-slate-600 leading-relaxed border-t border-slate-100 pt-3.5">
              {sc.summary}
            </p>
          )}
          <p className="text-[11px] text-slate-400">
            Scorecard v{sc.version} · score computed deterministically — agents provide facts, never the number
          </p>
        </div>
      </div>
    </div>
  );
}
