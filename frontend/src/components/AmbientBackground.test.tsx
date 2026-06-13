import { render } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { AmbientBackground } from "./AmbientBackground";

/** A minimal 2D context stand-in: jsdom returns null for getContext("2d"). */
function fakeCtx() {
  return {
    setTransform: vi.fn(),
    clearRect: vi.fn(),
    createRadialGradient: vi.fn(() => ({ addColorStop: vi.fn() })),
    beginPath: vi.fn(),
    arc: vi.fn(),
    fill: vi.fn(),
    fillStyle: "" as string | CanvasGradient,
  };
}

class StubResizeObserver {
  observe() {}
  unobserve() {}
  disconnect() {}
}

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
  document.documentElement.removeAttribute("data-theme");
});

describe("AmbientBackground", () => {
  it("renders a decorative, non-interactive canvas", () => {
    const { container } = render(<AmbientBackground />);
    const wrapper = container.querySelector(".ambient-background");
    expect(wrapper).toHaveAttribute("aria-hidden", "true");
    expect(wrapper?.querySelector("canvas")).toBeInTheDocument();
  });

  it("does nothing under prefers-reduced-motion", () => {
    const matchMedia = vi.fn().mockReturnValue({ matches: true });
    vi.stubGlobal("matchMedia", matchMedia);
    const raf = vi.spyOn(window, "requestAnimationFrame");

    render(<AmbientBackground />);

    expect(matchMedia).toHaveBeenCalledWith("(prefers-reduced-motion: reduce)");
    expect(raf).not.toHaveBeenCalled();
  });

  it("survives environments without a 2d context (jsdom)", () => {
    // jsdom's getContext returns null; mounting must not throw.
    expect(() => render(<AmbientBackground />)).not.toThrow();
  });

  it("animates fireflies, recycles drifting motes, and cleans up", () => {
    vi.stubGlobal("matchMedia", vi.fn().mockReturnValue({ matches: false }));
    const ctx = fakeCtx();
    vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockReturnValue(
      ctx as unknown as CanvasRenderingContext2D,
    );
    vi.spyOn(Element.prototype, "clientWidth", "get").mockReturnValue(1000);
    vi.spyOn(Element.prototype, "clientHeight", "get").mockReturnValue(800);
    // Deterministic motes so the drift/recycle path is reached predictably.
    vi.spyOn(Math, "random").mockReturnValue(0);
    let frameCb: FrameRequestCallback | null = null;
    vi.stubGlobal("requestAnimationFrame", (cb: FrameRequestCallback) => {
      frameCb = cb;
      return 1;
    });
    const cancel = vi.fn();
    vi.stubGlobal("cancelAnimationFrame", cancel);
    vi.stubGlobal("ResizeObserver", StubResizeObserver);

    const { unmount } = render(<AmbientBackground />);
    expect(frameCb).toBeTypeOf("function");

    let now = 0;
    const tick = (dt: number) => {
      now += dt;
      frameCb?.(now);
    };
    tick(40); // first frame draws (dark theme)
    tick(5); // throttled frame: now - last < FRAME_MS, early return
    // Enough frames that a mote drifts off-canvas (recycle) and the
    // breathing alpha dips below the skip threshold.
    for (let i = 0; i < 700; i += 1) tick(40);

    expect(ctx.clearRect).toHaveBeenCalled();
    expect(ctx.arc).toHaveBeenCalled();
    expect(ctx.createRadialGradient).toHaveBeenCalled();

    unmount();
    expect(cancel).toHaveBeenCalled();
  });

  it("draws warm motes in the light theme", () => {
    document.documentElement.setAttribute("data-theme", "light");
    vi.stubGlobal("matchMedia", vi.fn().mockReturnValue({ matches: false }));
    const ctx = fakeCtx();
    vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockReturnValue(
      ctx as unknown as CanvasRenderingContext2D,
    );
    vi.spyOn(Element.prototype, "clientWidth", "get").mockReturnValue(800);
    vi.spyOn(Element.prototype, "clientHeight", "get").mockReturnValue(600);
    vi.spyOn(Math, "random").mockReturnValue(0);
    let frameCb: FrameRequestCallback | null = null;
    vi.stubGlobal("requestAnimationFrame", (cb: FrameRequestCallback) => {
      frameCb = cb;
      return 1;
    });
    vi.stubGlobal("cancelAnimationFrame", vi.fn());
    vi.stubGlobal("ResizeObserver", StubResizeObserver);

    render(<AmbientBackground />);
    // A couple of fresh frames: alpha is still high, so motes draw.
    frameCb?.(40);
    frameCb?.(90);

    expect(ctx.createRadialGradient).toHaveBeenCalled();
    expect(ctx.fill).toHaveBeenCalled();
  });

  it("pauses on tab hide and resumes when visible", () => {
    vi.stubGlobal("matchMedia", vi.fn().mockReturnValue({ matches: false }));
    vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockReturnValue(
      fakeCtx() as unknown as CanvasRenderingContext2D,
    );
    vi.spyOn(Element.prototype, "clientWidth", "get").mockReturnValue(800);
    vi.spyOn(Element.prototype, "clientHeight", "get").mockReturnValue(600);
    const raf = vi.fn().mockReturnValue(7);
    vi.stubGlobal("requestAnimationFrame", raf);
    const cancel = vi.fn();
    vi.stubGlobal("cancelAnimationFrame", cancel);
    vi.stubGlobal("ResizeObserver", StubResizeObserver);

    render(<AmbientBackground />);

    const hiddenSpy = vi.spyOn(document, "hidden", "get").mockReturnValue(true);
    document.dispatchEvent(new Event("visibilitychange"));
    expect(cancel).toHaveBeenCalled();

    const before = raf.mock.calls.length;
    hiddenSpy.mockReturnValue(false);
    document.dispatchEvent(new Event("visibilitychange"));
    expect(raf.mock.calls.length).toBeGreaterThan(before);
  });
});
