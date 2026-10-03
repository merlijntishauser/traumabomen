import { useEffect, useRef } from "react";
import "./GrowingBranch.css";

/**
 * A soft fall of foliage down the landing's left margin that grows in as the
 * visitor scrolls. Leaves in both themes; their colour follows --color-action
 * (green in dark, indigo in light). Purely decorative (aria-hidden), shown only on
 * wide viewports, and fully present under prefers-reduced-motion.
 *
 * Geometry is deterministic (seeded pseudo-random) so the scatter keeps its
 * shape across resizes, and there is no layout read anywhere (react-doctor).
 */

const SVG_NS = "http://www.w3.org/2000/svg";
const ROW = 44; // vertical spacing between scatter rows
const PER_ROW = 2; // up to this many items per row

/** Deterministic pseudo-random in [0, 1): stable across resizes. */
function rnd(n: number): number {
  const x = Math.sin(n * 127.1 + 311.7) * 43758.5453;
  return x - Math.floor(x);
}

type Decor = { el: SVGGElement; activateY: number };

export function GrowingBranch() {
  const svgRef = useRef<SVGSVGElement | null>(null);

  useEffect(() => {
    const svg = svgRef.current;
    const container = svg?.parentElement;
    const scroller = document.querySelector(".landing");
    if (!svg || !container || !scroller) return;
    const reduced = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches ?? false;

    let decors: Decor[] = [];
    let height = 0;
    let raf = 0;

    function makeDecor(x: number, y: number, seed: number): SVGGElement {
      const g = document.createElementNS(SVG_NS, "g");
      g.setAttribute("class", "growing-branch__node");
      const side = rnd(seed + 5) > 0.5 ? 1 : -1;
      const leaf = document.createElementNS(SVG_NS, "ellipse");
      leaf.setAttribute("cx", String(x));
      leaf.setAttribute("cy", String(y));
      leaf.setAttribute("rx", String(4 + rnd(seed + 6) * 3));
      leaf.setAttribute("ry", String(2.5 + rnd(seed + 7) * 1.5));
      leaf.setAttribute("transform", `rotate(${side * (24 + rnd(seed + 8) * 42)} ${x} ${y})`);
      leaf.setAttribute("class", "growing-branch__leaf");
      // Each leaf at its own depth: a varied opacity reads like a real canopy.
      leaf.style.opacity = (0.25 + rnd(seed + 9) * 0.45).toFixed(2);
      g.appendChild(leaf);
      g.style.opacity = "0";
      svg?.appendChild(g);
      return g;
    }

    function rebuild() {
      if (!svg || !container) return;
      height = container.clientHeight;
      const width = Math.max(svg.clientWidth, 60);
      if (height < 400) return;
      svg.replaceChildren();
      svg.setAttribute("viewBox", `0 0 ${width} ${height}`);
      svg.setAttribute("preserveAspectRatio", "none");
      decors = [];

      // A jittered scatter down the gutter: one or two pieces per row, spread
      // across the width, denser than a single line of decor.
      let s = 0;
      for (let y = 40; y < height - 40; y += ROW) {
        const count = 1 + Math.floor(rnd(s + 0.5) * PER_ROW);
        for (let c = 0; c < count; c += 1) {
          s += 1;
          const x = 8 + rnd(s * 3.1) * (width - 18);
          const py = y + (rnd(s * 5.7) - 0.5) * (ROW * 0.7);
          decors.push({ el: makeDecor(x, py, s * 11 + 3), activateY: py - 20 });
        }
      }

      if (reduced) {
        for (const d of decors) d.el.style.opacity = "1";
      }
    }

    function update() {
      raf = 0;
      if (decors.length === 0 || height <= 0 || !container || !scroller) return;
      const rect = container.getBoundingClientRect();
      const scRect = scroller.getBoundingClientRect();
      if (rect.height <= 0) return;
      // How far the reading edge (viewport bottom) has travelled through the
      // sections, trailing slightly behind it.
      const progress = Math.min(Math.max((scRect.bottom - rect.top - 140) / rect.height, 0), 1);
      const grownTo = progress * height;
      for (const d of decors) {
        d.el.style.opacity = grownTo > d.activateY ? "1" : "0";
      }
    }

    function onScroll() {
      if (!raf) raf = requestAnimationFrame(update);
    }

    rebuild();
    if (!reduced) {
      scroller.addEventListener("scroll", onScroll, { passive: true });
      update();
    }
    const ro =
      typeof ResizeObserver !== "undefined"
        ? new ResizeObserver(() => {
            rebuild();
            if (!reduced) update();
          })
        : null;
    ro?.observe(container);

    return () => {
      scroller.removeEventListener("scroll", onScroll);
      if (raf) cancelAnimationFrame(raf);
      ro?.disconnect();
    };
  }, []);

  return <svg ref={svgRef} className="growing-branch" aria-hidden="true" />;
}
