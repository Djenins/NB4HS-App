// Regression checks for how the app loads permissions and guards routes
// (the P0 audit of 2026-10-28):
//   - fetchMyPermissions() tells a failed call (null) from an empty answer ([])
//   - a deactivated profile restored from storage is no session
//   - RequireRoute waits for the first answer instead of opening a page on the
//     account-type list, and refuses a page the loaded answer doesn't include
import { render, screen } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";

const rpc = vi.fn();
vi.mock("./supabase.js", () => ({ supabase: { rpc: (...args) => rpc(...args) } }));

let app;
vi.mock("../context/AppContext.jsx", () => ({ useApp: () => app }));

const { fetchMyPermissions } = await import("./permissions.js");
const { profileToSession } = await import("./supabaseAuth.js");
const { default: RequireRoute } = await import("../components/RequireRoute.jsx");

describe("fetchMyPermissions", () => {
  beforeEach(() => { rpc.mockReset(); vi.spyOn(console, "warn").mockImplementation(() => {}); });

  it("maps rows", async () => {
    rpc.mockResolvedValue({ data: [{ permission_key: "calendar.view", program_key: null, scope: null }], error: null });
    expect(await fetchMyPermissions()).toEqual([{ permissionKey: "calendar.view", programKey: "", scope: null }]);
  });
  it("returns [] for an account that holds nothing", async () => {
    rpc.mockResolvedValue({ data: [], error: null });
    expect(await fetchMyPermissions()).toEqual([]);
  });
  it("returns null when the call fails", async () => {
    rpc.mockResolvedValue({ data: null, error: { message: "network" } });
    expect(await fetchMyPermissions()).toBeNull();
  });
  it("returns null when the call throws", async () => {
    rpc.mockRejectedValue(new Error("offline"));
    expect(await fetchMyPermissions()).toBeNull();
  });
});

describe("profileToSession", () => {
  it("refuses a deactivated profile", () => {
    expect(profileToSession({ id: "u", role: "staff", email: "a@b", name: "A", active: false })).toBeNull();
  });
  it("keeps an active profile (and one from before the active column)", () => {
    expect(profileToSession({ id: "u", role: "staff", email: "a@b", name: "A", active: true })).toMatchObject({ id: "u", role: "staff" });
    expect(profileToSession({ id: "u", role: "staff", email: "a@b", name: "A" })).toMatchObject({ id: "u" });
  });
});

function renderGuard(routeKey) {
  return render(
    <MemoryRouter initialEntries={["/page"]}>
      <Routes>
        <Route path="/page" element={<RequireRoute routeKey={routeKey}><p>secret page</p></RequireRoute>} />
        <Route path="/" element={<p>home</p>} />
        <Route path="/calendar" element={<p>calendar</p>} />
      </Routes>
    </MemoryRouter>
  );
}

describe("RequireRoute while permissions load", () => {
  const base = {
    session: { id: "u", role: "case_manager", primaryWorkspace: null }, authLoading: false, kiosk: false,
    data: { workforceRoleAccess: [], programRoles: {} }, can: () => false
  };

  it("renders nothing until the first answer arrives", () => {
    app = Object.assign({}, base, { permissions: [], permissionsLoaded: false, permissionsFailed: false });
    const { container } = renderGuard("casemanagement");
    expect(container.textContent).toBe("");
  });
  it("refuses a page the account-type list allows but the loaded answer does not", () => {
    app = Object.assign({}, base, { permissions: [{ permissionKey: "calendar.view", programKey: "" }], permissionsLoaded: true, permissionsFailed: false });
    renderGuard("casemanagement");
    expect(screen.queryByText("secret page")).toBeNull();
    expect(screen.getByText("calendar")).toBeTruthy();
  });
  it("sends an account that holds nothing home instead of opening its old pages", () => {
    app = Object.assign({}, base, { permissions: [], permissionsLoaded: true, permissionsFailed: false });
    renderGuard("casemanagement");
    expect(screen.queryByText("secret page")).toBeNull();
    expect(screen.getByText("home")).toBeTruthy();
  });
  it("falls back to the account-type list only when the call failed", () => {
    app = Object.assign({}, base, { permissions: [], permissionsLoaded: true, permissionsFailed: true });
    renderGuard("casemanagement");
    expect(screen.getByText("secret page")).toBeTruthy();
  });
});
