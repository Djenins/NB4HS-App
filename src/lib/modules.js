// modules.js -- what each navigation item requires under the new access model
// (plans/unified-access-architecture.md §7.1; app_modules / permissions in the
// p1b_access_foundation migration).
//
// Phase 1 only: nothing renders from this yet. nav.js's role lists still draw
// the sidebar. Phase 4 switches the sidebar and RequireRoute to
// navItemsFromPermissions() once the parity check (supabase/tests/
// p1_access_check.sql, and legacyParity.test.js here) shows that every account
// sees exactly what it sees today.

// Nav key -> permission keys; any one of them shows the item. Keys match
// nav.js's vocabulary so routes and labels stay the same.
export var NAV_REQUIREMENTS = {
  dashboard: ["dashboard.view"],
  mycaseload: ["my_caseload.view"],
  myreports: ["staff_reports.submit"],
  staffreports: ["staff_reports.review", "staff_reports.view_all", "staff_reports.schedule.manage"],
  checkin: ["front_desk.checkin"],
  checkout: ["front_desk.checkout"],
  search: ["front_desk.visits.search"],
  calendar: ["calendar.view"],
  // My Availability: anyone who can open the calendar sets their own hours.
  availability: ["calendar.view"],
  students: ["students.view"],
  assessments: ["students.assessments.view"],
  casemanagement: ["case_management.view"],
  fooddistribution: ["food_distribution.view"],
  // Administrators manage SNAP program staff without holding SNAP case data.
  outreach: ["snap.view", "snap.staff.manage"],
  jobdeveloper: ["workforce.participants.view"],
  workforcedashboard: ["workforce.overview.view"],
  employers: ["workforce.employers.view"],
  jobopenings: ["workforce.jobs.view"],
  candidatematching: ["workforce.matching.view"],
  referrals: ["workforce.referrals.view"],
  placements: ["workforce.placements.view"],
  workforcereports: ["workforce.reports.view"],
  reports: ["org_reports.view"],
  qrcode: ["front_desk.qrcode"],
  manage: ["lists.manage"],
  users: ["admin.users.view"],
  settings: ["admin.settings.manage"]
};

// Canonical sidebar order: the administrator's order from nav.js (every other
// role's list is a subsequence of it).
export var NAV_ORDER = [
  "dashboard", "mycaseload", "checkin", "checkout", "search", "reports", "fooddistribution", "calendar", "availability",
  "qrcode", "manage", "students", "assessments", "casemanagement", "jobdeveloper",
  "workforcedashboard", "employers", "jobopenings", "candidatematching", "referrals", "placements", "workforcereports",
  "users", "settings", "outreach", "myreports", "staffreports"
];

// `permissions`: rows from my_permissions() ({ permissionKey, programKey, scope }).
export function navItemsFromPermissions(permissions) {
  var held = {};
  (permissions || []).forEach(function (p) { held[p.permissionKey] = true; });
  return NAV_ORDER.filter(function (key) {
    return NAV_REQUIREMENTS[key].some(function (perm) { return held[perm]; });
  });
}
