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

  it("refuses days before min, in the grid and the day list", () => {
    lang = "en";
    const { container } = render(<DatePicker id="d" name="date" defaultValue="2026-11-10" min="2026-11-05" />);
    fireEvent.click(screen.getByRole("button", { name: "Nov 10, 2026" }));
    expect(screen.getByRole("button", { name: "Nov 4, 2026" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Nov 5, 2026" })).toBeEnabled();
    expect(screen.getByRole("option", { name: "4" })).toBeDisabled();
    fireEvent.click(screen.getByRole("button", { name: "Nov 4, 2026" }));
    expect(container.querySelector('input[name="date"]').value).toBe("2026-11-10");
  });
});
