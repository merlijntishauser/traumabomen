import "./Glimpse.css";

/**
 * Theme-aware product screenshot. Each theme shows its own capture; the
 * variants swap via display (aspect ratios differ per capture), so the hidden
 * one is also removed from the accessibility tree. Both stay in the markup so
 * prerendered pages show the right one before any JS runs.
 *
 * Both load lazily: browsers do not fetch a lazy image while it is
 * display: none, so the other theme's capture is never downloaded. An eager
 * image would be fetched even when hidden.
 */
export function Glimpse({ name, alt }: { name: string; alt: string }) {
  return (
    <>
      <picture>
        <source srcSet={`/images/glimpse-${name}-dark.webp`} type="image/webp" />
        <img
          className="glimpse-shot glimpse-shot--dark"
          src={`/images/glimpse-${name}-dark.jpg`}
          alt={alt}
          loading="lazy"
          decoding="async"
        />
      </picture>
      <picture>
        <source srcSet={`/images/glimpse-${name}-light.webp`} type="image/webp" />
        <img
          className="glimpse-shot glimpse-shot--light"
          src={`/images/glimpse-${name}-light.jpg`}
          alt={alt}
          loading="lazy"
          decoding="async"
        />
      </picture>
    </>
  );
}
