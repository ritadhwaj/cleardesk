import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { X, Globe2, Check, Sun, Moon } from "lucide-react";
import { useTimezone, TZ_OPTIONS } from "../store/timezone";

/* High-detail continent + island coastlines in [lon, lat]. */
const CONTINENTS: [number, number][][] = [
  // North America (Alaska, Gulf of Mexico, Florida, Baja, Canadian Arctic)
  [[-168,66],[-166,68],[-162,70],[-156,71],[-148,70],[-140,70],[-128,70],[-115,72],
   [-100,70],[-95,68],[-92,72],[-82,73],[-78,67],[-80,62],[-78,56],[-90,57],[-95,51],
   [-88,48],[-83,46],[-82,43],[-79,43],[-76,44],[-70,47],[-66,45],[-60,47],[-56,51],
   [-64,60],[-70,50],[-70,43],[-74,40],[-76,36],[-81,31],[-80,27],[-80,25],[-82,26],
   [-84,30],[-88,30],[-90,29],[-94,29],[-97,26],[-97,21],[-95,18],[-92,18],[-88,21],
   [-87,16],[-83,15],[-84,11],[-78,8],[-82,8],[-86,12],[-92,16],[-96,16],[-105,20],
   [-110,24],[-112,29],[-114,28],[-114,31],[-117,33],[-120,34],[-122,37],[-124,40],
   [-124,43],[-124,48],[-130,54],[-135,57],[-138,59],[-146,61],[-152,58],[-158,57],
   [-162,59],[-166,62],[-168,66]],
  // Greenland
  [[-45,60],[-42,64],[-32,66],[-22,70],[-18,74],[-22,78],[-32,81],[-42,83],[-54,82],
   [-58,79],[-55,74],[-52,70],[-48,64],[-45,60]],
  // South America (Brazil bulge, Chilean coast, Patagonia)
  [[-81,7],[-77,8],[-72,11],[-66,11],[-62,10],[-52,5],[-50,0],[-44,-2],[-38,-4],[-35,-6],
   [-38,-12],[-39,-16],[-42,-22],[-48,-25],[-53,-34],[-58,-38],[-63,-41],[-66,-45],
   [-69,-50],[-74,-52],[-72,-46],[-73,-40],[-71,-33],[-71,-24],[-70,-18],[-76,-14],
   [-79,-8],[-81,-4],[-80,2],[-81,7]],
  // Africa (Med coast, Horn, Gulf of Guinea, Cape)
  [[-17,15],[-16,21],[-11,24],[-6,28],[-1,31],[3,32],[9,32],[10,34],[11,37],[15,33],
   [20,32],[25,32],[30,31],[33,29],[34,27],[35,24],[37,18],[40,15],[43,12],[48,12],
   [51,12],[49,9],[44,10],[42,5],[42,-1],[40,-5],[40,-11],[35,-18],[32,-26],[27,-33],
   [20,-35],[18,-32],[13,-23],[12,-16],[10,-7],[9,-1],[5,4],[-4,5],[-8,4],[-13,8],
   [-16,12],[-17,15]],
  // Europe (Iberia, France, Scandinavia, Baltic)
  [[-9,37],[-9,41],[-9,43],[-2,44],[0,47],[-2,48],[-4,49],[-1,49],[2,51],[4,52],[7,53],
   [8,55],[7,58],[5,61],[8,63],[11,64],[14,67],[18,69],[24,71],[28,71],[30,68],[27,66],
   [22,63],[24,60],[28,60],[24,58],[20,56],[14,54],[12,55],[13,54],[9,54],[4,52],[0,49],
   [-2,46],[-2,44],[-9,43],[-9,37]],
  // British Isles
  [[-5,50],[-2,51],[1,52],[0,54],[-2,56],[-4,58],[-6,58],[-6,55],[-8,55],[-10,54],
   [-8,52],[-10,51],[-6,50],[-5,50]],
  // Asia (Arabia, India, SE Asia, China, Korea, Siberia, Kamchatka)
  [[36,36],[35,31],[34,28],[38,20],[43,13],[45,12],[52,16],[58,23],[60,25],[66,25],
   [70,22],[73,16],[77,8],[80,13],[84,19],[88,21],[92,21],[95,16],[98,10],[100,6],
   [104,10],[106,10],[108,15],[110,21],[113,22],[117,23],[120,23],[121,31],[121,37],
   [126,40],[129,42],[131,43],[135,45],[141,53],[155,59],[162,60],[170,66],[180,66],
   [175,68],[160,70],[140,73],[130,73],[110,74],[100,77],[90,76],[78,73],[68,73],
   [60,70],[55,68],[50,66],[45,62],[42,58],[40,54],[36,52],[34,48],[33,44],[34,42],
   [36,40],[36,36]],
  // Japan
  [[130,31],[132,33],[135,34],[137,35],[141,38],[142,41],[142,43],[140,41],[139,37],
   [137,37],[135,35],[132,34],[130,32],[130,31]],
  // Sumatra / Java
  [[95,5],[98,2],[102,0],[104,-2],[106,-6],[110,-7],[114,-8],[119,-9],[116,-6],[112,-5],
   [108,-4],[104,-2],[100,3],[97,5],[95,5]],
  // Borneo
  [[109,2],[113,1],[117,4],[118,1],[116,-2],[112,-3],[109,-1],[109,2]],
  // Philippines
  [[120,18],[122,17],[124,13],[126,10],[125,6],[122,7],[120,13],[120,18]],
  // Madagascar
  [[43,-12],[47,-14],[50,-16],[49,-20],[47,-25],[45,-25],[44,-21],[43,-16],[43,-12]],
  // Australia
  [[113,-22],[114,-26],[115,-30],[118,-35],[123,-34],[127,-32],[131,-31],[134,-33],
   [137,-35],[139,-37],[141,-38],[144,-38],[147,-38],[150,-37],[153,-31],[153,-27],
   [151,-24],[149,-21],[146,-19],[143,-14],[140,-17],[137,-12],[135,-15],[130,-12],
   [126,-14],[123,-17],[120,-20],[116,-21],[113,-22]],
  // Tasmania
  [[145,-41],[148,-41],[148,-43],[146,-44],[144,-43],[145,-41]],
  // New Zealand
  [[166,-46],[168,-44],[171,-43],[174,-41],[176,-39],[178,-38],[176,-40],[174,-42],
   [171,-45],[168,-47],[166,-46]],
];

const SIZE = 380, RES = 380, TILT = 0.40;   // +tilt → north pole toward viewer

/** Build a detailed equirectangular Earth texture once. */
function buildEarthTexture(): ImageData {
  const W = 2048, H = 1024;
  const c = document.createElement("canvas"); c.width = W; c.height = H;
  const x = c.getContext("2d")!;
  x.imageSmoothingEnabled = true; (x as any).imageSmoothingQuality = "high";
  x.lineJoin = "round"; x.lineCap = "round";
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
    x.lineWidth = 11; x.strokeStyle = "rgba(90,150,180,0.45)"; x.stroke();  // shallow shelf
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
