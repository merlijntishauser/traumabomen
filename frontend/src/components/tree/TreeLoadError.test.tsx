import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router";
import { describe, expect, it, vi } from "vitest";
import { ApiError } from "../../lib/api";
import { TreeLoadError } from "./TreeLoadError";

vi.mock("react-i18next", () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));

function renderError(error: unknown, readOnly: boolean) {
  return render(
    <MemoryRouter>
      <TreeLoadError error={error} readOnly={readOnly} />
    </MemoryRouter>,
  );
}

describe("TreeLoadError", () => {
  it("says a removed share is no longer shared, with the way back", () => {
    renderError(new ApiError(404, "Tree not found"), true);
    expect(screen.getByText("share.noLongerShared")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "share.backToTrees" })).toHaveAttribute(
      "href",
      "/trees",
    );
  });

  it("shows the usual message, without a link, for an own tree", () => {
    renderError(new ApiError(404, "Tree not found"), false);
    expect(screen.getByText("tree.decryptionError")).toBeInTheDocument();
    expect(screen.queryByRole("link")).not.toBeInTheDocument();
  });
});
