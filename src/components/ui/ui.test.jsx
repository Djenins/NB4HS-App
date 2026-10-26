// Behaviour of the design-system primitives that pages depend on: the
// dialog's labelling and Escape, the table's sorting/selection/empty and
// phone-card paths, status colours, and Button's loading lock.
import { fireEvent, render, screen } from "@testing-library/react";
import { LazyMotion, domAnimation } from "framer-motion";
import { describe, expect, it, vi } from "vitest";
import { cn } from "../../lib/cn.js";
import { statusTone } from "../../lib/statusTone.js";
import { Button } from "./button.jsx";
import { DataTable } from "./data-table.jsx";
import { Dialog } from "./dialog.jsx";
import { EmptyState } from "./empty-state.jsx";
import { StatusBadge } from "./status-badge.jsx";

const withMotion = (ui) => render(<LazyMotion features={domAnimation}>{ui}</LazyMotion>);

describe("cn", () => {
  it("keeps a design-system type size alongside a colour", () => {
    expect(cn("text-ui text-muted")).toBe("text-ui text-muted");
  });
  it("lets a later size or radius win", () => {
    expect(cn("text-sm text-ui")).toBe("text-ui");
    expect(cn("rounded-lg rounded-control")).toBe("rounded-control");
  });
});

describe("statusTone", () => {
  it("maps visit states and falls back to neutral", () => {
    expect(statusTone("visit", "in")).toBe("success");
    expect(statusTone("visit", "out")).toBe("neutral");
    expect(statusTone("visit", "unknown")).toBe("neutral");
  });
  it("renders the label with the tone's classes", () => {
    render(<StatusBadge domain="visit" status="in">In building</StatusBadge>);
    expect(screen.getByText("In building").className).toContain("bg-tone-success-bg");
  });
});

describe("Button", () => {
  it("disables itself and reports busy while loading", () => {
    const onClick = vi.fn();
    render(<Button loading onClick={onClick}>Save</Button>);
    const btn = screen.getByRole("button", { name: "Save" });
    expect(btn).toBeDisabled();
    expect(btn).toHaveAttribute("aria-busy", "true");
  });
});

describe("Dialog", () => {
  it("is labelled by its title and closes on Escape", () => {
    const onClose = vi.fn();
    withMotion(<Dialog open onClose={onClose} title="Edit visit" closeLabel="Close"><input aria-label="First name" /></Dialog>);
    const dialog = screen.getByRole("dialog", { name: "Edit visit" });
    expect(dialog).toHaveAttribute("aria-modal", "true");
    fireEvent.keyDown(document, { key: "Escape" });
    expect(onClose).toHaveBeenCalledTimes(1);
  });
  it("renders nothing while closed", () => {
    withMotion(<Dialog open={false} onClose={() => {}} title="Edit visit" closeLabel="Close" />);
    expect(screen.queryByRole("dialog")).toBeNull();
  });
});

describe("DataTable", () => {
  const rows = [{ id: "a", name: "Ana" }, { id: "b", name: "Ben" }];
  const columns = [{ key: "name", header: "Name", sortKey: "name", cell: (r) => r.name }];

  it("exposes the active sort and asks to re-sort from the header", () => {
    const onSort = vi.fn();
    render(<DataTable columns={columns} rows={rows} getRowId={(r) => r.id} sort={{ key: "name", dir: "asc" }} onSort={onSort} />);
    const header = screen.getByRole("columnheader", { name: /Name/ });
    expect(header).toHaveAttribute("aria-sort", "ascending");
    fireEvent.click(screen.getByRole("button", { name: /Name/ }));
    expect(onSort).toHaveBeenCalledWith("name");
  });

  it("selects one row or the whole page", () => {
    const onToggle = vi.fn();
    const onToggleAll = vi.fn();
    render(
      <DataTable
        columns={columns} rows={rows} getRowId={(r) => r.id}
        selection={{ selected: new Set(["a"]), onToggle, onToggleAll, allLabel: "Select all", rowLabel: (r) => r.name }}
      />
    );
    expect(screen.getByRole("checkbox", { name: "Ana" })).toBeChecked();
    expect(screen.getByRole("checkbox", { name: "Select all" })).not.toBeChecked();
    fireEvent.click(screen.getByRole("checkbox", { name: "Ben" }));
    expect(onToggle).toHaveBeenCalledWith("b");
    fireEvent.click(screen.getByRole("checkbox", { name: "Select all" }));
    expect(onToggleAll).toHaveBeenCalled();
  });

  it("shows the empty state instead of an empty table", () => {
    render(<DataTable columns={columns} rows={[]} getRowId={(r) => r.id} empty={<EmptyState title="Nothing yet" />} />);
    expect(screen.queryByRole("table")).toBeNull();
    expect(screen.getByRole("heading", { name: "Nothing yet" })).toBeInTheDocument();
  });

  it("renders a phone card per row when given renderCard", () => {
    render(<DataTable columns={columns} rows={rows} getRowId={(r) => r.id} renderCard={(r) => <div>card {r.name}</div>} />);
    expect(screen.getByText("card Ana")).toBeInTheDocument();
    expect(screen.getByText("card Ben")).toBeInTheDocument();
  });
});
