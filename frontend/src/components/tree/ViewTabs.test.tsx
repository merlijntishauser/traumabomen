import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, it, vi } from "vitest";
import { ViewTabs } from "./ViewTabs";

vi.mock("react-i18next", () => ({
  useTranslation: () => ({
    t: (k: string) => k,
    i18n: { language: "en" },
  }),
}));

const TREE_UUID = "03f28958-029f-4663-82e3-4de766986d28";

function renderTabs(
  activeView: "canvas" | "timeline" | "patterns" | "journal" | "insights" = "canvas",
) {
  return render(
    <MemoryRouter>
      <ViewTabs treeId={TREE_UUID} activeView={activeView} />
    </MemoryRouter>,
  );
}

/** Get the tab wrapper (span or a) that contains the given label text. */
function getTab(label: string): HTMLElement {
  return screen.getByText(label).closest(".tree-toolbar__tab") as HTMLElement;
}

describe("ViewTabs", () => {
  it("renders all five tabs", () => {
    renderTabs();
    expect(screen.getByText("tree.canvas")).toBeTruthy();
    expect(screen.getByText("tree.timeline")).toBeTruthy();
    expect(screen.getByText("pattern.patterns")).toBeTruthy();
    expect(screen.getByText("journal.tab")).toBeTruthy();
    expect(screen.getByText("insights.tab")).toBeTruthy();
  });

  it("renders active tab as a span (not a link)", () => {
    renderTabs("canvas");
    const canvasTab = getTab("tree.canvas");
    expect(canvasTab.tagName).toBe("SPAN");
    expect(canvasTab.className).toContain("tree-toolbar__tab--active");
  });

  it("renders inactive tabs as links", () => {
    renderTabs("canvas");
    const timelineTab = getTab("tree.timeline");
    expect(timelineTab.tagName).toBe("A");
    expect(timelineTab.className).toContain("tree-toolbar__tab");
    expect(timelineTab.className).not.toContain("tree-toolbar__tab--active");
  });

  it("marks timeline as active when activeView is timeline", () => {
    renderTabs("timeline");
    const timelineTab = getTab("tree.timeline");
    expect(timelineTab.tagName).toBe("SPAN");
    expect(timelineTab.className).toContain("tree-toolbar__tab--active");

    const canvasTab = getTab("tree.canvas");
    expect(canvasTab.tagName).toBe("A");
  });

  it("marks patterns as active when activeView is patterns", () => {
    renderTabs("patterns");
    const patternsTab = getTab("pattern.patterns");
    expect(patternsTab.tagName).toBe("SPAN");
    expect(patternsTab.className).toContain("tree-toolbar__tab--active");
  });

  it("marks journal as active when activeView is journal", () => {
    renderTabs("journal");
    const journalTab = getTab("journal.tab");
    expect(journalTab.tagName).toBe("SPAN");
    expect(journalTab.className).toContain("tree-toolbar__tab--active");
  });

  it("marks insights as active when activeView is insights", () => {
    renderTabs("insights");
    const insightsTab = getTab("insights.tab");
    expect(insightsTab.tagName).toBe("SPAN");
    expect(insightsTab.className).toContain("tree-toolbar__tab--active");
  });

  it("uses compact IDs in link hrefs", () => {
    renderTabs("canvas");
    const timelineLink = getTab("tree.timeline");
    const href = timelineLink.getAttribute("href");
    expect(href).toContain("/trees/");
    expect(href).not.toContain(TREE_UUID);
    expect(href).toContain("/timeline");
  });
});
