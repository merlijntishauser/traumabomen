import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { type GuestTreeState, guestCopyToState, parseGuestCopy } from "../lib/guestCopy";
import { decryptGuestCopy, deriveGuestKeys, parseLinkSecret } from "../lib/guestCrypto";
import { openGuestLink } from "./guestApi";

/** Drop the secret and the copy after this long without pointer, key or scroll activity. */
export const GUEST_IDLE_MS = 15 * 60 * 1000;

const ACTIVITY_EVENTS = ["pointerdown", "pointermove", "keydown", "wheel", "touchstart"] as const;

export type GuestPageState =
  | { kind: "no_link" }
  | { kind: "malformed_link" }
  /** `error`: the last attempt failed for a reason the guest cannot act on; try again. */
  | { kind: "ready"; error?: boolean }
  | { kind: "opening" }
  | { kind: "wrong_passphrase" }
  | { kind: "locked" }
  | { kind: "not_available" }
  | { kind: "rate_limited" }
  | { kind: "offline" }
  | { kind: "undecryptable" }
  | { kind: "open"; tree: GuestTreeState; publishedAt: string }
  | { kind: "ended_idle" };

/** States after which the link is of no further use on this page. */
const TERMINAL = new Set<GuestPageState["kind"]>([
  "no_link",
  "malformed_link",
  "locked",
  "not_available",
  "undecryptable",
  "ended_idle",
]);

/**
 * The guest page's session: the link secret from the URL fragment (cleared
 * from the address bar at once and kept in a ref only), the passphrase check,
 * and the decrypted copy. Everything is dropped on pagehide and after
 * GUEST_IDLE_MS without activity. Nothing is written to any storage.
 */
export function useGuestSession(): {
  state: GuestPageState;
  open(passphrase: string): Promise<void>;
} {
  const { i18n } = useTranslation();
  const [state, setState] = useState<GuestPageState>({ kind: "ready" });
  const secretRef = useRef<string | null>(null);
  const fragmentReadRef = useRef(false);
  // Bumped whenever the session is dropped, so an open still in flight is discarded.
  const generationRef = useRef(0);

  // A layout effect so the first paint already shows the right state. The ref
  // guard keeps StrictMode's second run from reading the now empty fragment.
  useLayoutEffect(() => {
    if (fragmentReadRef.current) return;
    fragmentReadRef.current = true;
    const fragment = window.location.hash;
    window.history.replaceState(null, "", "/view");
    if (fragment.replace(/^#/, "") === "") {
      setState({ kind: "no_link" });
      return;
    }
    try {
      secretRef.current = parseLinkSecret(fragment);
    } catch {
      setState({ kind: "malformed_link" });
    }
  }, []);

  const terminal = TERMINAL.has(state.kind);

  useEffect(() => {
    if (terminal) return;
    const end = () => {
      generationRef.current++;
      secretRef.current = null;
      setState({ kind: "ended_idle" });
    };
    let timer = setTimeout(end, GUEST_IDLE_MS);
    const onActivity = () => {
      clearTimeout(timer);
      timer = setTimeout(end, GUEST_IDLE_MS);
    };
    const listenerOptions = { capture: true, passive: true };
    for (const type of ACTIVITY_EVENTS) window.addEventListener(type, onActivity, listenerOptions);
    // Scroll does not bubble; capture catches it on any scrolling element.
    window.addEventListener("scroll", onActivity, listenerOptions);
    window.addEventListener("pagehide", end);
    return () => {
      clearTimeout(timer);
      for (const type of ACTIVITY_EVENTS) {
        window.removeEventListener(type, onActivity, listenerOptions);
      }
      window.removeEventListener("scroll", onActivity, listenerOptions);
      window.removeEventListener("pagehide", end);
    };
  }, [terminal]);

  const open = useCallback(
    async (passphrase: string) => {
      const secret = secretRef.current;
      if (!secret) return;
      const generation = ++generationRef.current;
      const current = () => generation === generationRef.current;
      const finish = (next: GuestPageState, language?: string) => {
        if (!current()) return;
        if (TERMINAL.has(next.kind)) secretRef.current = null;
        if (language) void i18n.changeLanguage(language);
        setState(next);
      };
      setState({ kind: "opening" });

      let keys: Awaited<ReturnType<typeof deriveGuestKeys>>;
      try {
        keys = await deriveGuestKeys(secret, passphrase);
      } catch {
        finish({ kind: "ready", error: true });
        return;
      }
      if (!current()) return;

      const result = await openGuestLink(keys.linkId, keys.token);
      if (result.kind === "error") {
        finish({ kind: "ready", error: true });
        return;
      }
      if (result.kind !== "ok") {
        finish({ kind: result.kind });
        return;
      }

      try {
        const json = await decryptGuestCopy(result.ciphertext, keys.encKey, keys.linkId);
        const copy = parseGuestCopy(JSON.parse(json));
        const tree = guestCopyToState(copy);
        finish({ kind: "open", tree, publishedAt: copy.publishedAt }, copy.language);
      } catch {
        // Nothing of a copy that fails to decrypt or validate is rendered.
        finish({ kind: "undecryptable" });
      }
    },
    [i18n],
  );

  return { state, open };
}
