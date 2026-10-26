// workspaces.js -- the workspace layer over the navigation registry
// (plans/unified-access-architecture.md §7). A workspace is one program (or
// Home, or Administration); the sidebar shows the current workspace's pages,
// a switcher moves between the workspaces someone can open, and shared
// links (the calendar) stay at the bottom of every workspace.
//
// Which pages someone can open comes from their permissions
// (navItemsFromPermissions, modules.js) -- the same rule as before for every
// existing account, proven by the parity checks. Setting VITE_AUTH_MODEL=legacy
// at build time switches everything back to the old account-type lists
// (nav.js navItemsForRole) without a code change; Phase 8 removes that switch.
import { Briefcase, FolderKanban, GraduationCap, HeartHandshake, House, ShieldCheck, ShoppingBasket } from "lucide-react";
import { NAV_ORDER } from "./modules.js";
import { navKeyForPath as routeNavKey } from "./routes.js";

export var AUTH_MODEL = (import.meta.env && import.meta.env.VITE_AUTH_MODEL) === "legacy" ? "legacy" : "permissions";

// Order is the switcher's order. `items` are nav keys (nav.js vocabulary);
// the first one someone can open is where that workspace lands (Home: the
// same first page as before -- the dashboard, or check-in at the front desk).
// The sidebar groups Home's pages under their section headings either way.
export var WORKSPACES = [
  { key: "home", label: "wsHome", icon: House,
    items: ["dashboard", "mycaseload", "checkin", "checkout", "search", "myreports", "staffreports", "reports", "qrcode", "manage"] },
  { key: "students", label: "navStudents", icon: GraduationCap, items: ["students", "assessments"] },
  { key: "workforce", label: "navSectionWorkforceDevelopment", icon: Briefcase,
    items: ["workforcedashboard", "jobdeveloper", "jobopenings", "employers", "candidatematching", "referrals", "placements", "workforcereports"] },
  { key: "case_management", label: "navCaseManagement", icon: FolderKanban, items: ["casemanagement"] },
  { key: "snap", label: "wsSnap", icon: HeartHandshake, items: ["outreach"] },
  { key: "food_distribution", label: "navFoodDistribution", icon: ShoppingBasket, items: ["fooddistribution"] },
  { key: "admin", label: "adminAreaLabel", icon: ShieldCheck, items: ["users", "settings"] }
];

// Reachable from every workspace, below its own pages.
export var SHARED_ITEMS = ["calendar"];

// Every nav key belongs to exactly one place (a workspace or the shared links).
export function workspaceOfItem(item) {
  var ws = WORKSPACES.find(function (w) { return w.items.indexOf(item) !== -1; });
  return ws ? ws.key : null;
}

// The workspaces someone can open, each with its visible pages in order.
export function visibleWorkspaces(navItems) {
  var held = {};
  (navItems || []).forEach(function (k) { held[k] = true; });
  return WORKSPACES
    .map(function (w) { return Object.assign({}, w, { items: w.items.filter(function (k) { return held[k]; }) }); })
    .filter(function (w) { return w.items.length > 0; });
}

export function visibleSharedItems(navItems) {
  return SHARED_ITEMS.filter(function (k) { return (navItems || []).indexOf(k) !== -1; });
}

// The nav key a path belongs to (routes.js): "/workforce/employers/42" ->
// "employers", "/admin/roles" -> "users", "/clients/NB-1" -> null.
export function navKeyForPath(pathname) {
  return routeNavKey(pathname, NAV_ORDER);
}

// Which workspace to show: the one the current page belongs to; on a shared
// or record page, the one last chosen (if still allowed); else the person's
// primary workspace; else the first they can open.
export function pickWorkspace(workspaces, pathname, lastChosen, primary) {
  var keys = workspaces.map(function (w) { return w.key; });
  var fromPath = workspaceOfItem(navKeyForPath(pathname));
  if (fromPath && keys.indexOf(fromPath) !== -1) return fromPath;
  if (lastChosen && keys.indexOf(lastChosen) !== -1) return lastChosen;
  if (primary && keys.indexOf(primary) !== -1) return primary;
  return keys[0] || null;
}

// Where someone lands after signing in: the first page of their primary
// workspace if they can open it, else the first page they can open.
export function landingItem(navItems, primary) {
  var ws = visibleWorkspaces(navItems);
  var chosen = ws.find(function (w) { return w.key === primary; }) || ws[0];
  return chosen ? chosen.items[0] : (visibleSharedItems(navItems)[0] || null);
}
