import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { ApiError } from "../lib/api";
import { ShareTreeDialog } from "./ShareTreeDialog";

vi.mock("react-i18next", () => ({
  useTranslation: () => ({
    t: (k: string, opts?: Record<string, unknown>) =>
      opts?.email ? `${k}:${opts.email}` : opts?.name ? `${k}:${opts.name}` : k,
    i18n: { language: "nl" },
  }),
}));

const mockGetShares = vi.fn();
const mockCreateShare = vi.fn();
const mockDeleteShare = vi.fn();
const mockGetPublicKey = vi.fn();
vi.mock("../lib/api", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../lib/api")>()),
  getShares: (...a: unknown[]) => mockGetShares(...a),
  createShare: (...a: unknown[]) => mockCreateShare(...a),
  deleteShare: (...a: unknown[]) => mockDeleteShare(...a),
  getPublicKey: (...a: unknown[]) => mockGetPublicKey(...a),
  listGuestLinks: () => Promise.resolve([]),
}));

const mockImportKey = vi.fn();
const mockWrap = vi.fn();
vi.mock("../lib/crypto", () => ({
  importSharePublicKey: (...a: unknown[]) => mockImportKey(...a),
  wrapTreeKey: (...a: unknown[]) => mockWrap(...a),
}));

vi.mock("../contexts/useEncryption", () => ({
  useEncryption: () => ({
    keyRingBase64: new Map([["tree-1", "own-tree-key"]]),
    treeKeys: new Map(),
  }),
}));

function renderDialog() {
  HTMLDialogElement.prototype.showModal = vi.fn(function (this: HTMLDialogElement) {
    this.setAttribute("open", "");
  });
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={client}>
      <ShareTreeDialog
        treeId="tree-1"
        treeName="Mother's side"
        accountSharing
        guestLinks={false}
        onClose={vi.fn()}
      />
    </QueryClientProvider>,
  );
}

async function submitEmail(email: string) {
  const user = userEvent.setup();
  await user.type(screen.getByLabelText("share.emailLabel"), email);
  await user.click(screen.getByRole("button", { name: "share.submit" }));
}

describe("ShareTreeDialog", () => {
  beforeEach(() => {
    mockGetShares.mockReset().mockResolvedValue([]);
    mockCreateShare.mockReset().mockResolvedValue({});
    mockDeleteShare.mockReset().mockResolvedValue(undefined);
    mockGetPublicKey.mockReset().mockResolvedValue({ public_key: "their-jwk" });
    mockImportKey.mockReset().mockResolvedValue("their-crypto-key");
    mockWrap.mockReset().mockResolvedValue("wrapped-key");
  });

  it("shares with a registered user using the wrapped key", async () => {
    renderDialog();
    await submitEmail("  Anna@Example.com ");

    await waitFor(() => expect(mockCreateShare).toHaveBeenCalled());
    expect(mockGetPublicKey).toHaveBeenCalledWith("anna@example.com");
    expect(mockWrap).toHaveBeenCalledWith("own-tree-key", "their-crypto-key");
    expect(mockCreateShare).toHaveBeenCalledWith("tree-1", {
      recipient_email: "anna@example.com",
      encrypted_tree_key: "wrapped-key",
      language: "nl",
    });
  });

  it("offers an invite for an unknown email and creates a pending share on confirm", async () => {
    mockGetPublicKey.mockRejectedValue(new ApiError(404, "Not Found"));
    renderDialog();
    await submitEmail("new@example.com");

    expect(await screen.findByText("share.inviteConfirm:new@example.com")).toBeInTheDocument();
    // Registration may be capacity gated: the owner is told before inviting.
    expect(screen.getByText("share.inviteWaitlistNote")).toBeInTheDocument();
    expect(mockCreateShare).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole("button", { name: "share.inviteSend" }));
    await waitFor(() => expect(mockCreateShare).toHaveBeenCalled());
    expect(mockCreateShare).toHaveBeenCalledWith("tree-1", {
      recipient_email: "new@example.com",
      language: "nl",
    });
    expect(mockWrap).not.toHaveBeenCalled();
  });

  it("says the list could not load instead of calling the tree unshared", async () => {
    mockGetShares.mockRejectedValue(new ApiError(500, "boom"));
    renderDialog();
    expect(await screen.findByText("share.listError")).toBeInTheDocument();
    expect(screen.queryByText("share.empty")).not.toBeInTheDocument();
  });

  it("shows the self-share message", async () => {
    mockCreateShare.mockRejectedValue(new ApiError(422, "cannot_share_with_self"));
    renderDialog();
    await submitEmail("me@example.com");
    expect(await screen.findByRole("alert")).toHaveTextContent("share.errorSelf");
  });

  it("shows the already-shared and pending-limit messages", async () => {
    mockCreateShare.mockRejectedValueOnce(new ApiError(409, "already_shared"));
    renderDialog();
    await submitEmail("a@example.com");
    expect(await screen.findByRole("alert")).toHaveTextContent("share.errorAlready");

    mockCreateShare.mockRejectedValueOnce(new ApiError(409, "pending_share_limit"));
    await userEvent.setup().click(screen.getByRole("button", { name: "share.submit" }));
    await waitFor(() =>
      expect(screen.getByRole("alert")).toHaveTextContent("share.errorPendingLimit"),
    );
  });

  it("labels pending shares as invited and active shares as can view", async () => {
    mockGetShares.mockResolvedValue([
      {
        id: "s1",
        tree_id: "tree-1",
        recipient_email: "anna@example.com",
        recipient_display_name: "Anna",
        status: "active",
        created_at: "",
      },
      {
        id: "s2",
        tree_id: "tree-1",
        recipient_email: "pending@example.com",
        recipient_display_name: "Should not show",
        status: "pending",
        created_at: "",
      },
    ]);
    renderDialog();
    expect(await screen.findByText("Anna")).toBeInTheDocument();
    expect(screen.getByText("share.statusActive")).toBeInTheDocument();
    expect(screen.getByText("pending@example.com")).toBeInTheDocument();
    expect(screen.getByText("share.statusPending")).toBeInTheDocument();
    expect(screen.queryByText("Should not show")).not.toBeInTheDocument();
  });

  it("removes a share after confirmation", async () => {
    mockGetShares.mockResolvedValue([
      {
        id: "s1",
        tree_id: "tree-1",
        recipient_email: "anna@example.com",
        recipient_display_name: null,
        status: "active",
        created_at: "",
      },
    ]);
    renderDialog();
    const user = userEvent.setup();
    await user.click(await screen.findByRole("button", { name: "share.removeAccess" }));
    expect(mockDeleteShare).not.toHaveBeenCalled();
    // Second button with the same label is the confirm action.
    await user.click(screen.getByRole("button", { name: "share.removeAccess" }));
    await waitFor(() => expect(mockDeleteShare).toHaveBeenCalledWith("tree-1", "s1"));
  });
});
