// storage.js -- localStorage persistence, as plain data-in/data-out
// functions (no global singleton, no HTML-string building -- the theme
// toggle button is now a real component, see components/ThemeToggle.jsx).
// AppContext calls these; nothing else needs to touch localStorage directly.
import { CFG_KEY, DEFAULT_CHECKIN_URL, OLD_DEFAULT_CHECKIN_URL, STORE_KEY } from "./constants.js";

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
  var defaults = {
    checkInUrl: DEFAULT_CHECKIN_URL, closingTime: "17:00", theme: "light", sidebarCollapsed: false,
    calendarDefaultView: "week", calendarWeekStartsMonday: false, calendarDefaultFilter: "all",
    calendarClassStartTime: "09:30", calendarClassEndTime: "12:30"
  };
  try {
    var raw = localStorage.getItem(CFG_KEY);
    if (raw) {
      var cfg = Object.assign({}, defaults, JSON.parse(raw));
      // The old default kiosk link was the bare site address, which is now
      // the staff home page -- move saved copies of it to the kiosk link.
      if ((cfg.checkInUrl || "").replace(/\/+$/, "") === OLD_DEFAULT_CHECKIN_URL) cfg.checkInUrl = DEFAULT_CHECKIN_URL;
      return cfg;
    }
  } catch (e) {}
  return defaults;
}
// The auto check-out closing time: the organization's (app_settings, saved
// from System Settings) when there is one, else this browser's own.
export function effectiveClosingTime(orgSettings, cfg) {
  var org = orgSettings && orgSettings.closing_time;
  if (typeof org === "string" && /^\d{2}:\d{2}$/.test(org)) return org;
  return (cfg && cfg.closingTime) || "17:00";
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
