import { render } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { AuthHero } from "./AuthHero";

describe("AuthHero", () => {
  it("renders without crashing", () => {
    const { container } = render(<AuthHero />);
    expect(container.querySelector(".auth-hero")).toBeTruthy();
  });

  it("renders two images (dark and light)", () => {
    const { container } = render(<AuthHero />);
    const images = container.querySelectorAll("img");
    expect(images).toHaveLength(2);
  });

  it("uses default variant image paths", () => {
    const { container } = render(<AuthHero />);
    const images = container.querySelectorAll("img");
    expect(images[0].getAttribute("src")).toBe("/images/hero-dark.jpg");
    expect(images[1].getAttribute("src")).toBe("/images/hero-light.jpg");
  });

  it("uses unlock variant image paths", () => {
    const { container } = render(<AuthHero variant="unlock" />);
    const images = container.querySelectorAll("img");
    expect(images[0].getAttribute("src")).toBe("/images/hero-unlock-dark.jpg");
    expect(images[1].getAttribute("src")).toBe("/images/hero-unlock-light.jpg");
  });

  it("marks the container as aria-hidden", () => {
    const { container } = render(<AuthHero />);
    const hero = container.querySelector(".auth-hero");
    expect(hero?.getAttribute("aria-hidden")).toBe("true");
  });
});
