export function AuthHero() {
  return (
    <div className="auth-hero" aria-hidden="true">
      <img
        className="auth-hero__img auth-hero__img--dark"
        src="/images/hero-dark.jpg"
        alt=""
      />
      <img
        className="auth-hero__img auth-hero__img--light"
        src="/images/hero-light.jpg"
        alt=""
      />
    </div>
  );
}
