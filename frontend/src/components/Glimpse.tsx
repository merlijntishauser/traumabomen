import "./Glimpse.css";

/**
 * Theme-aware product screenshot. Each theme shows its own capture; the
 * variants swap via display (aspect ratios differ per capture), so the hidden
 * one is also removed from the accessibility tree.
 */
export function Glimpse({ name, alt, eager }: { name: string; alt: string; eager?: boolean }) {
  return (
    <>
      <picture>
        <source srcSet={`/images/glimpse-${name}-dark.webp`} type="image/webp" />
        <img
          className="glimpse-shot glimpse-shot--dark"
          src={`/images/glimpse-${name}-dark.jpg`}
          alt={alt}
          loading={eager ? undefined : "lazy"}
          decoding="async"
        />
      </picture>
      <picture>
        <source srcSet={`/images/glimpse-${name}-light.webp`} type="image/webp" />
        <img
          className="glimpse-shot glimpse-shot--light"
          src={`/images/glimpse-${name}-light.jpg`}
          alt={alt}
          loading={eager ? undefined : "lazy"}
          decoding="async"
        />
      </picture>
    </>
  );
}
