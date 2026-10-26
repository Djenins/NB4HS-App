// permissionAdmin.js -- data and rules for Phase 5 of the access model
// (plans/unified-access-architecture.md §6, §13): the Detailed Permissions
// tab, the role permission editor, Programs & Modules, the Access Audit Log
// and organization settings.
//
// The database decides (p5a_permission_admin: admin_add_override,
// admin_set_role_permissions, preview_role_permissions,
// admin_set_module_active, admin_set_setting, plus p1b's
// preview_effective_permissions and guard_access_change). These helpers only
// shape what the screens show: the permission tree, where each permission
// comes from, what a staged change would do, and which changes need the
// high-risk confirmation.
import { supabase } from "./supabase.js";

export var SCOPES = ["own", "assigned", "team", "program", "org"];

// ---------- the permission tree ----------

// The program a module belongs to ("" for shared and administration ones),
// found by walking up to its root.
export function programOf(moduleKey, modulesByKey) {
  var m = modulesByKey[moduleKey];
  while (m && m.parentKey) m = modulesByKey[m.parentKey];
  return m && m.kind === "program" ? m.key : "";
}

// Modules with screens that have permissions (directly or below), as a tree
// in catalogue order: [{ module, programKey, permissions, children }].
export function permissionTree(catalog) {
  var byKey = {};
  catalog.modules.forEach(function (m) { byKey[m.key] = m; });
  var perms = {};
  catalog.permissions.forEach(function (p) { (perms[p.moduleKey] = perms[p.moduleKey] || []).push(p); });
  function node(m) {
    return {
      module: m,
      programKey: programOf(m.key, byKey),
      permissions: (perms[m.key] || []).slice().sort(function (a, b) { return a.sortOrder - b.sortOrder; }),
      children: catalog.modules.filter(function (c) { return c.parentKey === m.key && c.implemented; }).map(node).filter(nonEmpty)
    };
  }
  function nonEmpty(n) { return n.permissions.length > 0 || n.children.length > 0; }
  return catalog.modules.filter(function (m) { return !m.parentKey && m.implemented; }).map(node).filter(nonEmpty);
}

// ---------- one person's access ----------

function active(o, now) {
  return !o.revokedAt && (!o.expiresAt || new Date(o.expiresAt) > now);
}

// Where one permission stands for a person: held or not, at what scope, which
// roles give it, and any individual grant or deny on it.
export function permissionState(permissionKey, effective, overrides, now) {
  var at = now || new Date();
  var row = effective.find(function (e) { return e.permissionKey === permissionKey; });
  var mine = overrides.filter(function (o) { return o.permissionKey === permissionKey && active(o, at); });
  var roles = [];
  if (row) {
    (row.sources || []).forEach(function (s) {
      if (s.type === "role" && roles.indexOf(s.name) === -1) roles.push(s.name);
    });
  }
  return {
    held: !!row,
    scope: row ? row.scope || null : null,
    roles: roles,
    grant: mine.find(function (o) { return o.effect === "grant"; }) || null,
    deny: mine.find(function (o) { return o.effect === "deny"; }) || null
  };
}

// Staged changes on the Detailed Permissions tab:
//   { type: "add", permissionKey, effect, scope, programKey, expiresAt }
//   { type: "revoke", id, permissionKey }
// -> the p_changes preview_effective_permissions() expects.
export function previewPayload(changes, reason) {
  return {
    add_overrides: changes.filter(function (c) { return c.type === "add"; }).map(function (c) {
      return { permission_key: c.permissionKey, effect: c.effect, scope: c.scope || null, program_key: c.programKey || null, reason: reason || "preview" };
    }),
    revoke_overrides: changes.filter(function (c) { return c.type === "revoke"; }).map(function (c) { return c.id; })
  };
}

// Preview rows -> what moves, leaving out what stays the same.
export function summarizePreview(rows) {
  var out = { added: [], removed: [], changed: [] };
  (rows || []).forEach(function (r) {
    var item = { permissionKey: r.permission_key, programKey: r.program_key || "", before: r.before_scope, after: r.after_scope };
    if (r.change === "added") out.added.push(item);
    else if (r.change === "removed") out.removed.push(item);
    else if (r.change === "scope_changed") out.changed.push(item);
  });
  return out;
}

// Sensitive participant data and administration powers need the typed
// confirmation (§6: "High-risk items ... need a typed confirmation and a
// reason").
export function isHighRisk(permissionKeys, permissionsByKey) {
  return permissionKeys.some(function (k) {
    var p = permissionsByKey[k];
    return !!p && p.sensitivity !== "normal";
  });
}

// ---------- a role's permissions ----------

// { permissionKey: scope | null } for one role.
export function roleDraft(rolePermissions, roleId) {
  var out = {};
  rolePermissions.forEach(function (rp) { if (rp.roleId === roleId) out[rp.permissionKey] = rp.scope || null; });
  return out;
}

export function draftList(draft) {
  return Object.keys(draft).sort().map(function (k) { return { key: k, scope: draft[k] || null }; });
}

export function diffDraft(before, after) {
  var out = { added: [], removed: [], changed: [] };
  Object.keys(after).sort().forEach(function (k) {
    if (!(k in before)) out.added.push({ key: k, scope: after[k] });
    else if ((before[k] || null) !== (after[k] || null)) out.changed.push({ key: k, from: before[k] || null, to: after[k] || null });
  });
  Object.keys(before).sort().forEach(function (k) { if (!(k in after)) out.removed.push({ key: k, scope: before[k] }); });
  return out;
}

// preview_role_permissions rows -> per person: { userId: { added, removed, changed } }.
export function summarizeRolePreview(rows) {
  var people = {};
  (rows || []).forEach(function (r) {
    var p = people[r.user_id] = people[r.user_id] || { added: 0, removed: 0, changed: 0 };
    if (r.change === "added") p.added++;
    else if (r.change === "removed") p.removed++;
    else p.changed++;
  });
  return people;
}

// Can this role's permissions be edited here? Legacy roles follow the
// account type; protected built-ins are fixed (the database refuses both).
export function roleEditable(role) {
  return !!role && !role.protected && role.kind !== "legacy" && !role.archivedAt;
}

// ---------- the audit log ----------

// Access and account tables: these keep full before/after values and hold
// no participant data (audit_values_table, p1a and p5a).
export var ACCESS_AUDIT_TABLES = [
  "profiles", "workforce_role_access", "program_staff", "app_modules", "roles", "role_permissions",
  "user_roles", "user_permission_overrides", "user_program_access", "positions", "user_positions",
  "position_role_suggestions", "teams", "team_members", "app_settings"
];

// The audit log's area names, by table.
export var AUDIT_TABLE_LABEL = {
  profiles: "adminAuditTblProfiles", workforce_role_access: "adminAuditTblWorkforceAccess", program_staff: "adminAuditTblProgramStaff",
  app_modules: "adminAuditTblModules", roles: "adminAuditTblRoles", role_permissions: "adminAuditTblRolePermissions",
  user_roles: "adminAuditTblUserRoles", user_permission_overrides: "adminAuditTblOverrides", user_program_access: "adminAuditTblProgramAccess",
  positions: "adminAuditTblPositions", user_positions: "adminAuditTblUserPositions", position_role_suggestions: "adminAuditTblSuggestions",
  teams: "adminAuditTblTeams", team_members: "adminAuditTblTeamMembers", app_settings: "adminAuditTblSettings"
};

// What an entry is about, from the row it recorded: the permission, module,
// program or setting -- the field that stays the same while others change.
export function auditRecordLabel(e) {
  var v = e.newValues || e.oldValues || {};
  return v.permission_key || v.program_key || v.key || v.name || v.name_en || "";
}

var IGNORED_FIELDS = ["updated_at", "created_at", "id"];

// Fields that changed between two row snapshots: [{ field, from, to }].
export function valueDiff(oldValues, newValues) {
  var a = oldValues || {};
  var b = newValues || {};
  var keys = Object.keys(Object.assign({}, a, b)).filter(function (k) { return IGNORED_FIELDS.indexOf(k) === -1; }).sort();
  return keys.filter(function (k) { return JSON.stringify(a[k]) !== JSON.stringify(b[k]); })
    .map(function (k) { return { field: k, from: a[k] === undefined ? null : a[k], to: b[k] === undefined ? null : b[k] }; });
}

function csvCell(v) {
  var s = v == null ? "" : String(v);
  // Spreadsheet formula injection: a leading = + - @ would run as a formula.
  if (/^[=+\-@]/.test(s)) s = "'" + s;
  return /[",\n\r]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s;
}

export function auditCsv(events, nameOf) {
  var header = ["When", "Who", "Action", "Table", "Record", "About", "Changed", "Reason"];
  var lines = [header.join(",")];
  events.forEach(function (e) {
    lines.push([
      e.occurredAt, nameOf(e.actorId), e.action, e.tableName, e.recordId, nameOf(e.subjectUserId),
      (e.changedFields || []).join(" "), e.reason
    ].map(csvCell).join(","));
  });
  return lines.join("\r\n");
}

// ---------- data ----------

export async function fetchUserAccess(userId) {
  const [eff, ovr] = await Promise.all([
    supabase.from("user_effective_permissions").select("permission_key, program_key, scope, sources").eq("user_id", userId),
    supabase.from("user_permission_overrides").select("*").eq("user_id", userId).is("revoked_at", null)
  ]);
  if (eff.error) throw eff.error;
  if (ovr.error) throw ovr.error;
  return {
    effective: eff.data.map((e) => ({ permissionKey: e.permission_key, programKey: e.program_key || "", scope: e.scope, sources: e.sources || [] })),
    overrides: ovr.data.map((o) => ({
      id: o.id, permissionKey: o.permission_key, effect: o.effect, scope: o.scope, programKey: o.program_key || "",
      reason: o.reason, grantedBy: o.granted_by, grantedAt: o.granted_at, expiresAt: o.expires_at, revokedAt: o.revoked_at
    }))
  };
}

export async function previewUserChanges(userId, changes) {
  const { data, error } = await supabase.rpc("preview_effective_permissions", { p_user: userId, p_changes: previewPayload(changes) });
  if (error) throw error;
  return data || [];
}

// Applies staged changes one by one: revocations first, so replacing a grant
// with a deny never briefly holds both.
export async function applyUserChanges(userId, changes, reason) {
  for (const c of changes.filter((x) => x.type === "revoke")) {
    const { error } = await supabase.rpc("admin_revoke_override", { p_override: c.id, p_reason: reason });
    if (error) throw error;
  }
  for (const c of changes.filter((x) => x.type === "add")) {
    const { error } = await supabase.rpc("admin_add_override", {
      p_user: userId, p_permission: c.permissionKey, p_effect: c.effect, p_scope: c.scope || null,
      p_program: c.programKey || null, p_expires_at: c.expiresAt || null, p_reason: reason
    });
    if (error) throw error;
  }
}

export async function previewRolePermissions(roleId, draft) {
  const { data, error } = await supabase.rpc("preview_role_permissions", { p_role: roleId, p_permissions: draftList(draft) });
  if (error) throw error;
  return data || [];
}

export async function saveRolePermissions(roleId, draft, reason) {
  const { data, error } = await supabase.rpc("admin_set_role_permissions", { p_role: roleId, p_permissions: draftList(draft), p_reason: reason });
  if (error) throw error;
  return data;
}

export async function setModuleActive(moduleKey, isActive, reason) {
  const { error } = await supabase.rpc("admin_set_module_active", { p_key: moduleKey, p_active: isActive, p_reason: reason });
  if (error) throw error;
}

// How many people can open each program: { programKey: count }.
export async function fetchProgramMemberCounts() {
  const { data, error } = await supabase.from("user_program_access").select("program_key, user_id").is("revoked_at", null);
  if (error) throw error;
  const out = {};
  data.forEach((r) => { out[r.program_key] = (out[r.program_key] || 0) + 1; });
  return out;
}

export var AUDIT_PAGE = 100;

// Newest first, AUDIT_PAGE at a time; `before` is the last row's id.
export async function fetchAuditEvents(f) {
  let q = supabase.from("audit_events")
    .select("id, occurred_at, actor_id, action, table_name, record_id, subject_user_id, changed_fields, old_values, new_values, reason")
    .in("table_name", f.table ? [f.table] : ACCESS_AUDIT_TABLES)
    .order("id", { ascending: false })
    .limit(AUDIT_PAGE);
  if (f.actor) q = q.eq("actor_id", f.actor);
  if (f.subject) q = q.eq("subject_user_id", f.subject);
  if (f.action) q = q.eq("action", f.action);
  if (f.from) q = q.gte("occurred_at", f.from);
  if (f.to) q = q.lt("occurred_at", f.to);
  if (f.before) q = q.lt("id", f.before);
  const { data, error } = await q;
  if (error) throw error;
  return data.map((e) => ({
    id: e.id, occurredAt: e.occurred_at, actorId: e.actor_id, action: e.action, tableName: e.table_name, recordId: e.record_id,
    subjectUserId: e.subject_user_id, changedFields: e.changed_fields || [], oldValues: e.old_values, newValues: e.new_values, reason: e.reason || ""
  }));
}

// Organization settings ({ closing_time: "17:00" }); empty until p5a is
// applied or before the first save.
export async function fetchAppSettings() {
  const { data, error } = await supabase.from("app_settings").select("key, value");
  if (error) throw error;
  const out = {};
  data.forEach((r) => { out[r.key] = r.value; });
  return out;
}

export async function saveAppSetting(key, value, reason) {
  const { error } = await supabase.rpc("admin_set_setting", { p_key: key, p_value: value, p_reason: reason || null });
  if (error) throw error;
}
