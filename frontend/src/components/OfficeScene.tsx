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

        {/* ---- desk (2.5-D) ---- */}
        <g>
          {/* shadow */}
          <ellipse cx="235" cy="800" rx="200" ry="22"
                   style={{ transition: `fill 1300ms ${EASE}, opacity 1300ms ${EASE}`,
                            fill: "#000000", opacity: dark ? 0.5 : 0.12 }} />
          {/* top surface with slight perspective */}
          <polygon points="70,676 400,676 424,700 46,700" fill="url(#deskTopDay)" style={fade(!dark)} />
          <polygon points="70,676 400,676 424,700 46,700" fill="url(#deskTopNight)" style={fade(dark)} />
          {/* front edge */}
          <rect x="46" y="700" width="378" height="14" rx="3"
                style={fill("#cbd5e1", "#0d131d")} />
          {/* legs */}
          <rect x="70" y="714" width="12" height="86" style={fill("#b6c2d1", "#151b26")} />
          <rect x="390" y="714" width="12" height="86" style={fill("#b6c2d1", "#151b26")} />
          {/* monitor */}
          <rect x="170" y="592" width="120" height="74" rx="6" strokeWidth="4"
                style={{ transition: `fill 1300ms ${EASE}, stroke 1300ms ${EASE}`,
                         fill: dark ? "#0f172a" : "#f1f5f9", stroke: dark ? "#475569" : "#9db0c4" }} />
          <rect x="176" y="598" width="108" height="62" rx="4" fill="#38bdf8"
                style={{ ...fade(dark, 900, 1300), opacity: dark ? 0.3 : 0 }} />
          <rect x="220" y="666" width="20" height="9" style={fill("#9db0c4", "#374151")} />
          {/* mug + plant */}
          <rect x="320" y="654" width="18" height="20" rx="3" style={fill("#e2e8f0", "#1f2937")} />
          <rect x="120" y="640" width="24" height="26" rx="4" style={fill("#dbe3ec", "#1f2937")} />
          <path d="M 132 640 C 120 616 121 606 132 594 C 143 606 145 618 132 640 Z"
                style={fill("#4ade80", "#14532d")} />
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
