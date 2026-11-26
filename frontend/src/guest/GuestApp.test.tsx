import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { buildDemoState } from "../lib/buildDemoState";
import type { DemoFixture } from "../lib/createDemoTree";
import { GuestApp } from "./GuestApp";
import type { GuestPageState } from "./useGuestSession";
import { useGuestSession } from "./useGuestSession";

vi.mock("react-i18next", () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));

vi.mock("./useGuestSession", () => ({ useGuestSession: vi.fn() }));

vi.mock("./GuestTreeView", () => ({
  GuestTreeView: ({ publishedAt }: { publishedAt: string }) => (
    <div data-testid="guest-tree-view">{publishedAt}</div>
  ),
}));

const mockSession = vi.mocked(useGuestSession);
const open = vi.fn(async () => {});

function renderIn(state: GuestPageState) {
  mockSession.mockReturnValue({ state, open });
  return render(<GuestApp />);
}

beforeEach(() => {
  open.mockClear();
});

describe("GuestApp: the passphrase screen", () => {
  it("explains the page, shows the usage notice and a plain passphrase field", () => {
    renderIn({ kind: "ready" });
    expect(screen.getByText("guest.open.intro")).toBeInTheDocument();
    expect(screen.getByText("guest.open.usageNotice")).toBeInTheDocument();
    const input = screen.getByLabelText("guest.open.passphrase");
    expect(input).toHaveAttribute("autocomplete", "off");
    expect(input).toHaveAttribute("spellcheck", "false");
    expect(input).toHaveAttribute("autocapitalize", "none");
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });

  it("opens with the typed passphrase", () => {
    renderIn({ kind: "ready" });
    fireEvent.change(screen.getByLabelText("guest.open.passphrase"), {
      target: { value: "anchor ladle meadow pebble violin" },
    });
    fireEvent.click(screen.getByRole("button", { name: "guest.open.submit" }));
    expect(open).toHaveBeenCalledWith("anchor ladle meadow pebble violin");
  });

  it("does not open with an empty passphrase", () => {
    renderIn({ kind: "ready" });
    fireEvent.click(screen.getByRole("button", { name: "guest.open.submit" }));
    expect(open).not.toHaveBeenCalled();
  });

  it("shows progress and disables the form while opening", () => {
    renderIn({ kind: "opening" });
    expect(screen.getByRole("status")).toHaveTextContent("guest.open.opening");
    expect(screen.getByLabelText("guest.open.passphrase")).toBeDisabled();
    expect(screen.getByRole("button", { name: "guest.open.submit" })).toBeDisabled();
  });

  it.each([
    [{ kind: "wrong_passphrase" }, "guest.state.wrongPassphrase"],
    [{ kind: "rate_limited" }, "guest.state.rateLimited"],
    [{ kind: "offline" }, "guest.state.offline"],
    [{ kind: "ready", error: true }, "guest.state.error"],
  ] as [GuestPageState, string][])("keeps the field for %o and says %s", (state, message) => {
    renderIn(state);
    expect(screen.getByRole("alert")).toHaveTextContent(message);
    expect(screen.getByLabelText("guest.open.passphrase")).toBeEnabled();
  });
});

describe("GuestApp: states that end the page", () => {
  it.each([
    ["no_link", "guest.state.noLink"],
    ["malformed_link", "guest.state.malformedLink"],
    ["locked", "guest.state.locked"],
    ["not_available", "guest.state.notAvailable"],
    ["undecryptable", "guest.state.undecryptable"],
    ["ended_idle", "guest.state.endedIdle"],
  ] as const)("%s says %s and asks for no passphrase", (kind, message) => {
    renderIn({ kind });
    expect(screen.getByRole("alert")).toHaveTextContent(message);
    expect(screen.queryByLabelText("guest.open.passphrase")).not.toBeInTheDocument();
    expect(screen.queryByTestId("guest-tree-view")).not.toBeInTheDocument();
  });
});

describe("GuestApp: an open copy", () => {
  it("shows the read-only view of the copy", async () => {
    const tree = buildDemoState({
      treeName: "The Vermeers",
      persons: [],
      relationships: [],
      events: [],
      lifeEvents: [],
      turningPoints: [],
      classifications: [],
      patterns: [],
      siblingGroups: [],
    } as unknown as DemoFixture);
    renderIn({ kind: "open", tree, publishedAt: "2026-11-20T10:00:00.000Z" });
    expect(await screen.findByTestId("guest-tree-view")).toHaveTextContent(
      "2026-11-20T10:00:00.000Z",
    );
    expect(screen.queryByLabelText("guest.open.passphrase")).not.toBeInTheDocument();
  });
});
