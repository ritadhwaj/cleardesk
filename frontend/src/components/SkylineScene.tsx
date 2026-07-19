import { useTheme } from "../store/theme";

/** Animated corporate skyline for the login panel.
 *  Light: day sky, sun high. Toggle -> sun arcs down and sets, stars come out,
 *  a bright moon rises, and the tower windows light up — a full dusk sequence.
 *  Toggling back plays the reverse: moonset into sunrise. */

const BUILDINGS = [
  { x: 16, w: 96, h: 250 }, { x: 128, w: 120, h: 390 }, { x: 268, w: 96, h: 300 },
  { x: 384, w: 132, h: 450 }, { x: 536, w: 88, h: 260 }, { x: 644, w: 118, h: 360 },
];

const STARS = Array.from({ length: 24 }, (_, i) => ({
  cx: (i * 137 + 31) % 780 + 10, cy: (i * 47 + 13) % 240 + 12,
  r: i % 3 === 0 ? 2 : 1.2, delay: `${(i % 5) * 0.35}s`,
}));

export default function SkylineScene() {
  const { dark } = useTheme();
  const t = (ms: number, delay = 0) =>
    ({ transition: `all ${ms}ms cubic-bezier(0.45,0,0.25,1) ${delay}ms` });

  return (
    <div className="absolute inset-0 overflow-hidden pointer-events-none select-none">
      <svg viewBox="0 0 800 680" className="w-full h-full" preserveAspectRatio="xMidYMax slice">
        <defs>
          <linearGradient id="daySky" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#7dd3fc" /><stop offset="100%" stopColor="#f0f9ff" />
          </linearGradient>
          <linearGradient id="nightSky" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#020617" /><stop offset="100%" stopColor="#1e1b4b" />
          </linearGradient>
          <filter id="glow"><feGaussianBlur stdDeviation="6" /></filter>
        </defs>

        {/* sky crossfade */}
        <rect width="800" height="680" fill="url(#daySky)" style={{ ...t(1400), opacity: dark ? 0 : 1 }} />
        <rect width="800" height="680" fill="url(#nightSky)" style={{ ...t(1400), opacity: dark ? 1 : 0 }} />

        {/* stars twinkle out at night */}
        {STARS.map((s, i) => (
          <circle key={i} cx={s.cx} cy={s.cy} r={s.r} fill="white"
                  className={dark ? "animate-twinkle" : ""}
                  style={{ ...t(900, 700), opacity: dark ? 0.9 : 0, animationDelay: s.delay }} />
        ))}

        {/* sun: high at day -> arcs down past the towers to set */}
        <g style={{ ...t(1600), transform: dark ? "translate(140px, 560px)" : "translate(0px, 0px)" }}>
          <circle cx="180" cy="130" r="48" fill="#fbbf24" opacity="0.55" filter="url(#glow)" />
          <circle cx="180" cy="130" r="34" fill="#fcd34d" />
        </g>
        {/* moon: rises as the sun sets */}
        <g style={{ ...t(1600, 350), transform: dark ? "translate(0px, 0px)" : "translate(-90px, 580px)" }}>
          <circle cx="600" cy="120" r="36" fill="#f1f5f9" opacity="0.5" filter="url(#glow)" />
          <circle cx="600" cy="120" r="27" fill="#f8fafc" />
          <circle cx="591" cy="111" r="6" fill="#cbd5e1" opacity="0.7" />
          <circle cx="607" cy="129" r="3.5" fill="#cbd5e1" opacity="0.6" />
        </g>

        {/* towers + windows that light up at night */}
        {BUILDINGS.map((b, bi) => {
          const y = 680 - b.h;
          const cols = Math.floor((b.w - 14) / 15);
          const rows = Math.floor((b.h - 24) / 22);
          return (
            <g key={bi}>
              <rect x={b.x} y={y} width={b.w} height={b.h} rx="2"
                    style={{ ...t(1200), fill: dark ? "#0f172a" : "#cbd5e1" }} />
              <rect x={b.x} y={y} width={b.w} height="6" rx="2"
                    style={{ ...t(1200), fill: dark ? "#1e293b" : "#94a3b8" }} />
              {Array.from({ length: rows }).flatMap((_, r) =>
                Array.from({ length: cols }).map((_, c) => {
                  const lit = (r * 7 + c * 13 + bi * 5) % 3 === 0;
                  return (
                    <rect key={`${r}-${c}`}
                          x={b.x + 8 + c * 15} y={y + 14 + r * 22} width="8" height="11" rx="1"
                          style={{
                            ...t(800, 600 + ((r + c + bi) % 6) * 120),
                            fill: dark ? (lit ? "#fbbf24" : "#1e293b")
                                       : "#eff6ff",
                            opacity: dark && !lit ? 0.6 : 0.95,
                          }} />
                  );
                }))}
            </g>
          );
        })}
      </svg>
    </div>
  );
}
