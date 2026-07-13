import { render } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { GrowingBranch } from "./GrowingBranch";

const RECT: DOMRect = {
  top: 0,
  bottom: 1200,
  left: 0,
  right: 120,
  width: 120,
  height: 1200,
  x: 0,
  y: 0,
  toJSON: () => ({}),
};

/** Render the branch inside a scrollable .landing, as the landing page does. */
function renderInLanding() {
  return render(
    <div className="landing">
      <div className="landing__sections">
        <GrowingBranch />
      </div>
    </div>,
  );
}

function stubLayout(clientHeight: number) {
  vi.spyOn(Element.prototype, "clientWidth", "get").mockReturnValue(120);
  vi.spyOn(Element.prototype, "clientHeight", "get").mockReturnValue(clientHeight);
  vi.spyOn(Element.prototype, "getBoundingClientRect").mockReturnValue(RECT);
}

/** A do-nothing observer for cases that do not need to drive its callback. */
class NoopObserver {
  observe() {}
  disconnect() {}
  unobserve() {}
}

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
  document.documentElement.removeAttribute("data-theme");
});

describe("GrowingBranch", () => {
  it("renders a decorative svg", () => {
    const { container } = render(<GrowingBranch />);
    const svg = container.querySelector("svg.growing-branch");
    expect(svg).toBeInTheDocument();
    expect(svg).toHaveAttribute("aria-hidden", "true");
  });

  it("mounts safely without a scroll container or layout (jsdom)", () => {
    expect(() => render(<GrowingBranch />)).not.toThrow();
  });

  it("scatters leaves down the gutter and reveals them as the page scrolls", () => {
    vi.stubGlobal("matchMedia", vi.fn().mockReturnValue({ matches: false }));
    stubLayout(1200);
    let frameCb: FrameRequestCallback | null = null;
    vi.stubGlobal("requestAnimationFrame", (cb: FrameRequestCallback) => {
      frameCb = cb;
      return 1;
    });
    vi.stubGlobal("cancelAnimationFrame", vi.fn());
    let roCb: (() => void) | null = null;
    class RO {
      constructor(cb: () => void) {
        roCb = cb;
      }
      observe() {}
      disconnect() {}
      unobserve() {}
    }
    vi.stubGlobal("ResizeObserver", RO);

    const { container, unmount } = renderInLanding();
    const svg = container.querySelector("svg.growing-branch") as SVGSVGElement;

    // Dark theme: leaves, not gems.
    expect(svg.querySelectorAll(".growing-branch__leaf").length).toBeGreaterThan(0);
    expect(svg.querySelectorAll(".growing-branch__gem")).toHaveLength(0);

    // A scroll event queues a frame; running it reveals nodes near the top.
    document.querySelector(".landing")?.dispatchEvent(new Event("scroll"));
    expect(frameCb).toBeTypeOf("function");
    frameCb?.(0);
    const revealed = [...svg.querySelectorAll<SVGGElement>(".growing-branch__node")].filter(
      (n) => n.style.opacity === "1",
    );
    expect(revealed.length).toBeGreaterThan(0);

    // The ResizeObserver callback rebuilds the scatter.
    expect(roCb).toBeTypeOf("function");
    roCb?.();
    expect(svg.querySelectorAll(".growing-branch__leaf").length).toBeGreaterThan(0);

    unmount();
  });

  it("draws indigo gems in the light theme and rebuilds when the theme changes", () => {
    document.documentElement.setAttribute("data-theme", "light");
    vi.stubGlobal("matchMedia", vi.fn().mockReturnValue({ matches: false }));
    stubLayout(1000);
    vi.stubGlobal("requestAnimationFrame", () => 1);
    vi.stubGlobal("cancelAnimationFrame", vi.fn());
    let moCb: (() => void) | null = null;
    class MO {
      constructor(cb: () => void) {
        moCb = cb;
      }
      observe() {}
      disconnect() {}
      takeRecords() {
        return [];
      }
    }
    vi.stubGlobal("MutationObserver", MO);
    vi.stubGlobal("ResizeObserver", NoopObserver);

    const { container } = renderInLanding();
    const svg = container.querySelector("svg.growing-branch") as SVGSVGElement;

    expect(svg.querySelectorAll(".growing-branch__gem").length).toBeGreaterThan(0);
    expect(svg.querySelectorAll(".growing-branch__leaf")).toHaveLength(0);

    // Theme observer fires on a data-theme change and rebuilds (now dark).
    document.documentElement.removeAttribute("data-theme");
    expect(moCb).toBeTypeOf("function");
    moCb?.();
    expect(svg.querySelectorAll(".growing-branch__leaf").length).toBeGreaterThan(0);
  });

  it("reveals every node at once under prefers-reduced-motion", () => {
    vi.stubGlobal("matchMedia", vi.fn().mockReturnValue({ matches: true }));
    stubLayout(1000);
    const raf = vi.fn();
    vi.stubGlobal("requestAnimationFrame", raf);
    vi.stubGlobal("cancelAnimationFrame", vi.fn());
    vi.stubGlobal("ResizeObserver", NoopObserver);

    const { container } = renderInLanding();
    const svg = container.querySelector("svg.growing-branch") as SVGSVGElement;
    const nodes = svg.querySelectorAll<SVGGElement>(".growing-branch__node");

    expect(nodes.length).toBeGreaterThan(0);
    for (const n of nodes) expect(n.style.opacity).toBe("1");
    // No scroll-driven animation under reduced motion.
    expect(raf).not.toHaveBeenCalled();
  });

  it("does not scatter when the gutter is too short", () => {
    vi.stubGlobal("matchMedia", vi.fn().mockReturnValue({ matches: false }));
    stubLayout(200); // below the 400px minimum height
    vi.stubGlobal("requestAnimationFrame", () => 1);
    vi.stubGlobal("cancelAnimationFrame", vi.fn());
    vi.stubGlobal("ResizeObserver", NoopObserver);

    const { container } = renderInLanding();
    const svg = container.querySelector("svg.growing-branch") as SVGSVGElement;
    expect(svg.querySelectorAll(".growing-branch__node")).toHaveLength(0);
  });
});
