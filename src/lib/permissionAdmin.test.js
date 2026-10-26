// The pure rules behind Phase 5's permission screens: the tree, where a
// permission comes from, what staged changes send, the high-risk test, role
// edits, the audit diff and CSV, and which closing time applies.
import { describe, expect, it, vi } from "vitest";

vi.mock("./supabase.js", () => ({ supabase: null }));
const {
  auditCsv, auditRecordLabel, diffDraft, draftList, isHighRisk, permissionState, permissionTree, previewPayload, programOf, roleDraft,
  roleEditable, summarizePreview, summarizeRolePreview, valueDiff
} = await import("./permissionAdmin.js");
const { effectiveClosingTime } = await import("./storage.js");

const CATALOG = {
  modules: [
    { key: "students", parentKey: null, kind: "program", name: "Students", implemented: true },
    { key: "students.assessments", parentKey: "students", kind: "submodule", name: "Assessments", implemented: true },
    { key: "students.future", parentKey: "students", kind: "submodule", name: "Later", implemented: false },
    { key: "calendar", parentKey: null, kind: "shared", name: "Calendar", implemented: true },
    { key: "workforce", parentKey: null, kind: "program", name: "No permissions here", implemented: true },
    { key: "reports", parentKey: null, kind: "shared", name: "Not built", implemented: false }
  ],
  permissions: [
    { key: "students.edit", moduleKey: "students", sortOrder: 2, sensitivity: "normal" },
    { key: "students.view", moduleKey: "students", sortOrder: 1, sensitivity: "normal" },
    { key: "students.assessments.grade", moduleKey: "students.assessments", sortOrder: 1, sensitivity: "sensitive" },
    { key: "calendar.view", moduleKey: "calendar", sortOrder: 1, sensitivity: "normal" },
    { key: "admin.users.view", moduleKey: "admin.users", sortOrder: 1, sensitivity: "system" }
  ]
};
const BY_KEY = {};
CATALOG.permissions.forEach((p) => { BY_KEY[p.key] = p; });

describe("permission tree", () => {
  it("nests implemented modules that have permissions, in catalogue order", () => {
    const tree = permissionTree(CATALOG);
    expect(tree.map((n) => n.module.key)).toEqual(["students", "calendar"]);
    expect(tree[0].permissions.map((p) => p.key)).toEqual(["students.view", "students.edit"]);
    expect(tree[0].children.map((n) => n.module.key)).toEqual(["students.assessments"]);
    expect(tree[0].children[0].programKey).toBe("students");
    expect(tree[1].programKey).toBe("");
  });

  it("finds a module's program by its root", () => {
    const byKey = {};
    CATALOG.modules.forEach((m) => { byKey[m.key] = m; });
    expect(programOf("students.assessments", byKey)).toBe("students");
    expect(programOf("calendar", byKey)).toBe("");
  });
});

describe("one person's permission", () => {
  const effective = [
    { permissionKey: "students.view", programKey: "students", scope: "program",
      sources: [{ type: "role", name: "Program Staff" }, { type: "role", name: "Program Staff" }, { type: "role", name: "Front Desk" }] }
  ];
  const overrides = [
    { id: "o1", permissionKey: "students.edit", effect: "deny", reason: "x", expiresAt: null, revokedAt: null },
    { id: "o2", permissionKey: "calendar.view", effect: "grant", reason: "x", expiresAt: "2026-01-01T00:00:00Z", revokedAt: null }
  ];
  const now = new Date("2026-10-26T12:00:00Z");

  it("names each role once and shows the scope", () => {
    expect(permissionState("students.view", effective, overrides, now)).toEqual({
      held: true, scope: "program", roles: ["Program Staff", "Front Desk"], grant: null, deny: null
    });
  });

  it("shows active overrides and ignores expired ones", () => {
    expect(permissionState("students.edit", effective, overrides, now).deny.id).toBe("o1");
    expect(permissionState("calendar.view", effective, overrides, now).grant).toBeNull();
  });
});

describe("staged changes", () => {
  const staged = [
    { type: "add", permissionKey: "calendar.view", effect: "grant", scope: null, programKey: "" },
    { type: "revoke", id: "o1", permissionKey: "students.edit" }
  ];

  it("become the preview's add and revoke lists", () => {
    expect(previewPayload(staged)).toEqual({
      add_overrides: [{ permission_key: "calendar.view", effect: "grant", scope: null, program_key: null, reason: "preview" }],
      revoke_overrides: ["o1"]
    });
  });

  it("summarize what moves and drop what doesn't", () => {
    const s = summarizePreview([
      { permission_key: "a", program_key: "", before_scope: null, after_scope: null, change: "added" },
      { permission_key: "b", program_key: "students", before_scope: "own", after_scope: null, change: "removed" },
      { permission_key: "c", program_key: "students", before_scope: "own", after_scope: "org", change: "scope_changed" },
      { permission_key: "d", program_key: "", before_scope: null, after_scope: null, change: "unchanged" }
    ]);
    expect([s.added.length, s.removed.length, s.changed.length]).toEqual([1, 1, 1]);
    expect(s.changed[0]).toEqual({ permissionKey: "c", programKey: "students", before: "own", after: "org" });
  });

  it("are high-risk when they touch sensitive data or administration", () => {
    expect(isHighRisk(["calendar.view", "students.view"], BY_KEY)).toBe(false);
    expect(isHighRisk(["students.assessments.grade"], BY_KEY)).toBe(true);
    expect(isHighRisk(["admin.users.view"], BY_KEY)).toBe(true);
    expect(isHighRisk(["unknown.key"], BY_KEY)).toBe(false);
  });
});

describe("role edits", () => {
  const rolePerms = [
    { roleId: "r", permissionKey: "students.view", scope: "program" },
    { roleId: "r", permissionKey: "calendar.view", scope: null },
    { roleId: "other", permissionKey: "students.edit", scope: "own" }
  ];

  it("diff added, removed and rescoped permissions", () => {
    const before = roleDraft(rolePerms, "r");
    expect(before).toEqual({ "students.view": "program", "calendar.view": null });
    const after = { "students.view": "assigned", "students.edit": "own" };
    expect(diffDraft(before, after)).toEqual({
      added: [{ key: "students.edit", scope: "own" }],
      removed: [{ key: "calendar.view", scope: null }],
      changed: [{ key: "students.view", from: "program", to: "assigned" }]
    });
    expect(draftList(after)).toEqual([{ key: "students.edit", scope: "own" }, { key: "students.view", scope: "assigned" }]);
  });

  it("count each person's gains and losses from the preview", () => {
    expect(summarizeRolePreview([
      { user_id: "u1", change: "added" }, { user_id: "u1", change: "added" }, { user_id: "u1", change: "removed" },
      { user_id: "u2", change: "scope_changed" }
    ])).toEqual({ u1: { added: 2, removed: 1, changed: 0 }, u2: { added: 0, removed: 0, changed: 1 } });
  });

  it("are allowed on custom and unprotected built-in roles only", () => {
    expect(roleEditable({ kind: "custom" })).toBe(true);
    expect(roleEditable({ kind: "builtin", protected: false })).toBe(true);
    expect(roleEditable({ kind: "builtin", protected: true })).toBe(false);
    expect(roleEditable({ kind: "legacy" })).toBe(false);
    expect(roleEditable({ kind: "custom", archivedAt: "2026-01-01" })).toBe(false);
  });
});

describe("audit log", () => {
  it("diffs the changed fields only", () => {
    expect(valueDiff(
      { id: "x", scope: "own", reason: "a", updated_at: "1", revoked_at: null },
      { id: "x", scope: "org", reason: "a", updated_at: "2", revoked_at: "2026-10-26" }
    )).toEqual([{ field: "revoked_at", from: null, to: "2026-10-26" }, { field: "scope", from: "own", to: "org" }]);
    expect(valueDiff(null, { key: "closing_time", value: "18:00" })).toEqual([
      { field: "key", from: null, to: "closing_time" }, { field: "value", from: null, to: "18:00" }
    ]);
  });

  it("names what an entry is about", () => {
    expect(auditRecordLabel({ newValues: { permission_key: "students.edit", scope: "own" } })).toBe("students.edit");
    expect(auditRecordLabel({ oldValues: { key: "food_distribution", active: true }, newValues: null })).toBe("food_distribution");
    expect(auditRecordLabel({})).toBe("");
  });

  it("exports CSV with quoting and no spreadsheet formulas", () => {
    const csv = auditCsv([{
      occurredAt: "2026-10-26T10:00:00Z", actorId: "a", action: "update", tableName: "roles", recordId: "r1",
      subjectUserId: null, changedFields: ["name"], reason: '=HYPERLINK("x"), "quoted"'
    }], (id) => (id === "a" ? "Admin, A." : ""));
    const row = csv.split("\r\n")[1];
    expect(row).toBe('2026-10-26T10:00:00Z,"Admin, A.",update,roles,r1,,name,"\'=HYPERLINK(""x""), ""quoted"""');
  });
});

describe("closing time", () => {
  it("uses the organization's when set, else this browser's", () => {
    expect(effectiveClosingTime({ closing_time: "18:30" }, { closingTime: "17:00" })).toBe("18:30");
    expect(effectiveClosingTime({}, { closingTime: "16:00" })).toBe("16:00");
    expect(effectiveClosingTime({ closing_time: "late" }, {})).toBe("17:00");
  });
});
