import { act, renderHook } from "@testing-library/react";
import * as d3 from "d3";
import { describe, expect, it } from "vitest";
import { useTimelineZoom } from "./useTimelineZoom";

describe("useTimelineZoom", () => {
  it("returns rescaledX matching the input xScale domain and range", () => {
    const xScale = d3.scaleLinear().domain([1950, 2025]).range([180, 800]);

    const { result } = renderHook(() =>
      useTimelineZoom({
        svgRef: { current: null },
        zoomGroupRef: { current: null },
        xScale,
        labelWidth: 180,
        width: 800,
        height: 400,
      }),
    );

    expect(result.current.rescaledX.domain()).toEqual([1950, 2025]);
    expect(result.current.rescaledX.range()).toEqual([180, 800]);
  });

  it("updates rescaledX when xScale changes", () => {
    const xScale1 = d3.scaleLinear().domain([1950, 2025]).range([180, 800]);
    const xScale2 = d3.scaleLinear().domain([1900, 2025]).range([180, 1000]);

    const { result, rerender } = renderHook(
      ({ xScale }) =>
        useTimelineZoom({
          svgRef: { current: null },
          zoomGroupRef: { current: null },
          xScale,
          labelWidth: 180,
          width: 800,
          height: 400,
        }),
      { initialProps: { xScale: xScale1 } },
    );

    expect(result.current.rescaledX.domain()).toEqual([1950, 2025]);

    act(() => {
      rerender({ xScale: xScale2 });
    });

    expect(result.current.rescaledX.domain()).toEqual([1900, 2025]);
    expect(result.current.rescaledX.range()).toEqual([180, 1000]);
  });

  it("does not crash when svgRef is null", () => {
    const xScale = d3.scaleLinear().domain([1950, 2025]).range([180, 800]);

    expect(() =>
      renderHook(() =>
        useTimelineZoom({
          svgRef: { current: null },
          zoomGroupRef: { current: null },
          xScale,
          labelWidth: 180,
          width: 800,
          height: 400,
        }),
      ),
    ).not.toThrow();
  });

  it("does not crash when dimensions are zero", () => {
    const xScale = d3.scaleLinear().domain([1950, 2025]).range([180, 800]);

    expect(() =>
      renderHook(() =>
        useTimelineZoom({
          svgRef: { current: null },
          zoomGroupRef: { current: null },
          xScale,
          labelWidth: 180,
          width: 0,
          height: 0,
        }),
      ),
    ).not.toThrow();
  });

  it("cleans up without error on unmount", () => {
    const xScale = d3.scaleLinear().domain([1950, 2025]).range([180, 800]);

    const { unmount } = renderHook(() =>
      useTimelineZoom({
        svgRef: { current: null },
        zoomGroupRef: { current: null },
        xScale,
        labelWidth: 180,
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

    const xScale = d3.scaleLinear().domain([1950, 2025]).range([180, 800]);

    const { result, unmount } = renderHook(() =>
      useTimelineZoom({
        svgRef: { current: svg },
        zoomGroupRef: { current: g },
        xScale,
        labelWidth: 180,
        width: 800,
        height: 400,
      }),
    );

    expect(result.current.rescaledX.domain()).toEqual([1950, 2025]);

    unmount();
    document.body.removeChild(svg);
  });
});
