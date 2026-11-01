import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { t as translate } from "../lib/i18n.js";

vi.mock("../context/AppContext.jsx", () => ({ useApp: () => ({ lang: "en" }), useT: () => (key) => translate(key, "en") }));
const { BreakdownCard } = await import("./BreakdownCard.jsx");

const props = {
  title: "How we met", columnLabel: "Source", countLabel: "Contacts",
  unit: { one: "new contact", many: "new contacts" }, group: { one: "source", many: "sources" }
};

describe("BreakdownCard", () => {
  it("shows the total, each part's share and a footer that adds up", () => {
    render(<BreakdownCard {...props} items={[{ label: "Walk-in", count: 3 }, { label: "Phone", count: 1 }]} />);
    expect(screen.getByText("2 sources")).toBeInTheDocument();
    expect(screen.getByText("Most from Walk-in: 75% of the total.")).toBeInTheDocument();
    expect(screen.getByText("25%")).toBeInTheDocument();
    expect(screen.getByText("4 new contacts across 2 sources")).toBeInTheDocument();
  });

  it("calls an equal split even, with one-decimal shares", () => {
    render(<BreakdownCard {...props} items={["A", "B", "C", "D", "E", "F", "G"].map((label) => ({ label, count: 1 }))} />);
    expect(screen.getByText("Evenly spread across all sources.")).toBeInTheDocument();
    expect(screen.getAllByText("14.3%")).toHaveLength(7);
  });

  it("uses the singular for one part and one item", () => {
    render(<BreakdownCard {...props} items={[{ label: "Event", count: 1 }]} />);
    expect(screen.getByText("1 source")).toBeInTheDocument();
    expect(screen.getByText("All from Event.")).toBeInTheDocument();
    expect(screen.getByText("1 new contact across 1 source")).toBeInTheDocument();
  });
});
