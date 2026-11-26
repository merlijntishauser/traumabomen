import { test, expect, type Browser, type Locator, type Page } from "@playwright/test";
import { register, createTree, uniqueEmail, TEST_PASSPHRASE } from "./helpers/auth";

const API_URL = process.env.E2E_API_URL || "http://localhost:8000";
const TREE = "Guest Family";
const OPEN_PATH = "/api/guest/open";

async function setGuestLinksFlag(audience: "all" | "disabled"): Promise<void> {
  const response = await fetch(`${API_URL}/test/feature-flag`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ key: "guest_links", audience }),
  });
  if (!response.ok) throw new Error(`Setting the flag failed: ${response.status}`);
}

/** The journey opens a link more often than one rate-limit window allows twice in a row. */
async function resetGuestOpenLimit(): Promise<void> {
  const response = await fetch(`${API_URL}/test/guest-open-limit-reset`, { method: "POST" });
  if (!response.ok) throw new Error(`Resetting the guest-open limit failed: ${response.status}`);
}

/** No storage at all on the guest origin: a fresh context starts empty, so any entry is new. */
async function expectNoGuestStorage(guest: Page): Promise<void> {
  expect(await guest.evaluate(() => Object.keys(localStorage))).toEqual([]);
  expect(await guest.evaluate(() => Object.keys(sessionStorage))).toEqual([]);
  expect(await guest.evaluate(async () => indexedDB.databases())).toEqual([]);
  expect(await guest.context().cookies()).toEqual([]);
}

function base64urlDecode(value: string): Uint8Array {
  const base64 = value.replace(/-/g, "+").replace(/_/g, "/");
  return Uint8Array.from(Buffer.from(base64, "base64"));
}

/** The link id the server knows a link by: HKDF-SHA256(linkSecret, "traumabomen/guest/v1/id", 16). */
async function linkIdOf(linkUrl: string): Promise<string> {
  const secret = base64urlDecode(new URL(linkUrl).hash.slice(1));
  const key = await crypto.subtle.importKey("raw", secret, "HKDF", false, ["deriveBits"]);
  const bits = await crypto.subtle.deriveBits(
    {
      name: "HKDF",
      hash: "SHA-256",
      salt: new Uint8Array(0),
      info: new TextEncoder().encode("traumabomen/guest/v1/id"),
    },
    key,
    128,
  );
  return Buffer.from(bits).toString("base64url");
}

async function expireLink(linkUrl: string): Promise<void> {
  const response = await fetch(`${API_URL}/test/guest-link-expire`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ link_id: await linkIdOf(linkUrl) }),
  });
  if (!response.ok) throw new Error(`Expiring the link failed: ${response.status}`);
}

/** A reload drops the in-memory key, so the unlock prompt appears again. */
async function unlockIfPrompted(page: Page): Promise<void> {
  const field = page.getByLabel(/^encryption key$/i);
  const prompted = await field
    .waitFor({ state: "visible", timeout: 8_000 })
    .then(() => true)
    .catch(() => false);
  if (prompted) {
    await field.fill(TEST_PASSPHRASE);
    await page.getByRole("button", { name: /^unlock$/i }).click();
    await field.waitFor({ state: "hidden", timeout: 30_000 });
  }
}

/** In-app navigation, so the key stays in memory (a full page load would lock). */
async function backToTrees(page: Page): Promise<void> {
  await page.getByRole("link", { name: "My trees" }).click();
  await page.waitForURL("**/trees");
}

async function openShareDialog(page: Page): Promise<Locator> {
  await page.getByRole("button", { name: `Options for ${TREE}` }).click();
  await page.getByRole("menuitem", { name: "Share", exact: true }).click();
  const dialog = page.getByRole("dialog", { name: `Share ${TREE}` });
  await expect(dialog).toBeVisible();
  await expect(dialog.getByRole("heading", { name: "Share by link" })).toBeVisible();
  return dialog;
}

async function closeDialog(dialog: Locator): Promise<void> {
  await dialog.getByRole("button", { name: "Close" }).click();
  await expect(dialog).toBeHidden();
}

/** Wait for the owner's request to the guest-links API that an action sends. */
function guestLinkResponse(page: Page, method: string) {
  return page.waitForResponse(
    (response) =>
      /\/api\/trees\/[^/]+\/guest-links/.test(new URL(response.url()).pathname) &&
      response.request().method() === method,
    { timeout: 60_000 },
  );
}

/** Create a link with the default 7 days and read its link and passphrase off the card. */
async function createLink(page: Page, dialog: Locator, label: string) {
  await dialog.getByLabel("For (only you see this)").fill(label);
  await expect(dialog.getByLabel("Lasts")).toHaveValue("7");
  const created = guestLinkResponse(page, "POST");
  await dialog.getByRole("button", { name: "Create link" }).click();
  expect((await created).status()).toBe(201);
  const card = dialog.locator(".guest-link").filter({ hasText: label });
  await expect(card).toBeVisible({ timeout: 15_000 });
  const secrets = card.locator(".guest-link__secret-value");
  const linkUrl = (await secrets.nth(0).textContent())?.trim() ?? "";
  const passphrase = (await secrets.nth(1).textContent())?.trim() ?? "";
  expect(linkUrl).toMatch(/\/view#[A-Za-z0-9_-]{43}$/);
  expect(passphrase.split(" ")).toHaveLength(5);
  return { card, linkUrl, passphrase };
}

/** Load the link as sent: a fresh document, so the page reads the fragment again. */
async function loadLink(guest: Page, linkUrl: string): Promise<void> {
  await guest.goto("about:blank");
  await guest.goto(linkUrl);
  await expect(guest.getByRole("heading", { name: "A family tree shared with you" })).toBeVisible();
}

async function submitPassphrase(guest: Page, passphrase: string): Promise<number> {
  await guest.getByLabel("Passphrase").fill(passphrase);
  const opened = guest.waitForResponse((r) => new URL(r.url()).pathname === OPEN_PATH, {
    timeout: 30_000,
  });
  await guest.getByRole("button", { name: "Open", exact: true }).click();
  return (await opened).status();
}

/**
 * Same-origin paths only the Vite dev server serves (modules, the HMR client,
 * imported translation JSON, argon2 from public/). The production guest build
 * puts all of them under /view-assets/, which scripts/test-nginx-guest.sh checks.
 */
const DEV_SERVER_PATHS =
  /^\/(@vite\/|@react-refresh$|@id\/|@fs\/|src\/|node_modules\/|public\/locales\/|argon2-bundled\.min\.js$)/;

function isGuestPath(pathname: string): boolean {
  return pathname === "/view" || pathname.startsWith("/view-assets/") || pathname === OPEN_PATH;
}

async function newGuestPage(browser: Browser, baseURL: string | undefined) {
  const context = await browser.newContext({ baseURL });
  const requests: string[] = [];
  const sockets: string[] = [];
  context.on("request", (request) => requests.push(request.url()));
  const page = await context.newPage();
  page.on("websocket", (socket) => sockets.push(socket.url()));
  return { page, requests, sockets };
}

test.describe("Guest links", () => {
  test.beforeAll(async () => {
    await setGuestLinksFlag("all");
  });

  test.beforeEach(async () => {
    await resetGuestOpenLimit();
  });

  test.afterAll(async () => {
    await setGuestLinksFlag("disabled");
  });

  test("owner shares a tree by link; a guest opens it with the passphrase", async ({
    browser,
    baseURL,
  }) => {
    // One long journey: sixteen guest opens, each running Argon2id (64 MiB) in the browser.
    test.setTimeout(180_000);
    const ownerContext = await browser.newContext({ baseURL });
    const owner = await ownerContext.newPage();
    const { page: guest, requests, sockets } = await newGuestPage(browser, baseURL);

    // The owner builds a tree with one person.
    await register(owner, uniqueEmail());
    await createTree(owner, TREE);
    await owner.getByLabel("Add person").click();
    const panel = owner.locator(".detail-panel");
    await panel.getByLabel("Name", { exact: true }).fill("Alice");
    await panel.getByLabel("Birth year", { exact: true }).fill("1960");
    await panel.getByLabel("Birth year", { exact: true }).blur();
    await expect(owner.locator(".react-flow__node").filter({ hasText: "Alice" })).toBeAttached({
      timeout: 10_000,
    });
    await owner.keyboard.press("Escape");

    // The owner creates a link and reads the link and passphrase from the dialog.
    await backToTrees(owner);
    let dialog = await openShareDialog(owner);
    const first = await createLink(owner, dialog, "Therapist");
    expect(new URL(first.linkUrl).origin).toBe(new URL(owner.url()).origin);
    await expect(first.card.getByText("Not opened yet.")).toBeVisible();
    await closeDialog(dialog);

    // A guest without an account opens the link: the fragment leaves the address bar at once.
    await loadLink(guest, first.linkUrl);
    expect(await guest.evaluate(() => location.hash)).toBe("");
    expect(new URL(guest.url()).pathname).toBe("/view");
    // Typed with other capitalisation: the passphrase is normalised before deriving.
    expect(await submitPassphrase(guest, first.passphrase.toUpperCase())).toBe(200);
    await expect(guest.getByRole("heading", { name: TREE })).toBeVisible({ timeout: 15_000 });
    await expect(guest.locator(".react-flow__node").filter({ hasText: "Alice" })).toBeAttached();
    await guest.getByRole("tab", { name: "Timeline" }).click();
    await expect(guest.getByRole("tab", { name: "Timeline" })).toHaveAttribute("aria-selected", "true");
    await expect(guest.getByRole("tabpanel").getByText("Alice").first()).toBeVisible();
    await guest.getByRole("tab", { name: "Patterns" }).click();
    await expect(guest.getByRole("tab", { name: "Patterns" })).toHaveAttribute("aria-selected", "true");
    expect(await guest.evaluate(() => location.hash)).toBe("");
    await expectNoGuestStorage(guest);

    // The owner renames the person and publishes again.
    await owner.getByRole("link", { name: /^open tree$/i }).click();
    await owner.waitForURL("**/trees/*");
    await owner.locator(".react-flow__node").filter({ hasText: "Alice" }).click();
    await expect(panel).toBeVisible();
    // The person fields fold away under Details on the person page.
    await panel.getByText("Details", { exact: true }).click();
    await panel.getByLabel("Name", { exact: true }).fill("Alicia");
    await panel.getByLabel("Name", { exact: true }).blur();
    await expect(owner.locator(".react-flow__node").filter({ hasText: "Alicia" })).toBeAttached({
      timeout: 10_000,
    });
    await owner.keyboard.press("Escape");
    await backToTrees(owner);
    dialog = await openShareDialog(owner);
    const republished = guestLinkResponse(owner, "PUT");
    await dialog.getByRole("button", { name: "Update what they see" }).click();
    expect((await republished).status()).toBe(200);
    await closeDialog(dialog);

    // The guest opens the original link again and sees the new name.
    await loadLink(guest, first.linkUrl);
    expect(await submitPassphrase(guest, first.passphrase)).toBe(200);
    await expect(guest.locator(".react-flow__node").filter({ hasText: "Alicia" })).toBeAttached({
      timeout: 15_000,
    });
    expect(await guest.evaluate(() => location.hash)).toBe("");
    await expectNoGuestStorage(guest);

    // The owner sees two opens; the dev proxy secret is unset, so networks are unavailable.
    dialog = await openShareDialog(owner);
    await expect(dialog.getByText(/^Opened 2 times, last on .+\. Networks unavailable\.$/)).toBeVisible({
      timeout: 15_000,
    });
    await closeDialog(dialog);

    // Ten wrong passphrases lock the link; the right one is then refused too.
    await loadLink(guest, first.linkUrl);
    for (let attempt = 1; attempt <= 10; attempt++) {
      expect(await submitPassphrase(guest, `wrong words for attempt ${attempt}`)).toBe(401);
      await expect(
        guest.getByText("That passphrase does not open this tree. Check it and try again."),
      ).toBeVisible();
    }
    expect(await submitPassphrase(guest, first.passphrase)).toBe(423);
    await expect(
      guest.getByText(
        "This link is locked after too many wrong passphrases. The person who shared this can unlock it.",
      ),
    ).toBeVisible();
    // Locked ends the page: the secret is gone, so there is no field to try again in.
    await expect(guest.getByLabel("Passphrase")).toHaveCount(0);

    dialog = await openShareDialog(owner);
    const card = dialog.locator(".guest-link").filter({ hasText: "Therapist" });
    await expect(card.getByText("Locked after too many wrong passphrases.")).toBeVisible({
      timeout: 15_000,
    });
    await expect(card.getByText("10 wrong passphrases.")).toBeVisible();
    const unlocked = guestLinkResponse(owner, "POST");
    await card.getByRole("button", { name: "Unlock" }).click();
    expect((await unlocked).status()).toBeLessThan(300);
    await expect(card.getByText("Locked after too many wrong passphrases.")).toHaveCount(0, {
      timeout: 15_000,
    });

    await loadLink(guest, first.linkUrl);
    expect(await submitPassphrase(guest, first.passphrase)).toBe(200);
    await expect(guest.locator(".react-flow__node").filter({ hasText: "Alicia" })).toBeAttached({
      timeout: 15_000,
    });

    // The owner extends the link to 30 days from today.
    const until = card.locator(".guest-link__until");
    const before = (await until.textContent()) ?? "";
    await card.getByLabel("New end date, counted from today").selectOption("30");
    const extended = guestLinkResponse(owner, "PUT");
    await card.getByRole("button", { name: "Extend" }).click();
    expect((await extended).status()).toBe(200);
    await expect(until).not.toHaveText(before, { timeout: 15_000 });

    // The owner ends the link; the guest's next open finds nothing.
    await card.getByRole("button", { name: "End link" }).click();
    await expect(card.getByText(/^End this link\?/)).toBeVisible();
    const ended = guestLinkResponse(owner, "DELETE");
    await card.getByRole("button", { name: "End link" }).click();
    expect((await ended).status()).toBeLessThan(300);
    await expect(card).toHaveCount(0, { timeout: 15_000 });

    await loadLink(guest, first.linkUrl);
    expect(await submitPassphrase(guest, first.passphrase)).toBe(404);
    await expect(
      guest.getByText("This tree is not available. The link may have expired or been ended."),
    ).toBeVisible();

    // An expired link gives the same answer.
    const second = await createLink(owner, dialog, "Cousin");
    await closeDialog(dialog);
    await expireLink(second.linkUrl);
    await loadLink(guest, second.linkUrl);
    expect(await submitPassphrase(guest, second.passphrase)).toBe(404);
    await expect(
      guest.getByText("This tree is not available. The link may have expired or been ended."),
    ).toBeVisible();

    // Every request the guest made stayed on this origin, on the guest paths.
    const origin = new URL(first.linkUrl).origin;
    const strays = requests.filter((url) => {
      if (url === "about:blank") return false;
      const parsed = new URL(url);
      if (parsed.origin !== origin) return true;
      return !isGuestPath(parsed.pathname) && !DEV_SERVER_PATHS.test(parsed.pathname);
    });
    expect(strays).toEqual([]);
    expect(requests.filter((url) => url.includes("/api/") && new URL(url).pathname !== OPEN_PATH)).toEqual([]);
    for (const socket of sockets) expect(new URL(socket).host).toBe(new URL(origin).host);

    await ownerContext.close();
    await guest.context().close();
  });
});
