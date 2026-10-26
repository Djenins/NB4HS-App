// Shell.test.jsx -- the sidebar's collapse rule. It has two independent
// inputs: the user's stored `config.sidebarCollapsed` preference, and the
// viewport. Below 768px the rail is forced on regardless of the preference,
// because a 264px sidebar swallows most of a phone screen.
//
// The preference must survive that: a phone visit (or a narrow window)
// should never rewrite what the user chose on a wide screen, so these tests
// assert updateConfig is left alone as well as what renders.
import { fireEvent, render, screen, within } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { t as translate } from "../lib/i18n.js";

const updateConfig = vi.fn();
let config = { theme: "light", sidebarCollapsed: false };
let authLoading = false;

// useT is a real hook here (useCallback, like the real one): React only
// catches a hook-order change once a component has stateful hooks before
// its early return, so a plain-function mock would hide that class of bug.
vi.mock("../context/AppContext.jsx", async () => {
  const { useCallback } = await import("react");
  return {
  useApp: () => ({
    session: { role: "administrator", currentUserName: "Ada Lovelace" },
    data: { students: [], classes: [], appointments: [], workforceRoleAccess: [] },
    authLoading,
    config,
    updateConfig,
    kiosk: false,
    lang: "en",
    setLang: vi.fn(),
    toggleTheme: vi.fn(),
    logout: vi.fn(),
    notifications: [],
    markNotifRead: vi.fn(),
    markAllNotifsRead: vi.fn(),
    requestConfirm: vi.fn(),
    showToast: vi.fn()
  }),
  useT: () => useCallback((key) => translate(key, "en"), [])
  };
});

import Shell from "./Shell.jsx";

// jsdom ships no matchMedia at all, so every test states the viewport it is
// describing rather than inheriting an ambient one.
function setViewport(isMobile) {
  window.matchMedia = vi.fn().mockImplementation((query) => ({
    matches: query === "(max-width: 767px)" ? isMobile : false,
    media: query,
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    addListener: vi.fn(),
    removeListener: vi.fn(),
    dispatchEvent: vi.fn()
  }));
}

const renderShell = () => render(<MemoryRouter initialEntries={["/dashboard"]}><Shell /></MemoryRouter>);
// The Dashboard nav item in the sidebar (the topbar breadcrumb also names
// the page): a text node when expanded, an aria-label when collapsed.
const sidebar = () => document.getElementById("app-sidebar");
const navLabelVisible = () => !!sidebar() && within(sidebar()).queryAllByText(translate("navDashboard", "en")).length > 0;

describe("Shell sidebar", () => {
  beforeEach(() => {
    updateConfig.mockClear();
    config = { theme: "light", sidebarCollapsed: false };
  });

  it("shows full-width nav labels on a wide viewport", () => {
    setViewport(false);
    renderShell();
    expect(navLabelVisible()).toBe(true);
  });

  // Phones: the sidebar is an off-canvas drawer (plans/unified-access-
  // architecture.md §7.2), closed until the menu button opens it, full width
  // with labels when open -- never the old 76px rail.
  it("is a closed drawer below 768px that the menu button opens", () => {
    setViewport(true);
    renderShell();
    expect(sidebar().className).toContain("-translate-x-full");
    const menu = screen.getByRole("button", { name: translate("openMenuLabel", "en") });
    expect(menu).toHaveAttribute("aria-expanded", "false");
    fireEvent.click(menu);
    expect(sidebar().className).toContain("translate-x-0");
    expect(navLabelVisible()).toBe(true);
  });

  it("leaves the stored preference untouched on a phone", () => {
    setViewport(true);
    renderShell();
    expect(updateConfig).not.toHaveBeenCalled();
  });

  // On a phone collapsing isn't a thing (it's a drawer), so a collapse
  // toggle would be a focusable control that does nothing.
  it("renders no collapse/expand control at all on mobile", () => {
    setViewport(true);
    renderShell();
    expect(screen.queryAllByRole("button", { name: translate("expandSidebarLabel", "en") })).toHaveLength(0);
    expect(screen.queryAllByRole("button", { name: translate("collapseSidebarLabel", "en") })).toHaveLength(0);
  });

  it("keeps the expand control on a wide viewport collapsed by preference", () => {
    setViewport(false);
    config = { theme: "light", sidebarCollapsed: true };
    renderShell();
    expect(navLabelVisible()).toBe(false);
    expect(screen.queryAllByRole("button", { name: translate("expandSidebarLabel", "en") }).length).toBeGreaterThan(0);
  });
});

// Regression: Shell returns null while the Supabase session is still being
// restored. A hook called below that early return (useIsMobile used to be)
// made the second render -- once authLoading flips false -- call more hooks
// than the first, and React crashed the whole tree on any full page load.
describe("Shell auth gate", () => {
  it("survives authLoading flipping from true to false", () => {
    setViewport(false);
    config = { theme: "light", sidebarCollapsed: false };
    authLoading = true;
    const { container, rerender } = renderShell();
    expect(container).toBeEmptyDOMElement();
    authLoading = false;
    expect(() => rerender(<MemoryRouter initialEntries={["/dashboard"]}><Shell /></MemoryRouter>)).not.toThrow();
    expect(navLabelVisible()).toBe(true);
  });
});
