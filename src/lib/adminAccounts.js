// adminAccounts.js -- data and rules for the Administration area: staff
// accounts, their positions and roles, and the roles and positions
// catalogues (plans/unified-access-architecture.md §6, Phase 2).
//
// Everything here is enforced in the database (p2a_admin_accounts: the
// admin_* functions, RLS and guard_access_change from p1b) or by the
// admin-users Edge Function. These helpers only shape what the screens show
// and turn database refusals into messages.
import { supabase } from "./supabase.js";

// ---------- pure rules ----------

// The legacy account types an invite can start someone on. Administrator is
// never one: promoting someone is a separate, confirmed step.
export var INVITE_ROLES = ["staff", "receptionist", "case_manager", "job_developer"];

// active      can sign in
// invited     active, invite sent, has never signed in
// pending     signed up on their own and waits for an admin to approve them
// deactivated switched off by an admin (sign-in blocked)
export function accountStatus(u) {
  if (!u.active) return u.deactivatedAt ? "deactivated" : "pending";
  if (u.invitedAt && !u.lastSignInAt) return "invited";
  return "active";
}

export var ACCOUNT_STATUSES = ["active", "invited", "pending", "deactivated"];

// Free-text query over name, email and position; exact status and account type.
export function filterAccounts(list, f) {
  var q = (f.query || "").trim().toLowerCase();
  return list.filter(function (u) {
    if (f.status && accountStatus(u) !== f.status) return false;
    if (f.role && u.role !== f.role) return false;
    if (!q) return true;
    var hay = [u.name, u.email].concat(u.positions.map(function (p) { return p.name; })).join(" ").toLowerCase();
    return hay.indexOf(q) !== -1;
  });
}

function cmp(a, b) { return a < b ? -1 : a > b ? 1 : 0; }

export function sortAccounts(list, sort) {
  var dir = sort.dir === "desc" ? -1 : 1;
  var key = {
    name: function (u) { return (u.name || u.email || "").toLowerCase(); },
    status: function (u) { return ACCOUNT_STATUSES.indexOf(accountStatus(u)); },
    lastSignIn: function (u) { return u.lastSignInAt || ""; }
  }[sort.key] || function (u) { return (u.name || "").toLowerCase(); };
  return list.slice().sort(function (a, b) { return dir * cmp(key(a), key(b)) || cmp(a.email, b.email); });
}

// Roles an admin can hand out by hand: not archived, not the automatic
// legacy mirrors (those follow the account type, Workforce access and
// program staff settings).
export function assignableRoles(roles) {
  return roles.filter(function (r) { return !r.archivedAt && r.kind !== "legacy"; });
}

// Permission rows of one role grouped under their module, in catalogue order:
// [{ module, permissions: [{ key, label, scope }] }].
export function groupRolePermissions(rolePermissions, permissions, modules) {
  var byKey = {};
  permissions.forEach(function (p) { byKey[p.key] = p; });
  var groups = {};
  rolePermissions.forEach(function (rp) {
    var p = byKey[rp.permissionKey];
    if (!p) return;
    (groups[p.moduleKey] = groups[p.moduleKey] || []).push({ key: p.key, label: p.label, scope: rp.scope, sortOrder: p.sortOrder });
  });
  return modules
    .filter(function (m) { return groups[m.key]; })
    .map(function (m) {
      return { module: m, permissions: groups[m.key].sort(function (a, b) { return a.sortOrder - b.sortOrder; }) };
    });
}

// A database or Edge Function refusal -> an i18n key for the toast.
export function adminErrorKey(error) {
  var text = String((error && (error.message || error.error)) || "");
  var code = error && error.code;
  if (/your own (account|access)/i.test(text)) return "adminErrSelf";
  if (/no active System Administrator/i.test(text)) return "adminErrLastAdmin";
  if (/System Administrator/i.test(text)) return "adminErrSystemAdminOnly";
  if (/reason is required/i.test(text)) return "adminErrReason";
  if (/permissions you do not hold|grant permissions you hold/i.test(text)) return "adminErrEscalation";
  if (/already signed in|already_signed_in/i.test(text)) return "adminErrAlreadySignedIn";
  if (/already_registered/i.test(text)) return "adminErrAlreadyRegistered";
  if (/email_failed/i.test(text)) return "adminErrEmailFailed";
  if (/rate_limited/i.test(text)) return "adminErrRateLimited";
  if (/expiry date/i.test(text)) return "adminErrExpiry";
  if (code === "42501" || /forbidden|permission/i.test(text)) return "adminErrForbidden";
  return "userActionError";
}

// ---------- accounts ----------

function toAccount(r) {
  return {
    id: r.id, name: r.name || "", email: r.email || "", role: r.role, active: r.active,
    primaryWorkspace: r.primary_workspace || "",
    createdAt: r.created_at, invitedAt: r.invited_at, deactivatedAt: r.deactivated_at, deactivatedBy: r.deactivated_by,
    lastSignInAt: r.last_sign_in_at, emailConfirmedAt: r.email_confirmed_at, bannedUntil: r.banned_until,
    sessionCount: r.session_count || 0,
    positions: (r.positions || []).map(function (p) { return { id: p.id, name: p.name, isPrimary: p.is_primary }; }),
    roles: (r.roles || []).map(function (x) {
      return { id: x.id, roleId: x.role_id, key: x.key, name: x.name, kind: x.kind, programKey: x.program_key || "", source: x.source, expiresAt: x.expires_at };
    })
  };
}

export async function fetchAccounts() {
  const { data, error } = await supabase.rpc("admin_users");
  if (error) throw error;
  return (data || []).map(toAccount);
}

export async function fetchAccount(userId) {
  const { data, error } = await supabase.rpc("admin_users", { p_user: userId });
  if (error) throw error;
  return data && data[0] ? toAccount(data[0]) : null;
}

export async function setAccountActive(userId, active, reason) {
  const { error } = await supabase.rpc("admin_set_user_active", { p_user: userId, p_active: active, p_reason: reason });
  if (error) throw error;
}

export async function revokeSessions(userId, reason) {
  const { data, error } = await supabase.rpc("admin_revoke_sessions", { p_user: userId, p_reason: reason });
  if (error) throw error;
  return data;
}

// The admin-users Edge Function (invite, resend_invite, password_reset).
// Errors come back as { error, detail } with an HTTP status; surface them as
// thrown objects adminErrorKey() understands.
async function callAccountsFunction(body) {
  const { data, error } = await supabase.functions.invoke("admin-users", { body });
  if (!error) return data;
  let detail = null;
  try { detail = error.context && typeof error.context.json === "function" ? await error.context.json() : null; } catch (e) { detail = null; }
  throw { message: detail ? [detail.error, detail.detail].filter(Boolean).join(": ") : error.message };
}

export function inviteStaff(fields) {
  return callAccountsFunction({ action: "invite", email: fields.email, name: fields.name, role: fields.role, delivery: fields.delivery, reason: fields.reason });
}

export function resendInvite(userId, delivery, reason) {
  return callAccountsFunction({ action: "resend_invite", user_id: userId, delivery, reason });
}

export function sendPasswordReset(userId, reason) {
  return callAccountsFunction({ action: "password_reset", user_id: userId, reason });
}

export async function updateAccountProfile(userId, patch) {
  const row = {};
  if (patch.name != null) row.name = patch.name;
  if (patch.role != null) row.role = patch.role;
  if (patch.primaryWorkspace !== undefined) row.primary_workspace = patch.primaryWorkspace || null;
  const { error } = await supabase.from("profiles").update(row).eq("id", userId);
  if (error) throw error;
}

// ---------- catalogues ----------

export async function fetchAccessCatalog() {
  const [roles, rolePerms, perms, modules, assignments] = await Promise.all([
    supabase.from("roles").select("*").order("name"),
    supabase.from("role_permissions").select("role_id, permission_key, scope"),
    supabase.from("permissions").select("key, module_key, scoped, sensitivity, sort_order, description"),
    supabase.from("app_modules").select("key, parent_key, kind, name_en, sort_order, active, implemented").order("sort_order"),
    supabase.from("user_roles").select("role_id, user_id").is("revoked_at", null)
  ]);
  const failed = [roles, rolePerms, perms, modules, assignments].find((r) => r.error);
  if (failed) throw failed.error;
  const permCount = {};
  rolePerms.data.forEach((rp) => { permCount[rp.role_id] = (permCount[rp.role_id] || 0) + 1; });
  const people = {};
  assignments.data.forEach((a) => { (people[a.role_id] = people[a.role_id] || new Set()).add(a.user_id); });
  return {
    roles: roles.data.map((r) => ({
      id: r.id, key: r.key, name: r.name, description: r.description || "", kind: r.kind, protected: r.protected,
      archivedAt: r.archived_at, createdAt: r.created_at,
      permissionCount: permCount[r.id] || 0, peopleCount: people[r.id] ? people[r.id].size : 0
    })),
    rolePermissions: rolePerms.data.map((rp) => ({ roleId: rp.role_id, permissionKey: rp.permission_key, scope: rp.scope })),
    permissions: perms.data.map((p) => ({ key: p.key, moduleKey: p.module_key, scoped: p.scoped, sensitivity: p.sensitivity, sortOrder: p.sort_order, label: p.description })),
    modules: modules.data.map((m) => ({ key: m.key, parentKey: m.parent_key, kind: m.kind, name: m.name_en, active: m.active, implemented: m.implemented })),
    members: assignments.data
  };
}

export async function createRole(name, description, copyFrom) {
  const { data, error } = await supabase.rpc("admin_create_role", { p_name: name, p_description: description || "", p_copy_from: copyFrom || null });
  if (error) throw error;
  return data;
}

export async function updateRole(roleId, patch) {
  const row = {};
  if (patch.name != null) row.name = patch.name;
  if (patch.description != null) row.description = patch.description;
  if (patch.archived !== undefined) row.archived_at = patch.archived ? new Date().toISOString() : null;
  const { error } = await supabase.from("roles").update(row).eq("id", roleId);
  if (error) throw error;
}

export async function assignRole(userId, roleId, programKey, expiresAt, reason) {
  const { error } = await supabase.rpc("admin_assign_role", {
    p_user: userId, p_role: roleId, p_program: programKey || null, p_expires_at: expiresAt || null, p_reason: reason || null
  });
  if (error) throw error;
}

export async function revokeRole(userRoleId, reason) {
  const { error } = await supabase.rpc("admin_revoke_role", { p_user_role: userRoleId, p_reason: reason || null });
  if (error) throw error;
}

export async function fetchPositions() {
  const [positions, holders] = await Promise.all([
    supabase.from("positions").select("*").order("sort_order"),
    supabase.from("user_positions").select("position_id, user_id").is("ended_on", null)
  ]);
  if (positions.error) throw positions.error;
  if (holders.error) throw holders.error;
  const count = {};
  holders.data.forEach((h) => { count[h.position_id] = (count[h.position_id] || 0) + 1; });
  return positions.data.map((p) => ({
    id: p.id, key: p.key, name: p.name_en, description: p.description || "", sortOrder: p.sort_order,
    archivedAt: p.archived_at, peopleCount: count[p.id] || 0
  }));
}

export async function createPosition(name, description) {
  const { data, error } = await supabase.rpc("admin_create_position", { p_name: name, p_description: description || "" });
  if (error) throw error;
  return data;
}

// Haitian Creole and French names follow the English one until translated.
export async function updatePosition(positionId, patch) {
  const row = {};
  if (patch.name != null) { row.name_en = patch.name; row.name_ht = patch.name; row.name_fr = patch.name; }
  if (patch.description != null) row.description = patch.description;
  if (patch.archived !== undefined) row.archived_at = patch.archived ? new Date().toISOString() : null;
  const { error } = await supabase.from("positions").update(row).eq("id", positionId);
  if (error) throw error;
}

export async function addUserPosition(userId, positionId, isPrimary) {
  const { error } = await supabase.from("user_positions").insert({ user_id: userId, position_id: positionId, is_primary: !!isPrimary });
  if (error) throw error;
}

export async function removeUserPosition(userId, positionId) {
  const { error } = await supabase.from("user_positions").delete().eq("user_id", userId).eq("position_id", positionId);
  if (error) throw error;
}

export async function setPrimaryPosition(userId, positionId) {
  const { error } = await supabase.rpc("admin_set_primary_position", { p_user: userId, p_position: positionId });
  if (error) throw error;
}
