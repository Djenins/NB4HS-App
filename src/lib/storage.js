// storage.js -- localStorage persistence, as plain data-in/data-out
// functions (no global singleton, no HTML-string building -- the theme
// toggle button is now a real component, see components/ThemeToggle.jsx).
// AppContext calls these; nothing else needs to touch localStorage directly.
import { CFG_KEY, DEFAULT_CHECKIN_URL, STORE_KEY } from "./constants.js";

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
