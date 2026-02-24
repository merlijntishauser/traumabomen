import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { EventCard, SeverityBar } from "./EventCard";

describe("SeverityBar", () => {
  it("renders 10 dots with correct fill count", () => {
    const { container } = render(<SeverityBar value={7} color="#ff0000" />);
    const dots = container.querySelectorAll(".detail-panel__severity-dot");
    expect(dots).toHaveLength(10);

    const filled = Array.from(dots).filter((d) => (d as HTMLElement).style.opacity === "1");
    expect(filled).toHaveLength(7);
  });

  it("clamps value to 0-10 range", () => {
    const { container } = render(<SeverityBar value={15} color="#ff0000" />);
    const dots = container.querySelectorAll(".detail-panel__severity-dot");
    const filled = Array.from(dots).filter((d) => (d as HTMLElement).style.opacity === "1");
    expect(filled).toHaveLength(10);
  });

  it("renders aria-label with clamped value", () => {
    render(<SeverityBar value={3} color="#ff0000" />);
    expect(screen.getByRole("img")).toHaveAttribute("aria-label", "3/10");
  });
});

describe("EventCard", () => {
  const defaultProps = {
    title: "Test Event",
    approximateDate: "2020",
    categoryLabel: "Loss",
    color: "#ff0000",
    barValue: 5,
    onClick: vi.fn(),
  };

  it("renders title, date, and category label", () => {
    render(<EventCard {...defaultProps} />);
    expect(screen.getByText("Test Event")).toBeInTheDocument();
    expect(screen.getByText("2020")).toBeInTheDocument();
    expect(screen.getByText("Loss")).toBeInTheDocument();
  });

  it("calls onClick when clicked", async () => {
    const user = userEvent.setup();
    const onClick = vi.fn();
    render(<EventCard {...defaultProps} onClick={onClick} />);
    await user.click(screen.getByText("Test Event"));
    expect(onClick).toHaveBeenCalledOnce();
  });

  it("renders severity bar when barValue is positive", () => {
    render(<EventCard {...defaultProps} barValue={6} />);
    expect(screen.getByRole("img", { name: "6/10" })).toBeInTheDocument();
  });

  it("does not render severity bar when barValue is null", () => {
    render(<EventCard {...defaultProps} barValue={null} />);
    expect(screen.queryByRole("img")).not.toBeInTheDocument();
  });

  it("does not render severity bar when barValue is 0", () => {
    render(<EventCard {...defaultProps} barValue={0} />);
    expect(screen.queryByRole("img")).not.toBeInTheDocument();
  });

  it("does not render date when approximateDate is undefined", () => {
    render(<EventCard {...defaultProps} approximateDate={undefined} />);
    expect(screen.queryByText("2020")).not.toBeInTheDocument();
  });

  it("applies custom dot className", () => {
    const { container } = render(<EventCard {...defaultProps} dotClassName="custom-dot" />);
    expect(container.querySelector(".custom-dot")).toBeInTheDocument();
  });

  it("applies custom dot style", () => {
    const { container } = render(<EventCard {...defaultProps} dotStyle={{ borderRadius: 2 }} />);
    const dot = container.querySelector(".detail-panel__event-card-dot");
    expect(dot).toHaveStyle({ borderRadius: "2px" });
  });

  it("applies category pill color from color prop", () => {
    render(<EventCard {...defaultProps} color="#00ff00" />);
    const pill = screen.getByText("Loss");
    expect(pill).toHaveStyle({ color: "#00ff00" });
  });
});
