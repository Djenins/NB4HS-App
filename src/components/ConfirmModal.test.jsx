// The app-wide confirm behind requestConfirm() renders the shared
// ConfirmDialog: the caller's message as the body, a named confirm button,
// and Cancel / Escape resolving false.
import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { t as translate } from "../lib/i18n.js";

let app;
vi.mock("../context/AppContext.jsx", () => ({ useApp: () => app, useT: () => (key) => translate(key, "en") }));

const { default: ConfirmModal } = await import("./ConfirmModal.jsx");

describe("ConfirmModal", () => {
  beforeEach(() => {
    app = { confirmState: null, resolveConfirm: vi.fn() };
  });

  it("renders nothing while no confirm is pending", () => {
    render(<ConfirmModal />);
    expect(screen.queryByRole("dialog")).toBeNull();
  });

  it("shows the message and resolves true on the named confirm button", () => {
    app.confirmState = { message: "Delete this grant?", opts: { danger: true, confirmLabel: "Delete grant" } };
    render(<ConfirmModal />);
    const dialog = screen.getByRole("dialog", { name: "Are you sure?" });
    expect(dialog.textContent).toContain("Delete this grant?");
    fireEvent.click(screen.getByRole("button", { name: "Delete grant" }));
    expect(app.resolveConfirm).toHaveBeenCalledWith(true);
  });

  it("resolves false on Cancel, and starts focus there for a destructive action", () => {
    app.confirmState = { message: "Remove this client?", opts: { danger: true } };
    render(<ConfirmModal />);
    const cancel = screen.getByRole("button", { name: "Cancel" });
    expect(document.activeElement).toBe(cancel);
    fireEvent.click(cancel);
    expect(app.resolveConfirm).toHaveBeenCalledWith(false);
  });

  it("falls back to the generic Confirm label", () => {
    app.confirmState = { message: "Start a new session?", opts: {} };
    render(<ConfirmModal />);
    fireEvent.click(screen.getByRole("button", { name: "Confirm" }));
    expect(app.resolveConfirm).toHaveBeenCalledWith(true);
  });
});
