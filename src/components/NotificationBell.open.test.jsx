// NotificationBell.open.test.jsx -- opening the panel must not mark
// everything read on the spot: that hid the unread highlight and the
// "Mark all read" button the moment they appeared. Closing marks them read.
import { fireEvent, render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { t as translate } from "../lib/i18n.js";

const markAllNotifsRead = vi.fn();
let notifications = [];

vi.mock("../context/AppContext.jsx", async () => {
  const { useCallback } = await import("react");
  return {
    useApp: () => ({
      data: { appointments: [] }, lang: "en", notifications, markAllNotifsRead,
      requestConfirm: vi.fn(), showToast: vi.fn()
    }),
    useT: () => useCallback((key) => translate(key, "en"), [])
  };
});

import NotificationBell from "./NotificationBell.jsx";

const unread = (id) => ({ id, type: "snap_task_due", title: "Follow-up due", message: "Call back — 2026-11-02", read: false, link: "/snap/tasks" });

function openBell() {
  render(<MemoryRouter><NotificationBell /></MemoryRouter>);
  fireEvent.keyDown(screen.getByRole("button", { name: translate("notificationsAriaLabel", "en") }), { key: "Enter" });
}

describe("NotificationBell", () => {
  beforeEach(() => { markAllNotifsRead.mockClear(); });

  it("keeps unread items and the mark-all button while open", () => {
    notifications = [unread("a"), unread("b")];
    openBell();
    expect(markAllNotifsRead).not.toHaveBeenCalled();
    fireEvent.click(screen.getByText(translate("notificationsMarkAllRead", "en")));
    expect(markAllNotifsRead).toHaveBeenCalledTimes(1);
  });

  it("marks everything read when the panel closes", () => {
    notifications = [unread("a")];
    openBell();
    expect(markAllNotifsRead).not.toHaveBeenCalled();
    fireEvent.keyDown(screen.getByRole("menu"), { key: "Escape" });
    expect(markAllNotifsRead).toHaveBeenCalledTimes(1);
  });

  it("sends nothing on close when everything is already read", () => {
    notifications = [Object.assign(unread("a"), { read: true })];
    openBell();
    fireEvent.keyDown(screen.getByRole("menu"), { key: "Escape" });
    expect(markAllNotifsRead).not.toHaveBeenCalled();
  });
});
