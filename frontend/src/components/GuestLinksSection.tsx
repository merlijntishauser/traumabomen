import { type FormEvent, useEffect, useId, useState } from "react";
import { useTranslation } from "react-i18next";
import type { GuestLinkOutcome, GuestLinks, OwnedGuestLink } from "../hooks/useGuestLinks";
import { useTreeData } from "../hooks/useTreeData";
import { summarizeGuestCopy } from "../lib/guestCopy";
import { formatLinkDate, guestLinkUrl } from "../lib/guestLinkFormat";
import { ConfirmDeleteButton } from "./ConfirmDeleteButton";
import "./GuestLinksSection.css";

const DAY_CHOICES = [1, 7, 14, 30] as const;
const DEFAULT_DAYS = 7;
const MANY_NETWORKS = 100;

type TFunction = ReturnType<typeof useTranslation>["t"];

function DaysSelect({
  id,
  value,
  onChange,
  ariaLabel,
}: {
  id?: string;
  value: number;
  onChange: (days: number) => void;
  ariaLabel?: string;
}) {
  const { t } = useTranslation();
  return (
    <select
      id={id}
      className="guest-links__select"
      value={value}
      aria-label={ariaLabel}
      onChange={(e) => onChange(Number(e.target.value))}
    >
      {DAY_CHOICES.map((days) => (
        <option key={days} value={days}>
          {t("guestLinks.days", { count: days })}
        </option>
      ))}
    </select>
  );
}

function CreateGuestLinkForm({
  treeId,
  busy,
  onCreate,
}: {
  treeId: string;
  busy: boolean;
  onCreate: (input: { label: string; days: number }) => Promise<GuestLinkOutcome>;
}) {
  const { t } = useTranslation();
  const labelId = useId();
  const daysId = useId();
  const [label, setLabel] = useState("");
  const [days, setDays] = useState(DEFAULT_DAYS);
  const tree = useTreeData(treeId);
  const summary = summarizeGuestCopy({ ...tree, treeName: tree.treeName ?? "" });

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (busy) return;
    const outcome = await onCreate({ label: label.trim(), days });
    if ("ok" in outcome) setLabel("");
  }

  return (
    <form className="guest-links__form" onSubmit={(e) => void handleSubmit(e)}>
      <div className="guest-links__field">
        <label className="share-dialog__label" htmlFor={labelId}>
          {t("guestLinks.labelField")}
        </label>
        <input
          id={labelId}
          type="text"
          autoComplete="off"
          maxLength={100}
          className="share-dialog__input"
          value={label}
          onChange={(e) => setLabel(e.target.value)}
          placeholder={t("guestLinks.labelPlaceholder")}
        />
      </div>
      <div className="guest-links__field">
        <label className="share-dialog__label" htmlFor={daysId}>
          {t("guestLinks.lasts")}
        </label>
        <DaysSelect id={daysId} value={days} onChange={setDays} />
      </div>
      <p className="guest-links__summary">
        {tree.isLoading
          ? t("common.loading")
          : t("guestLinks.summary", {
              persons: t("guestLinks.summaryPersons", { count: summary.persons }),
              events: t("guestLinks.summaryEvents", { count: summary.events }),
              patterns: t("guestLinks.summaryPatterns", { count: summary.patterns }),
            })}
      </p>
      <button type="submit" className="btn btn--primary" disabled={busy}>
        {busy ? t("guestLinks.working") : t("guestLinks.create")}
      </button>
    </form>
  );
}

function CopyRow({ label, value, copyLabel }: { label: string; value: string; copyLabel: string }) {
  const { t } = useTranslation();
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!copied) return;
    const timer = setTimeout(() => setCopied(false), 2000);
    return () => clearTimeout(timer);
  }, [copied]);

  async function handleCopy() {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
    } catch {
      // Clipboard refused: the value is on screen to select by hand.
    }
  }

  return (
    <div className="guest-link__secret">
      <span className="guest-link__secret-label">{label}</span>
      <code className="guest-link__secret-value">{value}</code>
      <button
        type="button"
        className="btn guest-link__btn"
        aria-label={copyLabel}
        onClick={() => void handleCopy()}
      >
        {copied ? t("guestLinks.copied") : t("guestLinks.copy")}
      </button>
    </div>
  );
}

function usageLine(t: TFunction, link: OwnedGuestLink, language: string): string {
  if (link.open_count === 0 || !link.last_opened_at) return t("guestLinks.notOpened");
  const count = link.open_count;
  const date = formatLinkDate(link.last_opened_at, language);
  if (link.network_count === null) return t("guestLinks.openedNoNetworks", { count, date });
  const networks =
    link.network_count >= MANY_NETWORKS
      ? t("guestLinks.networksMany")
      : t("guestLinks.networks", { count: link.network_count });
  return t("guestLinks.openedFrom", { count, date, networks });
}

interface GuestLinkCardProps {
  link: OwnedGuestLink;
  /** False when the feature is switched off: the link can only be listed and ended. */
  enabled: boolean;
  busy: boolean;
  onRepublish: () => void;
  onExtend: (days: number) => void;
  onUnlock: () => void;
  onEnd: () => void;
}

function GuestLinkCard({
  link,
  enabled,
  busy,
  onRepublish,
  onExtend,
  onUnlock,
  onEnd,
}: GuestLinkCardProps) {
  const { t, i18n } = useTranslation();
  const [extendDays, setExtendDays] = useState(DEFAULT_DAYS);
  const { secret } = link;
  const date = (iso: string) => formatLinkDate(iso, i18n.language);

  return (
    <li className="guest-link">
      <div className="guest-link__head">
        <span className="guest-link__label">{secret?.label || t("guestLinks.untitled")}</span>
        <span className="guest-link__until">
          {t("guestLinks.until", { date: date(link.expires_at) })}
        </span>
      </div>

      {/* With the feature off the link no longer opens: no link or passphrase to hand out. */}
      {!enabled ? null : secret ? (
        <>
          <CopyRow
            label={t("guestLinks.link")}
            value={guestLinkUrl(window.location.origin, secret.linkSecret)}
            copyLabel={t("guestLinks.copyLink")}
          />
          <CopyRow
            label={t("guestLinks.passphrase")}
            value={secret.passphrase}
            copyLabel={t("guestLinks.copyPassphrase")}
          />
          <p className="guest-link__note">{t("guestLinks.sendSeparately")}</p>
        </>
      ) : (
        <p className="guest-link__note">{t("guestLinks.unreadable")}</p>
      )}

      <div className="guest-link__line">
        <span>{t("guestLinks.published", { date: date(link.published_at) })}</span>
        {enabled && secret && (
          <button
            type="button"
            className="btn guest-link__btn"
            disabled={busy}
            onClick={onRepublish}
          >
            {t("guestLinks.update")}
          </button>
        )}
      </div>

      <p className="guest-link__usage">{usageLine(t, link, i18n.language)}</p>
      {link.open_count > 0 && (
        <p className="guest-link__note">{t("guestLinks.networksExplained")}</p>
      )}
      {link.failed_total > 0 && (
        <p className="guest-link__usage">
          {t("guestLinks.wrongPassphrases", { count: link.failed_total })}
        </p>
      )}
      {link.locked && (
        <div className="guest-link__line guest-link__locked">
          <span>{t("guestLinks.locked")}</span>
          {enabled && (
            <button
              type="button"
              className="btn guest-link__btn"
              disabled={busy}
              onClick={onUnlock}
            >
              {t("guestLinks.unlock")}
            </button>
          )}
        </div>
      )}

      <div className="guest-link__actions">
        {enabled && (
          <span className="guest-link__extend">
            <DaysSelect
              value={extendDays}
              onChange={setExtendDays}
              ariaLabel={t("guestLinks.extendFor")}
            />
            <button
              type="button"
              className="btn guest-link__btn"
              disabled={busy}
              onClick={() => onExtend(extendDays)}
            >
              {t("guestLinks.extend")}
            </button>
          </span>
        )}
        <ConfirmDeleteButton
          className="share-dialog__remove"
          label={t("guestLinks.end")}
          confirmLabel={t("guestLinks.endConfirm")}
          onConfirm={onEnd}
        />
      </div>
    </li>
  );
}

interface Props {
  treeId: string;
  /** The guest_links flag. Off: existing links are listed and can be ended, nothing more. */
  enabled: boolean;
  /** From useGuestLinks, held by the dialog so it can refuse to close mid-action. */
  guest: GuestLinks;
}

/** "Share by link" in the share dialog: read-only copies for someone without an account. */
export function GuestLinksSection({ treeId, enabled, guest }: Props) {
  const { t } = useTranslation();
  const titleId = useId();
  const [error, setError] = useState<string | null>(null);

  if (!enabled && guest.links.length === 0) return null;

  async function run(action: () => Promise<GuestLinkOutcome>): Promise<GuestLinkOutcome> {
    setError(null);
    const outcome = await action();
    if ("error" in outcome) setError(outcome.error);
    return outcome;
  }

  return (
    <section className="guest-links" aria-labelledby={titleId}>
      <h3 id={titleId} className="share-dialog__subtitle">
        {t("guestLinks.title")}
      </h3>
      <p className="guest-links__intro">{t("guestLinks.intro")}</p>

      {enabled && (
        <CreateGuestLinkForm
          treeId={treeId}
          busy={guest.busy}
          onCreate={(input) => run(() => guest.create(input))}
        />
      )}

      {error && (
        <p className="share-dialog__error" role="alert">
          {t(error)}
        </p>
      )}

      {guest.isLoading ? (
        <p className="share-dialog__empty">{t("common.loading")}</p>
      ) : guest.isError ? (
        <p className="share-dialog__error" role="alert">
          {t("guestLinks.listError")}
        </p>
      ) : (
        guest.links.length > 0 && (
          <ul className="guest-links__list">
            {guest.links.map((link) => (
              <GuestLinkCard
                key={link.id}
                link={link}
                enabled={enabled}
                busy={guest.busy}
                onRepublish={() => void run(() => guest.republish(link))}
                onExtend={(days) => void run(() => guest.extend(link.id, days))}
                onUnlock={() => void run(() => guest.unlock(link.id))}
                onEnd={() => void run(() => guest.end(link.id))}
              />
            ))}
          </ul>
        )
      )}
    </section>
  );
}
