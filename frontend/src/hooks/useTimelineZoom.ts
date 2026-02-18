import * as d3 from "d3";
import { useEffect, useRef, useState } from "react";

interface UseTimelineZoomOptions {
  svgRef: React.RefObject<SVGSVGElement | null>;
  zoomGroupRef: React.RefObject<SVGGElement | null>;
  scale: d3.ScaleLinear<number, number>;
  direction?: "horizontal" | "vertical";
  fixedOffset: number;
  width: number;
  height: number;
}

export function useTimelineZoom({
  svgRef,
  zoomGroupRef,
  scale,
  direction = "horizontal",
  fixedOffset,
  width,
  height,
}: UseTimelineZoomOptions): { rescaled: d3.ScaleLinear<number, number> } {
  const [rescaled, setRescaled] = useState<d3.ScaleLinear<number, number>>(() => scale);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    setRescaled(() => scale);
  }, [scale]);

  useEffect(() => {
    const svg = svgRef.current;
    if (!svg || width <= 0 || height <= 0) return;

    const isHorizontal = direction === "horizontal";

    // Compute initial transform that maps data-space to pixel-space.
    // Elements inside the zoom group are positioned in data coordinates
    // (e.g. year values for horizontal, age values for vertical).
    // The initial transform scales and translates them into pixel range.
    const [d0, d1] = scale.domain();
    const [r0, r1] = scale.range();
    const dataSpan = d1 - d0;
    const initialK = dataSpan > 0 ? (r1 - r0) / dataSpan : 1;
    const initialT = r0 - d0 * initialK;

    const initialTransform = isHorizontal
      ? d3.zoomIdentity.translate(initialT, 0).scale(initialK)
      : d3.zoomIdentity.translate(0, initialT).scale(initialK);

    const viewportExtent: [[number, number], [number, number]] = isHorizontal
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
      .scaleExtent([initialK * 0.5, initialK * 20])
      .extent(viewportExtent)
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
        }, 50);
      });

    const svgSel = d3.select(svg);
    svgSel.call(zoom);
    svgSel.call(zoom.transform, initialTransform);

    return () => {
      svgSel.on(".zoom", null);
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [svgRef, zoomGroupRef, scale, direction, fixedOffset, width, height]);

  return { rescaled };
}
