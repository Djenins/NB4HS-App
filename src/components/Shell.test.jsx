// Shell.test.jsx -- the sidebar's layout rule. It has two independent
// inputs: the user's stored `config.sidebarCollapsed` preference, and the
// viewport. Desktop (>= 1280px) follows the preference; a tablet starts on
// the collapsed rail; a phone gets no rail at all, only a menu button that
// opens the sidebar as a drawer.
//
// The preference must survive the smaller layouts: a tablet or phone visit
// should never rewrite what the user chose on a wide screen, so these tests
// assert updateConfig is left alone as well as what renders.
import { fireEvent, render, screen } from "@testing-library/react";
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
    data: { students: [], classes: [], appointments: [], workforceRoleAccess: [], caseClients: [], profiles: [], programRoles: {} },
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
  useT: () => useCallback((key) => translate(key, "en"), []),
  useStaffT: () => useCallback((key) => translate(key, "en"), [])
  };
});

// The SNAP entry's program list comes from Supabase; keep tests offline.
vi.mock("../lib/outreachPrograms.js", async (importOriginal) => {
  const actual = await importOriginal();
  return { ...actual, fetchOutreachPrograms: () => new Promise(() => {}) };
});

import Shell from "./Shell.jsx";

// jsdom ships no matchMedia at all, so every test states the viewport it is
// describing rather than inheriting an ambient one.
function setViewport(size) {
  window.matchMedia = vi.fn().mockImplementation((query) => ({
    matches: query === "(max-width: 767px)" ? size === "mobile" : query === "(min-width: 1280px)" ? size === "desktop" : false,
    media: query,
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    addListener: vi.fn(),
    removeListener: vi.fn(),
    dispatchEvent: vi.fn()
  }));
}

const renderShell = () => render(<MemoryRouter initialEntries={["/dashboard"]}><Shell /></MemoryRouter>);
// The Dashboard nav item: a text node when expanded, an aria-label when
// collapsed to the icon rail.
const navLabelVisible = () => screen.queryAllByText(translate("navDashboard", "en")).length > 0;
const iconOnlyLink = () => screen.queryByRole("link", { name: translate("navDashboard", "en") });

describe("Shell sidebar", () => {
  beforeEach(() => {
    updateConfig.mockClear();
    config = { theme: "light", sidebarCollapsed: false };
  });

  it("shows full-width nav labels on a desktop viewport", () => {
    setViewport("desktop");
    renderShell();
    expect(navLabelVisible()).toBe(true);
  });

  it("keeps the expand control on a desktop viewport collapsed by preference", () => {
    setViewport("desktop");
    config = { theme: "light", sidebarCollapsed: true };
    renderShell();
    expect(navLabelVisible()).toBe(false);
    expect(iconOnlyLink()).toBeInTheDocument();
    expect(screen.queryAllByRole("button", { name: translate("expandSidebarLabel", "en") }).length).toBeGreaterThan(0);
  });

  it("starts a tablet on the icon rail even though the stored preference is expanded", () => {
    setViewport("tablet");
    renderShell();
    expect(navLabelVisible()).toBe(false);
    expect(iconOnlyLink()).toBeInTheDocument();
  });

  it("expands on a tablet without rewriting the stored preference", () => {
    setViewport("tablet");
    renderShell();
    fireEvent.click(screen.getByRole("button", { name: translate("expandSidebarLabel", "en") }));
    expect(navLabelVisible()).toBe(true);
    expect(updateConfig).not.toHaveBeenCalled();
  });

  it("renders no rail on a phone, only a menu button that opens the drawer", () => {
    setViewport("mobile");
    renderShell();
    expect(screen.queryByRole("navigation", { name: translate("sidebarMainNav", "en") })).not.toBeInTheDocument();
    expect(screen.queryAllByRole("button", { name: translate("collapseSidebarLabel", "en") })).toHaveLength(0);
    fireEvent.click(screen.getByRole("button", { name: translate("sidebarOpenMenu", "en") }));
    expect(screen.getByRole("dialog", { name: translate("sidebarMainNav", "en") })).toBeInTheDocument();
    expect(navLabelVisible()).toBe(true);
    expect(updateConfig).not.toHaveBeenCalled();
  });

  it("marks the current page and offers search for an administrator", () => {
    setViewport("desktop");
    renderShell();
    expect(screen.getByRole("link", { name: translate("navDashboard", "en") })).toHaveAttribute("aria-current", "page");
    expect(screen.getByRole("button", { name: translate("cmdkPlaceholderAll", "en") })).toBeInTheDocument();
  });

  it("opens the search palette with Ctrl+K", () => {
    setViewport("desktop");
    renderShell();
    fireEvent.keyDown(window, { key: "k", ctrlKey: true });
    expect(screen.getByRole("combobox", { name: translate("cmdkPlaceholderAll", "en") })).toBeInTheDocument();
  });
});

// Regression: Shell returns null while the Supabase session is still being
// restored. A hook called below that early return (the viewport hook used to be)
// made the second render -- once authLoading flips false -- call more hooks
// than the first, and React crashed the whole tree on any full page load.
describe("Shell auth gate", () => {
  it("survives authLoading flipping from true to false", () => {
    setViewport("desktop");
    config = { theme: "light", sidebarCollapsed: false };
    authLoading = true;
    const { container, rerender } = renderShell();
    expect(container).toBeEmptyDOMElement();
    authLoading = false;
    expect(() => rerender(<MemoryRouter initialEntries={["/dashboard"]}><Shell /></MemoryRouter>)).not.toThrow();
    expect(navLabelVisible()).toBe(true);
  });
});
