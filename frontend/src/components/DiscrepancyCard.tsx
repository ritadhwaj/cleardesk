import { useState } from "react";
import { postReviewAction } from "../api/client";

interface Discrepancy {
  id: string; kind: string; severity: string; title: string;
  detail: Record<string, unknown>; resolution: string;
}

const SEVERITY_STYLE: Record<string, string> = {
  INFO: "bg-slate-100 text-slate-600",
  WARN: "bg-amber-100 text-amber-700",
  FAIL: "bg-red-100 text-red-700",
};

/** One flagged item in Review Mode: evidence + Accept / Correct actions.
 *  TODO: render side-by-side evidence crops from detail.values. */
export default function DiscrepancyCard({ caseId, d, onResolved }:
  { caseId: string; d: Discrepancy; onResolved: () => void }) {
  const [correcting, setCorrecting] = useState(false);
  const [value, setValue] = useState("");

  const act = async (action: string, corrected_value?: string) => {
    await postReviewAction(caseId, { action, discrepancy_id: d.id, corrected_value });
    onResolved();
  };

  return (
    <div className="bg-white rounded-xl shadow-sm p-4 space-y-3">
      <div className="flex justify-between">
        <span className="font-medium text-slate-800">{d.title}</span>
        <span className={`text-xs px-2 py-1 rounded-full ${SEVERITY_STYLE[d.severity]}`}>
          {d.severity}
        </span>
      </div>
      <pre className="text-xs bg-slate-50 rounded p-2 overflow-x-auto">
        {JSON.stringify(d.detail, null, 2)}
      </pre>
      {d.resolution === "OPEN" ? (
        correcting ? (
          <div className="flex gap-2">
            <input className="border rounded-lg p-2 flex-1 text-sm" value={value}
                   onChange={(e) => setValue(e.target.value)} placeholder="Correct value" />
            <button onClick={() => act("CORRECT", value)}
                    className="bg-slate-800 text-white px-3 rounded-lg text-sm">Save</button>
          </div>
        ) : (
          <div className="flex gap-2">
            <button onClick={() => act("ACCEPT")}
                    className="bg-green-600 text-white px-3 py-1.5 rounded-lg text-sm">
              Accept AI finding
            </button>
            <button onClick={() => setCorrecting(true)}
                    className="bg-white border px-3 py-1.5 rounded-lg text-sm">
              Correct value
            </button>
          </div>
        )
      ) : (
        <span className="text-xs text-slate-400">resolved: {d.resolution}</span>
      )}
    </div>
  );
}
