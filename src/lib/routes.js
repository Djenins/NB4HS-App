// routes.js -- canonical URLs per workspace, and a redirect for every URL the
// app used before (plans/unified-access-architecture.md §7.4). Pages live
// under their workspace -- /students/assessments, /workforce/employers/:id,
// /snap/cases, /food, /admin/settings -- and every old address, including
// bookmarks and links in old notifications, keeps working through
// LEGACY_REDIRECTS (App.jsx turns each into a <Route>; routes.test.js checks
// every one lands on a real route).

// Nav key -> path, where it isn't just "/" + key.
export var NAV_PATHS = {
  assessments: "/students/assessments",
  casemanagement: "/case-management",
  workforcedashboard: "/workforce",
  jobdeveloper: "/workforce/participants",
  employers: "/workforce/employers",
  jobopenings: "/workforce/jobs",
  candidatematching: "/workforce/matching",
  referrals: "/workforce/referrals",
  placements: "/workforce/placements",
  workforcereports: "/workforce/reports",
  fooddistribution: "/food",
  outreach: "/snap",
  users: "/admin/users",
  settings: "/admin/settings"
};

export function pathForNavKey(key) {
  return NAV_PATHS[key] || "/" + key;
}

// Old address -> new address; ":name" carries a URL parameter across.
export var LEGACY_REDIRECTS = [
  { from: "/assessments", to: "/students/assessments" },
  { from: "/casemanagement", to: "/case-management" },
  { from: "/casemanagement/:section", to: "/case-management/:section" },
  { from: "/workforcedashboard", to: "/workforce" },
  { from: "/jobdeveloper", to: "/workforce/participants" },
  { from: "/jobdeveloper/:clientId", to: "/workforce/participants/:clientId" },
  { from: "/employers", to: "/workforce/employers" },
  { from: "/employers/:employerId", to: "/workforce/employers/:employerId" },
  { from: "/jobopenings", to: "/workforce/jobs" },
  { from: "/candidatematching", to: "/workforce/matching" },
  { from: "/referrals", to: "/workforce/referrals" },
  { from: "/placements", to: "/workforce/placements" },
  { from: "/placements/:placementId", to: "/workforce/placements/:placementId" },
  { from: "/workforcereports", to: "/workforce/reports" },
  { from: "/fooddistribution", to: "/food" },
  { from: "/fooddistribution/:section", to: "/food/:section" },
  // Outreach is the engine behind SNAP; each Outreach program is its own
  // workspace now (decision D3 reversed the old /snap -> /outreach/snap).
  { from: "/outreach", to: "/snap" },
  { from: "/outreach/:program", to: "/:program" },
  { from: "/outreach/:program/:section", to: "/:program/:section" },
  { from: "/settings", to: "/admin/settings" },
  { from: "/users", to: "/admin/users" }
];

export function fillPath(pattern, params) {
  return pattern.replace(/:(\w+)/g, function (_, name) { return encodeURIComponent(params[name] || ""); });
}

// The nav key a path belongs to, by the longest matching path:
// "/workforce/employers/42" -> "employers", "/workforce" -> "workforcedashboard",
// "/admin/roles" -> "users" (Administration's account sections), "/clients/NB-1" -> null.
export function navKeyForPath(pathname, navKeys) {
  var path = (pathname || "").replace(/\/+$/, "") || "/";
  if (path.indexOf("/admin/") === 0 || path === "/admin") return path.indexOf("/admin/settings") === 0 ? "settings" : "users";
  var best = null;
  var bestLen = 0;
  (navKeys || []).forEach(function (key) {
    var p = pathForNavKey(key);
    if ((path === p || path.indexOf(p + "/") === 0) && p.length > bestLen) { best = key; bestLen = p.length; }
  });
  return best;
}
