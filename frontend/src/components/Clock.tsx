import { useEffect, useState } from "react";
import { Globe2 } from "lucide-react";
import { useTimezone, optionFor } from "../store/timezone";
import GlobePicker from "./GlobePicker";

/** Live date-time display (Date · Time · Timezone+city). Clicking opens the
 *  interactive 3D globe timezone picker. */
export default function Clock() {
  const { tz } = useTimezone();
  const [now, setNow] = useState(new Date());
  const [open, setOpen] = useState(false);
  const opt = optionFor(tz);

  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(t);
  }, []);

  const fmt = (o: Intl.DateTimeFormatOptions) =>
    new Intl.DateTimeFormat("en-GB", { timeZone: tz, ...o }).format(now);
  const date = fmt({ weekday: "short", day: "2-digit", month: "short", year: "numeric" });
  const time = fmt({ hour: "2-digit", minute: "2-digit", second: "2-digit", hour12: false });
  const offset = new Intl.DateTimeFormat("en-GB", { timeZone: tz, timeZoneName: "shortOffset" })
    .formatToParts(now).find((p) => p.type === "timeZoneName")?.value ?? "";

  return (
    <>
      <button onClick={() => setOpen(true)} title="Change timezone"
              className="group flex items-center gap-2.5 rounded-xl px-3 py-1.5
                         border border-slate-200 dark:border-slate-700
                         bg-white/70 dark:bg-slate-900/60 backdrop-blur
                         hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors">
        <Globe2 size={16} className="text-indigo-500 shrink-0 group-hover:rotate-12 transition-transform" />
        <div className="flex flex-col items-start leading-none gap-0.5">
          <span className="text-[13px] font-semibold text-slate-800 dark:text-slate-100">
            {date}
          </span>
          <span className="font-mono text-[13px] font-semibold tabular-nums text-slate-600 dark:text-slate-300">
            {time}
          </span>
          <span className="text-[10px] text-slate-400 dark:text-slate-500 tracking-wide">
            {opt.city} · {offset}
          </span>
        </div>
      </button>

      {open && <GlobePicker onClose={() => setOpen(false)} />}
    </>
  );
}
