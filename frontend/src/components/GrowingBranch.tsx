import { useEffect, useRef } from "react";
import "./GrowingBranch.css";

/**
 * A thin branch that grows down the landing page margin as the visitor
 * scrolls, sprouting a small leaf at intervals: the page itself quietly
 * becomes a tree. Purely decorative (aria-hidden), only shown on wide
 * viewports, and drawn fully grown for reduced-motion visitors.
 */

const SVG_NS = "http://www.w3.org/2000/svg";
const SEGMENT = 150;
const SWAY = 16;
const LEAF_SPACING = 340;

function buildPath(height: number): string {
  let d = "M 30 0";
  let side = 1;
  for (let y = 0; y < height; y += SEGMENT) {
    const end = Math.min(y + SEGMENT, height);
    const third = (end - y) / 3;
    d += ` C 30 ${y + third}, ${30 + side * SWAY} ${y + 2 * third}, 30 ${end}`;
    side = -side;
  }
  return d;
}

export function GrowingBranch() {
  const svgRef = useRef<SVGSVGElement | null>(null);

  useEffect(() => {
    const svg = svgRef.current;
    const container = svg?.parentElement;
    const scroller = document.querySelector(".landing");
    if (!svg || !container || !scroller) return;
    const reduced = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches ?? false;

    let line: SVGPathElement | null = null;
    let leaves: { el: SVGGElement; y: number }[] = [];
    let total = 0;
    let height = 0;
    let raf = 0;

    function rebuild() {
      if (!svg || !container) return;
      height = container.clientHeight;
      if (height < 400) return;
      svg.replaceChildren();
      svg.setAttribute("viewBox", `0 0 60 ${height}`);

      line = document.createElementNS(SVG_NS, "path");
      line.setAttribute("d", buildPath(height));
      line.setAttribute("class", "growing-branch__line");
      svg.appendChild(line);

      leaves = [];
      let side = 1;
      for (let y = 240; y < height - 120; y += LEAF_SPACING) {
        const node = document.createElementNS(SVG_NS, "g");
        node.setAttribute("class", "growing-branch__node");
        const twig = document.createElementNS(SVG_NS, "path");
        twig.setAttribute("d", `M 30 ${y} q ${10 * side} -4 ${16 * side} -12`);
        twig.setAttribute("class", "growing-branch__twig");
        const leaf = document.createElementNS(SVG_NS, "ellipse");
        leaf.setAttribute("cx", String(30 + 19 * side));
        leaf.setAttribute("cy", String(y - 14));
        leaf.setAttribute("rx", "5.5");
        leaf.setAttribute("ry", "3");
        leaf.setAttribute("transform", `rotate(${side * -38} ${30 + 19 * side} ${y - 14})`);
        leaf.setAttribute("class", "growing-branch__leaf");
        node.appendChild(twig);
        node.appendChild(leaf);
        node.style.opacity = "0";
        svg.appendChild(node);
        leaves.push({ el: node, y });
        side = -side;
      }

      // jsdom has no getTotalLength; there the branch simply renders complete.
      total = typeof line.getTotalLength === "function" ? line.getTotalLength() : 0;
      if (total > 0 && !reduced) {
        line.style.strokeDasharray = `${total}`;
        line.style.strokeDashoffset = `${total}`;
      } else {
        for (const l of leaves) l.el.style.opacity = "1";
      }
    }

    function update() {
      raf = 0;
      if (!line || total <= 0 || height <= 0 || !container || !scroller) return;
      const rect = container.getBoundingClientRect();
      const scRect = scroller.getBoundingClientRect();
      if (rect.height <= 0) return;
      // How far the reading edge (viewport bottom) has travelled through the
      // sections, trailing slightly behind it.
      const progress = Math.min(Math.max((scRect.bottom - rect.top - 140) / rect.height, 0), 1);
      line.style.strokeDashoffset = String(total * (1 - progress));
      const grownTo = progress * height;
      for (const l of leaves) {
        l.el.style.opacity = grownTo > l.y + 30 ? "1" : "0";
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
