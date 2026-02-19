import * as d3 from "d3";
import { useCallback, useEffect, useRef, useState } from "react";

interface UseTimelineZoomOptions {
  svgRef: React.RefObject<SVGSVGElement | null>;
  zoomGroupRef: React.RefObject<SVGGElement | null>;
  scale: d3.ScaleLinear<number, number>;
  direction?: "horizontal" | "vertical";
  fixedOffset: number;
  width: number;
  height: number;
  scrollMode?: boolean;
}

export interface TimelineZoomActions {
  zoomIn: () => void;
  zoomOut: () => void;
  resetZoom: () => void;
}

export interface UseTimelineZoomResult {
  rescaled: d3.ScaleLinear<number, number>;
  zoomK: number;
  zoomActions: TimelineZoomActions;
}

export function useTimelineZoom({
  svgRef,
  zoomGroupRef,
  scale,
  direction = "horizontal",
  fixedOffset,
  width,
  height,
  scrollMode = false,
}: UseTimelineZoomOptions): UseTimelineZoomResult {
  const [rescaled, setRescaled] = useState<d3.ScaleLinear<number, number>>(() => scale);
  const [zoomK, setZoomK] = useState(1);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const zoomRef = useRef<d3.ZoomBehavior<SVGSVGElement, unknown> | null>(null);
  const scrollModeRef = useRef(scrollMode);
  scrollModeRef.current = scrollMode;

  // Keep React state in sync when scale changes (even without a mounted SVG)
  useEffect(() => {
    setRescaled(() => scale);
    setZoomK(1);
  }, [scale]);

  useEffect(() => {
    const svg = svgRef.current;
    if (!svg || width <= 0 || height <= 0) return;

    const isHorizontal = direction === "horizontal";

    const translateExtent: [[number, number], [number, number]] = isHorizontal
      ? [
          [fixedOffset, 0],
          [width, height],
        ]
      : [
          [0, fixedOffset],
          [width, height],
        ];

    const zoom = d3
      .zoom<SVGSVGElement, unknown>()
      .scaleExtent([0.5, 20])
      .translateExtent(translateExtent)
      .extent(translateExtent)
      .filter((event: Event) => {
        if (scrollModeRef.current && event.type === "wheel") return false;
        return !(event as MouseEvent).button;
      })
      .on("zoom", (event: d3.D3ZoomEvent<SVGSVGElement, unknown>) => {
        const g = zoomGroupRef.current;
        if (g) {
          if (isHorizontal) {
            g.setAttribute(
              "transform",
              `translate(${event.transform.x},0) scale(${event.transform.k},1)`,
            );
          } else {
            g.setAttribute(
              "transform",
              `translate(0,${event.transform.y}) scale(1,${event.transform.k})`,
            );
          }
        }

        if (debounceRef.current) clearTimeout(debounceRef.current);
        debounceRef.current = setTimeout(() => {
          const newScale = isHorizontal
            ? event.transform.rescaleX(scale)
            : event.transform.rescaleY(scale);
          setRescaled(() => newScale);
          setZoomK(event.transform.k);
        }, 50);
      });

    zoomRef.current = zoom;

    const svgSel = d3.select(svg);

    // Reset D3 zoom state and DOM transform so React state (zoomK=1) stays in sync
    // when the effect re-runs (e.g., due to scale/width/height changing)
    svgSel.property("__zoom", d3.zoomIdentity);
    const g = zoomGroupRef.current;
    if (g) g.removeAttribute("transform");
    setRescaled(() => scale);
    setZoomK(1);

    svgSel.call(zoom);

    return () => {
      svgSel.on(".zoom", null);
      zoomRef.current = null;
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [svgRef, zoomGroupRef, scale, direction, fixedOffset, width, height]);

  const zoomIn = useCallback(() => {
    const svg = svgRef.current;
    const zoom = zoomRef.current;
    if (!svg || !zoom) return;
    d3.select(svg).transition().duration(250).call(zoom.scaleBy, 1.5);
  }, [svgRef]);

  const zoomOut = useCallback(() => {
    const svg = svgRef.current;
    const zoom = zoomRef.current;
    if (!svg || !zoom) return;
    d3.select(svg)
      .transition()
      .duration(250)
      .call(zoom.scaleBy, 1 / 1.5);
  }, [svgRef]);

  const resetZoom = useCallback(() => {
    const svg = svgRef.current;
    const zoom = zoomRef.current;
    if (!svg || !zoom) return;
    d3.select(svg).transition().duration(250).call(zoom.transform, d3.zoomIdentity);
  }, [svgRef]);

  return { rescaled, zoomK, zoomActions: { zoomIn, zoomOut, resetZoom } };
}
