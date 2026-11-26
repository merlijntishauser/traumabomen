import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import i18next from "i18next";
import { I18nextProvider, initReactI18next } from "react-i18next";
import { beforeEach, describe, expect, it, vi } from "vitest";
import en from "../../public/locales/en/translation.json";
import { ApiError } from "../lib/api";
import { GuestCopyTooLargeError } from "../lib/publishGuestCopy";
import type { GuestLink } from "../types/api";
import { ShareTreeDialog } from "./ShareTreeDialog";

const api = vi.hoisted(() => ({
  listGuestLinks: vi.fn(),
  createGuestLink: vi.fn(),
  republishGuestLink: vi.fn(),
  extendGuestLink: vi.fn(),
  unlockGuestLink: vi.fn(),
  deleteGuestLink: vi.fn(),
  getShares: vi.fn(),
}));
vi.mock("../lib/api", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../lib/api")>()),
  ...api,
}));

const mockPublish = vi.fn();
vi.mock("../lib/publishGuestCopy", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../lib/publishGuestCopy")>()),
  publishGuestCopy: (...a: unknown[]) => mockPublish(...a),
}));

vi.mock("../lib/crypto", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../lib/crypto")>()),
  decryptFromApi: async (blob: string) => JSON.parse(blob),
  encryptForApi: async (data: unknown) => `sealed:${JSON.stringify(data)}`,
}));

vi.mock("../lib/passphraseWords", () => ({
  generatePassphrase: async () => "maple river quiet lantern stone",
}));

vi.mock("../contexts/useEncryption", () => ({
  useEncryption: () => ({
    treeKeys: new Map([["tree-1", {} as CryptoKey]]),
    keyRingBase64: new Map([["tree-1", "own-tree-key"]]),
  }),
}));

function entities(n: number, prefix: string) {
  return new Map(Array.from({ length: n }, (_, i) => [`${prefix}${i}`, { id: `${prefix}${i}` }]));
}
let mockTree = {
  treeName: "Mother's side",
  persons: entities(12, "p"),
  relationships: new Map(),
  events: entities(30, "e"),
  lifeEvents: entities(3, "l"),
  turningPoints: entities(1, "t"),
  classifications: new Map(),
  patterns: entities(3, "pt"),
  siblingGroups: new Map(),
  journalEntries: entities(2, "j"),
  isLoading: false,
};
vi.mock("../hooks/useTreeData", () => ({ useTreeData: () => mockTree }));

const SECRET = {
  linkSecret: "A".repeat(43),
  passphrase: "maple river quiet lantern stone",
  label: "Therapist",
};

function fixtureLink(overrides: Partial<GuestLink> = {}): GuestLink {
  return {
    id: "link-1",
    owner_blob: JSON.stringify(SECRET),
    created_at: "2026-11-25T10:00:00Z",
    published_at: "2026-11-25T10:00:00Z",
    expires_at: "2026-12-02T10:00:00Z",
    open_count: 3,
    last_opened_at: "2026-11-28T10:00:00Z",
    network_count: 2,
    failed_total: 1,
    locked: false,
    ...overrides,
  };
}

async function makeI18n() {
  const instance = i18next.createInstance();
  await instance.use(initReactI18next).init({
    lng: "en",
    resources: { en: { translation: en } },
    interpolation: { escapeValue: false },
  });
  return instance;
}

async function renderDialog({ guestLinks = true }: { guestLinks?: boolean } = {}) {
  HTMLDialogElement.prototype.showModal = vi.fn(function (this: HTMLDialogElement) {
    this.setAttribute("open", "");
  });
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const i18n = await makeI18n();
  const onClose = vi.fn();
  const ui = () => (
    <I18nextProvider i18n={i18n}>
      <QueryClientProvider client={client}>
        <ShareTreeDialog
          treeId="tree-1"
          treeName="Mother's side"
          accountSharing={false}
          guestLinks={guestLinks}
          onClose={onClose}
        />
      </QueryClientProvider>
    </I18nextProvider>
  );
  const view = render(ui());
  return { ...view, onClose, rerenderDialog: () => view.rerender(ui()) };
}

describe("GuestLinksSection", () => {
  beforeEach(() => {
    for (const fn of Object.values(api)) fn.mockReset();
    api.listGuestLinks.mockResolvedValue([]);
    api.createGuestLink.mockResolvedValue(fixtureLink());
    api.republishGuestLink.mockResolvedValue(fixtureLink());
    api.extendGuestLink.mockResolvedValue(fixtureLink());
    api.unlockGuestLink.mockResolvedValue(fixtureLink());
    api.deleteGuestLink.mockResolvedValue(undefined);
    mockPublish.mockReset().mockResolvedValue({
      linkId: "L".repeat(22),
      token: "T".repeat(43),
      ciphertext: "cipher",
    });
    mockTree = { ...mockTree, persons: entities(12, "p"), isLoading: false };
  });

  it("offers the create form with 7 days preselected and the summary line", async () => {
    await renderDialog();
    expect(await screen.findByRole("heading", { name: "Share by link" })).toBeInTheDocument();
    expect(screen.getByLabelText("For (only you see this)")).toBeInTheDocument();
    const lasts = screen.getByLabelText("Lasts") as HTMLSelectElement;
    expect(lasts.value).toBe("7");
    expect(Array.from(lasts.options).map((o) => o.value)).toEqual(["1", "7", "14", "30"]);
    expect(
      screen.getByText("12 people, 34 events, 3 patterns. Not your journal."),
    ).toBeInTheDocument();
    // Account sharing is off: no email form.
    expect(screen.queryByLabelText(/email address/i)).not.toBeInTheDocument();
    expect(api.getShares).not.toHaveBeenCalled();
  });

  it("creates a link with the label, the chosen days and the sealed owner blob", async () => {
    const user = userEvent.setup();
    await renderDialog();
    await user.type(await screen.findByLabelText("For (only you see this)"), "  Therapist ");
    await user.selectOptions(screen.getByLabelText("Lasts"), "14");
    await user.click(screen.getByRole("button", { name: "Create link" }));

    await waitFor(() => expect(api.createGuestLink).toHaveBeenCalled());
    const [treeId, body] = api.createGuestLink.mock.calls[0];
    expect(treeId).toBe("tree-1");
    expect(body).toMatchObject({
      link_id: "L".repeat(22),
      token: "T".repeat(43),
      ciphertext: "cipher",
      expires_in_days: 14,
    });
    const blob = JSON.parse(body.owner_blob.replace(/^sealed:/, ""));
    expect(blob.label).toBe("Therapist");
    expect(blob.passphrase).toBe("maple river quiet lantern stone");
    expect(blob.linkSecret).toMatch(/^[A-Za-z0-9_-]{43}$/);
    expect(mockPublish.mock.calls[0][0]).toMatchObject({
      treeId: "tree-1",
      linkSecret: blob.linkSecret,
      passphrase: blob.passphrase,
      language: "en",
    });
  });

  it.each([
    ["a copy over 5 MB", () => mockPublish.mockRejectedValue(new GuestCopyTooLargeError())],
    [
      "an API 413",
      () => api.createGuestLink.mockRejectedValue(new ApiError(413, "copy_too_large")),
    ],
  ])("shows the too-large message for %s", async (_name, arrange) => {
    arrange();
    const user = userEvent.setup();
    await renderDialog();
    await user.click(await screen.findByRole("button", { name: "Create link" }));
    expect(await screen.findByRole("alert")).toHaveTextContent(
      "This tree is too large to share by link. Nothing was published.",
    );
  });

  it("shows the limit message when the tree already has 5 links", async () => {
    api.createGuestLink.mockRejectedValue(new ApiError(409, "too_many_links"));
    const user = userEvent.setup();
    await renderDialog();
    await user.click(await screen.findByRole("button", { name: "Create link" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("at most 5 links");
  });

  it("renders every line of a link", async () => {
    api.listGuestLinks.mockResolvedValue([fixtureLink({ locked: true })]);
    const user = userEvent.setup();
    await renderDialog();
    const card = within(await screen.findByRole("listitem"));

    expect(card.getByText("Therapist")).toBeInTheDocument();
    expect(card.getByText(/^until December 2/)).toBeInTheDocument();
    const url = `${window.location.origin}/view#${SECRET.linkSecret}`;
    expect(card.getByText(url)).toBeInTheDocument();
    expect(card.getByText(SECRET.passphrase)).toBeInTheDocument();
    expect(card.getByText("Send these two separately.")).toBeInTheDocument();
    expect(card.getByText(/^Published November 25/)).toBeInTheDocument();
    expect(card.getByRole("button", { name: "Update what they see" })).toBeInTheDocument();
    expect(
      card.getByText("Opened 3 times, last on November 28, from 2 networks."),
    ).toBeInTheDocument();
    expect(card.getByText(/A network is not a person/)).toBeInTheDocument();
    expect(card.getByText("1 wrong passphrase.")).toBeInTheDocument();
    expect(card.getByText("Locked after too many wrong passphrases.")).toBeInTheDocument();
    expect(card.getByRole("button", { name: "Unlock" })).toBeInTheDocument();
    expect(card.getByRole("button", { name: "Extend" })).toBeInTheDocument();
    expect(card.getByRole("button", { name: "End link" })).toBeInTheDocument();
    // No combined copy: one button for the link, one for the passphrase.
    expect(card.getAllByRole("button", { name: /^Copy/ })).toHaveLength(2);

    await user.click(card.getByRole("button", { name: "Copy link" }));
    expect(await navigator.clipboard.readText()).toBe(url);
    await user.click(card.getByRole("button", { name: "Copy passphrase" }));
    expect(await navigator.clipboard.readText()).toBe(SECRET.passphrase);
  });

  it.each([
    [{ network_count: 100 }, "Opened 3 times, last on November 28, from 100 or more networks."],
    [{ network_count: null }, "Opened 3 times, last on November 28. Networks unavailable."],
    [{ open_count: 0, last_opened_at: null }, "Not opened yet."],
  ])("writes the usage line for %j", async (overrides, line) => {
    api.listGuestLinks.mockResolvedValue([fixtureLink(overrides)]);
    await renderDialog();
    expect(await screen.findByText(line)).toBeInTheDocument();
  });

  it("does not republish when the tree is edited, only on Update", async () => {
    api.listGuestLinks.mockResolvedValue([fixtureLink()]);
    const view = await renderDialog();
    await screen.findByRole("listitem");

    // The owner adds a person while the dialog is open.
    mockTree = { ...mockTree, persons: entities(13, "p") };
    view.rerenderDialog();
    expect(await screen.findByText(/^13 people/)).toBeInTheDocument();
    expect(mockPublish).not.toHaveBeenCalled();
    expect(api.republishGuestLink).not.toHaveBeenCalled();
  });

  it("republishes with the stored link secret and passphrase on Update", async () => {
    api.listGuestLinks.mockResolvedValue([fixtureLink()]);
    const user = userEvent.setup();
    await renderDialog();
    await user.click(await screen.findByRole("button", { name: "Update what they see" }));
    await waitFor(() =>
      expect(api.republishGuestLink).toHaveBeenCalledWith("tree-1", "link-1", "cipher"),
    );
    expect(mockPublish.mock.calls[0][0]).toMatchObject({
      linkSecret: SECRET.linkSecret,
      passphrase: SECRET.passphrase,
    });
  });

  it("extends by the chosen days and unlocks", async () => {
    api.listGuestLinks.mockResolvedValue([fixtureLink({ locked: true })]);
    const user = userEvent.setup();
    await renderDialog();
    const card = within(await screen.findByRole("listitem"));
    await user.selectOptions(card.getByLabelText("New end date, counted from today"), "30");
    await user.click(card.getByRole("button", { name: "Extend" }));
    await waitFor(() => expect(api.extendGuestLink).toHaveBeenCalledWith("tree-1", "link-1", 30));
    await user.click(card.getByRole("button", { name: "Unlock" }));
    await waitFor(() => expect(api.unlockGuestLink).toHaveBeenCalledWith("tree-1", "link-1"));
  });

  it("asks to confirm before ending, saying it cannot undo what was seen", async () => {
    api.listGuestLinks.mockResolvedValue([fixtureLink()]);
    const user = userEvent.setup();
    await renderDialog();
    const card = within(await screen.findByRole("listitem"));
    await user.click(card.getByRole("button", { name: "End link" }));
    expect(api.deleteGuestLink).not.toHaveBeenCalled();
    expect(card.getByText(/cannot undo what they have already seen/)).toBeInTheDocument();
    await user.click(card.getByRole("button", { name: "End link" }));
    await waitFor(() => expect(api.deleteGuestLink).toHaveBeenCalledWith("tree-1", "link-1"));
  });

  it("is hidden with the flag off and no links", async () => {
    await renderDialog({ guestLinks: false });
    await waitFor(() => expect(api.listGuestLinks).toHaveBeenCalled());
    expect(screen.queryByRole("heading", { name: "Share by link" })).not.toBeInTheDocument();
  });

  it("with the flag off, lists existing links with End only", async () => {
    api.listGuestLinks.mockResolvedValue([fixtureLink({ locked: true })]);
    await renderDialog({ guestLinks: false });
    const card = within(await screen.findByRole("listitem"));
    expect(screen.queryByRole("button", { name: "Create link" })).not.toBeInTheDocument();
    expect(screen.queryByLabelText("For (only you see this)")).not.toBeInTheDocument();
    expect(card.queryByRole("button", { name: "Update what they see" })).not.toBeInTheDocument();
    expect(card.queryByRole("button", { name: "Extend" })).not.toBeInTheDocument();
    expect(card.queryByRole("button", { name: "Unlock" })).not.toBeInTheDocument();
    expect(card.getByRole("button", { name: "End link" })).toBeInTheDocument();
    // The link no longer opens: nothing to hand out.
    expect(card.queryByRole("button", { name: /^Copy/ })).not.toBeInTheDocument();
    expect(card.queryByText(SECRET.passphrase)).not.toBeInTheDocument();
    expect(card.queryByText(/\/view#/)).not.toBeInTheDocument();
    expect(card.queryByText("Send these two separately.")).not.toBeInTheDocument();
    // The listing stays: label, dates and usage.
    expect(card.getByText("Therapist")).toBeInTheDocument();
    expect(card.getByText(/^until /)).toBeInTheDocument();
    expect(card.getByText(/^Published /)).toBeInTheDocument();
    expect(card.getByText(/^Opened 3 times/)).toBeInTheDocument();
  });

  it("will not close while a guest link action is in flight", async () => {
    api.listGuestLinks.mockResolvedValue([fixtureLink()]);
    let finish: (value: unknown) => void = () => {};
    mockPublish.mockReturnValue(
      new Promise((resolve) => {
        finish = resolve;
      }),
    );
    const user = userEvent.setup();
    const view = await renderDialog();
    await user.click(await screen.findByRole("button", { name: "Update what they see" }));
    await user.click(screen.getByRole("button", { name: "Close" }));
    expect(view.onClose).not.toHaveBeenCalled();

    finish({ linkId: "L".repeat(22), token: "T".repeat(43), ciphertext: "cipher" });
    await waitFor(() => expect(api.republishGuestLink).toHaveBeenCalled());
    await waitFor(() =>
      expect(screen.getByRole("button", { name: "Update what they see" })).toBeEnabled(),
    );
    await user.click(screen.getByRole("button", { name: "Close" }));
    expect(view.onClose).toHaveBeenCalled();
  });

  it("still offers End for a link whose details cannot be read", async () => {
    api.listGuestLinks.mockResolvedValue([fixtureLink({ owner_blob: "not json" })]);
    await renderDialog();
    const card = within(await screen.findByRole("listitem"));
    expect(card.getByText(/could not be read/)).toBeInTheDocument();
    expect(card.queryByRole("button", { name: "Update what they see" })).not.toBeInTheDocument();
    expect(card.getByRole("button", { name: "End link" })).toBeInTheDocument();
  });
});
