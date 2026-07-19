import { useTheme } from "../store/theme";

/** Animated corporate skyline (login panel).
 *  2.5-D towers with lit faces + side extrusions, drifting clouds in both
 *  themes, and a sunset -> moonrise sequence on theme toggle.
 *  Perf: no SVG filters — glows are radial gradients; only transform /
 *  opacity / fill are transitioned, with will-change hints. */

const EASE = "cubic-bezier(0.65, 0, 0.35, 1)";

const BUILDINGS = [
  { x: 16, w: 96, h: 250 }, { x: 128, w: 120, h: 390 }, { x: 268, w: 96, h: 300 },
  { x: 384, w: 132, h: 450 }, { x: 536, w: 88, h: 260 }, { x: 644, w: 118, h: 360 },
];

// pseudo-random but stable star field; each twinkles on its own rhythm
const STARS = Array.from({ length: 34 }, (_, i) => {
  const rnd = (n: number) => ((Math.sin(i * 12.9898 + n * 78.233) * 43758.5453) % 1 + 1) % 1;
  return {
    cx: rnd(1) * 780 + 10, cy: rnd(2) * 250 + 12,
    r: rnd(3) > 0.8 ? 2 : 1.2,
    delay: `${(rnd(4) * 4).toFixed(2)}s`,
    dur: `${(2.2 + rnd(5) * 2.6).toFixed(2)}s`,
  };
});

const CLOUDS = [
  { x: 90, y: 90, s: 1.15, cls: "animate-drift" },
  { x: 430, y: 55, s: 0.85, cls: "animate-drift-2" },
  { x: 610, y: 165, s: 1.0, cls: "animate-drift" },
];

function Cloud({ dark }: { dark: boolean }) {
  return (
    <g style={{ transition: `fill 1400ms ${EASE}, opacity 1400ms ${EASE}` }}
       fill={dark ? "#26314b" : "#ffffff"} opacity={dark ? 0.55 : 0.92}>
      <ellipse cx="0" cy="0" rx="46" ry="17" />
      <ellipse cx="-28" cy="6" rx="30" ry="13" />
      <ellipse cx="30" cy="5" rx="32" ry="14" />
      <ellipse cx="4" cy="-12" rx="26" ry="14" />
    </g>
  );
}

export default function SkylineScene() {
  const { dark } = useTheme();
  const fade = (on: boolean, ms = 1400, delay = 0) => ({
    opacity: on ? 1 : 0,
    transition: `opacity ${ms}ms ${EASE} ${delay}ms`,
  });

  return (
    <div className="absolute inset-0 overflow-hidden pointer-events-none select-none">
      <svg viewBox="0 0 800 680" className="w-full h-full" preserveAspectRatio="xMidYMax slice">
        <defs>
          <linearGradient id="daySky" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#3b82f6" /><stop offset="55%" stopColor="#93c5fd" />
            <stop offset="100%" stopColor="#fef3c7" />
          </linearGradient>
          <linearGradient id="nightSky" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#020617" /><stop offset="70%" stopColor="#1e1b4b" />
            <stop offset="100%" stopColor="#312e81" />
          </linearGradient>
          <radialGradient id="sunGlow">
            <stop offset="0%" stopColor="#fff7cc" /><stop offset="35%" stopColor="#fcd34d" />
            <stop offset="70%" stopColor="#fbbf24" stopOpacity="0.35" />
            <stop offset="100%" stopColor="#fbbf24" stopOpacity="0" />
          </radialGradient>
          <radialGradient id="moonGlow">
            <stop offset="0%" stopColor="#ffffff" /><stop offset="40%" stopColor="#e2e8f0" />
            <stop offset="75%" stopColor="#cbd5e1" stopOpacity="0.25" />
            <stop offset="100%" stopColor="#cbd5e1" stopOpacity="0" />
          </radialGradient>
          <linearGradient id="towerDay" x1="0" y1="0" x2="1" y2="0">
            <stop offset="0%" stopColor="#e2e8f0" /><stop offset="55%" stopColor="#cbd5e1" />
            <stop offset="100%" stopColor="#94a3b8" />
          </linearGradient>
          <linearGradient id="towerNight" x1="0" y1="0" x2="1" y2="0">
            <stop offset="0%" stopColor="#1e293b" /><stop offset="60%" stopColor="#111a2e" />
            <stop offset="100%" stopColor="#0b1220" />
          </linearGradient>
          <linearGradient id="glassDay" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#bfdbfe" /><stop offset="100%" stopColor="#eff6ff" />
          </linearGradient>
        </defs>

        {/* sky crossfade */}
        <rect width="800" height="680" fill="url(#daySky)" style={fade(!dark)} />
        <rect width="800" height="680" fill="url(#nightSky)" style={fade(dark)} />

        {/* stars — twinkle in place behind the moon, random rhythms */}
        {dark && STARS.map((s, i) => (
          <circle key={i} cx={s.cx} cy={s.cy} r={s.r} fill="white"
                  className="animate-star"
                  style={{ animationDelay: s.delay, animationDuration: s.dur }} />
        ))}

        {/* sun: sets behind towers */}
        <g style={{ transform: dark ? "translate(150px, 580px)" : "translate(0px, 0px)",
                    transition: `transform 1800ms ${EASE}`, willChange: "transform" }}>
          <circle cx="180" cy="130" r="95" fill="url(#sunGlow)" />
          <circle cx="180" cy="130" r="34" fill="#fde047" />
        </g>
        {/* moon: rises after sunset begins */}
        <g style={{ transform: dark ? "translate(0px, 0px)" : "translate(-100px, 600px)",
                    transition: `transform 1800ms ${EASE} 300ms`, willChange: "transform" }}>
          <circle cx="600" cy="120" r="72" fill="url(#moonGlow)" />
          <circle cx="600" cy="120" r="27" fill="#f8fafc" />
          <circle cx="591" cy="111" r="6" fill="#cbd5e1" opacity="0.7" />
          <circle cx="607" cy="129" r="3.5" fill="#cbd5e1" opacity="0.6" />
          <circle cx="599" cy="119" r="2.5" fill="#cbd5e1" opacity="0.5" />
        </g>

        {/* clouds — drift in both themes, tinted by night */}
        {CLOUDS.map((c, i) => (
          <g key={i} className={c.cls}
             style={{ transformOrigin: `${c.x}px ${c.y}px` }}>
            <g transform={`translate(${c.x} ${c.y}) scale(${c.s})`}>
              <Cloud dark={dark} />
            </g>
          </g>
        ))}

        {/* airliner — side profile, flies across the sky, both themes */}
        <g className="animate-fly">
          <g transform="scale(1.05)">
            {/* twin contrails behind the engines */}
            <rect x="-150" y="99.5" width="150" height="2.4" rx="1.2" fill="#ffffff"
                  opacity={dark ? 0.12 : 0.4} />
            <rect x="-150" y="106" width="150" height="2.4" rx="1.2" fill="#ffffff"
                  opacity={dark ? 0.12 : 0.4} />

            <g style={{ transition: `fill 1400ms ${EASE}` }}>
              {/* far wing (behind fuselage, darker for depth) */}
              <path d="M 30 101 L 8 122 L 20 122 L 44 103 Z"
                    fill={dark ? "#64748b" : "#94a3b8" } />
              {/* horizontal stabilizer */}
              <path d="M -8 101 L -20 92 L -13 92 L 2 100 Z"
                    fill={dark ? "#94a3b8" : "#cbd5e1"} />
              {/* fuselage */}
              <path d="M -14 100 L 40 96.5 Q 60 96.5 66 101.5 Q 60 106.5 40 106.5 L -14 103.5
                       Q -20 101.75 -14 100 Z"
                    fill={dark ? "#e2e8f0" : "#f8fafc"} />
              {/* cockpit nose shading */}
              <path d="M 52 97.6 Q 66 99 66 101.5 Q 66 104 52 105.4 Z"
                    fill={dark ? "#cbd5e1" : "#e2e8f0"} />
              {/* tail fin */}
              <path d="M -14 100.5 L -24 82 L -14 82 L -2 99.5 Z"
                    fill={dark ? "#cbd5e1" : "#e5edf6"} />
              {/* belly shadow */}
              <path d="M -12 103.5 L 40 106 Q 58 106 64 102.6 Q 58 108.5 40 108.5 L -12 105 Z"
                    fill={dark ? "#94a3b8" : "#cbd5e1"} opacity="0.8" />
              {/* near wing (in front, lighter) */}
              <path d="M 26 105 L 0 84 L 14 84 L 42 103.5 Z"
                    fill={dark ? "#cbd5e1" : "#e2e8f0"} />
              {/* engine nacelle under the wing */}
              <ellipse cx="24" cy="107" rx="7" ry="3" fill={dark ? "#64748b" : "#94a3b8"} />
            </g>

            {/* cockpit window */}
            <path d="M 56 99.5 L 61 100 L 61 102 L 56 102.5 Z"
                  fill={dark ? "#38bdf8" : "#0ea5e9"} opacity="0.85" />
            {/* cabin windows */}
            {[6, 14, 22, 30, 38, 46].map((wx) => (
              <rect key={wx} x={wx} y="100" width="2.4" height="2.2" rx="0.6"
                    fill={dark ? "#fde68a" : "#7dd3fc"}
                    opacity={dark ? 0.95 : 0.8} />
            ))}
          </g>
        </g>

        {/* 2.5-D towers: lit front face + darker side extrusion + roof */}
        {BUILDINGS.map((b, bi) => {
          const y = 680 - b.h;
          const d = 16; // extrusion depth
          const cols = Math.floor((b.w - 18) / 20);
          const rows = Math.floor((b.h - 30) / 30);
          return (
            <g key={bi}>
              {/* side face */}
              <polygon points={`${b.x + b.w},${y} ${b.x + b.w + d},${y - d * 0.6} ${b.x + b.w + d},${680 - d * 0.6} ${b.x + b.w},680`}
                       style={{ transition: `fill 1400ms ${EASE}`,
                                fill: dark ? "#060b16" : "#64748b" }} />
              {/* roof */}
              <polygon points={`${b.x},${y} ${b.x + d},${y - d * 0.6} ${b.x + b.w + d},${y - d * 0.6} ${b.x + b.w},${y}`}
                       style={{ transition: `fill 1400ms ${EASE}`,
                                fill: dark ? "#111a2e" : "#e2e8f0" }} />
              {/* front face: gradient crossfade */}
              <rect x={b.x} y={y} width={b.w} height={b.h} fill="url(#towerDay)" style={fade(!dark, 1200)} />
              <rect x={b.x} y={y} width={b.w} height={b.h} fill="url(#towerNight)" style={fade(dark, 1200)} />
              {/* windows */}
              {Array.from({ length: rows }).flatMap((_, r) =>
                Array.from({ length: cols }).map((_, c) => {
                  const lit = (r * 7 + c * 13 + bi * 5) % 3 === 0;
                  return (
                    <rect key={`${r}-${c}`}
                          x={b.x + 11 + c * 20} y={y + 18 + r * 30} width="11" height="15" rx="1.5"
                          style={{
                            transition: `fill 700ms ${EASE} ${500 + ((r + c + bi) % 6) * 120}ms, opacity 700ms ${EASE}`,
                            fill: dark ? (lit ? "#fbbf24" : "#182238") : "url(#glassDay)",
                            opacity: dark && !lit ? 0.7 : 0.95,
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
