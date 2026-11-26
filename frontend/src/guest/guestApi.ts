// Plain fetch on purpose: the guest page must not pull in lib/api (tokens,
// Sentry hooks, retries). Same origin only, no credentials, no referrer.

export type GuestOpenResult =
  | { kind: "ok"; ciphertext: string }
  | {
      kind: "not_available" | "locked" | "wrong_passphrase" | "rate_limited" | "offline" | "error";
    };

const STATUS_KIND: Record<
  number,
  "not_available" | "locked" | "wrong_passphrase" | "rate_limited"
> = {
  404: "not_available",
  423: "locked",
  401: "wrong_passphrase",
  429: "rate_limited",
};

export async function openGuestLink(linkId: string, token: string): Promise<GuestOpenResult> {
  let response: Response;
  try {
    response = await fetch("/api/guest/open", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ link_id: linkId, token }),
      credentials: "omit",
      cache: "no-store",
      referrerPolicy: "no-referrer",
    });
  } catch {
    return { kind: "offline" };
  }
  if (response.status === 200) {
    try {
      const body = (await response.json()) as { ciphertext?: unknown };
      if (typeof body.ciphertext === "string") return { kind: "ok", ciphertext: body.ciphertext };
    } catch {
      // fall through to error
    }
    return { kind: "error" };
  }
  return { kind: STATUS_KIND[response.status] ?? "error" };
}
