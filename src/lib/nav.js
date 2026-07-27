// nav.js -- which nav tabs each role sees, and their labels/paths. Ported
// from nav_shell.js's navItemsForRole()/navLabel(). Route paths use the same
// keys as the original `view` strings (so "casemanagement" -> "/casemanagement"),
// keeping the URL vocabulary identical to the old view vocabulary -- there's
// no reason to invent new names for things that already had good ones.
import { NAV_GROUP, NAV_SECTION, NAV_SECTION_ORDER } from "./constants.js";
import { t } from "./i18n.js";

export function navItemsForRole(role) {
  if (role === "administrator") return ["dashboard", "mycaseload", "checkin", "checkout", "search", "reports", "fooddistribution", "calendar", "qrcode", "manage", "students", "assessments", "casemanagement", "jobdeveloper", "workforcedashboard", "employers", "jobopenings", "candidatematching", "referrals", "placements", "workforcereports", "users", "settings"];
  if (role === "staff") return ["dashboard", "checkout", "search", "reports", "fooddistribution", "calendar"];
  if (role === "receptionist") return ["checkin", "checkout", "calendar"];
  if (role === "case_manager") return ["dashboard", "mycaseload", "checkin", "checkout", "search", "reports", "calendar", "qrcode", "manage", "students", "assessments", "casemanagement"];
  if (role === "job_developer") return ["dashboard", "mycaseload", "checkin", "checkout", "search", "reports", "calendar", "qrcode", "manage", "students", "assessments", "jobdeveloper", "workforcedashboard", "employers", "jobopenings", "candidatematching", "referrals", "placements", "workforcereports"];
  return [];
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
