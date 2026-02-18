import * as d3 from "d3";
import { useEffect, useRef, useState } from "react";

interface UseTimelineZoomOptions {
  svgRef: React.RefObject<SVGSVGElement | null>;
  zoomGroupRef: React.RefObject<SVGGElement | null>;
  xScale: d3.ScaleLinear<number, number>;
  labelWidth: number;
  width: number;
  height: number;
}

export function useTimelineZoom({
  svgRef,
  zoomGroupRef,
  xScale,
  labelWidth,
  width,
  height,
}: UseTimelineZoomOptions): { rescaledX: d3.ScaleLinear<number, number> } {
  const [rescaledX, setRescaledX] = useState<d3.ScaleLinear<number, number>>(() => xScale);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    setRescaledX(() => xScale);
  }, [xScale]);

  useEffect(() => {
    const svg = svgRef.current;
    if (!svg || width <= 0 || height <= 0) return;

    const zoom = d3
      .zoom<SVGSVGElement, unknown>()
      .scaleExtent([0.5, 20])
      .translateExtent([
        [labelWidth, 0],
        [width, height],
      ])
      .extent([
        [labelWidth, 0],
        [width, height],
      ])
      .on("zoom", (event: d3.D3ZoomEvent<SVGSVGElement, unknown>) => {
        const g = zoomGroupRef.current;
        if (g) {
          g.setAttribute(
            "transform",
            `translate(${event.transform.x},0) scale(${event.transform.k},1)`,
          );
        }

        if (debounceRef.current) clearTimeout(debounceRef.current);
        debounceRef.current = setTimeout(() => {
          const newScale = event.transform.rescaleX(xScale);
          setRescaledX(() => newScale);
        }, 50);
      });

    const svgSel = d3.select(svg);
    svgSel.call(zoom);

    return () => {
      svgSel.on(".zoom", null);
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [svgRef, zoomGroupRef, xScale, labelWidth, width, height]);

  return { rescaledX };
}
