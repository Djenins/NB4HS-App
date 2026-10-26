// Admin.test.jsx -- the Administration screens render real data shapes and
// wire their actions to the right calls. The data layer is mocked; its pure
// rules (status, filters) are the real ones.
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { t as translate } from "../../lib/i18n.js";

const tr = (k) => translate(k, "en");
let session = { id: "me", role: "administrator" };
let held = ["admin.users.view", "admin.users.invite", "admin.users.edit", "admin.users.deactivate", "admin.users.revoke_sessions",
  "admin.roles.view", "admin.roles.manage", "admin.permissions.assign", "admin.positions.manage", "admin.programs.manage", "admin.audit.view"];
const showToast = vi.fn();

vi.mock("../../context/AppContext.jsx", async () => {
  const { useCallback } = await import("react");
  return {
    useApp: () => ({
      session, lang: "en", showToast, requestConfirm: () => Promise.resolve(true),
      can: (k) => held.indexOf(k) !== -1,
      data: { profiles: [{ id: "u1", name: "Ann Active", email: "ann@nb4hs.org" }, { id: "me", name: "Me", email: "me@nb4hs.org" }] }
    }),
    useT: () => useCallback((key) => translate(key, "en"), [])
  };
});

const ACCOUNTS = [
  { id: "u1", name: "Ann Active", email: "ann@nb4hs.org", role: "case_manager", active: true, invitedAt: null, deactivatedAt: null, lastSignInAt: "2026-10-20T10:00:00Z", sessionCount: 2, createdAt: "2026-07-01T00:00:00Z",
    positions: [{ id: "p1", name: "Case Manager", isPrimary: true }],
    roles: [{ id: "ur1", roleId: "r-legacy", key: "legacy_case_manager", name: "Case Manager (legacy)", kind: "legacy", programKey: "", source: "legacy_sync" },
      { id: "ur2", roleId: "r-c", key: "lead", name: "Program Lead", kind: "custom", programKey: "students", source: "admin" }] },
  { id: "u2", name: "Ivy Invited", email: "ivy@nb4hs.org", role: "staff", active: true, invitedAt: "2026-10-25T00:00:00Z", deactivatedAt: null, lastSignInAt: null, sessionCount: 0, positions: [], roles: [] },
  { id: "u3", name: "Pat Pending", email: "pat@nb4hs.org", role: "receptionist", active: false, invitedAt: null, deactivatedAt: null, lastSignInAt: null, sessionCount: 0, positions: [], roles: [] },
  { id: "u4", name: "Dee Gone", email: "dee@nb4hs.org", role: "staff", active: false, invitedAt: null, deactivatedAt: "2026-10-24T00:00:00Z", lastSignInAt: "2026-09-01T00:00:00Z", sessionCount: 3, positions: [], roles: [] },
  { id: "me", name: "Me", email: "me@nb4hs.org", role: "administrator", active: true, lastSignInAt: "2026-10-26T00:00:00Z", sessionCount: 1, positions: [], roles: [] }
];
const CATALOG = {
  roles: [
    { id: "r-sys", key: "system_administrator", name: "System Administrator", description: "", kind: "builtin", protected: true, permissionCount: 2, peopleCount: 0 },
    { id: "r-legacy", key: "legacy_case_manager", name: "Case Manager (legacy)", description: "", kind: "legacy", permissionCount: 1, peopleCount: 1 },
    { id: "r-c", key: "lead", name: "Program Lead", description: "Leads a program", kind: "custom", permissionCount: 1, peopleCount: 1 },
    { id: "r-old", key: "old", name: "Old Role", description: "", kind: "custom", archivedAt: "2026-01-01", permissionCount: 0, peopleCount: 0 }
  ],
  rolePermissions: [{ roleId: "r-c", permissionKey: "students.view", scope: "program" }, { roleId: "r-legacy", permissionKey: "students.view", scope: "assigned" }],
  permissions: [{ key: "students.view", moduleKey: "students", label: "Open Students", sortOrder: 1, sensitivity: "normal", scoped: true },
    { key: "students.assessments.grade", moduleKey: "students.assessments", label: "Grade assessments", sortOrder: 1, sensitivity: "sensitive", scoped: true }],
  modules: [{ key: "students", kind: "program", name: "Students", active: true, implemented: true },
    { key: "students.assessments", parentKey: "students", kind: "submodule", name: "Assessments", active: true, implemented: true },
    { key: "workforce", kind: "program", name: "Workforce", active: true, implemented: true }],
  members: [{ role_id: "r-c", user_id: "u1" }]
};

const lib = vi.hoisted(() => ({}));
vi.mock("../../lib/adminAccounts.js", async (importOriginal) => {
  const real = await importOriginal();
  Object.assign(lib, {
    fetchAccounts: vi.fn(() => Promise.resolve(ACCOUNTS)),
    fetchAccount: vi.fn((id) => Promise.resolve(ACCOUNTS.find((a) => a.id === id) || null)),
    fetchAccessCatalog: vi.fn(() => Promise.resolve(CATALOG)),
    fetchPositions: vi.fn(() => Promise.resolve([{ id: "p1", name: "Case Manager", description: "", peopleCount: 1 }, { id: "p2", name: "Receptionist", description: "", peopleCount: 0 }])),
    setAccountActive: vi.fn(() => Promise.resolve()),
    revokeSessions: vi.fn(() => Promise.resolve(2)),
    inviteStaff: vi.fn(() => Promise.resolve({ user_id: "new", link: "https://example/verify?token=abc" })),
    createPosition: vi.fn(() => Promise.resolve("p3")),
    revokeRole: vi.fn(() => Promise.resolve()),
    fetchProgramAccess: vi.fn(() => Promise.resolve({ students: { source: "legacy_sync", grantedAt: "2026-10-26T00:00:00Z" } })),
    grantProgram: vi.fn(() => Promise.resolve()),
    revokeProgram: vi.fn(() => Promise.resolve())
  });
  return Object.assign({}, real, lib);
});

const perm = vi.hoisted(() => ({}));
vi.mock("../../lib/permissionAdmin.js", async (importOriginal) => {
  const real = await importOriginal();
  Object.assign(perm, {
    fetchUserAccess: vi.fn(() => Promise.resolve({
      effective: [{ permissionKey: "students.view", programKey: "students", scope: "program", sources: [{ type: "role", name: "Program Lead" }] }],
      overrides: []
    })),
    previewUserChanges: vi.fn(() => Promise.resolve([
      { permission_key: "students.assessments.grade", program_key: "students", before_scope: null, after_scope: "assigned", change: "added" }
    ])),
    applyUserChanges: vi.fn(() => Promise.resolve()),
    previewRolePermissions: vi.fn(() => Promise.resolve([{ user_id: "u1", permission_key: "students.assessments.grade", program_key: "students", change: "added" }])),
    saveRolePermissions: vi.fn(() => Promise.resolve(1)),
    setModuleActive: vi.fn(() => Promise.resolve()),
    fetchProgramMemberCounts: vi.fn(() => Promise.resolve({ students: 3 })),
    fetchAuditEvents: vi.fn(() => Promise.resolve([
      { id: 9, occurredAt: "2026-10-26T10:00:00Z", actorId: "me", action: "update", tableName: "role_permissions", recordId: "r-c",
        subjectUserId: null, changedFields: ["scope"], oldValues: { scope: "own" }, newValues: { scope: "program" }, reason: "Wider reach" }
    ]))
  });
  return Object.assign({}, real, perm);
});

import AdminUsers from "./AdminUsers.jsx";
import AdminUserProfile from "./AdminUserProfile.jsx";
import AdminRoles from "./AdminRoles.jsx";
import AdminRoleDetail from "./AdminRoleDetail.jsx";
import AdminPositions from "./AdminPositions.jsx";
import AdminPrograms from "./AdminPrograms.jsx";
import AdminAudit from "./AdminAudit.jsx";

function renderIn(node) {
  return render(<MemoryRouter>{node}</MemoryRouter>);
}

beforeEach(() => {
  session = { id: "me", role: "administrator" };
  showToast.mockClear();
  Object.values(lib).forEach((fn) => fn.mockClear && fn.mockClear());
});

describe("Staff accounts list", () => {
  it("shows every account with its status and filters by status", async () => {
    renderIn(<AdminUsers />);
    await screen.findAllByText("Ann Active");
    expect(screen.getAllByText(tr("adminStatusInvited")).length).toBeGreaterThan(0);
    expect(screen.getAllByText(tr("adminStatusInactive")).length).toBeGreaterThan(0);
    expect(screen.getAllByText(tr("adminStatusDeactivated")).length).toBeGreaterThan(0);
    fireEvent.change(screen.getByLabelText(tr("statusLabel")), { target: { value: "inactive" } });
    expect(screen.queryAllByText("Ann Active")).toHaveLength(0);
    expect(screen.getAllByText("Pat Pending").length).toBeGreaterThan(0);
  });

  it("invites by link and shows the link once", async () => {
    renderIn(<AdminUsers />);
    await screen.findAllByText("Ann Active");
    fireEvent.click(screen.getByRole("button", { name: tr("adminInviteStaff") }));
    const dialog = await screen.findByRole("dialog");
    fireEvent.click(within(dialog).getByRole("button", { name: tr("adminSendInvite") }));
    expect(within(dialog).getByText(tr("adminNameRequired"))).toBeTruthy();
    expect(lib.inviteStaff).not.toHaveBeenCalled();
    fireEvent.change(within(dialog).getByLabelText(/Full name/), { target: { value: "New Person" } });
    fireEvent.change(within(dialog).getByLabelText(/Email/), { target: { value: "ANN@nb4hs.org" } });
    fireEvent.click(within(dialog).getByRole("button", { name: tr("adminSendInvite") }));
    expect(within(dialog).getByText(tr("duplicateEmail"))).toBeTruthy();
    fireEvent.change(within(dialog).getByLabelText(/Email/), { target: { value: "new@nb4hs.org" } });
    fireEvent.click(within(dialog).getByRole("button", { name: tr("adminDeliveryLink") }));
    fireEvent.click(within(dialog).getByRole("button", { name: tr("adminCreateInviteLink") }));
    await waitFor(() => expect(lib.inviteStaff).toHaveBeenCalledWith({ email: "new@nb4hs.org", name: "New Person", role: "staff", delivery: "link" }));
    expect(await screen.findByDisplayValue("https://example/verify?token=abc")).toBeTruthy();
  });
});

describe("One account", () => {
  it("offers the right actions and asks for a reason before deactivating", async () => {
    renderIn(<AdminUserProfile userId="u1" />);
    await screen.findByRole("heading", { name: "Ann Active" });
    expect(screen.getByRole("button", { name: tr("adminSendReset") })).toBeTruthy();
    expect(screen.getByRole("button", { name: tr("adminSignOutEverywhere") })).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: tr("adminDeactivate") }));
    const dialog = await screen.findByRole("dialog");
    fireEvent.click(within(dialog).getByRole("button", { name: tr("adminDeactivate") }));
    expect(within(dialog).getByText(tr("adminReasonRequired"))).toBeTruthy();
    expect(lib.setAccountActive).not.toHaveBeenCalled();
    fireEvent.change(within(dialog).getByRole("textbox"), { target: { value: "Left the organisation" } });
    fireEvent.click(within(dialog).getByRole("button", { name: tr("adminDeactivate") }));
    await waitFor(() => expect(lib.setAccountActive).toHaveBeenCalledWith("u1", false, "Left the organisation"));
  });

  it("activates an inactive account and reactivates a deactivated one", async () => {
    const { unmount } = renderIn(<AdminUserProfile userId="u3" />);
    expect(await screen.findByRole("button", { name: tr("adminApprove") })).toBeTruthy();
    expect(screen.queryByRole("button", { name: tr("adminDeactivate") })).toBeNull();
    unmount();
    renderIn(<AdminUserProfile userId="u4" />);
    expect(await screen.findByRole("button", { name: tr("adminReactivate") })).toBeTruthy();
    // Old sessions on a switched-off account can still be ended.
    expect(screen.getByRole("button", { name: tr("adminSignOutEverywhere") })).toBeTruthy();
  });

  it("gives no account actions on your own account", async () => {
    renderIn(<AdminUserProfile userId="me" />);
    await screen.findByText(tr("adminOwnAccountTitle"));
    expect(screen.queryByRole("button", { name: tr("adminDeactivate") })).toBeNull();
    expect(screen.queryByRole("button", { name: tr("adminSignOutEverywhere") })).toBeNull();
  });

  it("says roles don't change access yet, and only removes hand-given roles", async () => {
    renderIn(<AdminUserProfile userId="u1" />);
    await screen.findByRole("heading", { name: "Ann Active" });
    fireEvent.click(screen.getByRole("tab", { name: /Roles/ }));
    expect(screen.getByText(tr("adminRolesNotLiveTitle"))).toBeTruthy();
    expect(screen.getAllByRole("button", { name: tr("adminRemove") })).toHaveLength(1);
  });
});

describe("Program access", () => {
  it("shows automatic access read-only and gives a program with a reason", async () => {
    renderIn(<AdminUserProfile userId="u1" />);
    await screen.findByRole("heading", { name: "Ann Active" });
    fireEvent.click(screen.getByRole("tab", { name: tr("adminTabPrograms") }));
    expect(await screen.findByText(tr("adminProgramAutomatic"))).toBeTruthy();
    const buttons = screen.getAllByRole("button", { name: tr("adminGiveAccess") });
    expect(buttons).toHaveLength(1); // Workforce only; Students is automatic
    expect(screen.queryByRole("button", { name: tr("adminRemove") })).toBeNull();
    fireEvent.click(buttons[0]);
    const dialog = await screen.findByRole("dialog");
    fireEvent.change(within(dialog).getByRole("textbox"), { target: { value: "Covering referrals" } });
    fireEvent.click(within(dialog).getByRole("button", { name: tr("adminGiveAccess") }));
    await waitFor(() => expect(lib.grantProgram).toHaveBeenCalledWith("u1", "workforce", "Covering referrals"));
  });

  it("offers no changes on your own account", async () => {
    renderIn(<AdminUserProfile userId="me" />);
    await screen.findByText(tr("adminOwnAccountTitle"));
    fireEvent.click(screen.getByRole("tab", { name: tr("adminTabPrograms") }));
    await screen.findByText(tr("adminProgramAutomatic"));
    expect(screen.queryByRole("button", { name: tr("adminGiveAccess") })).toBeNull();
  });
});

describe("Roles", () => {
  it("lists roles in use, archived on request", async () => {
    renderIn(<AdminRoles />);
    expect((await screen.findAllByText("Program Lead")).length).toBeGreaterThan(0);
    expect(screen.queryAllByText("Old Role")).toHaveLength(0);
    fireEvent.click(screen.getByRole("button", { name: tr("adminArchived") }));
    expect(screen.getAllByText("Old Role").length).toBeGreaterThan(0);
  });

  it("keeps automatic roles read-only and shows a custom role's permissions and people", async () => {
    const { unmount } = renderIn(<AdminRoleDetail roleId="r-legacy" />);
    await screen.findByText(tr("adminLegacyRoleTitle"));
    expect(screen.queryByRole("button", { name: tr("editLabel") })).toBeNull();
    unmount();
    renderIn(<AdminRoleDetail roleId="r-c" />);
    await screen.findByText("Open Students");
    expect(screen.getByText(tr("adminScopeProgram"))).toBeTruthy();
    expect(screen.getByRole("link", { name: "Ann Active" })).toBeTruthy();
    expect(screen.getByRole("button", { name: tr("editLabel") })).toBeTruthy();
  });
});

describe("Positions", () => {
  it("adds a position", async () => {
    renderIn(<AdminPositions />);
    await screen.findAllByText("Receptionist");
    fireEvent.click(screen.getByRole("button", { name: tr("adminNewPosition") }));
    const dialog = await screen.findByRole("dialog");
    fireEvent.change(within(dialog).getByLabelText(/Position name/), { target: { value: "Data Analyst" } });
    fireEvent.click(within(dialog).getByRole("button", { name: tr("adminNewPosition") }));
    await waitFor(() => expect(lib.createPosition).toHaveBeenCalledWith("Data Analyst", ""));
  });
});

describe("Detailed permissions", () => {
  it("shows where each permission comes from", async () => {
    renderIn(<AdminUserProfile userId="u1" />);
    fireEvent.click(await screen.findByRole("tab", { name: tr("adminTabPermissions") }));
    await screen.findByText("Grade assessments");
    expect(screen.getByText("Program Lead")).toBeTruthy();
    expect(screen.getAllByText(tr("adminOriginNone")).length).toBeGreaterThan(0);
  });

  it("stages a sensitive grant, previews it, and needs the typed confirmation and a reason", async () => {
    renderIn(<AdminUserProfile userId="u1" />);
    fireEvent.click(await screen.findByRole("tab", { name: tr("adminTabPermissions") }));
    const trigger = await screen.findByRole("button", { name: tr("adminPermissionActions").replace("{permission}", "Grade assessments") });
    fireEvent.pointerDown(trigger, { button: 0, ctrlKey: false, pointerType: "mouse" });
    fireEvent.click(await screen.findByRole("menuitem", { name: tr("adminGrantIndividually") }));
    const stageDialog = await screen.findByRole("dialog");
    fireEvent.click(within(stageDialog).getByRole("button", { name: tr("adminStageChange") }));
    expect(await screen.findByText(tr("adminOneStaged"))).toBeTruthy();
    expect(perm.applyUserChanges).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole("button", { name: tr("adminReviewAndSave") }));
    const review = await screen.findByRole("dialog");
    await within(review).findByText(tr("adminGains"));
    expect(perm.previewUserChanges).toHaveBeenCalledWith("u1", [expect.objectContaining({ type: "add", permissionKey: "students.assessments.grade", effect: "grant", scope: "assigned", programKey: "students" })]);
    const save = within(review).getByRole("button", { name: tr("adminSaveChanges") });
    expect(save.disabled).toBe(true); // high-risk: type the name first
    fireEvent.change(within(review).getByLabelText(tr("adminTypeToConfirm").replace("{phrase}", "Ann Active")), { target: { value: "ann active" } });
    expect(save.disabled).toBe(false);
    fireEvent.click(save);
    expect(await within(review).findByText(tr("adminReasonRequired"))).toBeTruthy();
    fireEvent.change(within(review).getByLabelText(/Reason/), { target: { value: "Covering grading this term" } });
    fireEvent.click(save);
    await waitFor(() => expect(perm.applyUserChanges).toHaveBeenCalledWith("u1", expect.any(Array), "Covering grading this term"));
  });

  it("offers no changes on your own account", async () => {
    renderIn(<AdminUserProfile userId="me" />);
    fireEvent.click(await screen.findByRole("tab", { name: tr("adminTabPermissions") }));
    await screen.findByText("Grade assessments");
    expect(screen.queryByRole("button", { name: /^Change / })).toBeNull();
  });
});

describe("Role permission editor", () => {
  it("is not offered on legacy or protected roles", async () => {
    const { unmount } = renderIn(<AdminRoleDetail roleId="r-legacy" />);
    await screen.findByText(tr("adminLegacyRoleTitle"));
    expect(screen.queryByRole("button", { name: tr("adminEditPermissions") })).toBeNull();
    unmount();
    renderIn(<AdminRoleDetail roleId="r-sys" />);
    await screen.findByText(tr("adminBuiltinRoleBody"));
    expect(screen.queryByRole("button", { name: tr("adminEditPermissions") })).toBeNull();
  });

  it("previews who is affected before saving the new list", async () => {
    renderIn(<AdminRoleDetail roleId="r-c" />);
    fireEvent.click(await screen.findByRole("button", { name: tr("adminEditPermissions") }));
    fireEvent.click(await screen.findByLabelText(/Grade assessments/));
    fireEvent.click(screen.getByRole("button", { name: tr("adminReviewAndSave") }));
    const review = await screen.findByRole("dialog");
    await within(review).findByText(tr("adminAffectsOne"));
    expect(within(review).getByText("Ann Active")).toBeTruthy();
    expect(perm.previewRolePermissions).toHaveBeenCalledWith("r-c", { "students.view": "program", "students.assessments.grade": "assigned" });
    fireEvent.change(within(review).getByLabelText(tr("adminTypeToConfirm").replace("{phrase}", "Program Lead")), { target: { value: "Program Lead" } });
    fireEvent.change(within(review).getByLabelText(/Reason/), { target: { value: "Leads grade now" } });
    fireEvent.click(within(review).getByRole("button", { name: tr("adminSaveChanges") }));
    await waitFor(() => expect(perm.saveRolePermissions).toHaveBeenCalledWith("r-c", { "students.view": "program", "students.assessments.grade": "assigned" }, "Leads grade now"));
  });
});

describe("Programs & Modules", () => {
  it("turns a module off only with a reason", async () => {
    renderIn(<AdminPrograms />);
    await screen.findByText(tr("adminProgramPeople").replace("{n}", 3));
    fireEvent.click(screen.getAllByRole("button", { name: tr("adminTurnOff") })[1]);
    const dialog = await screen.findByRole("dialog");
    fireEvent.click(within(dialog).getByRole("button", { name: tr("adminTurnOff") }));
    expect(perm.setModuleActive).not.toHaveBeenCalled();
    fireEvent.change(within(dialog).getByLabelText(/Reason/), { target: { value: "Pausing assessments" } });
    fireEvent.click(within(dialog).getByRole("button", { name: tr("adminTurnOff") }));
    await waitFor(() => expect(perm.setModuleActive).toHaveBeenCalledWith("students.assessments", false, "Pausing assessments"));
  });
});

describe("Access audit log", () => {
  it("lists changes with their reason, shows the diff and filters on the server", async () => {
    renderIn(<AdminAudit />);
    const row = (await screen.findByText(/Wider reach/)).closest("button");
    expect(row.getAttribute("aria-expanded")).toBe("false");
    fireEvent.click(row);
    expect(await screen.findByText("own")).toBeTruthy();
    expect(screen.getByText("program")).toBeTruthy();
    fireEvent.change(screen.getByLabelText(tr("adminAuditWho")), { target: { value: "u1" } });
    await waitFor(() => expect(perm.fetchAuditEvents).toHaveBeenLastCalledWith(expect.objectContaining({ actor: "u1" })));
  });
});
