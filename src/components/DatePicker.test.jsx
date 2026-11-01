import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { t as translate } from "../lib/i18n.js";

let lang = "ht";
vi.mock("../context/AppContext.jsx", () => ({
  useApp: () => ({ lang }),
  useT: () => (key) => translate(key, lang)
}));
const { default: DatePicker } = await import("./DatePicker.jsx");

describe("DatePicker", () => {
  it("names each day with its full date, in Kreyòl on a Kreyòl page", () => {
    lang = "ht";
    render(<DatePicker id="d" name="date" defaultValue="2026-11-10" />);
    fireEvent.click(screen.getByRole("button", { name: "10 novanm 2026" }));
    expect(screen.getByRole("button", { name: "2 novanm 2026" })).toBeInTheDocument();
    expect(screen.getByRole("option", { name: "novanm" })).toBeInTheDocument();
  });

  it("refuses days before min", () => {
    lang = "en";
    const { container } = render(<DatePicker id="d" name="date" defaultValue="2026-11-10" min="2026-11-05" />);
    fireEvent.click(screen.getByRole("button", { name: "Nov 10, 2026" }));
    expect(screen.getByRole("button", { name: "Nov 4, 2026" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Nov 5, 2026" })).toBeEnabled();
    fireEvent.click(screen.getByRole("button", { name: "Nov 4, 2026" }));
    expect(container.querySelector('input[name="date"]').value).toBe("2026-11-10");
  });

  it("starts the week on Sunday and shows only the month's own days", () => {
    lang = "en";
    const { container } = render(<DatePicker id="d" name="date" defaultValue="2026-10-14" />);
    fireEvent.click(screen.getByRole("button", { name: "Oct 14, 2026" }));
    expect(container.querySelector(".date-picker-weekdays span").textContent).toBe("Sun");
    // Oct 1, 2026 is a Thursday: four blanks (Sun-Wed) come first.
    const cells = [...container.querySelector(".date-picker-grid").children];
    expect(cells.slice(0, 4).every((c) => c.tagName === "SPAN")).toBe(true);
    expect(cells[4]).toHaveAccessibleName("Oct 1, 2026");
    expect(screen.queryByRole("button", { name: "Sep 30, 2026" })).toBeNull();
  });
});
