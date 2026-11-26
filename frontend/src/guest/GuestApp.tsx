import { type FormEvent, lazy, Suspense, useId, useState } from "react";
import { useTranslation } from "react-i18next";
import { type GuestPageState, useGuestSession } from "./useGuestSession";
import "./GuestApp.css";

const GuestTreeView = lazy(() =>
  import("./GuestTreeView").then((module) => ({ default: module.GuestTreeView })),
);

/** The message for each state that ends the page: no passphrase field. */
const END_MESSAGES: Partial<Record<GuestPageState["kind"], string>> = {
  no_link: "guest.state.noLink",
  malformed_link: "guest.state.malformedLink",
  locked: "guest.state.locked",
  not_available: "guest.state.notAvailable",
  undecryptable: "guest.state.undecryptable",
  ended_idle: "guest.state.endedIdle",
};

/** The message shown above the passphrase field after a failed attempt. */
function retryMessage(state: GuestPageState): string | null {
  switch (state.kind) {
    case "wrong_passphrase":
      return "guest.state.wrongPassphrase";
    case "rate_limited":
      return "guest.state.rateLimited";
    case "offline":
      return "guest.state.offline";
    case "ready":
      return state.error ? "guest.state.error" : null;
    default:
      return null;
  }
}

function PassphraseForm({
  state,
  onOpen,
}: {
  state: GuestPageState;
  onOpen: (passphrase: string) => void;
}) {
  const { t } = useTranslation();
  const inputId = useId();
  const [passphrase, setPassphrase] = useState("");
  const opening = state.kind === "opening";
  const message = retryMessage(state);

  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (opening || passphrase.trim() === "") return;
    onOpen(passphrase);
  };

  return (
    <form className="guest-app__form" onSubmit={submit} noValidate>
      <label className="guest-app__label" htmlFor={inputId}>
        {t("guest.open.passphrase")}
      </label>
      <input
        id={inputId}
        className="guest-app__input"
        type="text"
        name="guest-passphrase"
        value={passphrase}
        onChange={(event) => setPassphrase(event.target.value)}
        autoComplete="off"
        spellCheck={false}
        autoCapitalize="none"
        autoCorrect="off"
        disabled={opening}
        aria-describedby={message ? `${inputId}-message` : undefined}
      />
      {message && (
        <p id={`${inputId}-message`} className="guest-app__error" role="alert">
          {t(message)}
        </p>
      )}
      {opening && (
        <p className="guest-app__status" role="status">
          {t("guest.open.opening")}
        </p>
      )}
      <button className="guest-app__submit" type="submit" disabled={opening}>
        {t("guest.open.submit")}
      </button>
    </form>
  );
}

/** The guest page: the passphrase screen, its outcomes, then the read-only copy. */
export function GuestApp() {
  const { t } = useTranslation();
  const { state, open } = useGuestSession();

  if (state.kind === "open") {
    return (
      <Suspense fallback={<p className="guest-loading">{t("common.loading")}</p>}>
        <GuestTreeView state={state.tree} publishedAt={state.publishedAt} />
      </Suspense>
    );
  }

  const endMessage = END_MESSAGES[state.kind];
  return (
    <main className="guest-app">
      <section className="guest-app__card" aria-labelledby="guest-app-title">
        <h1 id="guest-app-title" className="guest-app__title">
          {t("guest.open.title")}
        </h1>
        {endMessage ? (
          <p className="guest-app__message" role="alert">
            {t(endMessage)}
          </p>
        ) : (
          <>
            <p className="guest-app__text">{t("guest.open.intro")}</p>
            <p className="guest-app__notice">{t("guest.open.usageNotice")}</p>
            <PassphraseForm state={state} onOpen={(passphrase) => void open(passphrase)} />
          </>
        )}
      </section>
    </main>
  );
}
