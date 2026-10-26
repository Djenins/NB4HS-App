// permissions.js -- the permission-resolution rules
// (plans/unified-access-architecture.md §4), as pure functions.
//
// The database is the authority: compute_effective_permissions() in the
// p1b_access_foundation migration resolves everyone's access, RLS reads the
// result, and the app gets its own copy from my_permissions(). This mirror
// exists so the rules can be tested table by table here, and so admin screens
// can explain a result without a round trip. Keep the two in step.
import { supabase } from "./supabase.js";

export var SCOPES = ["own", "assigned", "team", "program", "org"];

export function scopeRank(scope) {
  return SCOPES.indexOf(scope) + 1; // 0 for none
}

function activeRow(row, now) {
  return !row.revokedAt && (!row.expiresAt || new Date(row.expiresAt) > now);
}

// input:
//   active          the account is active
//   modules         [{ key, parentKey, kind, active, implemented }]
//   permissions     [{ key, moduleKey, scoped }]
//   roles           [{ id, key, archived }]
//   rolePermissions [{ roleId, permissionKey, scope }]
//   roleAssignments [{ roleId, programKey, revokedAt, expiresAt }]
//   programAccess   [programKey]                     (active rows only)
//   overrides       [{ permissionKey, effect, scope, programKey, revokedAt, expiresAt }]
// returns [{ permissionKey, programKey ('' outside programs), scope (null if unscoped) }]
export function resolveEffectivePermissions(input, now) {
  var at = now || new Date();
  if (!input.active) return [];

  var modules = {};
  (input.modules || []).forEach(function (m) { modules[m.key] = m; });
  function chain(key) {
    var out = [];
    for (var m = modules[key]; m; m = m.parentKey ? modules[m.parentKey] : null) out.unshift(m);
    return out;
  }
  function enabled(key) {
    return chain(key).every(function (m) { return m.active && m.implemented; });
  }
  function programOf(key) {
    var root = chain(key)[0];
    return root && root.kind === "program" ? root.key : "";
  }

  var roleById = {};
  (input.roles || []).forEach(function (r) { roleById[r.id] = r; });
  var grants = [];
  (input.roleAssignments || []).filter(function (a) { return activeRow(a, at); }).forEach(function (a) {
    var role = roleById[a.roleId];
    if (!role || role.archived) return;
    (input.rolePermissions || []).filter(function (rp) { return rp.roleId === a.roleId; }).forEach(function (rp) {
      grants.push({ permissionKey: rp.permissionKey, program: a.programKey || null, scope: rp.scope || null });
    });
  });
  var overrides = (input.overrides || []).filter(function (o) { return activeRow(o, at); });
  overrides.filter(function (o) { return o.effect === "grant"; }).forEach(function (o) {
    grants.push({ permissionKey: o.permissionKey, program: o.programKey || null, scope: o.scope || null });
  });
  var programs = input.programAccess || [];

  var held = {};
  (input.permissions || []).forEach(function (p) {
    if (!modules[p.moduleKey] || !enabled(p.moduleKey)) return;
    var program = programOf(p.moduleKey);
    if (program && programs.indexOf(program) === -1) return; // program gate
    var mine = grants.filter(function (g) {
      return g.permissionKey === p.key && (!program || !g.program || g.program === program);
    });
    if (!mine.length) return;
    var rank = Math.max.apply(null, mine.map(function (g) { return scopeRank(g.scope); }));
    var denies = overrides.filter(function (o) {
      return o.effect === "deny" && o.permissionKey === p.key && (!o.programKey || o.programKey === program);
    });
    if (denies.length) {
      if (!p.scoped || denies.some(function (d) { return !d.scope; })) return; // deny wins
      var cap = Math.min.apply(null, denies.map(function (d) { return scopeRank(d.scope); }));
      rank = Math.min(rank, cap - 1);
      if (rank < 1) return;
    }
    held[p.key] = { permissionKey: p.key, programKey: program, scope: p.scoped ? SCOPES[rank - 1] : null, moduleKey: p.moduleKey };
  });

  // Parent gate: a submodule permission needs its parent's ".view".
  function kept(key, seen) {
    var row = held[key];
    if (!row) return false;
    var m = modules[row.moduleKey];
    if (!m || m.kind !== "submodule") return true;
    var parentView = m.parentKey + ".view";
    if (seen[parentView]) return false;
    seen[parentView] = true;
    return kept(parentView, seen);
  }
  return Object.keys(held).filter(function (k) { return kept(k, {}); }).map(function (k) {
    var row = held[k];
    return { permissionKey: row.permissionKey, programKey: row.programKey, scope: row.scope };
  });
}

// Does a permission list (from my_permissions or the resolver) include key,
// optionally in one program?
export function can(permissions, key, program) {
  return (permissions || []).some(function (p) {
    return p.permissionKey === key && (!program || p.programKey === program || p.programKey === "");
  });
}

// The signed-in user's effective permissions. Empty (never a throw) when the
// RPC is unavailable, so nothing that reads it can break the page.
export async function fetchMyPermissions() {
  if (!supabase) return [];
  var res = await supabase.rpc("my_permissions");
  if (res.error) { console.warn("fetchMyPermissions failed", res.error); return []; }
  return (res.data || []).map(function (r) {
    return { permissionKey: r.permission_key, programKey: r.program_key || "", scope: r.scope || null };
  });
}
