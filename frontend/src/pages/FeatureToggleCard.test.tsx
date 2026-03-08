import { act, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  FeatureToggleCard,
  FeatureTogglesSection,
} from "../components/admin/FeatureTogglesSection";
import type { AdminFeatureFlag, UserRow } from "../types/api";

vi.mock("react-i18next", () => ({
  useTranslation: () => ({
    t: (k: string) => k,
  }),
}));

const makeFlag = (overrides: Partial<AdminFeatureFlag> = {}): AdminFeatureFlag => ({
  key: "watercolor_theme",
  audience: "selected",
  selected_user_ids: [],
  ...overrides,
});

const makeUsers = (): UserRow[] => [
  {
    id: "user-1",
    email: "alice@example.com",
    created_at: "2026-01-01T00:00:00Z",
    email_verified: true,
    is_admin: false,
    last_active: null,
    tree_count: 0,
    person_count: 0,
    relationship_count: 0,
    event_count: 0,
  },
  {
    id: "user-2",
    email: "bob@example.com",
    created_at: "2026-01-01T00:00:00Z",
    email_verified: true,
    is_admin: false,
    last_active: null,
    tree_count: 0,
    person_count: 0,
    relationship_count: 0,
    event_count: 0,
  },
];

describe("FeatureToggleCard", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("debounces rapid checkbox toggles into a single API call", () => {
    const onUpdate = vi.fn();
    const flag = makeFlag({ audience: "selected", selected_user_ids: [] });

    render(
      <FeatureToggleCard
        flag={flag}
        allUsers={makeUsers()}
        isPending={false}
        onUpdate={onUpdate}
      />,
    );

    // Open the user dropdown
    fireEvent.click(screen.getByRole("button", { name: /admin\.features/ }));

    // Rapidly toggle two users
    const checkboxes = screen.getAllByRole("checkbox");
    fireEvent.click(checkboxes[0]); // add user-1
    fireEvent.click(checkboxes[1]); // add user-2

    // onUpdate should NOT have been called yet (debounced)
    expect(onUpdate).not.toHaveBeenCalled();

    // Advance past the 300ms debounce
    act(() => {
      vi.advanceTimersByTime(300);
    });

    // Should fire exactly once with both users
    expect(onUpdate).toHaveBeenCalledTimes(1);
    const [audience, userIds] = onUpdate.mock.calls[0];
    expect(audience).toBe("selected");
    expect(userIds).toContain("user-1");
    expect(userIds).toContain("user-2");
  });

  it("cancels pending debounce when server data syncs (flag prop changes)", () => {
    const onUpdate = vi.fn();
    const flag = makeFlag({ audience: "selected", selected_user_ids: ["user-1"] });

    const { rerender } = render(
      <FeatureToggleCard
        flag={flag}
        allUsers={makeUsers()}
        isPending={false}
        onUpdate={onUpdate}
      />,
    );

    // Open dropdown and toggle a user
    fireEvent.click(screen.getByRole("button", { name: /admin\.features/ }));
    const checkboxes = screen.getAllByRole("checkbox");
    fireEvent.click(checkboxes[0]); // uncheck user-1

    // Simulate server data arriving before debounce fires (query invalidation)
    const updatedFlag = makeFlag({ audience: "selected", selected_user_ids: ["user-1", "user-2"] });
    rerender(
      <FeatureToggleCard
        flag={updatedFlag}
        allUsers={makeUsers()}
        isPending={false}
        onUpdate={onUpdate}
      />,
    );

    // Advance past the debounce timeout
    act(() => {
      vi.advanceTimersByTime(300);
    });

    // The debounced call should have been cancelled by the server sync
    expect(onUpdate).not.toHaveBeenCalled();
  });

  it("persists correctly after a single toggle with no interruption", () => {
    const onUpdate = vi.fn();
    const flag = makeFlag({ audience: "selected", selected_user_ids: [] });

    render(
      <FeatureToggleCard
        flag={flag}
        allUsers={makeUsers()}
        isPending={false}
        onUpdate={onUpdate}
      />,
    );

    // Open dropdown and toggle one user
    fireEvent.click(screen.getByRole("button", { name: /admin\.features/ }));
    const checkboxes = screen.getAllByRole("checkbox");
    fireEvent.click(checkboxes[0]); // add user-1

    act(() => {
      vi.advanceTimersByTime(300);
    });

    expect(onUpdate).toHaveBeenCalledTimes(1);
    expect(onUpdate).toHaveBeenCalledWith("selected", ["user-1"]);
  });

  it("calls onUpdate without userIds when audience is not 'selected'", () => {
    const onUpdate = vi.fn();
    const flag = makeFlag({ audience: "disabled" });

    render(
      <FeatureToggleCard
        flag={flag}
        allUsers={makeUsers()}
        isPending={false}
        onUpdate={onUpdate}
      />,
    );

    const allRadio = screen.getByRole("radio", { name: /admin\.features\.audience\.all/ });
    fireEvent.click(allRadio);

    expect(onUpdate).toHaveBeenCalledTimes(1);
    expect(onUpdate).toHaveBeenCalledWith("all");
  });

  it("closes dropdown on outside click", () => {
    const flag = makeFlag({ audience: "selected", selected_user_ids: [] });

    render(
      <FeatureToggleCard flag={flag} allUsers={makeUsers()} isPending={false} onUpdate={vi.fn()} />,
    );

    // Open dropdown
    fireEvent.click(screen.getByRole("button", { name: /admin\.features/ }));
    expect(screen.getAllByRole("checkbox").length).toBeGreaterThan(0);

    // Click outside
    fireEvent.mouseDown(document.body);

    expect(screen.queryAllByRole("checkbox")).toHaveLength(0);
  });

  it("removes a user when toggling an already-selected user", () => {
    const onUpdate = vi.fn();
    const flag = makeFlag({ audience: "selected", selected_user_ids: ["user-1"] });

    render(
      <FeatureToggleCard
        flag={flag}
        allUsers={makeUsers()}
        isPending={false}
        onUpdate={onUpdate}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: /admin\.features/ }));
    const checkboxes = screen.getAllByRole("checkbox");
    // user-1 is already selected, clicking should remove it
    fireEvent.click(checkboxes[0]);

    act(() => {
      vi.advanceTimersByTime(300);
    });

    expect(onUpdate).toHaveBeenCalledWith("selected", []);
  });

  it("shows 'no users selected' when selectedCount is 0", () => {
    const flag = makeFlag({ audience: "selected", selected_user_ids: [] });

    render(
      <FeatureToggleCard flag={flag} allUsers={makeUsers()} isPending={false} onUpdate={vi.fn()} />,
    );

    expect(screen.getByText("admin.features.noUsersSelected")).toBeInTheDocument();
  });

  it("shows 'users selected' count when users are selected", () => {
    const flag = makeFlag({ audience: "selected", selected_user_ids: ["user-1", "user-2"] });

    render(
      <FeatureToggleCard flag={flag} allUsers={makeUsers()} isPending={false} onUpdate={vi.fn()} />,
    );

    expect(screen.getByText("admin.features.usersSelected")).toBeInTheDocument();
  });

  it("shows loading text when allUsers is empty", () => {
    const flag = makeFlag({ audience: "selected", selected_user_ids: [] });

    render(<FeatureToggleCard flag={flag} allUsers={[]} isPending={false} onUpdate={vi.fn()} />);

    fireEvent.click(screen.getByRole("button", { name: /admin\.features/ }));
    expect(screen.getByText("common.loading")).toBeInTheDocument();
  });

  it("shows admin badge for admin users", () => {
    const flag = makeFlag({ audience: "selected", selected_user_ids: [] });
    const users = makeUsers();
    users[0].is_admin = true;

    render(<FeatureToggleCard flag={flag} allUsers={users} isPending={false} onUpdate={vi.fn()} />);

    fireEvent.click(screen.getByRole("button", { name: /admin\.features/ }));
    expect(screen.getByText("admin.adminBadge")).toBeInTheDocument();
  });

  it("applies active class to current audience option", () => {
    const flag = makeFlag({ audience: "all" });
    const { container } = render(
      <FeatureToggleCard flag={flag} allUsers={makeUsers()} isPending={false} onUpdate={vi.fn()} />,
    );

    const activeOption = container.querySelector(".admin-ft-option--active");
    expect(activeOption).toBeTruthy();
    expect(activeOption?.textContent).toContain("admin.features.audience.all");
  });
});

describe("FeatureTogglesSection", () => {
  it("renders section with feature toggle cards", () => {
    const flags: AdminFeatureFlag[] = [
      { key: "watercolor_theme", audience: "all", selected_user_ids: [] },
      { key: "another_flag", audience: "disabled", selected_user_ids: [] },
    ];
    const mutation = {
      mutate: vi.fn(),
      isPending: false,
    } as unknown as Parameters<typeof FeatureTogglesSection>[0]["updateFeatureMutation"];

    render(
      <FeatureTogglesSection
        data={{ flags }}
        users={makeUsers()}
        updateFeatureMutation={mutation}
      />,
    );

    expect(screen.getByText("admin.featureToggles")).toBeInTheDocument();
    expect(screen.getByText("admin.features.watercolor_theme")).toBeInTheDocument();
    expect(screen.getByText("admin.features.another_flag")).toBeInTheDocument();
  });

  it("calls mutation.mutate when a card audience changes", () => {
    const mutate = vi.fn();
    const flags: AdminFeatureFlag[] = [
      { key: "watercolor_theme", audience: "disabled", selected_user_ids: [] },
    ];
    const mutation = {
      mutate,
      isPending: false,
    } as unknown as Parameters<typeof FeatureTogglesSection>[0]["updateFeatureMutation"];

    render(
      <FeatureTogglesSection
        data={{ flags }}
        users={makeUsers()}
        updateFeatureMutation={mutation}
      />,
    );

    const allRadio = screen.getByRole("radio", { name: /admin\.features\.audience\.all/ });
    fireEvent.click(allRadio);

    expect(mutate).toHaveBeenCalledWith({
      key: "watercolor_theme",
      audience: "all",
      user_ids: undefined,
    });
  });
});
