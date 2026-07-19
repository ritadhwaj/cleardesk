import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { X, Globe2, Check, Sun, Moon } from "lucide-react";
import { useTimezone, TZ_OPTIONS } from "../store/timezone";

/* Simplified continent outlines in [lon, lat] — rough but recognisable. */
const CONTINENTS: [number, number][][] = [
  [[-168,65],[-158,71],[-130,70],[-95,70],[-82,62],[-64,60],[-56,50],[-66,44],[-70,41],
   [-81,25],[-97,16],[-106,23],[-114,30],[-124,40],[-124,48],[-138,59],[-168,65]],
  [[-79,9],[-60,10],[-50,0],[-35,-6],[-38,-16],[-48,-25],[-58,-34],[-66,-45],[-74,-52],
   [-73,-42],[-71,-30],[-81,-6],[-79,9]],
  [[-16,15],[-6,20],[10,32],[11,37],[25,32],[34,31],[43,12],[51,12],[41,-2],[40,-16],
   [33,-27],[20,-35],[15,-30],[9,-3],[-8,4],[-17,6],[-16,15]],
  [[-10,36],[-2,43],[2,51],[-5,58],[10,59],[13,65],[26,71],[55,70],[95,76],[140,73],
   [168,66],[180,64],[160,60],[142,54],[135,44],[122,40],[121,31],[110,21],[95,8],
   [80,8],[73,17],[60,25],[52,30],[44,40],[36,45],[28,41],[40,30],[30,31],[22,38],
   [10,44],[-10,36]],
  [[113,-22],[122,-16],[131,-12],[142,-11],[147,-19],[153,-28],[150,-38],[140,-38],
   [129,-32],[118,-35],[114,-28],[113,-22]],
];

const SIZE = 380, RES = 360, TILT = -0.36;

/** Build an equirectangular Earth texture once (ocean + land + polar ice). */
function buildEarthTexture(): ImageData {
  const W = 720, H = 360;
  const c = document.createElement("canvas"); c.width = W; c.height = H;
  const x = c.getContext("2d")!;
  const ocean = x.createLinearGradient(0, 0, 0, H);
  ocean.addColorStop(0, "#0a2a52"); ocean.addColorStop(0.5, "#0e3a6b"); ocean.addColorStop(1, "#0a2a52");
  x.fillStyle = ocean; x.fillRect(0, 0, W, H);
  const px = (lon: number) => ((lon + 180) / 360) * W;
  const py = (lat: number) => ((90 - lat) / 180) * H;
  const land = x.createLinearGradient(0, 0, 0, H);
  land.addColorStop(0, "#5b7d52"); land.addColorStop(0.5, "#3f6b43"); land.addColorStop(1, "#4a6e40");
  for (const poly of CONTINENTS) {
    x.beginPath();
    poly.forEach(([lo, la], i) => (i ? x.lineTo(px(lo), py(la)) : x.moveTo(px(lo), py(la))));
    x.closePath();
    x.fillStyle = land; x.fill();
    x.lineWidth = 2; x.strokeStyle = "rgba(120,150,110,0.5)"; x.stroke();
  }
  // desert bands + polar ice for a touch of variety
  x.fillStyle = "rgba(196,170,110,0.28)";
  x.fillRect(px(-15), py(30), px(55) - px(-15), py(15) - py(30));
  x.fillStyle = "rgba(235,245,255,0.85)";
  x.fillRect(0, 0, W, py(75)); x.fillRect(0, py(-72), W, H - py(-72));
  return x.getImageData(0, 0, W, H);
}

function subsolar(now: Date) {
  const utcH = now.getUTCHours() + now.getUTCMinutes() / 60 + now.getUTCSeconds() / 3600;
  const lon = (-15 * (utcH - 12)) * Math.PI / 180;
  const start = Date.UTC(now.getUTCFullYear(), 0, 0);
  const day = Math.floor((now.getTime() - start) / 86400000);
  const lat = (-23.44 * Math.cos((2 * Math.PI / 365) * (day + 10))) * Math.PI / 180;
  return {
    x: Math.cos(lat) * Math.sin(lon), y: Math.sin(lat), z: Math.cos(lat) * Math.cos(lon),
  };
}

export default function GlobePicker({ onClose }: { onClose: () => void }) {
  const { tz, setTz } = useTimezone();
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [hover, setHover] = useState<number | null>(null);
  const hoverRef = useRef<number | null>(null);
  const rot = useRef(0);

  useEffect(() => { hoverRef.current = hover; }, [hover]);

  useEffect(() => {
    const canvas = canvasRef.current!;
    const ctx = canvas.getContext("2d")!;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    canvas.width = SIZE * dpr; canvas.height = SIZE * dpr;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

    const tex = buildEarthTexture();
    const TW = tex.width, TH = tex.height, T = tex.data;

    // offscreen globe raster
    const gc = document.createElement("canvas"); gc.width = RES; gc.height = RES;
    const gctx = gc.getContext("2d")!;
    const out = gctx.createImageData(RES, RES);
    const O = out.data;

    // precompute per-disk-pixel geometry
    const cr = RES / 2, Rr = RES / 2 - 2;
    const idx: number[] = [];
    const u0: number[] = [], vv: number[] = [], sLat: number[] = [], cLat: number[] = [];
    const sApp: number[] = [], cApp: number[] = [];
    for (let py2 = 0; py2 < RES; py2++) {
      for (let px2 = 0; px2 < RES; px2++) {
        const nx = (px2 - cr) / Rr, ny = (py2 - cr) / Rr;
        const r2 = nx * nx + ny * ny;
        if (r2 > 1) continue;
        const nz = Math.sqrt(1 - r2);
        // un-tilt (rotate +TILT back around X) to geographic sphere coords
        const y = ny * Math.cos(-TILT) - nz * Math.sin(-TILT);
        const z = ny * Math.sin(-TILT) + nz * Math.cos(-TILT);
        const x = nx;
        const lat = Math.asin(Math.max(-1, Math.min(1, y)));
        const app = Math.atan2(x, z);         // apparent longitude at rot=0
        const di = (py2 * RES + px2) * 4;
        idx.push(di);
        u0.push(((app / (2 * Math.PI)) + 0.5) * TW);
        vv.push(((90 - lat * 180 / Math.PI) / 180) * TH);
        sLat.push(Math.sin(lat)); cLat.push(Math.cos(lat));
        sApp.push(Math.sin(app)); cApp.push(Math.cos(app));
        O[di + 3] = 255;
      }
    }
    const N = idx.length;

    let raf = 0, last = performance.now();
    const project = (latD: number, lonD: number, rotV: number) => {
      const lat = latD * Math.PI / 180, lon = lonD * Math.PI / 180 + rotV;
      const x = Math.cos(lat) * Math.sin(lon);
      let y = Math.sin(lat), z = Math.cos(lat) * Math.cos(lon);
      const y2 = y * Math.cos(TILT) - z * Math.sin(TILT);
      const z2 = y * Math.sin(TILT) + z * Math.cos(TILT);
      const Rd = SIZE / 2 - 2;
      return { sx: SIZE / 2 + Rd * x, sy: SIZE / 2 - Rd * y2, z: z2 };
    };

    const draw = (t: number) => {
      const dt = Math.min(50, t - last); last = t;
      if (hoverRef.current === null) rot.current += 0.00028 * dt;
      const rotV = rot.current;
      const cosR = Math.cos(rotV), sinR = Math.sin(rotV);
      const uShift = (rotV / (2 * Math.PI)) * TW;
      const sun = subsolar(new Date());

      for (let i = 0; i < N; i++) {
        let u = u0[i] - uShift; u %= TW; if (u < 0) u += TW;
        const ti = (((vv[i] | 0) * TW + (u | 0)) * 4);
        // geographic normal (lon = app - rot)
        const gX = cLat[i] * (sApp[i] * cosR - cApp[i] * sinR);
        const gZ = cLat[i] * (cApp[i] * cosR + sApp[i] * sinR);
        const dot = gX * sun.x + sLat[i] * sun.y + gZ * sun.z;   // >0 day
        // smooth terminator
        const lit = dot > 0.12 ? 1 : dot < -0.05 ? 0 : (dot + 0.05) / 0.17;
        const f = 0.16 + 0.84 * lit;
        const di = idx[i];
        // night tint slightly blue, day full colour
        O[di]     = T[ti]     * f + (1 - lit) * 6;
        O[di + 1] = T[ti + 1] * f + (1 - lit) * 10;
        O[di + 2] = T[ti + 2] * f + (1 - lit) * 26;
      }
      gctx.putImageData(out, 0, 0);

      // composite: sphere + atmosphere
      ctx.clearRect(0, 0, SIZE, SIZE);
      ctx.save();
      ctx.beginPath(); ctx.arc(SIZE / 2, SIZE / 2, SIZE / 2 - 2, 0, Math.PI * 2); ctx.clip();
      ctx.drawImage(gc, 0, 0, SIZE, SIZE);
      // sun-side sheen
      const sg = ctx.createRadialGradient(SIZE / 2 - 60, SIZE / 2 - 70, 20, SIZE / 2, SIZE / 2, SIZE / 2);
      sg.addColorStop(0, "rgba(255,255,255,0.16)"); sg.addColorStop(1, "rgba(255,255,255,0)");
      ctx.fillStyle = sg; ctx.fillRect(0, 0, SIZE, SIZE);
      ctx.restore();
      // atmosphere rim
      ctx.beginPath(); ctx.arc(SIZE / 2, SIZE / 2, SIZE / 2 - 2, 0, Math.PI * 2);
      ctx.strokeStyle = "rgba(120,180,255,0.55)"; ctx.lineWidth = 2; ctx.stroke();
      const ag = ctx.createRadialGradient(SIZE / 2, SIZE / 2, SIZE / 2 - 10, SIZE / 2, SIZE / 2, SIZE / 2 + 10);
      ag.addColorStop(0, "rgba(96,165,250,0)"); ag.addColorStop(1, "rgba(96,165,250,0.35)");
      ctx.beginPath(); ctx.arc(SIZE / 2, SIZE / 2, SIZE / 2, 0, Math.PI * 2);
      ctx.fillStyle = ag; ctx.fill();

      // city markers
      TZ_OPTIONS.forEach((o, i) => {
        const p = project(o.lat, o.lon, rotV);
        if (p.z < 0) return;
        // is this city currently in night?
        const clat = o.lat * Math.PI / 180, clon = o.lon * Math.PI / 180;
        const cd = Math.cos(clat) * Math.sin(clon) * sun.x + Math.sin(clat) * sun.y
                 + Math.cos(clat) * Math.cos(clon) * sun.z;
        const night = cd < 0;
        const selected = o.id === tz, hovered = hoverRef.current === i;
        const blink = night ? 0.55 + 0.45 * Math.sin(t / 320 + i) : 1;
        const rad = (hovered ? 6 : 3.6) + p.z * 1.4;
        // glow
        const gl = ctx.createRadialGradient(p.sx, p.sy, 0, p.sx, p.sy, rad + 8);
        gl.addColorStop(0, night ? `rgba(253,224,71,${0.9 * blink})` : "rgba(56,189,248,0.9)");
        gl.addColorStop(1, "rgba(0,0,0,0)");
        ctx.fillStyle = gl; ctx.beginPath(); ctx.arc(p.sx, p.sy, rad + 8, 0, Math.PI * 2); ctx.fill();
        // dot
        ctx.beginPath(); ctx.arc(p.sx, p.sy, rad, 0, Math.PI * 2);
        ctx.fillStyle = selected ? "#34d399" : night ? `rgba(253,224,71,${blink})` : "#7dd3fc";
        ctx.globalAlpha = 0.6 + 0.4 * p.z; ctx.fill(); ctx.globalAlpha = 1;
        if (selected || hovered) {
          ctx.beginPath(); ctx.arc(p.sx, p.sy, rad + 4, 0, Math.PI * 2);
          ctx.strokeStyle = selected ? "#34d399" : "#e2e8f0"; ctx.lineWidth = 1.5; ctx.stroke();
          ctx.font = "600 12px Inter, sans-serif";
          const tw = ctx.measureText(o.city).width;
          const lx = Math.min(Math.max(p.sx - tw / 2, 4), SIZE - tw - 8);
          ctx.fillStyle = "rgba(2,6,23,0.85)"; ctx.fillRect(lx - 5, p.sy - rad - 22, tw + 10, 17);
          ctx.fillStyle = "#e2e8f0"; ctx.fillText(o.city, lx, p.sy - rad - 9);
        }
      });

      raf = requestAnimationFrame(draw);
    };
    raf = requestAnimationFrame(draw);

    const pick = (e: MouseEvent) => {
      const r = canvas.getBoundingClientRect();
      const mx = (e.clientX - r.left) * (SIZE / r.width);
      const my = (e.clientY - r.top) * (SIZE / r.height);
      let best: number | null = null, bestD = 16;
      TZ_OPTIONS.forEach((o, i) => {
        const p = project(o.lat, o.lon, rot.current);
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
            <canvas ref={canvasRef} className="cursor-pointer" style={{ width: 380, height: 380 }} />
            <div className="flex items-center gap-4 mt-2 text-[11px] text-slate-400 dark:text-slate-500">
              <span className="flex items-center gap-1"><Sun size={12} className="text-sky-400" /> day</span>
              <span className="flex items-center gap-1"><Moon size={12} className="text-amber-300" /> night · lights blink</span>
            </div>
            <p className="text-xs text-slate-400 dark:text-slate-500 mt-0.5">
              {hover !== null ? `Click to select ${TZ_OPTIONS[hover].city}` : "Hover the globe and click a city"}
            </p>
          </div>

          <div className="grid grid-cols-2 gap-1.5 max-h-[380px] overflow-y-auto pr-1">
            {TZ_OPTIONS.map((o, i) => (
              <button key={o.id}
                      onMouseEnter={() => setHover(i)} onMouseLeave={() => setHover(null)}
                      onClick={() => { setTz(o.id); onClose(); }}
                      className={`flex items-center justify-between gap-2 rounded-lg px-3 py-2 text-sm
                                  text-left transition-colors
                                  ${o.id === tz
                                    ? "bg-emerald-50 dark:bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 font-semibold"
                                    : hover === i ? "bg-slate-100 dark:bg-slate-800"
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
