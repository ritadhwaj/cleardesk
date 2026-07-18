import { useTheme } from "../store/theme";

const STARS = [
  { top: "22%", left: "16%", size: 2, delay: "0s" },
  { top: "58%", left: "28%", size: 1.5, delay: "0.4s" },
  { top: "30%", left: "42%", size: 2.5, delay: "0.8s" },
  { top: "62%", left: "52%", size: 1.5, delay: "0.2s" },
  { top: "20%", left: "60%", size: 2, delay: "0.6s" },
];

/** Day/night toggle: sun with a drifting cloud by day; slides into a
 *  starlit night with a cratered moon. Everything crossfades on a slow
 *  ease so it reads as dusk falling, not a switch flipping. */
export default function ThemeToggle() {
  const { dark, toggle } = useTheme();

  return (
    <button onClick={toggle} aria-label="Toggle light/dark theme"
            title={dark ? "Switch to day" : "Switch to night"}
            className="relative w-[72px] h-9 rounded-full overflow-hidden shrink-0
                       border border-sky-200/70 dark:border-indigo-800/70
                       shadow-inner transition-colors duration-700 group">
      {/* day sky */}
      <span className={`absolute inset-0 bg-gradient-to-b from-sky-300 via-sky-400 to-sky-500
                        transition-opacity duration-700 ease-in-out
                        ${dark ? "opacity-0" : "opacity-100"}`} />
      {/* night sky */}
      <span className={`absolute inset-0 bg-gradient-to-b from-slate-950 via-indigo-950 to-slate-900
                        transition-opacity duration-700 ease-in-out
                        ${dark ? "opacity-100" : "opacity-0"}`} />

      {/* stars — fade in and twinkle at night */}
      {STARS.map((s, i) => (
        <span key={i}
              className={`absolute rounded-full bg-white transition-opacity duration-1000
                          ${dark ? "opacity-90 animate-twinkle" : "opacity-0"}`}
              style={{ top: s.top, left: s.left, width: s.size, height: s.size,
                       animationDelay: s.delay }} />
      ))}

      {/* cloud — drifts away and dissolves at night */}
      <svg viewBox="0 0 40 16" width="26" height="11"
           className={`absolute right-2 top-1/2 -translate-y-1/2 transition-all duration-700 ease-in-out
                       ${dark ? "translate-x-6 opacity-0" : "translate-x-0 opacity-95"}`}>
        <ellipse cx="12" cy="11" rx="9" ry="5" fill="white" />
        <ellipse cx="21" cy="8" rx="8" ry="6" fill="white" />
        <ellipse cx="29" cy="11" rx="8" ry="5" fill="white" />
      </svg>

      {/* knob: sun ⇄ moon, sliding across the sky */}
      <span className={`absolute top-1 left-1 w-7 h-7 rounded-full
                        transition-all duration-700 ease-in-out
                        ${dark ? "translate-x-[36px] rotate-[360deg]" : "translate-x-0 rotate-0"}`}>
        {/* sun */}
        <span className={`absolute inset-0 rounded-full bg-gradient-to-br from-yellow-200 to-amber-400
                          shadow-[0_0_12px_rgba(251,191,36,0.9)]
                          transition-opacity duration-500
                          ${dark ? "opacity-0" : "opacity-100"}`} />
        {/* moon */}
        <span className={`absolute inset-0 rounded-full bg-gradient-to-br from-slate-100 to-slate-300
                          shadow-[0_0_10px_rgba(226,232,240,0.5)]
                          transition-opacity duration-500
                          ${dark ? "opacity-100" : "opacity-0"}`}>
          <span className="absolute w-1.5 h-1.5 rounded-full bg-slate-400/60 top-1.5 left-2" />
          <span className="absolute w-1 h-1 rounded-full bg-slate-400/50 top-3.5 left-4" />
          <span className="absolute w-[3px] h-[3px] rounded-full bg-slate-400/50 top-4 left-1.5" />
        </span>
      </span>
    </button>
  );
}
