export function AuthHero({ variant = "default" }: { variant?: "default" | "unlock" }) {
  const suffix = variant === "unlock" ? "-unlock" : "";
  return (
    <div className="auth-hero" aria-hidden="true">
      <img
        className="auth-hero__img auth-hero__img--dark"
        src={`/images/hero${suffix}-dark.jpg`}
        alt=""
        decoding="async"
      />
      <img
        className="auth-hero__img auth-hero__img--light"
        src={`/images/hero${suffix}-light.jpg`}
        alt=""
        decoding="async"
      />
    </div>
  );
}
