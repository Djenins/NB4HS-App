// storage.js -- localStorage persistence, as plain data-in/data-out
// functions (no global singleton, no HTML-string building -- the theme
// toggle button is now a real component, see components/ThemeToggle.jsx).
// AppContext calls these; nothing else needs to touch localStorage directly.
import { CFG_KEY, DEFAULT_CHECKIN_URL, SESSION_KEY, STORE_KEY } from "./constants.js";

export function saveData(data) {
  try { localStorage.setItem(STORE_KEY, JSON.stringify(data)); } catch (e) { console.warn("save failed", e); }
}
export function loadData() {
  try {
    var raw = localStorage.getItem(STORE_KEY);
    if (raw) return JSON.parse(raw);
  } catch (e) { console.warn("load failed", e); }
  return null;
}
export function getConfig() {
  var defaults = { checkInUrl: DEFAULT_CHECKIN_URL, closingTime: "17:00", theme: "light", sidebarCollapsed: false };
  try {
    var raw = localStorage.getItem(CFG_KEY);
    if (raw) return Object.assign({}, defaults, JSON.parse(raw));
  } catch (e) {}
  return defaults;
}
export function setConfig(cfg) {
  try { localStorage.setItem(CFG_KEY, JSON.stringify(Object.assign({}, getConfig(), cfg))); } catch (e) {}
}
// Dark mode: a plain data-attribute toggle on <html>, driven entirely by CSS
// custom properties (see src/styles/main.css). Preference is stored
// alongside other device-level config, so it's per-browser.
export function applyTheme(theme) {
  if (theme === "dark") document.documentElement.setAttribute("data-theme", "dark");
  else document.documentElement.removeAttribute("data-theme");
}
// Session persistence: who's logged in survives a page refresh. Still
// client-side-only (see README) -- it just remembers the last signed-in
// staff member so a refresh doesn't silently boot them back to the login
// screen. Returns the raw saved session or null; AppContext + the router
// are responsible for validating the user still exists/is active and for
// deciding which route to land on.
export function saveSession(session) {
  try { localStorage.setItem(SESSION_KEY, JSON.stringify(session)); } catch (e) { console.warn("session save failed", e); }
}
export function loadSession() {
  try {
    var raw = localStorage.getItem(SESSION_KEY);
    if (!raw) return null;
    var sess = JSON.parse(raw);
    if (!sess || !sess.role || !sess.currentUserEmail) return null;
    return sess;
  } catch (e) { console.warn("session load failed", e); return null; }
}
export function clearSession() {
  try { localStorage.removeItem(SESSION_KEY); } catch (e) {}
}
