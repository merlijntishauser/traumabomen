import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import type {
  ActivityStats,
  FeedbackItem,
  FunnelStats,
  GrowthPoint,
  OverviewStats,
  RetentionStats,
  UsageBuckets,
  UsageStats,
  UserListStats,
  WaitlistCapacity,
  WaitlistListResponse,
} from "../../types/api";
import { ActivitySection } from "./ActivitySection";
import { FeatureToggleCard, FeatureTogglesSection } from "./FeatureTogglesSection";
import { FeedbackSection } from "./FeedbackSection";
import { FunnelSection } from "./FunnelSection";
import { GrowthSection } from "./GrowthSection";
import { OverviewSection } from "./OverviewSection";
import { RetentionSection } from "./RetentionSection";
import { UsageSection } from "./UsageSection";
import { UserListSection } from "./UserListSection";
import { WaitlistSection } from "./WaitlistSection";

vi.mock("react-i18next", () => ({
  useTranslation: () => ({
    t: (key: string) => key,
    i18n: { language: "en" },
  }),
}));

// Mock d3 to avoid SVG rendering issues in JSDOM
// Use a chainable proxy so any method chain (e.g. .attr().attr().attr()) works.
// Any function argument passed to a chained method is invoked (like real D3 selections)
// so that callbacks passed to .call(), .x(), .y(), .domain() etc. are covered.
function chainable(): unknown {
  const proxy: unknown = new Proxy(() => proxy, {
    get:
      () =>
      (...args: unknown[]) => {
        for (const arg of args) {
          if (typeof arg === "function") {
            try {
              arg(proxy);
            } catch {
              // ignore errors from callbacks that expect real D3 objects
            }
          }
        }
        return proxy;
      },
    apply: () => proxy,
  });
  return proxy;
}

vi.mock("d3", () => ({
  select: () => chainable(),
  scaleTime: () => chainable(),
  scaleLinear: () => chainable(),
  line: () => chainable(),
  area: () => chainable(),
  extent: () => [new Date(), new Date()],
  max: () => 10,
  axisBottom: () => chainable(),
  axisLeft: () => chainable(),
  timeFormat: () => () => "",
  curveMonotoneX: "curveMonotoneX",
}));

function makeBuckets(val = 0): UsageBuckets {
  return {
    zero: val,
    one_two: val,
    three_five: val,
    six_ten: val,
    eleven_twenty: val,
    twenty_plus: val,
  };
}

function makeMutation() {
  return {
    mutate: vi.fn(),
    mutateAsync: vi.fn(),
    isPending: false,
    isSuccess: false,
    isError: false,
    isIdle: true,
    error: null,
    data: undefined,
    variables: undefined,
    reset: vi.fn(),
    context: undefined,
    failureCount: 0,
    failureReason: null,
    status: "idle" as const,
    submittedAt: 0,
  };
}

// OverviewSection
describe("OverviewSection", () => {
  it("renders section title and stat values", () => {
    const data: OverviewStats = {
      total_users: 42,
      verified_users: 30,
      signups: { day: 2, week: 10, month: 25 },
      active_users: { day: 5, week: 15, month: 35 },
    };
    render(<OverviewSection data={data} />);
    expect(screen.getByText("admin.overview")).toBeInTheDocument();
    expect(screen.getByText("42")).toBeInTheDocument();
    expect(screen.getByText("10")).toBeInTheDocument();
  });

  it("renders without data (undefined)", () => {
    render(<OverviewSection data={undefined} />);
    expect(screen.getByText("admin.overview")).toBeInTheDocument();
  });
});

// FunnelSection
describe("FunnelSection", () => {
  it("renders funnel steps with counts and percentages", () => {
    const data: FunnelStats = {
      registered: 100,
      verified: 80,
      created_tree: 60,
      added_person: 40,
      added_relationship: 20,
      added_event: 10,
    };
    render(<FunnelSection data={data} />);
    expect(screen.getByText("admin.signupFunnel")).toBeInTheDocument();
    expect(screen.getByText("admin.funnel.registered")).toBeInTheDocument();
    expect(screen.getByText("100 (100%)")).toBeInTheDocument();
    expect(screen.getByText("10 (10%)")).toBeInTheDocument();
  });
});

// GrowthSection
describe("GrowthSection", () => {
  it("renders without crashing with empty data", () => {
    render(<GrowthSection points={[]} />);
    expect(screen.getByText("admin.userGrowth")).toBeInTheDocument();
  });

  it("renders without crashing with data points", () => {
    const points: GrowthPoint[] = [
      { date: "2026-01-01", total: 5 },
      { date: "2026-01-08", total: 12 },
    ];
    render(<GrowthSection points={points} />);
    expect(screen.getByText("admin.userGrowth")).toBeInTheDocument();
  });
});

// ActivitySection
describe("ActivitySection", () => {
  it("renders heatmap with day labels and hour columns", () => {
    const data: ActivityStats = {
      cells: [{ day: 0, hour: 9, count: 5 }],
    };
    render(<ActivitySection data={data} />);
    expect(screen.getByText("admin.loginActivity")).toBeInTheDocument();
    expect(screen.getByText("admin.day.mon")).toBeInTheDocument();
    expect(screen.getByText("admin.day.sun")).toBeInTheDocument();
    // Hour labels 0-23 should be present
    expect(screen.getByText("0")).toBeInTheDocument();
    expect(screen.getByText("23")).toBeInTheDocument();
  });
});

// RetentionSection
describe("RetentionSection", () => {
  it("renders cohort table with retention data", () => {
    const data: RetentionStats = {
      cohorts: [{ week: "2026-W01", signup_count: 10, retention: [100, 80, 60] }],
    };
    render(<RetentionSection data={data} />);
    expect(screen.getByText("admin.retention")).toBeInTheDocument();
    expect(screen.getByText("admin.cohort")).toBeInTheDocument();
    expect(screen.getByText("2026-W01")).toBeInTheDocument();
    expect(screen.getByText("100%")).toBeInTheDocument();
    expect(screen.getByText("60%")).toBeInTheDocument();
  });

  it("renders empty message when no cohorts", () => {
    const data: RetentionStats = { cohorts: [] };
    render(<RetentionSection data={data} />);
    expect(screen.getByText("admin.noCohortData")).toBeInTheDocument();
  });

  it("renders empty message when data is undefined", () => {
    render(<RetentionSection data={undefined} />);
    expect(screen.getByText("admin.noCohortData")).toBeInTheDocument();
  });
});

// UsageSection
describe("UsageSection", () => {
  it("renders usage charts with bucket labels", () => {
    const data: UsageStats = {
      persons: makeBuckets(5),
      relationships: makeBuckets(3),
      events: makeBuckets(1),
    };
    render(<UsageSection data={data} />);
    expect(screen.getByText("admin.usageDepth")).toBeInTheDocument();
    expect(screen.getByText("admin.persons")).toBeInTheDocument();
    expect(screen.getByText("admin.relationships")).toBeInTheDocument();
    expect(screen.getByText("admin.events")).toBeInTheDocument();
  });
});

// UserListSection
describe("UserListSection", () => {
  it("renders user table with email and stats", () => {
    const data: UserListStats = {
      users: [
        {
          id: "u1",
          email: "alice@example.com",
          created_at: "2026-01-15T10:00:00Z",
          email_verified: true,
          is_admin: true,
          last_active: "2026-03-01T08:00:00Z",
          tree_count: 2,
          person_count: 10,
          relationship_count: 8,
          event_count: 5,
        },
      ],
    };
    render(<UserListSection data={data} />);
    expect(screen.getByText("admin.userList")).toBeInTheDocument();
    expect(screen.getByText("alice@example.com")).toBeInTheDocument();
    expect(screen.getByText("admin.adminBadge")).toBeInTheDocument();
    expect(screen.getByText("admin.yes")).toBeInTheDocument();
  });

  it("shows N/A for null last_active", () => {
    const data: UserListStats = {
      users: [
        {
          id: "u2",
          email: "bob@example.com",
          created_at: "2026-01-15T10:00:00Z",
          email_verified: false,
          is_admin: false,
          last_active: null,
          tree_count: 0,
          person_count: 0,
          relationship_count: 0,
          event_count: 0,
        },
      ],
    };
    render(<UserListSection data={data} />);
    expect(screen.getByText("common.notAvailable")).toBeInTheDocument();
    expect(screen.getByText("admin.no")).toBeInTheDocument();
  });
});

// WaitlistSection
describe("WaitlistSection", () => {
  it("renders waitlist entries with approve and delete buttons", () => {
    const data: WaitlistListResponse = {
      items: [
        {
          id: "w1",
          email: "charlie@example.com",
          status: "waiting",
          created_at: "2026-02-01T00:00:00Z",
          approved_at: null,
        },
      ],
      waiting: 1,
      approved: 0,
      registered: 0,
    };
    const capacityData: WaitlistCapacity = {
      active_users: 10,
      max_active_users: 50,
      waitlist_enabled: true,
    };
    render(
      <WaitlistSection
        data={data}
        capacityData={capacityData}
        approveMutation={makeMutation() as never}
        deleteMutation={makeMutation() as never}
      />,
    );
    expect(screen.getByText("admin.waitlist.title")).toBeInTheDocument();
    expect(screen.getByText("charlie@example.com")).toBeInTheDocument();
    expect(screen.getByText("admin.waitlist.approve")).toBeInTheDocument();
    expect(screen.getByText("admin.waitlist.delete")).toBeInTheDocument();
  });

  it("renders empty state when no items", () => {
    render(
      <WaitlistSection
        data={undefined}
        capacityData={undefined}
        approveMutation={makeMutation() as never}
        deleteMutation={makeMutation() as never}
      />,
    );
    expect(screen.getByText("admin.waitlist.empty")).toBeInTheDocument();
  });
});

// FeedbackSection
describe("FeedbackSection", () => {
  it("renders feedback items with category and message", () => {
    const data = {
      items: [
        {
          id: "f1",
          category: "bug",
          message: "Something is broken",
          user_email: "user@example.com",
          created_at: "2026-02-15T00:00:00Z",
          is_read: false,
        } satisfies FeedbackItem,
      ],
    };
    render(
      <FeedbackSection
        data={data}
        markReadMutation={makeMutation() as never}
        deleteFeedbackMutation={makeMutation() as never}
      />,
    );
    expect(screen.getByText("admin.feedback")).toBeInTheDocument();
    expect(screen.getByText("Something is broken")).toBeInTheDocument();
    expect(screen.getByText("user@example.com")).toBeInTheDocument();
    expect(screen.getByText("admin.feedbackMarkRead")).toBeInTheDocument();
    expect(screen.getByText("admin.feedbackDelete")).toBeInTheDocument();
  });

  it("renders empty state when no feedback", () => {
    render(
      <FeedbackSection
        data={{ items: [] }}
        markReadMutation={makeMutation() as never}
        deleteFeedbackMutation={makeMutation() as never}
      />,
    );
    expect(screen.getByText("admin.feedbackEmpty")).toBeInTheDocument();
  });

  it("hides mark-read button for already-read items", () => {
    const data = {
      items: [
        {
          id: "f2",
          category: "general",
          message: "Already read",
          user_email: null,
          created_at: "2026-02-15T00:00:00Z",
          is_read: true,
        } satisfies FeedbackItem,
      ],
    };
    render(
      <FeedbackSection
        data={data}
        markReadMutation={makeMutation() as never}
        deleteFeedbackMutation={makeMutation() as never}
      />,
    );
    expect(screen.queryByText("admin.feedbackMarkRead")).not.toBeInTheDocument();
    expect(screen.getByText("admin.feedbackAnonymous")).toBeInTheDocument();
  });

  it("calls markReadMutation.mutate when mark-read button is clicked", () => {
    const markReadMut = makeMutation();
    const data = {
      items: [
        {
          id: "f3",
          category: "bug",
          message: "Unread item",
          user_email: "u@test.com",
          created_at: "2026-02-15T00:00:00Z",
          is_read: false,
        } satisfies FeedbackItem,
      ],
    };
    render(
      <FeedbackSection
        data={data}
        markReadMutation={markReadMut as never}
        deleteFeedbackMutation={makeMutation() as never}
      />,
    );
    fireEvent.click(screen.getByText("admin.feedbackMarkRead"));
    expect(markReadMut.mutate).toHaveBeenCalledWith("f3");
  });

  it("calls deleteFeedbackMutation.mutate when delete button is clicked", () => {
    const deleteMut = makeMutation();
    const data = {
      items: [
        {
          id: "f4",
          category: "bug",
          message: "Item to delete",
          user_email: null,
          created_at: "2026-02-15T00:00:00Z",
          is_read: true,
        } satisfies FeedbackItem,
      ],
    };
    render(
      <FeedbackSection
        data={data}
        markReadMutation={makeMutation() as never}
        deleteFeedbackMutation={deleteMut as never}
      />,
    );
    fireEvent.click(screen.getByText("admin.feedbackDelete"));
    expect(deleteMut.mutate).toHaveBeenCalledWith("f4");
  });
});

// WaitlistSection button click tests
describe("WaitlistSection button clicks", () => {
  it("calls approveMutation.mutate when approve button is clicked", () => {
    const approveMut = makeMutation();
    const data: WaitlistListResponse = {
      items: [
        {
          id: "w2",
          email: "waiting@test.com",
          status: "waiting",
          created_at: "2026-02-01T00:00:00Z",
          approved_at: null,
        },
      ],
      waiting: 1,
      approved: 0,
      registered: 0,
    };
    render(
      <WaitlistSection
        data={data}
        capacityData={undefined}
        approveMutation={approveMut as never}
        deleteMutation={makeMutation() as never}
      />,
    );
    fireEvent.click(screen.getByText("admin.waitlist.approve"));
    expect(approveMut.mutate).toHaveBeenCalledWith("w2");
  });

  it("calls deleteMutation.mutate when delete button is clicked", () => {
    const deleteMut = makeMutation();
    const data: WaitlistListResponse = {
      items: [
        {
          id: "w3",
          email: "todelete@test.com",
          status: "waiting",
          created_at: "2026-02-01T00:00:00Z",
          approved_at: null,
        },
      ],
      waiting: 1,
      approved: 0,
      registered: 0,
    };
    render(
      <WaitlistSection
        data={data}
        capacityData={undefined}
        approveMutation={makeMutation() as never}
        deleteMutation={deleteMut as never}
      />,
    );
    fireEvent.click(screen.getByText("admin.waitlist.delete"));
    expect(deleteMut.mutate).toHaveBeenCalledWith("w3");
  });
});

// FeatureTogglesSection
describe("FeatureTogglesSection", () => {
  it("renders feature toggle cards for each flag", () => {
    const data = {
      flags: [{ key: "test_flag", audience: "all" as const, selected_user_ids: [] }],
    };
    render(
      <FeatureTogglesSection
        data={data}
        users={[]}
        updateFeatureMutation={makeMutation() as never}
      />,
    );
    expect(screen.getByText("admin.featureToggles")).toBeInTheDocument();
    expect(screen.getByText("admin.features.test_flag")).toBeInTheDocument();
  });
});

describe("FeatureToggleCard", () => {
  it("calls onUpdate with audience when non-selected option is chosen", () => {
    const onUpdate = vi.fn();
    const flag = { key: "my_flag", audience: "disabled" as const, selected_user_ids: [] };
    render(<FeatureToggleCard flag={flag} allUsers={[]} isPending={false} onUpdate={onUpdate} />);
    // Click the "all" radio button
    const allRadio = screen.getByDisplayValue("all");
    fireEvent.click(allRadio);
    expect(onUpdate).toHaveBeenCalledWith("all");
  });

  it("calls onUpdate with audience and user_ids when selected option is chosen", () => {
    const onUpdate = vi.fn();
    const flag = { key: "my_flag", audience: "disabled" as const, selected_user_ids: ["u1"] };
    render(<FeatureToggleCard flag={flag} allUsers={[]} isPending={false} onUpdate={onUpdate} />);
    const selectedRadio = screen.getByDisplayValue("selected");
    fireEvent.click(selectedRadio);
    expect(onUpdate).toHaveBeenCalledWith("selected", ["u1"]);
  });
});
