import {
  ArrowLeft,
  Ban,
  Check,
  Cpu,
  Database,
  DoorOpen,
  FileLock2,
  KeyRound,
  LogIn,
  type LucideIcon,
  ShieldCheck,
  UploadCloud,
} from "lucide-react";
import { useTranslation } from "react-i18next";
import { Link, useNavigate } from "react-router-dom";
import "../styles/security.css";

type Card = { icon: LucideIcon; id: string; chips?: string[] };

const STEP1: Card[] = [
  { icon: LogIn, id: "card1" },
  { icon: ShieldCheck, id: "card2", chips: ["TLS", "Auth"] },
  { icon: DoorOpen, id: "card3" },
  { icon: Ban, id: "card4" },
];

const STEP2: Card[] = [
  { icon: KeyRound, id: "card1" },
  { icon: Cpu, id: "card2", chips: ["Argon2id"] },
  { icon: FileLock2, id: "card3", chips: ["AES-256-GCM"] },
  { icon: UploadCloud, id: "card4" },
  { icon: Database, id: "card5" },
];

export default function SecurityPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();

  function renderCard(step: "step1" | "step2", card: Card, index: number) {
    const Icon = card.icon;
    return (
      <div key={card.id} className="security-card">
        <span className="security-card__num">{index + 1}</span>
        <div className="security-card__icon">
          <Icon size={34} aria-hidden="true" />
        </div>
        <h3>{t(`security.${step}.${card.id}.title`)}</h3>
        <p>{t(`security.${step}.${card.id}.body`)}</p>
        {card.chips && (
          <div className="security-chips">
            {card.chips.map((chip) => (
              <span key={chip} className="security-chip">
                {chip}
              </span>
            ))}
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="security-page">
      <div className="security-wrap">
        <button type="button" className="security-back" onClick={() => navigate(-1)}>
          <ArrowLeft size={16} aria-hidden="true" />
          {t("auth.stepBack")}
        </button>

        <article className="security-poster">
          <header className="security-header">
            <h1>{t("security.title")}</h1>
            <p className="security-subtitle">{t("security.subtitle")}</p>
          </header>

          <section className="security-section">
            <div className="security-section__head">
              <span className="security-badge">{t("security.step1.badge")}</span>
              <h2>{t("security.step1.title")}</h2>
            </div>
            <p className="security-section__note">{t("security.step1.note")}</p>
            <div className="security-flow">{STEP1.map((c, i) => renderCard("step1", c, i))}</div>
          </section>

          <section className="security-section">
            <div className="security-section__head">
              <span className="security-badge">{t("security.step2.badge")}</span>
              <h2>{t("security.step2.title")}</h2>
            </div>
            <p className="security-section__note">{t("security.step2.note")}</p>
            <div className="security-flow security-flow--five">
              {STEP2.map((c, i) => renderCard("step2", c, i))}
            </div>
          </section>

          <section className="security-answer">
            <div className="security-shield">
              <ShieldCheck size={48} aria-hidden="true" />
            </div>
            <div>
              <p className="security-answer__eyebrow">{t("security.answer.eyebrow")}</p>
              <h2>{t("security.answer.heading")}</h2>
              <p>{t("security.answer.body")}</p>
            </div>
          </section>

          <div className="security-panels">
            <section className="security-panel">
              <h2 className="security-panel__title">{t("security.access.title")}</h2>
              <ul className="security-checklist">
                {["item1", "item2", "item3", "item4"].map((k) => (
                  <li key={k}>
                    <Check size={16} aria-hidden="true" />
                    {t(`security.access.${k}`)}
                  </li>
                ))}
              </ul>
            </section>
            <section className="security-panel">
              <h2 className="security-panel__title">{t("security.why.title")}</h2>
              <ul className="security-checklist">
                {["item1", "item2", "item3", "item4"].map((k) => (
                  <li key={k}>
                    <Check size={16} aria-hidden="true" />
                    {t(`security.why.${k}`)}
                  </li>
                ))}
              </ul>
            </section>
          </div>

          <p className="security-footer">
            {t("security.footer")} <Link to="/privacy">{t("security.readPrivacy")}</Link>
          </p>
        </article>
      </div>
    </div>
  );
}
