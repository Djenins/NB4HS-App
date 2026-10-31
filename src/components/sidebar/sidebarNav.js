// sidebarNav.js -- turns the signed-in user's nav keys (nav.js's
// navItemsForRole(), which is still the only place access is decided) into
// the floating sidebar's grouped entries. Pure, so the grouping rules are
// testable without rendering anything.
//
// Two reshapes on top of navSectionsForItems():
//   * Workforce folds into one "Workforce" program entry. Its individual
//     pages (Employers, Job Openings, ...) are reached through Workforce's own
//     horizontal ModuleNav, so the sidebar doesn't repeat them.
//   * "Outreach" becomes one entry per outreach program the person can open
//     (SNAP today) -- SNAP is a program, Outreach is only the engine behind
//     it. Routes don't change: SNAP still lives at /outreach/snap. Until the
//     program list loads (or if it can't), the single Outreach entry stays.
import { NAV_ICONS } from "../../lib/navIcons.js";
import { navLabel, navPath, navSectionLabel, navSectionsForItems } from "../../lib/nav.js";
import { programName, programsVisibleTo } from "../../lib/outreachPrograms.js";

// Every Workforce page lives under /workforce (routes.js), so the single
// Workforce entry stays highlighted anywhere inside it.
var WORKFORCE_PATHS = ["/workforce"];

// Program entries open a workspace with its own section menu (ModuleNav);
// the sidebar marks them with a chevron.
var WORKSPACE_KEYS = ["fooddistribution", "students", "casemanagement", "outreach", "workforce", "communications"];

function entryFor(v, lang) {
  var match = [navPath(v)];
  if (v === "workforce") match = WORKFORCE_PATHS;
  if (v === "students") match = ["/students"];
  // Staff Accounts opens Administration; its other sections (roles,
  // positions, audit) keep the entry lit too. System Settings
  // (/admin/settings) is its own entry and wins as the longer match.
  if (v === "users") match = ["/admin"];
  return { key: v, label: navLabel(v, lang), to: navPath(v), icon: NAV_ICONS[v], match: match, workspace: WORKSPACE_KEYS.indexOf(v) !== -1 };
}

function outreachEntries(programs, role, programRoles, lang) {
  var visible = programsVisibleTo(programs, role, programRoles);
  if (!visible.length) return [entryFor("outreach", lang)];
  return visible.map(function (p) {
    var to = "/" + p.key;
    return {
      key: "outreach:" + p.key, label: programName(p, lang), to: to, icon: NAV_ICONS[p.key] || NAV_ICONS.outreach,
      match: [to], workspace: true
    };
  });
}

// [{ key, label, entries: [{ key, label, to, icon, match, workspace }] }]
export function sidebarSections(items, opts) {
  var o = opts || {};
  var lang = o.lang || "en";
  var sections = navSectionsForItems(items);
  var hasWorkforce = sections.some(function (s) { return s.key === "workforceDevelopment"; });
  var out = [];
  sections.forEach(function (s) {
    if (s.key === "workforceDevelopment") return;
    var entries = [];
    s.items.forEach(function (v) {
      // Assessments is a section of Adult Education (AdultEdNav), not a
      // program of its own; its page keeps the Adult Education entry lit.
      if (v === "assessments") return;
      if (v === "outreach") entries = entries.concat(outreachEntries(o.programs, o.role, o.programRoles, lang));
      else entries.push(entryFor(v, lang));
    });
    if (s.key === "programs" && hasWorkforce) entries.push(entryFor("workforce", lang));
    out.push({ key: s.key, label: navSectionLabel(s.key, lang), entries: entries });
  });
  // Workforce access without any other program (e.g. a receptionist granted
  // it in Settings): give it a Programs group of its own, in Programs' place.
  if (hasWorkforce && !out.some(function (s) { return s.key === "programs"; })) {
    var at = out.findIndex(function (s) { return s.key === "operations" || s.key === "administration"; });
    var programs = { key: "programs", label: navSectionLabel("programs", lang), entries: [entryFor("workforce", lang)] };
    if (at === -1) out.push(programs); else out.splice(at, 0, programs);
  }
  return out;
}

function pathMatches(pathname, prefix) {
  return pathname === prefix || pathname.indexOf(prefix + "/") === 0;
}

// The one entry to highlight for this path: the longest matching prefix
// wins, so exactly one row is ever active.
export function activeEntryKey(sections, pathname) {
  var best = null, bestLen = -1;
  sections.forEach(function (s) {
    s.entries.forEach(function (e) {
      e.match.forEach(function (prefix) {
        if (pathMatches(pathname, prefix) && prefix.length > bestLen) { best = e.key; bestLen = prefix.length; }
      });
    });
  });
  return best;
}
