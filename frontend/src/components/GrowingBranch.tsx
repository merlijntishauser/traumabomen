import { useEffect, useRef } from "react";
import "./GrowingBranch.css";

/**
 * A tree that grows down the landing's left margin as the visitor scrolls:
 * a trunk that thickens as it descends, side branches reaching toward the
 * window edge, secondary forks, and small twigs. In the dark theme it
 * sprouts leaves; in the light theme it carries indigo squares and diamonds
 * that softly shimmer. Purely decorative (aria-hidden), wide viewports only,
 * drawn fully grown under prefers-reduced-motion.
 */

const SVG_NS = "http://www.w3.org/2000/svg";
const SEGMENT = 150;
const SWAY = 16;
const TRUNK_DECOR_SPACING = 200;
const SPLIT_SPACING = 360;
const TWIG_SPACING = 170;

/** Deterministic pseudo-random in [0, 1): stable across resizes. */
function rnd(n: number): number {
  const x = Math.sin(n * 127.1 + 311.7) * 43758.5453;
  return x - Math.floor(x);
}

/** Point on a cubic bezier (used to place decor and forks along branches). */
function cubicAt(t: number, p0: number, p1: number, p2: number, p3: number): number {
  const u = 1 - t;
  return u * u * u * p0 + 3 * u * u * t * p1 + 3 * u * t * t * p2 + t * t * t * p3;
}

/** Strokes that reveal with scroll: trunk segments, branches, forks, twigs.
   Each uses pathLength="1", so the dash runs in normalised 0..1 units and no
   getTotalLength layout read is ever needed. */
type Stroke = { el: SVGPathElement; startY: number; reach: number };
type Decor = { el: SVGGElement; activateY: number };

export function GrowingBranch() {
  const svgRef = useRef<SVGSVGElement | null>(null);

  useEffect(() => {
    const svg = svgRef.current;
    const container = svg?.parentElement;
    const scroller = document.querySelector(".landing");
    if (!svg || !container || !scroller) return;
    const reduced = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches ?? false;

    let strokes: Stroke[] = [];
    let decors: Decor[] = [];
    let height = 0;
    let raf = 0;

    function addStroke(d: string, width: number, startY: number, reach: number, sub = false) {
      const path = document.createElementNS(SVG_NS, "path");
      path.setAttribute("d", d);
      path.setAttribute(
        "class",
        sub ? "growing-branch__line growing-branch__line--sub" : "growing-branch__line",
      );
      // pathLength normalises the path to 1 unit, so the dash hides/reveals it
      // without ever measuring (no layout read anywhere in this component).
      path.setAttribute("pathLength", "1");
      path.style.strokeWidth = width.toFixed(2);
      path.style.strokeDasharray = "1";
      path.style.strokeDashoffset = reduced ? "0" : "1";
      svg?.appendChild(path);
      strokes.push({ el: path, startY, reach });
      return path;
    }

    function makeDecor(x: number, y: number, seed: number, light: boolean): SVGGElement {
      const g = document.createElementNS(SVG_NS, "g");
      g.setAttribute("class", "growing-branch__node");
      if (light) {
        // Indigo squares and diamonds, in three shades, softly shimmering.
        const size = 4.5 + rnd(seed + 1) * 3.5;
        const gem = document.createElementNS(SVG_NS, "rect");
        gem.setAttribute("x", String(x - size / 2));
        gem.setAttribute("y", String(y - size / 2));
        gem.setAttribute("width", String(size));
        gem.setAttribute("height", String(size));
        const diamond = rnd(seed + 2) > 0.4;
        gem.setAttribute("transform", `rotate(${diamond ? 45 : 0} ${x} ${y})`);
        const shade = ["a", "b", "c"][Math.floor(rnd(seed + 3) * 3)];
        gem.setAttribute("class", `growing-branch__gem growing-branch__gem--${shade}`);
        gem.style.animationDelay = `${(rnd(seed + 4) * 3).toFixed(2)}s`;
        g.appendChild(gem);
      } else {
        const side = rnd(seed + 5) > 0.5 ? 1 : -1;
        const leaf = document.createElementNS(SVG_NS, "ellipse");
        leaf.setAttribute("cx", String(x));
        leaf.setAttribute("cy", String(y));
        leaf.setAttribute("rx", String(4.5 + rnd(seed + 6) * 2));
        leaf.setAttribute("ry", "3");
        leaf.setAttribute("transform", `rotate(${side * -38} ${x} ${y})`);
        leaf.setAttribute("class", "growing-branch__leaf");
        g.appendChild(leaf);
      }
      g.style.opacity = "0";
      if (svg) svg.appendChild(g);
      return g;
    }

    function rebuild() {
      if (!svg || !container) return;
      height = container.clientHeight;
      const width = Math.max(svg.clientWidth, 60);
      if (height < 400) return;
      const light = document.documentElement.getAttribute("data-theme") === "light";
      svg.replaceChildren();
      svg.setAttribute("viewBox", `0 0 ${width} ${height}`);
      svg.setAttribute("preserveAspectRatio", "none");
      const tx = width - 26;
      strokes = [];
      decors = [];

      // The trunk thickens as it grows downward: a young shoot at the top,
      // a confident line by the footer.
      const trunkW = (y: number) => 1.05 + (y / height) * 1.7;
      let side = 1;
      for (let y = 0; y < height; y += SEGMENT) {
        const end = Math.min(y + SEGMENT, height);
        const third = (end - y) / 3;
        addStroke(
          `M ${tx} ${y} C ${tx} ${y + third}, ${tx + side * SWAY} ${y + 2 * third}, ${tx} ${end}`,
          trunkW((y + end) / 2),
          y,
          end - y,
        );
        side = -side;
      }

      const splitYs: number[] = [];

      // Side branches splitting off toward the window edge, some with a
      // secondary fork partway along.
      let i = 0;
      for (let sy = 300; sy < height - 160; sy += SPLIT_SPACING) {
        i += 1;
        splitYs.push(sy);
        const maxLen = Math.max(width - 44, 30);
        const len = maxLen * (0.5 + 0.48 * rnd(i));
        const droop = rnd(i + 10) > 0.45 ? 1 : -0.6;
        const x1 = tx - len * 0.35;
        const y1 = sy + droop * (8 + 14 * rnd(i + 11));
        const x2 = tx - len * 0.72;
        const y2 = sy + droop * (26 + 22 * rnd(i + 12));
        const x3 = tx - len;
        const y3 = sy + droop * (42 + 26 * rnd(i + 13));
        const subW = trunkW(sy) * 0.7;
        addStroke(`M ${tx} ${sy} C ${x1} ${y1}, ${x2} ${y2}, ${x3} ${y3}`, subW, sy, 240, true);

        // Decor along the side branch: one midway, one at the tip.
        for (const t of [0.55, 1]) {
          const dx = cubicAt(t, tx, x1, x2, x3);
          const dy = cubicAt(t, sy, y1, y2, y3);
          decors.push({
            el: makeDecor(dx, dy + (light ? 0 : -7), i * 31 + t * 17, light),
            activateY: sy + 60 + t * 80,
          });
        }

        // Longer branches fork once, partway along, with their own tip decor.
        if (len > maxLen * 0.62) {
          const ft = 0.5;
          const fx = cubicAt(ft, tx, x1, x2, x3);
          const fy = cubicAt(ft, sy, y1, y2, y3);
          const fLen = len * 0.4;
          const fDroop = -droop;
          const fex = fx - fLen;
          const fey = fy + fDroop * (30 + 22 * rnd(i + 14));
          addStroke(
            `M ${fx} ${fy} Q ${fx - fLen * 0.55} ${fy + fDroop * 10}, ${fex} ${fey}`,
            subW * 0.65,
            sy + 100,
            200,
            true,
          );
          decors.push({
            el: makeDecor(fex, fey + (light ? 0 : -6), i * 47 + 9, light),
            activateY: sy + 200,
          });
        }
      }

      // Small twigs on the trunk between the big splits.
      let k = 0;
      for (let ty = 150; ty < height - 100; ty += TWIG_SPACING) {
        k += 1;
        if (splitYs.some((sy) => Math.abs(sy - ty) < 70)) continue;
        const tSide = rnd(k + 30) > 0.45 ? -1 : 1;
        const tLen = 16 + rnd(k + 31) * 14;
        addStroke(
          `M ${tx} ${ty} q ${tSide * tLen * 0.6} ${-6 - rnd(k + 32) * 6}, ${tSide * tLen} ${-12 - rnd(k + 33) * 8}`,
          Math.max(trunkW(ty) * 0.45, 0.9),
          ty,
          120,
          true,
        );
        if (rnd(k + 34) > 0.4) {
          decors.push({
            el: makeDecor(tx + tSide * (tLen + 4), ty - 16, k * 13 + 5, light),
            activateY: ty + 50,
          });
        }
      }

      // Decor along the trunk itself.
      let j = 0;
      for (let y = 180; y < height - 120; y += TRUNK_DECOR_SPACING) {
        j += 1;
        const dSide = rnd(j + 50) > 0.5 ? 1 : -1;
        decors.push({
          el: makeDecor(tx + dSide * 13, y - 8, j * 7 + 3, light),
          activateY: y + 30,
        });
      }

      // Under reduced motion the strokes are already fully drawn (dashoffset 0
      // in addStroke), so reveal the decor immediately too; otherwise scroll
      // drives both via update().
      if (reduced) {
        for (const d of decors) d.el.style.opacity = "1";
      }
    }

    function update() {
      raf = 0;
      if (strokes.length === 0 || height <= 0 || !container || !scroller) return;
      const rect = container.getBoundingClientRect();
      const scRect = scroller.getBoundingClientRect();
      if (rect.height <= 0) return;
      // How far the reading edge (viewport bottom) has travelled through the
      // sections, trailing slightly behind it.
      const progress = Math.min(Math.max((scRect.bottom - rect.top - 140) / rect.height, 0), 1);
      const grownTo = progress * height;
      for (const s of strokes) {
        const local = Math.min(Math.max((grownTo - s.startY) / s.reach, 0), 1);
        s.el.style.strokeDashoffset = String(1 - local);
      }
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
    // The decor shapes differ per theme, so rebuild when the theme changes.
    const mo =
      typeof MutationObserver !== "undefined"
        ? new MutationObserver(() => {
            rebuild();
            if (!reduced) update();
          })
        : null;
    mo?.observe(document.documentElement, { attributes: true, attributeFilter: ["data-theme"] });

    return () => {
      scroller.removeEventListener("scroll", onScroll);
      if (raf) cancelAnimationFrame(raf);
      ro?.disconnect();
      mo?.disconnect();
    };
  }, []);

  return <svg ref={svgRef} className="growing-branch" aria-hidden="true" />;
}
