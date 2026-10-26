import { fireEvent, render, screen, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { CalendarDays, ClipboardList, LayoutGrid } from "lucide-react";
import ModuleNav from "./ModuleNav.jsx";

const ITEMS = [
  { key: "dashboard", label: "Dashboard", icon: LayoutGrid },
  { key: "intakes", label: "Intakes", icon: ClipboardList, badge: 3 },
  { key: "appointments", label: "Appointments", icon: CalendarDays, disabled: true }
];

function setup(value = "dashboard", items = ITEMS) {
  const onChange = vi.fn();
  render(<ModuleNav label="Case Management" items={items} value={value} onChange={onChange} />);
  return { onChange, nav: screen.getByRole("navigation", { name: "Case Management" }) };
}

describe("ModuleNav", () => {
  it("renders one button per item inside a labelled navigation list", () => {
    const { nav } = setup();
    expect(within(nav).getAllByRole("listitem")).toHaveLength(3);
    // Accessible names: the visible badge number is hidden; "(3)" is read instead.
    expect(within(nav).getByRole("button", { name: "Dashboard" })).toBeInTheDocument();
    expect(within(nav).getByRole("button", { name: "Intakes (3)" })).toBeInTheDocument();
    expect(within(nav).getByRole("button", { name: "Appointments" })).toBeInTheDocument();
  });

  it("marks only the item matching `value` as the current page", () => {
    setup("intakes");
    expect(screen.getByRole("button", { name: /Intakes/ })).toHaveAttribute("aria-current", "page");
    expect(screen.getByRole("button", { name: "Dashboard" })).not.toHaveAttribute("aria-current");
  });

  it("calls onChange with the item's key", () => {
    const { onChange } = setup();
    fireEvent.click(screen.getByRole("button", { name: /Intakes/ }));
    expect(onChange).toHaveBeenCalledWith("intakes");
  });

  it("ignores clicks on a disabled item and says so to assistive tech", () => {
    const { onChange } = setup();
    const btn = screen.getByRole("button", { name: "Appointments" });
    expect(btn).toHaveAttribute("aria-disabled", "true");
    fireEvent.click(btn);
    expect(onChange).not.toHaveBeenCalled();
  });

  it("only shows the items it is given (modules filter by permission)", () => {
    setup("dashboard", ITEMS.filter((i) => i.key !== "intakes"));
    expect(screen.queryByRole("button", { name: /Intakes/ })).toBeNull();
  });
});
