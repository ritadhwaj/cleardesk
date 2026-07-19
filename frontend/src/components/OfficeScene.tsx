import { useTheme } from "../store/theme";

/** Ambient office room behind the whole app.
 *  Light: white walls & desk, a window-shaped sunbeam falls across the room.
 *  Dark: matte black room — the sunbeam dies and three pendant lamps switch on
 *  (staggered), pouring warm light cones onto the desk. All CSS-transitioned. */

const LAMPS = [
  { x: 470, drop: 175, delay: 200 },
  { x: 620, drop: 215, delay: 380 },
  { x: 770, drop: 185, delay: 560 },
];

export default function OfficeScene() {
  const { dark } = useTheme();
  const t = (ms: number, delay = 0) =>
    ({ transition: `all ${ms}ms cubic-bezier(0.45,0,0.25,1) ${delay}ms` });

  return (
    <div className="fixed inset-0 z-0 overflow-hidden pointer-events-none select-none opacity-[0.55]">
      <svg viewBox="0 0 1440 900" className="w-full h-full" preserveAspectRatio="xMidYMax slice">
        <defs>
          <linearGradient id="beam" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor="#fef3c7" stopOpacity="0.9" />
            <stop offset="100%" stopColor="#fef9c3" stopOpacity="0.15" />
          </linearGradient>
          <linearGradient id="cone" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#fde68a" stopOpacity="0.85" />
            <stop offset="100%" stopColor="#fde68a" stopOpacity="0.02" />
          </linearGradient>
          <filter id="soft"><feGaussianBlur stdDeviation="5" /></filter>
        </defs>

        {/* wall + floor */}
        <rect width="1440" height="740" style={{ ...t(1200), fill: dark ? "#05070d" : "#f8fafc" }} />
        <rect y="740" width="1440" height="160" style={{ ...t(1200), fill: dark ? "#0a0f1a" : "#e2e8f0" }} />
        <line x1="0" y1="740" x2="1440" y2="740"
              style={{ ...t(1200), stroke: dark ? "#1e293b" : "#cbd5e1" }} strokeWidth="2" />

        {/* window on the right of the room */}
        <g>
          <rect x="1060" y="150" width="300" height="400" rx="6"
                style={{ ...t(1200), fill: dark ? "#0b1026" : "#bae6fd",
                         stroke: dark ? "#334155" : "#94a3b8" }} strokeWidth="10" />
          <line x1="1210" y1="155" x2="1210" y2="545"
                style={{ ...t(1200), stroke: dark ? "#334155" : "#94a3b8" }} strokeWidth="8" />
          <line x1="1065" y1="350" x2="1355" y2="350"
                style={{ ...t(1200), stroke: dark ? "#334155" : "#94a3b8" }} strokeWidth="8" />
          {/* sun / moon seen through the glass */}
          <circle cx="1140" cy="240" r="30" fill="#fcd34d" filter="url(#soft)"
                  style={{ ...t(1400), opacity: dark ? 0 : 0.9 }} />
          <circle cx="1290" cy="230" r="22" fill="#f1f5f9" filter="url(#soft)"
                  style={{ ...t(1400, 300), opacity: dark ? 0.95 : 0 }} />
          {[...Array(8)].map((_, i) => (
            <circle key={i} cx={1080 + (i * 37) % 260 + 8} cy={175 + (i * 53) % 150}
                    r={i % 3 ? 1.2 : 1.8} fill="white"
                    className={dark ? "animate-twinkle" : ""}
                    style={{ ...t(900, 500), opacity: dark ? 0.9 : 0,
                             animationDelay: `${(i % 4) * 0.4}s` }} />
          ))}
        </g>

        {/* window-shaped sunbeam projected across the room (dies at night) */}
        <polygon points="1060,220 1060,540 420,830 180,700"
                 fill="url(#beam)" filter="url(#soft)"
                 style={{ ...t(1500), opacity: dark ? 0 : 0.7 }} />

        {/* pendant lamps */}
        {LAMPS.map((l, i) => (
          <g key={i}>
            <line x1={l.x} y1="0" x2={l.x} y2={l.drop}
                  style={{ ...t(1200), stroke: dark ? "#475569" : "#94a3b8" }} strokeWidth="3" />
            <path d={`M ${l.x - 34} ${l.drop + 34} L ${l.x - 10} ${l.drop} L ${l.x + 10} ${l.drop} L ${l.x + 34} ${l.drop + 34} Z`}
                  style={{ ...t(1200), fill: dark ? "#1f2937" : "#cbd5e1",
                           stroke: dark ? "#374151" : "#94a3b8" }} strokeWidth="2" />
            {/* bulb + glow + cone: only at night, staggered switch-on */}
            <circle cx={l.x} cy={l.drop + 26} r="9"
                    style={{ ...t(500, l.delay + 700), fill: dark ? "#fde68a" : "#e2e8f0" }} />
            <circle cx={l.x} cy={l.drop + 26} r="20" fill="#fde68a" filter="url(#soft)"
                    style={{ ...t(500, l.delay + 700), opacity: dark ? 0.7 : 0 }} />
            <polygon points={`${l.x - 30},${l.drop + 36} ${l.x + 30},${l.drop + 36} ${l.x + 130},640 ${l.x - 130},640`}
                     fill="url(#cone)"
                     style={{ ...t(700, l.delay + 800), opacity: dark ? 0.5 : 0 }} />
          </g>
        ))}

        {/* desk */}
        <g>
          <rect x="360" y="628" width="520" height="16" rx="5"
                style={{ ...t(1200), fill: dark ? "#111827" : "#ffffff",
                         stroke: dark ? "#374151" : "#cbd5e1" }} strokeWidth="2" />
          <rect x="386" y="644" width="14" height="120"
                style={{ ...t(1200), fill: dark ? "#1f2937" : "#e2e8f0" }} />
          <rect x="842" y="644" width="14" height="120"
                style={{ ...t(1200), fill: dark ? "#1f2937" : "#e2e8f0" }} />
          {/* monitor */}
          <rect x="560" y="540" width="130" height="80" rx="6"
                style={{ ...t(1200), fill: dark ? "#0f172a" : "#f1f5f9",
                         stroke: dark ? "#475569" : "#94a3b8" }} strokeWidth="4" />
          <rect x="614" y="620" width="22" height="10"
                style={{ ...t(1200), fill: dark ? "#374151" : "#cbd5e1" }} />
          {/* screen glow at night */}
          <rect x="566" y="546" width="118" height="68" rx="4" fill="#38bdf8" filter="url(#soft)"
                style={{ ...t(900, 1200), opacity: dark ? 0.25 : 0 }} />
          {/* plant */}
          <rect x="800" y="600" width="26" height="28" rx="4"
                style={{ ...t(1200), fill: dark ? "#1f2937" : "#e2e8f0" }} />
          <path d="M 813 600 C 800 575 800 565 812 552 C 824 565 826 578 813 600 Z"
                style={{ ...t(1200), fill: dark ? "#14532d" : "#4ade80" }} />
        </g>

        {/* chair facing the desk */}
        <g>
          <rect x="585" y="668" width="80" height="14" rx="7"
                style={{ ...t(1200), fill: dark ? "#1f2937" : "#e2e8f0",
                         stroke: dark ? "#374151" : "#cbd5e1" }} strokeWidth="2" />
          <rect x="616" y="682" width="16" height="60"
                style={{ ...t(1200), fill: dark ? "#1f2937" : "#e2e8f0" }} />
          <rect x="580" y="742" width="90" height="10" rx="5"
                style={{ ...t(1200), fill: dark ? "#1f2937" : "#e2e8f0" }} />
          <rect x="577" y="600" width="18" height="80" rx="8"
                style={{ ...t(1200), fill: dark ? "#1f2937" : "#e2e8f0",
                         stroke: dark ? "#374151" : "#cbd5e1" }} strokeWidth="2" />
        </g>
      </svg>
    </div>
  );
}
