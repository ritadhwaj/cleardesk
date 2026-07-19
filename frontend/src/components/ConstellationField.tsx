import { useEffect, useRef } from "react";

/** Floating dim nodes drifting in the login left panel. Nearby nodes link with
 *  faint lines; on mouse hover the cursor becomes a temporary node that the
 *  closest points reach out and connect to — a living graph/tree that floats.
 *  Canvas-based for smooth 60fps; sits behind the panel text (pointer-events
 *  pass through, we read moves from the parent). */

interface Node { x: number; y: number; vx: number; vy: number; r: number }

export default function ConstellationField() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const mouse = useRef<{ x: number; y: number } | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current!;
    const ctx = canvas.getContext("2d")!;
    let raf = 0;
    let W = 0, H = 0, dpr = Math.min(window.devicePixelRatio || 1, 2);
    let nodes: Node[] = [];

    const resize = () => {
      const rect = canvas.getBoundingClientRect();
      W = rect.width; H = rect.height;
      canvas.width = W * dpr; canvas.height = H * dpr;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      const count = Math.max(28, Math.floor((W * H) / 14000));
      nodes = Array.from({ length: count }, () => ({
        x: Math.random() * W, y: Math.random() * H,
        vx: (Math.random() - 0.5) * 0.28, vy: (Math.random() - 0.5) * 0.28,
        r: Math.random() * 1.6 + 1,
      }));
    };
    resize();

    const LINK = 130;      // node-to-node link distance
    const HOVER = 200;     // cursor attraction radius

    const draw = () => {
      ctx.clearRect(0, 0, W, H);

      // move + wrap
      for (const n of nodes) {
        n.x += n.vx; n.y += n.vy;
        if (n.x < -20) n.x = W + 20; if (n.x > W + 20) n.x = -20;
        if (n.y < -20) n.y = H + 20; if (n.y > H + 20) n.y = -20;
      }

      // node-to-node links
      for (let i = 0; i < nodes.length; i++) {
        for (let j = i + 1; j < nodes.length; j++) {
          const a = nodes[i], b = nodes[j];
          const dx = a.x - b.x, dy = a.y - b.y;
          const dist = Math.hypot(dx, dy);
          if (dist < LINK) {
            const o = (1 - dist / LINK) * 0.22;
            ctx.strokeStyle = `rgba(148,163,220,${o})`;
            ctx.lineWidth = 1;
            ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y); ctx.stroke();
          }
        }
      }

      // cursor becomes a hub the nearby nodes connect to
      const m = mouse.current;
      if (m) {
        for (const n of nodes) {
          const dx = n.x - m.x, dy = n.y - m.y;
          const dist = Math.hypot(dx, dy);
          if (dist < HOVER) {
            const o = (1 - dist / HOVER) * 0.6;
            ctx.strokeStyle = `rgba(96,165,250,${o})`;
            ctx.lineWidth = 1.1;
            ctx.beginPath(); ctx.moveTo(n.x, n.y); ctx.lineTo(m.x, m.y); ctx.stroke();
            // gentle attraction so the graph "reaches" toward the cursor
            n.vx += (-dx / dist) * 0.006;
            n.vy += (-dy / dist) * 0.006;
          }
        }
        // clamp velocity so it keeps floating, not flinging
        for (const n of nodes) {
          n.vx = Math.max(-0.6, Math.min(0.6, n.vx));
          n.vy = Math.max(-0.6, Math.min(0.6, n.vy));
        }
        ctx.fillStyle = "rgba(96,165,250,0.9)";
        ctx.beginPath(); ctx.arc(m.x, m.y, 3, 0, Math.PI * 2); ctx.fill();
      }

      // nodes
      for (const n of nodes) {
        const lit = m && Math.hypot(n.x - m.x, n.y - m.y) < HOVER;
        ctx.fillStyle = lit ? "rgba(147,197,253,0.95)" : "rgba(148,163,200,0.5)";
        ctx.beginPath(); ctx.arc(n.x, n.y, n.r, 0, Math.PI * 2); ctx.fill();
      }

      raf = requestAnimationFrame(draw);
    };
    draw();

    // read pointer from the whole panel (this canvas has pointer-events none)
    const parent = canvas.parentElement!;
    const onMove = (e: PointerEvent) => {
      const rect = canvas.getBoundingClientRect();
      mouse.current = { x: e.clientX - rect.left, y: e.clientY - rect.top };
    };
    const onLeave = () => { mouse.current = null; };
    parent.addEventListener("pointermove", onMove);
    parent.addEventListener("pointerleave", onLeave);
    window.addEventListener("resize", resize);

    return () => {
      cancelAnimationFrame(raf);
      parent.removeEventListener("pointermove", onMove);
      parent.removeEventListener("pointerleave", onLeave);
      window.removeEventListener("resize", resize);
    };
  }, []);

  return (
    <canvas ref={canvasRef}
            className="absolute inset-0 w-full h-full pointer-events-none z-0" />
  );
}
