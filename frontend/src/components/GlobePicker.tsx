import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { X, Globe2, Check } from "lucide-react";
import { useTimezone, TZ_OPTIONS } from "../store/timezone";

/** Full-screen dialog with an auto-rotating wireframe globe. City markers sit on
 *  the sphere; hover highlights one (globe pauses) and shows its label, click
 *  selects that timezone. A city list on the side is the accessible fallback. */
export default function GlobePicker({ onClose }: { onClose: () => void }) {
  const { tz, setTz } = useTimezone();
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [hover, setHover] = useState<number | null>(null);
  const hoverRef = useRef<number | null>(null);
  const rot = useRef(0);
  const [, force] = useState(0);

  useEffect(() => { hoverRef.current = hover; }, [hover]);

  useEffect(() => {
    const canvas = canvasRef.current!;
    const ctx = canvas.getContext("2d")!;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const SIZE = 380, R = 150, cx = SIZE / 2, cy = SIZE / 2, TILT = -0.35;
    canvas.width = SIZE * dpr; canvas.height = SIZE * dpr;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    let raf = 0;

    const project = (latDeg: number, lonDeg: number) => {
      const lat = (latDeg * Math.PI) / 180;
      const lon = (lonDeg * Math.PI) / 180 + rot.current;
      const x = Math.cos(lat) * Math.sin(lon);
      let y = Math.sin(lat);
      let z = Math.cos(lat) * Math.cos(lon);
      const y2 = y * Math.cos(TILT) - z * Math.sin(TILT);
      const z2 = y * Math.sin(TILT) + z * Math.cos(TILT);
      return { sx: cx + R * x, sy: cy - R * y2, z: z2, x };
    };

    const draw = () => {
      ctx.clearRect(0, 0, SIZE, SIZE);

      // sphere body
      const g = ctx.createRadialGradient(cx - 45, cy - 55, 20, cx, cy, R);
      g.addColorStop(0, "#1e3a8a"); g.addColorStop(0.6, "#0f2557"); g.addColorStop(1, "#05102e");
      ctx.beginPath(); ctx.arc(cx, cy, R, 0, Math.PI * 2); ctx.fillStyle = g; ctx.fill();
      // rim glow
      ctx.beginPath(); ctx.arc(cx, cy, R, 0, Math.PI * 2);
      ctx.strokeStyle = "rgba(96,165,250,0.55)"; ctx.lineWidth = 1.5; ctx.stroke();

      // graticule
      const line = (pts: { sx: number; sy: number; z: number }[]) => {
        let started = false;
        ctx.beginPath();
        for (const p of pts) {
          if (p.z >= 0) {
            if (!started) { ctx.moveTo(p.sx, p.sy); started = true; } else ctx.lineTo(p.sx, p.sy);
          } else started = false;
        }
        ctx.strokeStyle = "rgba(96,165,250,0.18)"; ctx.lineWidth = 1; ctx.stroke();
      };
      for (let latD = -60; latD <= 60; latD += 30) {
        const pts = []; for (let l = 0; l <= 360; l += 6) pts.push(project(latD, l)); line(pts);
      }
      for (let lonD = 0; lonD < 360; lonD += 30) {
        const pts = []; for (let l = -90; l <= 90; l += 6) pts.push(project(l, lonD)); line(pts);
      }

      // city markers (front hemisphere)
      TZ_OPTIONS.forEach((o, i) => {
        const p = project(o.lat, o.lon);
        if (p.z < 0) return;
        const selected = o.id === tz;
        const hovered = hoverRef.current === i;
        const rad = (hovered ? 6 : 3.5) + p.z * 1.5;
        ctx.beginPath(); ctx.arc(p.sx, p.sy, rad, 0, Math.PI * 2);
        ctx.fillStyle = selected ? "#34d399" : hovered ? "#93c5fd" : "#60a5fa";
        ctx.globalAlpha = 0.5 + 0.5 * p.z; ctx.fill(); ctx.globalAlpha = 1;
        if (hovered || selected) {
          ctx.beginPath(); ctx.arc(p.sx, p.sy, rad + 4, 0, Math.PI * 2);
          ctx.strokeStyle = selected ? "#34d399" : "#93c5fd"; ctx.lineWidth = 1.5; ctx.stroke();
          ctx.font = "600 12px Inter, sans-serif";
          const label = o.city;
          const tw = ctx.measureText(label).width;
          const lx = Math.min(Math.max(p.sx - tw / 2, 4), SIZE - tw - 8);
          ctx.fillStyle = "rgba(2,6,23,0.85)";
          ctx.fillRect(lx - 5, p.sy - rad - 22, tw + 10, 17);
          ctx.fillStyle = "#e2e8f0"; ctx.fillText(label, lx, p.sy - rad - 9);
        }
      });

      if (hoverRef.current === null) rot.current += 0.0042;
      raf = requestAnimationFrame(draw);
    };
    draw();

    const pick = (e: MouseEvent) => {
      const r = canvas.getBoundingClientRect();
      const mx = (e.clientX - r.left) * (SIZE / r.width);
      const my = (e.clientY - r.top) * (SIZE / r.height);
      let best: number | null = null, bestD = 16;
      TZ_OPTIONS.forEach((o, i) => {
        const p = project(o.lat, o.lon);
        if (p.z < 0) return;
        const d = Math.hypot(p.sx - mx, p.sy - my);
        if (d < bestD) { bestD = d; best = i; }
      });
      if (best !== hoverRef.current) { hoverRef.current = best; setHover(best); }
    };
    const onClick = () => {
      if (hoverRef.current !== null) { setTz(TZ_OPTIONS[hoverRef.current].id); onClose(); }
    };
    canvas.addEventListener("mousemove", pick);
    canvas.addEventListener("mouseleave", () => { hoverRef.current = null; setHover(null); });
    canvas.addEventListener("click", onClick);
    force((n) => n + 1);
    return () => {
      cancelAnimationFrame(raf);
      canvas.removeEventListener("mousemove", pick);
      canvas.removeEventListener("click", onClick);
    };
  }, [tz]); // eslint-disable-line

  return createPortal(
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4
                    bg-slate-950/70 backdrop-blur-sm animate-fade-in"
         onClick={onClose}>
      <div className="card p-6 w-full max-w-3xl animate-scale-in" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-4">
          <h2 className="flex items-center gap-2 text-lg font-bold h-page">
            <Globe2 size={20} className="text-indigo-500" /> Choose your timezone
          </h2>
          <button onClick={onClose}
                  className="w-8 h-8 rounded-lg border border-slate-200 dark:border-slate-600
                             flex items-center justify-center text-slate-400
                             hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors">
            <X size={16} />
          </button>
        </div>

        <div className="grid md:grid-cols-[380px_1fr] gap-6 items-center">
          <div className="flex flex-col items-center">
            <canvas ref={canvasRef}
                    className="cursor-pointer"
                    style={{ width: 380, height: 380 }} />
            <p className="text-xs text-slate-400 dark:text-slate-500 mt-1">
              {hover !== null
                ? `Click to select ${TZ_OPTIONS[hover].city}`
                : "Hover the globe and click a city"}
            </p>
          </div>

          {/* accessible city list / fallback */}
          <div className="grid grid-cols-2 gap-1.5 max-h-[380px] overflow-y-auto pr-1">
            {TZ_OPTIONS.map((o, i) => (
              <button key={o.id}
                      onMouseEnter={() => setHover(i)}
                      onMouseLeave={() => setHover(null)}
                      onClick={() => { setTz(o.id); onClose(); }}
                      className={`flex items-center justify-between gap-2 rounded-lg px-3 py-2 text-sm
                                  text-left transition-colors
                                  ${o.id === tz
                                    ? "bg-emerald-50 dark:bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 font-semibold"
                                    : hover === i
                                      ? "bg-slate-100 dark:bg-slate-800"
                                      : "hover:bg-slate-50 dark:hover:bg-slate-800/60 text-slate-600 dark:text-slate-300"}`}>
                <span>
                  <span className="block leading-tight">{o.city}</span>
                  <span className="block text-[11px] text-slate-400">{o.label}</span>
                </span>
                {o.id === tz && <Check size={15} className="shrink-0 text-emerald-500" />}
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>,
    document.body
  );
}
