// accessLevels.js -- the simple view of access: for each program No access /
// Staff / Manager, plus Front desk and Administrator switches
// (migration a1_simple_access_levels).
//
// Reading: a person's level comes from what they can actually do today
// (user_effective_permissions), whatever gave it to them -- their account
// type, the levels, or a role added on the advanced tabs. So the same summary
// works for everyone, before and after they're switched to levels.
// Saving: admin_set_access_levels() writes the levels and switches the person
// from "follows the account type" to "uses access levels".
import { supabase } from "./supabase.js";

export var ACCESS_PROGRAMS = ["case_management", "students", "workforce", "food_distribution", "snap"];
export var LEVELS = ["none", "staff", "manager"];

// i18n keys for the program names and level names.
export var PROGRAM_LABEL = {
  case_management: "accessProgramCaseManagement",
  students: "accessProgramStudents",
  workforce: "accessProgramWorkforce",
  food_distribution: "accessProgramFood",
  snap: "accessProgramSnap"
};
export var LEVEL_LABEL = { none: "accessLevelNone", staff: "accessLevelStaff", manager: "accessLevelManager" };

// One permission that only Staff-and-up has, and one that only Managers
// have, per program.
var MARKERS = {
  case_management: { staff: "case_management.view", manager: "case_management.reports.view" },
  students: { staff: "students.view", manager: "students.delete" },
  workforce: { staff: "workforce.view", manager: "workforce.reports.view" },
  food_distribution: { staff: "food_distribution.view", manager: "food_distribution.reports.view" },
  snap: { staff: "snap.view", manager: "snap.reports.view" }
};
var FRONT_DESK = "front_desk.checkin";
var ADMIN = "admin.permissions.assign";

export var MARKER_KEYS = ACCESS_PROGRAMS.reduce(function (out, p) {
  return out.concat([MARKERS[p].staff, MARKERS[p].manager]);
}, [FRONT_DESK, ADMIN]);

export function emptyAccess() {
  var levels = {};
  ACCESS_PROGRAMS.forEach(function (p) { levels[p] = "none"; });
  return { levels: levels, frontDesk: false, admin: false };
}

// rows: [{ user_id, permission_key, program_key }] -> { [userId]: access }
export function accessFromPermissionRows(rows) {
  var held = {};
  (rows || []).forEach(function (r) {
    (held[r.user_id] = held[r.user_id] || {})[r.permission_key + "|" + (r.program_key || "")] = true;
  });
  var out = {};
  Object.keys(held).forEach(function (u) {
    var h = held[u];
    var a = emptyAccess();
    ACCESS_PROGRAMS.forEach(function (p) {
      if (h[MARKERS[p].manager + "|" + p]) a.levels[p] = "manager";
      else if (h[MARKERS[p].staff + "|" + p]) a.levels[p] = "staff";
    });
    a.frontDesk = !!h[FRONT_DESK + "|"];
    a.admin = !!h[ADMIN + "|"];
    out[u] = a;
  });
  return out;
}

// A switched-off account holds no permissions, so its levels can't be read
// from them. While it still follows its account type, this is what that type
// gives (the same answer accessFromPermissionRows gives an active account).
var ACCOUNT_TYPE_ACCESS = {
  administrator: { levels: { case_management: "manager", students: "manager", workforce: "manager", food_distribution: "manager" }, frontDesk: true, admin: true },
  case_manager: { levels: { case_management: "manager", students: "manager" }, frontDesk: true },
  job_developer: { levels: { students: "manager", workforce: "staff" }, frontDesk: true },
  staff: { levels: { food_distribution: "staff" } },
  receptionist: { levels: {}, frontDesk: true }
};

export function accessForAccountType(role) {
  var a = emptyAccess();
  var src = ACCOUNT_TYPE_ACCESS[role];
  if (!src) return a;
  Object.keys(src.levels).forEach(function (p) { a.levels[p] = src.levels[p]; });
  a.frontDesk = !!src.frontDesk;
  a.admin = !!src.admin;
  return a;
}

// The account type the database keeps in step with a set of levels
// (access_levels_account_type() in a1).
export function accountTypeForAccess(a) {
  if (a.admin) return "administrator";
  if (a.levels.case_management !== "none") return "case_manager";
  if (a.levels.workforce !== "none") return "job_developer";
  if (ACCESS_PROGRAMS.some(function (p) { return a.levels[p] !== "none"; })) return "staff";
  if (a.frontDesk) return "receptionist";
  return "staff";
}

export function sameAccess(a, b) {
  if (!a || !b) return false;
  return a.frontDesk === b.frontDesk && a.admin === b.admin &&
    ACCESS_PROGRAMS.every(function (p) { return a.levels[p] === b.levels[p]; });
}

export function hasAnyAccess(a) {
  return !!a && (a.frontDesk || a.admin || ACCESS_PROGRAMS.some(function (p) { return a.levels[p] !== "none"; }));
}

// Short pieces for a one-line summary: [{ key, program?, level? }], in
// program order, then Front desk, then Administrator.
export function accessSummary(a) {
  if (!a) return [];
  var out = [];
  ACCESS_PROGRAMS.forEach(function (p) {
    if (a.levels[p] !== "none") out.push({ key: p, program: p, level: a.levels[p] });
  });
  if (a.frontDesk) out.push({ key: "frontDesk" });
  if (a.admin) out.push({ key: "admin" });
  return out;
}

// ---------- data ----------

// { [userId]: { access, mode } } for the given people (or everyone).
export async function fetchAccessLevels(userIds) {
  var perms = supabase.from("user_effective_permissions").select("user_id, permission_key, program_key").in("permission_key", MARKER_KEYS);
  var modes = supabase.from("profiles").select("id, role, active, access_mode");
  if (userIds) { perms = perms.in("user_id", userIds); modes = modes.in("id", userIds); }
  var res = await Promise.all([perms, modes]);
  if (res[0].error) throw res[0].error;
  if (res[1].error) throw res[1].error;
  var byUser = accessFromPermissionRows(res[0].data);
  var out = {};
  (res[1].data || []).forEach(function (p) {
    var mode = p.access_mode || "account_type";
    var access = byUser[p.id] || emptyAccess();
    // Off and still on its account type: show what the type would give.
    if (!p.active && mode === "account_type") access = accessForAccountType(p.role);
    out[p.id] = { access: access, mode: mode };
  });
  return out;
}

export async function fetchUserAccessLevels(userId) {
  var all = await fetchAccessLevels([userId]);
  return all[userId] || { access: emptyAccess(), mode: "account_type" };
}

export async function saveAccessLevels(userId, access, reason) {
  var levels = {};
  ACCESS_PROGRAMS.forEach(function (p) { levels[p] = access.levels[p] || "none"; });
  var res = await supabase.rpc("admin_set_access_levels", {
    p_user: userId, p_levels: levels, p_front_desk: !!access.frontDesk, p_admin: !!access.admin, p_reason: reason || null
  });
  if (res.error) throw res.error;
}

export async function switchToAccountType(userId, reason) {
  var res = await supabase.rpc("admin_use_account_type", { p_user: userId, p_reason: reason || null });
  if (res.error) throw res.error;
}
