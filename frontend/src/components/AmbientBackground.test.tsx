import { render } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { AmbientBackground } from "./AmbientBackground";

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
    vi.unstubAllGlobals();
    raf.mockRestore();
  });

  it("survives environments without a 2d context (jsdom)", () => {
    // jsdom's getContext returns null; mounting must not throw.
    expect(() => render(<AmbientBackground />)).not.toThrow();
  });
});
