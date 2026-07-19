import { useEffect, useRef, useState } from "react";
import { Clock as ClockIcon, ChevronDown, Check, Globe } from "lucide-react";
import { useTimezone, TZ_OPTIONS, labelFor } from "../store/timezone";

/** Live ticking date-time with a clickable timezone selector.
 *  Changing the zone updates every date/time shown across the app. */
export default function Clock() {
  const { tz, setTz } = useTimezone();
  const [now, setNow] = useState(new Date());
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(t);
  }, []);

  useEffect(() => {
    const onDoc = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, []);

  const fmt = (opts: Intl.DateTimeFormatOptions) =>
    new Intl.DateTimeFormat("en-GB", { timeZone: tz, ...opts }).format(now);

  const time = fmt({ hour: "2-digit", minute: "2-digit", second: "2-digit", hour12: false });
  const date = fmt({ day: "2-digit", month: "short", year: "numeric" });
  const offset = new Intl.DateTimeFormat("en-GB", { timeZone: tz, timeZoneName: "shortOffset" })
    .formatToParts(now).find((p) => p.type === "timeZoneName")?.value ?? "";

  return (
    <div ref={ref} className="relative">
      <button onClick={() => setOpen((o) => !o)}
              className="group flex items-center gap-2.5 rounded-xl px-3 py-1.5
                         border border-slate-200 dark:border-slate-700
                         bg-white/70 dark:bg-slate-900/60 backdrop-blur
                         hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors">
        <ClockIcon size={15} className="text-indigo-500 shrink-0" />
        <div className="flex flex-col items-start leading-none">
          <span className="font-mono text-sm font-semibold tabular-nums text-slate-800 dark:text-slate-100">
            {time}
          </span>
          <span className="text-[10px] text-slate-400 dark:text-slate-500 tracking-wide">
            {date} · {offset}
          </span>
        </div>
        <ChevronDown size={13}
                     className={`text-slate-400 transition-transform ${open ? "rotate-180" : ""}`} />
      </button>

      {open && (
        <div className="absolute right-0 mt-2 w-60 z-50 card p-1.5 animate-scale-in
                        max-h-80 overflow-y-auto">
          <p className="flex items-center gap-1.5 text-[11px] font-semibold uppercase
                        tracking-wider text-slate-400 px-2.5 py-1.5">
            <Globe size={12} /> Display timezone
          </p>
          {TZ_OPTIONS.map((o) => {
            const off = new Intl.DateTimeFormat("en-GB",
              { timeZone: o.id, timeZoneName: "shortOffset" })
              .formatToParts(now).find((p) => p.type === "timeZoneName")?.value ?? "";
            return (
              <button key={o.id} onClick={() => { setTz(o.id); setOpen(false); }}
                      className={`w-full flex items-center justify-between gap-2 rounded-lg px-2.5 py-2
                                  text-sm transition-colors
                                  ${tz === o.id
                                    ? "bg-slate-100 dark:bg-slate-800 font-semibold text-slate-900 dark:text-white"
                                    : "text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800/60"}`}>
                <span className="flex items-center gap-2">
                  {tz === o.id ? <Check size={14} className="text-indigo-500" />
                               : <span className="w-3.5" />}
                  {o.label}
                </span>
                <span className="font-mono text-[11px] text-slate-400">{off}</span>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
