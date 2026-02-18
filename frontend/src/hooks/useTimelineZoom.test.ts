import { act, renderHook } from "@testing-library/react";
import * as d3 from "d3";
import { describe, expect, it } from "vitest";
import { useTimelineZoom } from "./useTimelineZoom";

describe("useTimelineZoom", () => {
  it("returns rescaled matching the input scale domain and range", () => {
    const scale = d3.scaleLinear().domain([1950, 2025]).range([180, 800]);

    const { result } = renderHook(() =>
      useTimelineZoom({
        svgRef: { current: null },
        zoomGroupRef: { current: null },
        scale,
        fixedOffset: 180,
        width: 800,
        height: 400,
      }),
    );

    expect(result.current.rescaled.domain()).toEqual([1950, 2025]);
    expect(result.current.rescaled.range()).toEqual([180, 800]);
  });

  it("updates rescaled when scale changes", () => {
    const scale1 = d3.scaleLinear().domain([1950, 2025]).range([180, 800]);
    const scale2 = d3.scaleLinear().domain([1900, 2025]).range([180, 1000]);

    const { result, rerender } = renderHook(
      ({ scale }) =>
        useTimelineZoom({
          svgRef: { current: null },
          zoomGroupRef: { current: null },
          scale,
          fixedOffset: 180,
          width: 800,
          height: 400,
        }),
      { initialProps: { scale: scale1 } },
    );

    expect(result.current.rescaled.domain()).toEqual([1950, 2025]);

    act(() => {
      rerender({ scale: scale2 });
    });

    expect(result.current.rescaled.domain()).toEqual([1900, 2025]);
    expect(result.current.rescaled.range()).toEqual([180, 1000]);
  });

  it("does not crash when svgRef is null", () => {
    const scale = d3.scaleLinear().domain([1950, 2025]).range([180, 800]);

    expect(() =>
      renderHook(() =>
        useTimelineZoom({
          svgRef: { current: null },
          zoomGroupRef: { current: null },
          scale,
          fixedOffset: 180,
          width: 800,
          height: 400,
        }),
      ),
    ).not.toThrow();
  });

  it("does not crash when dimensions are zero", () => {
    const scale = d3.scaleLinear().domain([1950, 2025]).range([180, 800]);

    expect(() =>
      renderHook(() =>
        useTimelineZoom({
          svgRef: { current: null },
          zoomGroupRef: { current: null },
          scale,
          fixedOffset: 180,
          width: 0,
          height: 0,
        }),
      ),
    ).not.toThrow();
  });

  it("cleans up without error on unmount", () => {
    const scale = d3.scaleLinear().domain([1950, 2025]).range([180, 800]);

    const { unmount } = renderHook(() =>
      useTimelineZoom({
        svgRef: { current: null },
        zoomGroupRef: { current: null },
        scale,
        fixedOffset: 180,
        width: 800,
        height: 400,
      }),
    );

    expect(() => unmount()).not.toThrow();
  });

  it("works with a real SVG element attached to DOM", () => {
    const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
    const g = document.createElementNS("http://www.w3.org/2000/svg", "g");
    svg.appendChild(g);
    document.body.appendChild(svg);

    const scale = d3.scaleLinear().domain([1950, 2025]).range([180, 800]);

    const { result, unmount } = renderHook(() =>
      useTimelineZoom({
        svgRef: { current: svg },
        zoomGroupRef: { current: g },
        scale,
        fixedOffset: 180,
        width: 800,
        height: 400,
      }),
    );

    expect(result.current.rescaled.domain()).toEqual([1950, 2025]);

    unmount();
    document.body.removeChild(svg);
  });

  it("applies initial transform that maps data-space to pixel-space", () => {
    const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
    const g = document.createElementNS("http://www.w3.org/2000/svg", "g");
    svg.appendChild(g);
    document.body.appendChild(svg);

    const scale = d3.scaleLinear().domain([1950, 2025]).range([180, 800]);

    const { unmount } = renderHook(() =>
      useTimelineZoom({
        svgRef: { current: svg },
        zoomGroupRef: { current: g },
        scale,
        fixedOffset: 180,
        width: 800,
        height: 400,
      }),
    );

    const transform = g.getAttribute("transform");
    expect(transform).toBeTruthy();

    // Parse the transform values
    const translateMatch = transform!.match(/translate\(([-\d.]+)/);
    const scaleMatch = transform!.match(/scale\(([-\d.]+)/);
    expect(translateMatch).toBeTruthy();
    expect(scaleMatch).toBeTruthy();

    const tx = Number(translateMatch![1]);
    const k = Number(scaleMatch![1]);

    // Verify the transform maps domain start -> range start
    expect(k * 1950 + tx).toBeCloseTo(180, 1);
    // Verify the transform maps domain end -> range end
    expect(k * 2025 + tx).toBeCloseTo(800, 1);

    unmount();
    document.body.removeChild(svg);
  });

  it("applies initial transform for vertical direction", () => {
    const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
    const g = document.createElementNS("http://www.w3.org/2000/svg", "g");
    svg.appendChild(g);
    document.body.appendChild(svg);

    const scale = d3.scaleLinear().domain([0, 90]).range([52, 600]);

    const { unmount } = renderHook(() =>
      useTimelineZoom({
        svgRef: { current: svg },
        zoomGroupRef: { current: g },
        scale,
        direction: "vertical",
        fixedOffset: 52,
        width: 400,
        height: 600,
      }),
    );

    const transform = g.getAttribute("transform");
    expect(transform).toBeTruthy();

    // Vertical: translate(0, ty) scale(1, k)
    const translateMatch = transform!.match(/translate\(0,([-\d.]+)/);
    const scaleMatch = transform!.match(/scale\(1,([-\d.]+)/);
    expect(translateMatch).toBeTruthy();
    expect(scaleMatch).toBeTruthy();

    const ty = Number(translateMatch![1]);
    const k = Number(scaleMatch![1]);

    // Verify the transform maps domain start -> range start
    expect(k * 0 + ty).toBeCloseTo(52, 1);
    // Verify the transform maps domain end -> range end
    expect(k * 90 + ty).toBeCloseTo(600, 1);

    unmount();
    document.body.removeChild(svg);
  });
});
