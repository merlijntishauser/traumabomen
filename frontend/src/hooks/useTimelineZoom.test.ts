import { act, renderHook, waitFor } from "@testing-library/react";
import * as d3 from "d3";
import { afterEach, describe, expect, it, vi } from "vitest";
import { useTimelineZoom } from "./useTimelineZoom";

// Capture zoom handler and filter registered via d3.zoom().on("zoom") / .filter()
let capturedZoomHandler: ((event: unknown) => void) | null = null;
let capturedFilter: ((event: Event) => boolean) | null = null;

vi.mock("d3", async (importOriginal) => {
  const real = await importOriginal<typeof d3>();
  return {
    ...real,
    zoom: (...args: Parameters<typeof real.zoom>) => {
      const z = real.zoom(...args);
      const origOn = z.on.bind(z);
      const origFilter = z.filter.bind(z);
      z.on = ((type: string, handler: ((event: unknown) => void) | null) => {
        if (type === "zoom" && handler) capturedZoomHandler = handler;
        return origOn(type, handler);
      }) as typeof z.on;
      z.filter = ((fn: (event: Event) => boolean) => {
        capturedFilter = fn;
        return origFilter(fn);
      }) as typeof z.filter;
      return z;
    },
  };
});

describe("useTimelineZoom", () => {
  afterEach(() => {
    vi.useRealTimers();
    capturedZoomHandler = null;
    capturedFilter = null;
  });

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

  it("zoomIn does not throw when svgRef is null", () => {
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
    expect(() => act(() => result.current.zoomActions.zoomIn())).not.toThrow();
  });

  it("zoomOut does not throw when svgRef is null", () => {
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
    expect(() => act(() => result.current.zoomActions.zoomOut())).not.toThrow();
  });

  it("resetZoom does not throw when svgRef is null", () => {
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
    expect(() => act(() => result.current.zoomActions.resetZoom())).not.toThrow();
  });

  it("zoomIn triggers D3 zoom on a mounted SVG", () => {
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

    expect(() => act(() => result.current.zoomActions.zoomIn())).not.toThrow();

    unmount();
    document.body.removeChild(svg);
  });

  it("zoomOut triggers D3 zoom on a mounted SVG", () => {
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

    expect(() => act(() => result.current.zoomActions.zoomOut())).not.toThrow();

    unmount();
    document.body.removeChild(svg);
  });

  it("resetZoom triggers D3 zoom on a mounted SVG", () => {
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

    expect(() => act(() => result.current.zoomActions.resetZoom())).not.toThrow();

    unmount();
    document.body.removeChild(svg);
  });

  it("accepts scrollMode option without errors", () => {
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
        scrollMode: true,
      }),
    );

    expect(result.current.rescaled.domain()).toEqual([1950, 2025]);
    expect(() => act(() => result.current.zoomActions.zoomIn())).not.toThrow();

    unmount();
    document.body.removeChild(svg);
  });

  it("zoom handler updates rescaled and zoomK via debounce (horizontal)", async () => {
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

    expect(capturedZoomHandler).not.toBeNull();

    act(() => {
      capturedZoomHandler!({ transform: d3.zoomIdentity.scale(2) });
    });

    // Synchronous transform is applied immediately
    expect(g.getAttribute("transform")).toContain("scale(2,1)");

    // Debounced state update (50ms) fires and React re-renders
    await waitFor(() => {
      expect(result.current.zoomK).toBe(2);
    });

    // Filter: right-click blocked
    expect(capturedFilter).not.toBeNull();
    expect(capturedFilter!(new MouseEvent("mousedown", { button: 0 }))).toBe(true);
    expect(capturedFilter!(new MouseEvent("mousedown", { button: 2 }))).toBe(false);

    unmount();
    document.body.removeChild(svg);
  });

  it("zoom handler uses rescaleY for vertical direction", async () => {
    const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
    const g = document.createElementNS("http://www.w3.org/2000/svg", "g");
    svg.appendChild(g);
    document.body.appendChild(svg);

    const scale = d3.scaleLinear().domain([0, 80]).range([50, 400]);

    const { result, unmount } = renderHook(() =>
      useTimelineZoom({
        svgRef: { current: svg },
        zoomGroupRef: { current: g },
        scale,
        direction: "vertical",
        fixedOffset: 50,
        width: 600,
        height: 400,
      }),
    );

    expect(capturedZoomHandler).not.toBeNull();

    act(() => {
      capturedZoomHandler!({ transform: d3.zoomIdentity.scale(3) });
    });

    expect(g.getAttribute("transform")).toContain("scale(1,3)");

    await waitFor(() => {
      expect(result.current.zoomK).toBe(3);
    });

    unmount();
    document.body.removeChild(svg);
  });

  it("filter blocks wheel events when scrollMode is true", () => {
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
        scrollMode: true,
      }),
    );

    expect(capturedFilter).not.toBeNull();
    expect(capturedFilter!(new WheelEvent("wheel"))).toBe(false);
    expect(capturedFilter!(new MouseEvent("mousedown", { button: 0 }))).toBe(true);

    unmount();
    document.body.removeChild(svg);
  });

  it("zoom actions work with vertical direction", () => {
    const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
    const g = document.createElementNS("http://www.w3.org/2000/svg", "g");
    svg.appendChild(g);
    document.body.appendChild(svg);

    const scale = d3.scaleLinear().domain([0, 80]).range([50, 400]);

    const { result, unmount } = renderHook(() =>
      useTimelineZoom({
        svgRef: { current: svg },
        zoomGroupRef: { current: g },
        scale,
        direction: "vertical",
        fixedOffset: 50,
        width: 600,
        height: 400,
      }),
    );

    expect(() => act(() => result.current.zoomActions.zoomIn())).not.toThrow();
    expect(() => act(() => result.current.zoomActions.zoomOut())).not.toThrow();
    expect(() => act(() => result.current.zoomActions.resetZoom())).not.toThrow();

    unmount();
    document.body.removeChild(svg);
  });
});
