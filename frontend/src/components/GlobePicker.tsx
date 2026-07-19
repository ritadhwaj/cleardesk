import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { X, Globe2, Check, Sun, Moon } from "lucide-react";
import { useTimezone, TZ_OPTIONS } from "../store/timezone";

/* Continent + island outlines in [lon, lat] — detailed enough to read clearly. */
const CONTINENTS: [number, number][][] = [
  // North America
  [[-168,66],[-165,60],[-153,58],[-138,59],[-130,55],[-124,48],[-124,40],[-120,35],
   [-117,33],[-110,31],[-105,22],[-97,16],[-91,15],[-88,21],[-84,22],[-81,25],[-80,31],
   [-76,35],[-70,42],[-66,44],[-60,47],[-56,51],[-64,60],[-78,62],[-85,70],[-95,70],
   [-115,73],[-128,70],[-140,70],[-156,71],[-168,66]],
  // Greenland
  [[-45,60],[-30,60],[-20,70],[-22,78],[-40,83],[-58,80],[-52,70],[-45,60]],
  // South America
  [[-81,7],[-77,8],[-72,11],[-62,10],[-50,0],[-44,-2],[-35,-6],[-38,-13],[-41,-22],
   [-48,-25],[-54,-34],[-58,-40],[-66,-45],[-71,-50],[-74,-52],[-72,-45],[-71,-33],
   [-73,-20],[-78,-8],[-81,7]],
  // Africa + Arabia
  [[-17,15],[-16,21],[-6,28],[3,32],[10,34],[11,37],[20,33],[28,31],[33,28],[35,24],
   [40,15],[43,12],[51,12],[45,8],[42,-1],[40,-11],[34,-20],[27,-33],[20,-35],[15,-28],
   [12,-16],[9,-1],[3,5],[-8,4],[-14,9],[-17,15]],
  // Europe
  [[-10,37],[-9,43],[-1,44],[-1,49],[-5,50],[3,51],[8,54],[10,58],[16,56],[21,56],
   [26,60],[30,60],[28,66],[22,66],[14,64],[8,60],[4,52],[-2,47],[-9,43],[-10,37]],
  // British Isles
  [[-6,50],[-2,51],[1,53],[-2,56],[-6,58],[-9,55],[-10,52],[-6,50]],
  // Asia
  [[26,40],[36,42],[45,40],[50,44],[56,41],[52,30],[57,25],[62,25],[68,24],[73,20],
   [77,8],[80,13],[81,20],[87,22],[92,22],[97,16],[101,13],[106,10],[109,15],[108,21],
   [113,22],[118,24],[122,30],[121,38],[126,41],[131,43],[136,45],[143,50],[136,55],
   [141,60],[160,61],[170,66],[180,66],[172,70],[140,73],[110,74],[95,76],[68,73],
   [55,70],[42,66],[34,62],[38,55],[30,50],[27,45],[26,40]],
  // Japan
  [[130,31],[136,34],[141,39],[142,43],[139,36],[135,34],[130,31]],
  // SE Asia / Indonesia
  [[95,6],[104,1],[112,-1],[120,-4],[127,-3],[132,-5],[122,-9],[110,-8],[100,-1],[95,6]],
  // Madagascar
  [[43,-12],[50,-15],[48,-25],[44,-22],[43,-12]],
  // Australia
  [[113,-22],[114,-28],[116,-35],[123,-34],[129,-32],[137,-35],[140,-38],[147,-38],
   [151,-34],[153,-28],[151,-24],[146,-19],[142,-11],[136,-12],[130,-12],[124,-16],[113,-22]],
  // New Zealand
  [[166,-46],[171,-44],[174,-41],[176,-38],[173,-40],[168,-46],[166,-46]],
];

const SIZE = 380, RES = 380, TILT = 0.40;   // +tilt → north pole toward viewer

/** Build a detailed equirectangular Earth texture once. */
function buildEarthTexture(): ImageData {
  const W = 1024, H = 512;
  const c = document.createElement("canvas"); c.width = W; c.height = H;
  const x = c.getContext("2d")!;
  const px = (lon: number) => ((lon + 180) / 360) * W;
  const py = (lat: number) => ((90 - lat) / 180) * H;

  // ocean with latitude depth variation
  const ocean = x.createLinearGradient(0, 0, 0, H);
  ocean.addColorStop(0.0, "#0a2b55"); ocean.addColorStop(0.25, "#0f3f78");
  ocean.addColorStop(0.5, "#12559b"); ocean.addColorStop(0.75, "#0f3f78");
  ocean.addColorStop(1.0, "#0a2b55");
  x.fillStyle = ocean; x.fillRect(0, 0, W, H);

  // continents with a coastal shelf outline for depth
  for (const poly of CONTINENTS) {
    x.beginPath();
    poly.forEach(([lo, la], i) => (i ? x.lineTo(px(lo), py(la)) : x.moveTo(px(lo), py(la))));
    x.closePath();
    x.lineWidth = 6; x.strokeStyle = "rgba(90,150,180,0.45)"; x.stroke();  // shallow shelf
    const land = x.createLinearGradient(0, py(80), 0, py(-60));
    land.addColorStop(0.0, "#6f8f5c");   // tundra
    land.addColorStop(0.35, "#3f6b3f");  // temperate green
    land.addColorStop(0.55, "#4e7a3e");
    land.addColorStop(1.0, "#5c7a44");
    x.fillStyle = land; x.fill();
  }

  // arid / desert bands (Sahara, Arabia, Australia interior, US SW)
  x.fillStyle = "rgba(202,176,116,0.42)";
  const desert = (lo1: number, la1: number, lo2: number, la2: number) =>
    x.fillRect(px(lo1), py(la1), px(lo2) - px(lo1), py(la2) - py(la1));
  desert(-12, 30, 35, 16); desert(38, 30, 55, 15);
  desert(118, -20, 140, -28); desert(-114, 38, -104, 32);
  // mountain/forest darkening (Himalaya, Amazon, Congo)
  x.fillStyle = "rgba(30,60,35,0.35)";
  desert(-70, -3, -52, -12); desert(12, 4, 28, -6); desert(75, 34, 95, 28);
  // polar ice caps (soft edge)
  const ice = x.createLinearGradient(0, 0, 0, py(60));
  ice.addColorStop(0, "rgba(240,248,255,0.95)"); ice.addColorStop(1, "rgba(240,248,255,0)");
  x.fillStyle = ice; x.fillRect(0, 0, W, py(60));
  const ice2 = x.createLinearGradient(0, py(-60), 0, H);
  ice2.addColorStop(0, "rgba(240,248,255,0)"); ice2.addColorStop(1, "rgba(240,248,255,0.95)");
  x.fillStyle = ice2; x.fillRect(0, py(-60), W, H - py(-60));

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
        const my = -ny;                        // screen-down → math-up
        const x = nx;
        // un-tilt (rotate -TILT around X) into globe-axis coords
        const y = my * Math.cos(TILT) + nz * Math.sin(TILT);
        const z = -my * Math.sin(TILT) + nz * Math.cos(TILT);
        const lat = Math.asin(Math.max(-1, Math.min(1, y)));
        const app = Math.atan2(x, z);         // axis longitude at rot=0
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

      // coordinate graticule (lat/long grid) so coordinates are readable
      const gline = (pts: { sx: number; sy: number; z: number }[]) => {
        ctx.beginPath(); let started = false;
        for (const p of pts) {
          if (p.z >= 0) { started ? ctx.lineTo(p.sx, p.sy) : ctx.moveTo(p.sx, p.sy); started = true; }
          else started = false;
        }
        ctx.strokeStyle = "rgba(190,220,255,0.16)"; ctx.lineWidth = 1; ctx.stroke();
      };
      for (let latD = -60; latD <= 60; latD += 30) {
        const pts = []; for (let l = -180; l <= 180; l += 5) pts.push(project(latD, l, rotV)); gline(pts);
      }
      for (let lonD = -180; lonD < 180; lonD += 30) {
        const pts = []; for (let l = -85; l <= 85; l += 5) pts.push(project(l, lonD, rotV)); gline(pts);
      }
      // equator emphasised
      {
        const pts = []; for (let l = -180; l <= 180; l += 4) pts.push(project(0, l, rotV));
        ctx.beginPath(); let s = false;
        for (const p of pts) { if (p.z >= 0) { s ? ctx.lineTo(p.sx, p.sy) : ctx.moveTo(p.sx, p.sy); s = true; } else s = false; }
        ctx.strokeStyle = "rgba(190,220,255,0.32)"; ctx.lineWidth = 1.2; ctx.stroke();
      }

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
