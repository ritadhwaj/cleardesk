import { useTheme } from "../store/theme";

/** Office-room scene for the left sidebar panel (portrait).
 *  Light: white room, sun + drifting clouds in the window, a strong sunbeam
 *  and a glare pool across the desk. Dark: matte black room, moon + stars +
 *  night clouds in the window, pendant lamps switch on in sequence.
 *  Perf: gradient glows only (no SVG filters), transform/opacity/fill
 *  transitions with will-change. */

const EASE = "cubic-bezier(0.65, 0, 0.35, 1)";

const LAMPS = [
  { x: 110, drop: 150, delay: 200 },
  { x: 235, drop: 195, delay: 400 },
  { x: 360, drop: 160, delay: 600 },
];

export default function OfficeScene() {
  const { dark } = useTheme();
  const fade = (on: boolean, ms = 1300, delay = 0) => ({
    opacity: on ? 1 : 0,
    transition: `opacity ${ms}ms ${EASE} ${delay}ms`,
  });
  const fill = (light: string, night: string, ms = 1300) => ({
    fill: dark ? night : light,
    transition: `fill ${ms}ms ${EASE}`,
  });

  return (
    <div className="absolute inset-0 overflow-hidden pointer-events-none select-none">
      <svg viewBox="0 0 480 960" className="w-full h-full" preserveAspectRatio="xMidYMax slice">
        <defs>
          <linearGradient id="wallDay" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#ffffff" /><stop offset="100%" stopColor="#e8edf4" />
          </linearGradient>
          <linearGradient id="wallNight" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#0c1018" /><stop offset="100%" stopColor="#05070c" />
          </linearGradient>
          <linearGradient id="floorDay" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#dbe3ec" /><stop offset="100%" stopColor="#c4cfdc" />
          </linearGradient>
          <linearGradient id="floorNight" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#0b0f18" /><stop offset="100%" stopColor="#070a10" />
          </linearGradient>
          <linearGradient id="winDay" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#60a5fa" /><stop offset="100%" stopColor="#dbeafe" />
          </linearGradient>
          <linearGradient id="winNight" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#0b1026" /><stop offset="100%" stopColor="#1e1b4b" />
          </linearGradient>
          <radialGradient id="sunG">
            <stop offset="0%" stopColor="#fff8d6" /><stop offset="40%" stopColor="#fcd34d" />
            <stop offset="100%" stopColor="#fbbf24" stopOpacity="0" />
          </radialGradient>
          <radialGradient id="moonG">
            <stop offset="0%" stopColor="#ffffff" /><stop offset="45%" stopColor="#e2e8f0" />
            <stop offset="100%" stopColor="#cbd5e1" stopOpacity="0" />
          </radialGradient>
          <linearGradient id="beamG" x1="1" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#fef3c7" stopOpacity="0.95" />
            <stop offset="100%" stopColor="#fde68a" stopOpacity="0.06" />
          </linearGradient>
          <radialGradient id="glareG">
            <stop offset="0%" stopColor="#fffbeb" stopOpacity="0.95" />
            <stop offset="100%" stopColor="#fde68a" stopOpacity="0" />
          </radialGradient>
          <linearGradient id="coneG" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#fde68a" stopOpacity="0.9" />
            <stop offset="100%" stopColor="#fde68a" stopOpacity="0.02" />
          </linearGradient>
          <linearGradient id="deskTopDay" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#ffffff" /><stop offset="100%" stopColor="#e2e8f0" />
          </linearGradient>
          <linearGradient id="deskTopNight" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#232b38" /><stop offset="100%" stopColor="#141a24" />
          </linearGradient>
          <clipPath id="winClip"><rect x="256" y="150" width="188" height="270" rx="8" /></clipPath>
          <clipPath id="artClip"><rect x="66" y="216" width="116" height="92" /></clipPath>
          <linearGradient id="artSky" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#fcd34d" /><stop offset="55%" stopColor="#fb7185" />
            <stop offset="100%" stopColor="#a855f7" />
          </linearGradient>
          <radialGradient id="lampWarm">
            <stop offset="0%" stopColor="#fde68a" /><stop offset="100%" stopColor="#f59e0b" stopOpacity="0" />
          </radialGradient>
        </defs>

        {/* wall + floor */}
        <rect width="480" height="770" fill="url(#wallDay)" style={fade(!dark)} />
        <rect width="480" height="770" fill="url(#wallNight)" style={fade(dark)} />
        <rect y="770" width="480" height="190" fill="url(#floorDay)" style={fade(!dark)} />
        <rect y="770" width="480" height="190" fill="url(#floorNight)" style={fade(dark)} />
        <line x1="0" y1="770" x2="480" y2="770" strokeWidth="2"
              style={{ transition: `stroke 1300ms ${EASE}`, stroke: dark ? "#1e293b" : "#b6c2d1" }} />
        {/* skirting for depth */}
        <rect y="756" width="480" height="14"
              style={fill("#eef2f7", "#0e1420")} />

        {/* ---- window (right) with sky inside ---- */}
        <g>
          {/* window shadow for 3d pop */}
          <rect x="262" y="158" width="188" height="270" rx="8"
                style={fill("#b6c2d1", "#000000")} opacity="0.35" />
          <rect x="256" y="150" width="188" height="270" rx="8"
                style={{ transition: `stroke 1300ms ${EASE}`,
                         stroke: dark ? "#334155" : "#94a3b8", fill: "none" }} strokeWidth="10" />
          <g clipPath="url(#winClip)">
            <rect x="256" y="150" width="188" height="270" fill="url(#winDay)" style={fade(!dark)} />
            <rect x="256" y="150" width="188" height="270" fill="url(#winNight)" style={fade(dark)} />
            {/* sun in the window */}
            <g style={{ transform: dark ? "translate(30px, 260px)" : "translate(0,0)",
                        transition: `transform 1600ms ${EASE}`, willChange: "transform" }}>
              <circle cx="310" cy="230" r="55" fill="url(#sunG)" />
              <circle cx="310" cy="230" r="20" fill="#fde047" />
            </g>
            {/* moon in the window */}
            <g style={{ transform: dark ? "translate(0,0)" : "translate(-24px, 270px)",
                        transition: `transform 1600ms ${EASE} 250ms`, willChange: "transform" }}>
              <circle cx="392" cy="215" r="42" fill="url(#moonG)" />
              <circle cx="392" cy="215" r="16" fill="#f8fafc" />
              <circle cx="387" cy="210" r="3.5" fill="#cbd5e1" opacity="0.7" />
              <circle cx="397" cy="220" r="2.2" fill="#cbd5e1" opacity="0.6" />
            </g>
            {/* stars — twinkle in place behind the moon, random rhythms */}
            {dark && [...Array(16)].map((_, i) => {
              const rnd = (n: number) => ((Math.sin(i * 12.9898 + n * 78.233) * 43758.5453) % 1 + 1) % 1;
              return (
                <circle key={i} cx={264 + rnd(1) * 174} cy={162 + rnd(2) * 210}
                        r={rnd(3) > 0.8 ? 1.8 : 1.1} fill="white"
                        className="animate-star"
                        style={{ animationDelay: `${(rnd(4) * 4).toFixed(2)}s`,
                                 animationDuration: `${(2.2 + rnd(5) * 2.6).toFixed(2)}s` }} />
              );
            })}
            {/* window clouds: white by day, slate by night, always drifting */}
            <g className="animate-drift">
              <g transform="translate(300 300) scale(0.55)">
                <g style={{ transition: `fill 1300ms ${EASE}, opacity 1300ms ${EASE}` }}
                   fill={dark ? "#26314b" : "#ffffff"} opacity={dark ? 0.6 : 0.95}>
                  <ellipse cx="0" cy="0" rx="46" ry="16" /><ellipse cx="-28" cy="6" rx="28" ry="12" />
                  <ellipse cx="28" cy="5" rx="30" ry="13" /><ellipse cx="4" cy="-11" rx="24" ry="13" />
                </g>
              </g>
            </g>
            <g className="animate-drift-2">
              <g transform="translate(390 185) scale(0.4)">
                <g style={{ transition: `fill 1300ms ${EASE}, opacity 1300ms ${EASE}` }}
                   fill={dark ? "#1f2940" : "#ffffff"} opacity={dark ? 0.5 : 0.9}>
                  <ellipse cx="0" cy="0" rx="46" ry="16" /><ellipse cx="-26" cy="6" rx="26" ry="12" />
                  <ellipse cx="26" cy="5" rx="28" ry="12" />
                </g>
              </g>
            </g>
          </g>
          {/* mullions */}
          <line x1="350" y1="155" x2="350" y2="415" strokeWidth="7"
                style={{ transition: `stroke 1300ms ${EASE}`, stroke: dark ? "#334155" : "#94a3b8" }} />
          <line x1="260" y1="285" x2="440" y2="285" strokeWidth="7"
                style={{ transition: `stroke 1300ms ${EASE}`, stroke: dark ? "#334155" : "#94a3b8" }} />
        </g>

        {/* ---- framed art on the wall (left of window) ---- */}
        <g>
          {/* drop shadow */}
          <rect x="58" y="212" width="140" height="112" rx="4"
                style={{ transition: `opacity 1300ms ${EASE}`, fill: "#000",
                         opacity: dark ? 0.4 : 0.14 }} transform="translate(4 5)" />
          {/* gilt frame */}
          <rect x="54" y="208" width="140" height="112" rx="4"
                style={fill("#c8a24a", "#7c6a34")} />
          <rect x="62" y="216" width="124" height="96"
                style={fill("#f8fafc", "#0f1420")} />
          {/* the artwork: colourful sunset landscape (stays vivid, dims slightly at night) */}
          <g clipPath="url(#artClip)"
             style={{ transition: `opacity 1300ms ${EASE}`, opacity: dark ? 0.82 : 1 }}>
            <rect x="66" y="220" width="116" height="88" fill="url(#artSky)" />
            <circle cx="150" cy="250" r="15" fill="#fb923c" />
            <path d="M 66 292 Q 96 262 124 292 T 182 288 L 182 308 L 66 308 Z" fill="#c2410c" />
            <path d="M 66 300 Q 100 276 134 300 T 182 298 L 182 308 L 66 308 Z" fill="#7c2d12" />
            <path d="M 66 304 Q 110 288 150 304 T 182 304 L 182 308 L 66 308 Z" fill="#4c1d0f" />
          </g>
        </g>

        {/* ---- sunbeam + glare pool (day only) ---- */}
        <polygon points="256,190 256,420 40,900 0,760 0,560" fill="url(#beamG)"
                 style={fade(!dark, 1500)} />
        <ellipse cx="180" cy="705" rx="150" ry="34" fill="url(#glareG)"
                 style={fade(!dark, 1500, 150)} />
        <ellipse cx="120" cy="850" rx="180" ry="46" fill="url(#glareG)"
                 style={{ ...fade(!dark, 1500, 250), opacity: dark ? 0 : 0.8 }} />

        {/* ---- pendant lamps ---- */}
        {LAMPS.map((l, i) => (
          <g key={i}>
            <line x1={l.x} y1="0" x2={l.x} y2={l.drop} strokeWidth="3"
                  style={{ transition: `stroke 1300ms ${EASE}`, stroke: dark ? "#475569" : "#9db0c4" }} />
            <path d={`M ${l.x - 30} ${l.drop + 30} L ${l.x - 9} ${l.drop} L ${l.x + 9} ${l.drop} L ${l.x + 30} ${l.drop + 30} Z`}
                  strokeWidth="2"
                  style={{ transition: `fill 1300ms ${EASE}, stroke 1300ms ${EASE}`,
                           fill: dark ? "#1f2937" : "#cdd8e4", stroke: dark ? "#374151" : "#9db0c4" }} />
            <ellipse cx={l.x} cy={l.drop + 30} rx="30" ry="5"
                     style={fill("#b6c2d1", "#111827")} />
            {/* bulb, glow, cone: night only, staggered */}
            <circle cx={l.x} cy={l.drop + 24} r="8"
                    style={{ transition: `fill 450ms ${EASE} ${l.delay + 700}ms`,
                             fill: dark ? "#fde68a" : "#e2e8f0" }} />
            <circle cx={l.x} cy={l.drop + 24} r="34" fill="url(#sunG)"
                    style={fade(dark, 500, l.delay + 700)} />
            <polygon points={`${l.x - 26},${l.drop + 34} ${l.x + 26},${l.drop + 34} ${l.x + 105},700 ${l.x - 105},700`}
                     fill="url(#coneG)" style={{ ...fade(dark, 700, l.delay + 800), opacity: dark ? 0.45 : 0 }} />
            <ellipse cx={l.x} cy="700" rx="95" ry="16" fill="url(#glareG)"
                     style={fade(dark, 700, l.delay + 900)} />
          </g>
        ))}

        {/* ---- desk (2.5-D) with colourful desk items ---- */}
        <g>
          {/* shadow */}
          <ellipse cx="235" cy="800" rx="200" ry="22"
                   style={{ transition: `fill 1300ms ${EASE}, opacity 1300ms ${EASE}`,
                            fill: "#000000", opacity: dark ? 0.5 : 0.12 }} />
          {/* warm wooden desktop (colour in both themes, richer at night) */}
          <polygon points="70,676 400,676 424,700 46,700"
                   style={fill("#c9964e", "#6b4b2a")} />
          <polygon points="70,676 400,676 400,680 70,680"
                   style={fill("#e0b877", "#7c5a34")} opacity="0.7" />
          {/* front edge */}
          <rect x="46" y="700" width="378" height="14" rx="3"
                style={fill("#a9743c", "#4a3320")} />
          {/* legs */}
          <rect x="70" y="714" width="12" height="86" style={fill("#8f6234", "#2c1e12")} />
          <rect x="390" y="714" width="12" height="86" style={fill("#8f6234", "#2c1e12")} />

          {/* monitor showing a little dashboard */}
          <rect x="166" y="586" width="128" height="80" rx="6" strokeWidth="4"
                style={{ transition: `fill 1300ms ${EASE}, stroke 1300ms ${EASE}`,
                         fill: dark ? "#0b1220" : "#1e293b", stroke: dark ? "#475569" : "#334155" }} />
          {/* screen content: header bar + coloured chart bars */}
          <rect x="172" y="592" width="116" height="12" rx="2" fill="#3b82f6" opacity="0.85" />
          <rect x="176" y="612" width="14" height="46" rx="1.5" fill="#38bdf8" />
          <rect x="196" y="626" width="14" height="32" rx="1.5" fill="#34d399" />
          <rect x="216" y="618" width="14" height="40" rx="1.5" fill="#fbbf24" />
          <rect x="236" y="634" width="14" height="24" rx="1.5" fill="#f472b6" />
          <rect x="256" y="606" width="26" height="52" rx="2" fill="#1e293b" opacity="0.5" />
          <circle cx="269" cy="628" r="9" fill="none" stroke="#a78bfa" strokeWidth="3.5" />
          <rect x="222" y="666" width="16" height="9" style={fill("#94a3b8", "#374151")} />
          <rect x="206" y="675" width="48" height="5" rx="2" style={fill("#94a3b8", "#374151")} />

          {/* keyboard */}
          <polygon points="188,684 272,684 280,694 180,694"
                   style={fill("#e2e8f0", "#2b3546")} />
          {[192, 205, 218, 231, 244, 257].map((kx) => (
            <rect key={kx} x={kx} y="686" width="9" height="4" rx="1"
                  style={fill("#cbd5e1", "#3b475a")} />
          ))}

          {/* stack of colourful books (left) */}
          <rect x="70" y="664" width="52" height="8" rx="1.5" fill="#ef4444" />
          <rect x="74" y="656" width="48" height="8" rx="1.5" fill="#3b82f6" />
          <rect x="72" y="648" width="50" height="8" rx="1.5" fill="#f59e0b" />
          <rect x="78" y="640" width="42" height="8" rx="1.5" fill="#10b981" />

          {/* pen holder with coloured pens */}
          <rect x="128" y="652" width="22" height="24" rx="3" style={fill("#cbd5e1", "#334155")} />
          <line x1="134" y1="652" x2="131" y2="632" stroke="#ef4444" strokeWidth="3" strokeLinecap="round" />
          <line x1="140" y1="652" x2="141" y2="628" stroke="#3b82f6" strokeWidth="3" strokeLinecap="round" />
          <line x1="146" y1="652" x2="149" y2="634" stroke="#10b981" strokeWidth="3" strokeLinecap="round" />

          {/* coffee mug with handle + steam */}
          <rect x="300" y="654" width="22" height="22" rx="3" fill="#0d9488" />
          <path d="M 322 658 q 9 0 9 7 t -9 7" fill="none" stroke="#0d9488" strokeWidth="3" />
          <ellipse cx="311" cy="654" rx="11" ry="3" fill="#5eead4" />
          <path d="M 307 650 q -4 -8 2 -14" fill="none" stroke="#cbd5e1" strokeWidth="2"
                strokeLinecap="round" opacity={dark ? 0.35 : 0.6} />
          <path d="M 314 650 q 4 -8 -2 -14" fill="none" stroke="#cbd5e1" strokeWidth="2"
                strokeLinecap="round" opacity={dark ? 0.35 : 0.6} />

          {/* sticky note on the desk */}
          <rect x="150" y="668" width="20" height="18" rx="1" fill="#fde047"
                transform="rotate(-8 160 677)" />

          {/* potted plant (terracotta) */}
          <path d="M 356 656 L 378 656 L 375 676 L 359 676 Z" fill="#e07a5f" />
          <rect x="356" y="652" width="22" height="6" rx="1" fill="#c96a4f" />
          <path d="M 367 652 C 352 626 355 616 367 606 C 379 616 382 628 367 652 Z" fill="#22c55e" />
          <path d="M 367 652 C 360 632 356 626 350 620 C 360 622 368 634 367 652 Z" fill="#16a34a" />
          <path d="M 367 652 C 374 632 378 626 384 620 C 374 622 366 634 367 652 Z" fill="#16a34a" />

          {/* small desk lamp (right) with warm glow at night */}
          <rect x="392" y="662" width="26" height="6" rx="2" style={fill("#64748b", "#334155")} />
          <line x1="405" y1="662" x2="400" y2="628" stroke={dark ? "#475569" : "#64748b"} strokeWidth="3" />
          <line x1="400" y1="628" x2="386" y2="614" stroke={dark ? "#475569" : "#64748b"} strokeWidth="3" />
          <path d="M 378 606 L 396 610 L 390 624 L 374 618 Z" style={fill("#475569", "#1f2937")} />
          <circle cx="385" cy="616" r="18" fill="url(#lampWarm)" style={fade(dark, 600, 1400)} />
        </g>

        {/* ---- chair facing the desk ---- */}
        <g>
          <ellipse cx="235" cy="905" rx="90" ry="14"
                   style={{ transition: `opacity 1300ms ${EASE}`, fill: "#000",
                            opacity: dark ? 0.45 : 0.1 }} />
          <rect x="196" y="716" width="78" height="16" rx="8" style={fill("#dbe3ec", "#1a2230")} />
          <rect x="227" y="732" width="16" height="66" style={fill("#c4cfdc", "#151b26")} />
          <rect x="190" y="796" width="90" height="10" rx="5" style={fill("#c4cfdc", "#151b26")} />
          <rect x="188" y="640" width="18" height="86" rx="8" strokeWidth="2"
                style={{ transition: `fill 1300ms ${EASE}, stroke 1300ms ${EASE}`,
                         fill: dark ? "#1a2230" : "#dbe3ec", stroke: dark ? "#2b3546" : "#b6c2d1" }} />
        </g>
      </svg>
    </div>
  );
}
