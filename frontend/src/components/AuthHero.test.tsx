import { render } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { AuthHero } from "./AuthHero";

vi.mock("react-i18next", () => ({
  useTranslation: () => ({
    t: (key: string) => key,
  }),
}));

describe("AuthHero", () => {
  it("renders without crashing", () => {
    const { container } = render(<AuthHero />);
    expect(container.querySelector(".auth-hero")).toBeTruthy();
  });

  it("renders two images (dark, light)", () => {
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

  it("sets decoding=async on both images", () => {
    const { container } = render(<AuthHero />);
    const images = container.querySelectorAll("img");
    for (const img of images) {
      expect(img.getAttribute("decoding")).toBe("async");
    }
  });

  it("wraps each image in a picture element with webp source", () => {
    const { container } = render(<AuthHero />);
    const pictures = container.querySelectorAll("picture");
    expect(pictures).toHaveLength(2);
    const sources = container.querySelectorAll("source[type='image/webp']");
    expect(sources).toHaveLength(2);
    expect(sources[0].getAttribute("srcset")).toBe("/images/hero-dark.webp");
    expect(sources[1].getAttribute("srcset")).toBe("/images/hero-light.webp");
  });

  it("does not mark the container as aria-hidden, leaving the overlay visible to AT", () => {
    const { container } = render(<AuthHero />);
    const hero = container.querySelector(".auth-hero");
    expect(hero?.getAttribute("aria-hidden")).toBeNull();
  });

  it("marks the decorative images with empty alt so screen readers skip them", () => {
    const { container } = render(<AuthHero />);
    const images = container.querySelectorAll("img");
    for (const img of images) {
      expect(img.getAttribute("alt")).toBe("");
    }
  });

  it("renders the brand overlay (logomark + tagline) on the default variant", () => {
    const { container } = render(<AuthHero />);
    const overlay = container.querySelector(".auth-hero__overlay");
    expect(overlay).toBeTruthy();
    expect(overlay?.querySelector("svg")).toBeTruthy();
    expect(overlay?.querySelector(".auth-hero__tagline")?.textContent).toBe("landing.heroTagline");
  });

  it("hides the brand overlay on the unlock variant", () => {
    // Unlock is the "locked door" surface — the kit keeps it visually quiet.
    const { container } = render(<AuthHero variant="unlock" />);
    expect(container.querySelector(".auth-hero__overlay")).toBeNull();
  });
});
