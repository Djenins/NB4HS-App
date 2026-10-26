// commandSearch.js -- what the ⌘K command palette (components/sidebar/
// CommandPalette.jsx) searches, and who may search what. Pure: it only
// filters data AppContext has already loaded, so it can never surface a
// record the server didn't already hand this user.
//
// Each record type is gated on the nav item that owns it -- the same
// navItemsForRole() list the sidebar is built from, so search and
// navigation can't disagree about access:
//   students     -> "students" (Adult Education)
//   case clients -> "casemanagement"
//   staff        -> "users", administrators only
// Pages are the sidebar's own entries, which are already filtered.
import { studentMatchesSearch } from "./students.js";
import { roleLabel } from "./utils.js";

export var RESULT_LIMIT = 5;

export function searchScopes(items, role) {
  var has = function (v) { return (items || []).indexOf(v) !== -1; };
  return { students: has("students"), clients: has("casemanagement"), staff: role === "administrator" && has("users") };
}

// The placeholder names only what this person can actually find.
export function searchPlaceholderKey(scopes) {
  if (scopes.staff) return "cmdkPlaceholderAll";
  if (scopes.students && scopes.clients) return "cmdkPlaceholderStudentsClients";
  if (scopes.students) return "sidebarSearchPlaceholder";
  if (scopes.clients) return "cmdkPlaceholderClients";
  return "cmdkPlaceholderPages";
}

function fullName(r) {
  return ((r.firstName || "") + " " + (r.lastName || "")).trim();
}

function digits(s) {
  return (s || "").replace(/\D/g, "");
}

function clientMatches(c, q, qDigits) {
  var hay = (fullName(c) + " " + (c.email || "") + " " + (c.nbId || "")).toLowerCase();
  if (hay.indexOf(q) !== -1) return true;
  return qDigits.length >= 3 && digits(c.phone).indexOf(qDigits) !== -1;
}

// [{ key, results: [{ id, kind, title, subtitle, to, state? }] }], empty groups dropped.
// `state` rides along as react-router location state.
// With no query, only pages are listed (a quick "go to" menu).
export function buildResults(opts) {
  var q = (opts.query || "").trim().toLowerCase();
  var scopes = opts.scopes;
  var data = opts.data || {};
  var lang = opts.lang || "en";
  var groups = [];

  var pages = (opts.pages || []).filter(function (p) { return !q || p.label.toLowerCase().indexOf(q) !== -1; });
  groups.push({ key: "pages", results: pages.slice(0, q ? RESULT_LIMIT : pages.length).map(function (p) {
    return { id: "page:" + p.key, kind: "page", title: p.label, subtitle: p.section || "", to: p.to, icon: p.icon };
  }) });

  if (q) {
    if (scopes.students) {
      var classes = data.classes || [];
      groups.push({ key: "students", results: (data.students || []).filter(function (s) { return studentMatchesSearch(s, q); }).slice(0, RESULT_LIMIT).map(function (s) {
        var c = classes.find(function (cc) { return cc.key === s.classKey; });
        return {
          id: "student:" + s.id, kind: "student", title: fullName(s),
          subtitle: [s.studentId, c ? c.name : ""].filter(Boolean).join(" · "),
          to: s.nbId ? "/clients/" + s.nbId : "/students"
        };
      }) });
    }
    if (scopes.clients) {
      var qDigits = digits(q);
      groups.push({ key: "clients", results: (data.caseClients || []).filter(function (c) { return clientMatches(c, q, qDigits); }).slice(0, RESULT_LIMIT).map(function (c) {
        return {
          id: "client:" + c.id, kind: "client", title: fullName(c),
          subtitle: [c.nbId, c.phone].filter(Boolean).join(" · "),
          to: c.nbId ? "/clients/" + c.nbId : "/casemanagement/clients"
        };
      }) });
    }
    if (scopes.staff) {
      groups.push({ key: "staff", results: (data.profiles || []).filter(function (p) {
        return ((p.name || "") + " " + (p.email || "")).toLowerCase().indexOf(q) !== -1;
      }).slice(0, RESULT_LIMIT).map(function (p) {
        // Staff Accounts has no per-person page; it pages to this row and highlights it.
        return { id: "staff:" + p.id, kind: "staff", title: p.name || p.email, subtitle: [p.email, roleLabel(p.role, lang)].filter(Boolean).join(" · "), to: "/users", state: { focusUserId: p.id } };
      }) });
    }
  }

  return groups.filter(function (g) { return g.results.length > 0; });
}
