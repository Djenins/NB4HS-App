// nav.js -- which nav tabs each role sees, and their labels/paths. Ported
// from nav_shell.js's navItemsForRole()/navLabel(). Route paths use the same
// keys as the original `view` strings (so "casemanagement" -> "/casemanagement"),
// keeping the URL vocabulary identical to the old view vocabulary -- there's
// no reason to invent new names for things that already had good ones.
import { NAV_GROUP, NAV_SECTION, NAV_SECTION_ORDER } from "./constants.js";
import { t } from "./i18n.js";

// The 7 Workforce Development pages -- deliberately NOT hardcoded into any
// role's base array below. Whether a role gets them is decided at the
// bottom of navItemsForRole() by the admin-configurable
// workforce_role_access table (see enabledWorkforceRoles() and
// Settings.jsx's "Workforce Development Access" card) -- administrator
// always gets them, every other role only if explicitly granted. Note
// "jobdeveloper" itself (the older Job Developer/participant-tracking page)
// is unrelated and stays hardcoded per-role as before.
var WORKFORCE_KEYS = ["workforcedashboard", "employers", "jobopenings", "candidatematching", "referrals", "placements", "workforcereports"];

export function navItemsForRole(role, workforceAllowedRoles) {
  var base;
  if (role === "administrator") base = ["dashboard", "mycaseload", "checkin", "checkout", "search", "reports", "fooddistribution", "calendar", "qrcode", "manage", "students", "assessments", "casemanagement", "jobdeveloper", "users", "settings"];
  else if (role === "staff") base = ["dashboard", "checkout", "search", "reports", "fooddistribution", "calendar"];
  else if (role === "receptionist") base = ["checkin", "checkout", "calendar"];
  else if (role === "case_manager") base = ["dashboard", "mycaseload", "checkin", "checkout", "search", "reports", "calendar", "qrcode", "manage", "students", "assessments", "casemanagement"];
  else if (role === "job_developer") base = ["dashboard", "mycaseload", "checkin", "checkout", "search", "reports", "calendar", "qrcode", "manage", "students", "assessments", "jobdeveloper"];
  else return [];

  var hasWorkforceAccess = role === "administrator" || (workforceAllowedRoles || []).indexOf(role) !== -1;
  if (!hasWorkforceAccess) return base;

  // Insert right after "jobdeveloper" when present (preserves the exact
  // ordering admin/job_developer always had), otherwise append at the end.
  var jdIndex = base.indexOf("jobdeveloper");
  if (jdIndex === -1) return base.concat(WORKFORCE_KEYS);
  return base.slice(0, jdIndex + 1).concat(WORKFORCE_KEYS, base.slice(jdIndex + 1));
}

// Flattens workforce_role_access rows ([{role, enabled}]) into a plain
// array of role strings currently granted -- what navItemsForRole()'s
// second argument expects.
export function enabledWorkforceRoles(workforceRoleAccess) {
  return (workforceRoleAccess || []).filter(function (r) { return r.enabled; }).map(function (r) { return r.role; });
}

export function navLabel(v, lang) {
  return {
    checkin: t("navCheckIn", lang),
    checkout: t("navCheckOut", lang),
    dashboard: t("navDashboard", lang),
    mycaseload: t("navMyCaseload", lang),
    search: t("navSearch", lang),
    reports: t("navReports", lang),
    fooddistribution: t("navFoodDistribution", lang),
    calendar: t("navCalendar", lang),
    qrcode: t("navQR", lang),
    manage: t("navManage", lang),
    students: t("navStudents", lang),
    assessments: t("navAssessments", lang),
    casemanagement: t("navCaseManagement", lang),
    jobdeveloper: t("navJobDeveloper", lang),
    workforcedashboard: t("navWorkforceDashboard", lang),
    employers: t("navEmployers", lang),
    jobopenings: t("navJobOpenings", lang),
    candidatematching: t("navCandidateMatching", lang),
    referrals: t("navReferrals", lang),
    placements: t("navPlacements", lang),
    workforcereports: t("navWorkforceReports", lang),
    users: t("navUsers", lang),
    settings: t("navSettings", lang)
  }[v];
}

export function navPath(v) {
  return "/" + v;
}

// Purely a scanning aid on the flat tab bar: a visual divider between the
// "core" day-to-day items and the "admin" configuration screens. Items
// aren't hidden or reordered, just visually grouped -- ported from
// renderShellWith()'s divider logic.
export function showDividerBefore(items, index) {
  return index > 0 && NAV_GROUP[items[index - 1]] === "core" && NAV_GROUP[items[index]] === "admin";
}

// Groups a role's nav items into the 5-bucket sidebar taxonomy (see
// NAV_SECTION in constants.js), in a fixed display order, dropping any
// bucket that ends up empty for that role. Shell.jsx renders one heading +
// item list per entry this returns.
export function navSectionsForItems(items) {
  return NAV_SECTION_ORDER
    .map((key) => ({ key, items: items.filter((v) => NAV_SECTION[v] === key) }))
    .filter((section) => section.items.length > 0);
}

export function navSectionLabel(key, lang) {
  return {
    overview: t("navSectionOverview", lang),
    dailyOps: t("navGroupCore", lang),
    programs: t("navSectionPrograms", lang),
    workforceDevelopment: t("navSectionWorkforceDevelopment", lang),
    operations: t("navSectionOperations", lang),
    administration: t("navGroupAdmin", lang)
  }[key];
}
