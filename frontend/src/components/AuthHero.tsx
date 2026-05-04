import { useTranslation } from "react-i18next";
import { Logomark } from "./Logomark";

export function AuthHero({ variant = "default" }: { variant?: "default" | "unlock" }) {
  const { t } = useTranslation();
  const suffix = variant === "unlock" ? "-unlock" : "";
  // Only the landing variant gets the brand-mark overlay. Unlock keeps the
  // hero purely decorative — it's the "locked door" surface.
  const showOverlay = variant === "default";
  // The <img alt=""> on the picture elements is the canonical way to mark
  // a decorative image — screen readers skip it. We don't need (and biome's
  // a11y rule disallows) aria-hidden on the wrapping <picture>.
  return (
    <div className="auth-hero">
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
      {showOverlay && (
        <div className="auth-hero__overlay">
          <Logomark size={32} className="auth-hero__logomark" />
          <p className="auth-hero__tagline">{t("landing.heroTagline")}</p>
        </div>
      )}
    </div>
  );
}
