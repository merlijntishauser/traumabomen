export function AuthHero({ variant = "default" }: { variant?: "default" | "unlock" }) {
  const suffix = variant === "unlock" ? "-unlock" : "";
  return (
    <div className="auth-hero" aria-hidden="true">
      <picture>
        <source srcSet={`/images/hero${suffix}-dark.webp`} type="image/webp" />
        <img
          className="auth-hero__img auth-hero__img--dark"
          src={`/images/hero${suffix}-dark.jpg`}
          alt=""
          decoding="async"
        />
      </picture>
      <picture>
        <source srcSet={`/images/hero${suffix}-light.webp`} type="image/webp" />
        <img
          className="auth-hero__img auth-hero__img--light"
          src={`/images/hero${suffix}-light.jpg`}
          alt=""
          decoding="async"
        />
      </picture>
    </div>
  );
}
