import { useEffect, useRef } from "react";
import "./AmbientBackground.css";

/**
 * A quiet, living layer over the hero photography: fireflies drifting through
 * the dark forest, warm light motes in the morning light theme.
 *
 * Hand-rolled 2D canvas rather than a 3D library: the effect needs ~2 KB, not
 * a render engine, and the page keeps its performance budget. It draws at
 * ~30fps, pauses when the tab is hidden, disables itself entirely under
 * prefers-reduced-motion, and renders nothing when canvas is unavailable.
 */

type Mote = {
  x: number;
  y: number;
  r: number;
  vx: number;
  vy: number;
  phase: number;
  pulse: number;
  drift: number;
};

const FRAME_MS = 1000 / 30;

function spawn(w: number, h: number): Mote {
  return {
    x: Math.random() * w,
    y: Math.random() * h,
    r: 0.8 + Math.random() * 1.7,
    vx: (Math.random() - 0.5) * 0.12,
    vy: -(0.04 + Math.random() * 0.14),
    phase: Math.random() * Math.PI * 2,
    pulse: 0.4 + Math.random() * 0.8,
    drift: 0.2 + Math.random() * 0.6,
  };
}

export function AmbientBackground() {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const reduced = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches ?? false;
    if (reduced) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const parent = canvas.parentElement;
    let width = 0;
    let height = 0;
    let motes: Mote[] = [];
    const dpr = Math.min(window.devicePixelRatio || 1, 2);

    function resize() {
      width = parent?.clientWidth ?? window.innerWidth;
      height = parent?.clientHeight ?? window.innerHeight;
      if (!canvas) return;
      canvas.width = Math.round(width * dpr);
      canvas.height = Math.round(height * dpr);
      ctx?.setTransform(dpr, 0, 0, dpr, 0, 0);
      // Density scales with area; capped so phones stay cool.
      const target = Math.min(64, Math.round((width * height) / 22000));
      motes = Array.from({ length: target }, () => spawn(width, height));
    }

    let raf = 0;
    let last = 0;
    let t = 0;

    function draw(now: number) {
      raf = requestAnimationFrame(draw);
      if (now - last < FRAME_MS) return;
      last = now;
      t += 0.016;
      if (!ctx) return;

      const light = document.documentElement.getAttribute("data-theme") === "light";
      ctx.clearRect(0, 0, width, height);

      for (const m of motes) {
        m.x += m.vx + Math.sin(t * m.drift + m.phase) * 0.08;
        m.y += m.vy;
        if (m.y < -6 || m.x < -6 || m.x > width + 6) {
          Object.assign(m, spawn(width, height), { y: height + 4 });
        }
        // Firefly breathing: each mote fades in and out on its own rhythm.
        const glow = 0.5 + 0.5 * Math.sin(t * m.pulse + m.phase);
        const alpha = (light ? 0.5 : 0.55) * glow;
        if (alpha < 0.03) continue;

        const grad = ctx.createRadialGradient(m.x, m.y, 0, m.x, m.y, m.r * 5);
        if (light) {
          // Warm dust motes in the morning light.
          grad.addColorStop(0, `rgba(255, 226, 166, ${alpha})`);
          grad.addColorStop(0.45, `rgba(255, 226, 166, ${alpha * 0.25})`);
          grad.addColorStop(1, "rgba(255, 226, 166, 0)");
        } else {
          // Soft green fireflies in the dark forest.
          grad.addColorStop(0, `rgba(190, 240, 200, ${alpha})`);
          grad.addColorStop(0.45, `rgba(140, 215, 165, ${alpha * 0.3})`);
          grad.addColorStop(1, "rgba(140, 215, 165, 0)");
        }
        ctx.fillStyle = grad;
        ctx.beginPath();
        ctx.arc(m.x, m.y, m.r * 5, 0, Math.PI * 2);
        ctx.fill();
      }
    }

    function onVisibility() {
      if (document.hidden) {
        cancelAnimationFrame(raf);
      } else {
        last = 0;
        raf = requestAnimationFrame(draw);
      }
    }

    resize();
    const ro = typeof ResizeObserver !== "undefined" ? new ResizeObserver(resize) : null;
    if (parent && ro) ro.observe(parent);
    document.addEventListener("visibilitychange", onVisibility);
    raf = requestAnimationFrame(draw);

    return () => {
      cancelAnimationFrame(raf);
      ro?.disconnect();
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, []);

  return (
    <div className="ambient-background" aria-hidden="true">
      <canvas ref={canvasRef} />
    </div>
  );
}
