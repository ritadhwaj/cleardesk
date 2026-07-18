import { useState } from "react";
import { Check, Pencil, AlertTriangle, Info, XCircle } from "lucide-react";
import { postReviewAction } from "../api/client";

interface Discrepancy {
  id: string; kind: string; severity: string; title: string;
  detail: Record<string, unknown>; resolution: string;
}

const SEVERITY: Record<string, { chip: string; Icon: typeof Info }> = {
  INFO: { chip: "chip-slate", Icon: Info },
  WARN: { chip: "chip-amber", Icon: AlertTriangle },
  FAIL: { chip: "chip-red", Icon: XCircle },
};

/** One flagged item in Review Mode: readable evidence + Accept / Correct actions. */
export default function DiscrepancyCard({ caseId, d, onResolved }:
  { caseId: string; d: Discrepancy; onResolved: () => void }) {
  const [correcting, setCorrecting] = useState(false);
  const [value, setValue] = useState("");
  const [busy, setBusy] = useState(false);
  const sev = SEVERITY[d.severity] ?? SEVERITY.INFO;

  const act = async (action: string, corrected_value?: string) => {
    setBusy(true);
    try {
      await postReviewAction(caseId, { action, discrepancy_id: d.id, corrected_value });
      onResolved();
    } finally {
      setBusy(false);
    }
  };

  const values = (d.detail?.values as Array<Record<string, string>>) ?? null;

  return (
    <div className="card card-hover p-5 space-y-3.5 animate-fade-up">
      <div className="flex items-start justify-between gap-3">
        <p className="font-semibold text-slate-800 dark:text-slate-100 leading-snug">{d.title}</p>
        <span className={`inline-flex items-center gap-1 text-[11px] font-bold px-2.5 py-1 rounded-full shrink-0 ${sev.chip}`}>
          <sev.Icon size={12} /> {d.severity}
        </span>
      </div>

      {values ? (
        <div className="grid sm:grid-cols-2 gap-2">
          {values.map((v, i) => (
            <div key={i} className="rounded-xl bg-slate-50 border border-slate-100
                                    dark:bg-slate-800/70 dark:border-slate-700/60 px-3.5 py-2.5
                                    transition-colors duration-500">
              <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500">
                {v.doc ?? v.agent ?? `source ${i + 1}`}
              </p>
              <p className="font-mono text-sm text-slate-800 dark:text-slate-200 mt-0.5">{v.value ?? "—"}</p>
            </div>
          ))}
        </div>
      ) : (
        <pre className="text-xs bg-slate-50 dark:bg-slate-800/70 rounded-xl p-3 overflow-x-auto
                        text-slate-600 dark:text-slate-300">
          {JSON.stringify(d.detail, null, 2)}
        </pre>
      )}

      {d.resolution === "OPEN" ? (
        correcting ? (
          <div className="flex gap-2">
            <input autoFocus className="input flex-1"
                   value={value} onChange={(e) => setValue(e.target.value)}
                   placeholder="Enter the correct value" />
            <button onClick={() => act("CORRECT", value)} disabled={busy || !value}
                    className="btn btn-primary disabled:opacity-40">Save</button>
            <button onClick={() => setCorrecting(false)} className="btn btn-ghost">Cancel</button>
          </div>
        ) : (
          <div className="flex gap-2">
            <button onClick={() => act("ACCEPT")} disabled={busy} className="btn btn-success">
              <Check size={15} /> Accept AI finding
            </button>
            <button onClick={() => setCorrecting(true)} disabled={busy} className="btn btn-ghost">
              <Pencil size={14} /> Correct value
            </button>
          </div>
        )
      ) : (
        <p className="inline-flex items-center gap-1.5 text-xs font-semibold text-emerald-600 dark:text-emerald-400">
          <Check size={13} /> resolved · {d.resolution.replace("_", " ").toLowerCase()}
        </p>
      )}
    </div>
  );
}
