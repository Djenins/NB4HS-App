// utils.js -- pure helper functions (formatting, CSV parsing, id generation).
// These take the values they need (lang, data arrays) as parameters instead
// of reading a global App singleton, since there is no such singleton in the
// React app -- state lives in AppContext and is passed in by components.
import { DATE_LOCALE, SERVICES, STAFF } from "./constants.js";
import { t } from "./i18n.js";

export function labelFor(list, key, lang) {
  var found = list.filter(function (i) { return i.key === key; })[0];
  if (!found) return key;
  return found[lang] || found.en;
}
/* Services/staff lists = the built-in defaults plus anything an Administrator
   has added via the Manage Lists screen. "full" includes inactive items (so
   historic visits still display correctly); "active" is what shows up in the
   check-in form's dropdowns. */
export function fullServiceList(customServices) { return SERVICES.concat(customServices || []); }
export function fullStaffList(customStaff) { return STAFF.concat(customStaff || []); }
export function activeServiceList(customServices, disabledServices) {
  var disabled = disabledServices || [];
  return fullServiceList(customServices).filter(function (s) { return disabled.indexOf(s.key) === -1; });
}
export function activeStaffList(customStaff, disabledStaff) {
  var disabled = disabledStaff || [];
  return fullStaffList(customStaff).filter(function (s) { return disabled.indexOf(s.key) === -1; });
}
export function slugify(str) {
  return (str || "").toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_+|_+$/g, "") || "item";
}
export function uid() { return "v_" + Date.now().toString(36) + "_" + Math.random().toString(36).slice(2, 9); }
// Pure: given the next student sequence number, returns its NB-##### id.
// The caller (the data reducer) is responsible for incrementing the counter
// in state -- this function no longer mutates anything itself.
export function genStudentId(n) {
  var padded = ("00000" + n).slice(-5);
  return "NB-" + padded;
}
export function pad2(n) { return n < 10 ? "0" + n : "" + n; }
export function todayStr() { var d = new Date(); return d.getFullYear() + "-" + pad2(d.getMonth() + 1) + "-" + pad2(d.getDate()); }
export function dateStrFromDate(d) { return d.getFullYear() + "-" + pad2(d.getMonth() + 1) + "-" + pad2(d.getDate()); }
export function normalizeDateCell(v) {
  if (v === undefined || v === null || v === "") return "";
  if (v instanceof Date && !isNaN(v.getTime())) return dateStrFromDate(v);
  var s = v.toString().trim();
  if (!s) return "";
  if (/^\d{4}-\d{1,2}-\d{1,2}$/.test(s)) {
    var p = s.split("-");
    return p[0] + "-" + pad2(parseInt(p[1], 10)) + "-" + pad2(parseInt(p[2], 10));
  }
  var m = s.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})$/);
  if (m) return m[3] + "-" + pad2(parseInt(m[1], 10)) + "-" + pad2(parseInt(m[2], 10));
  return s;
}
// Note: React escapes text content automatically (that's what JSX does when
// you write {someValue} instead of dangerouslySetInnerHTML), so this is only
// still needed for the handful of places generating raw HTML strings (CSV/
// export content, or content handed to dangerouslySetInnerHTML). Kept as-is
// so those call sites don't need to change.
export function escapeHtml(str) {
  if (str === null || str === undefined) return "";
  return String(str).replace(/[&<>"']/g, function (c) {
    return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c];
  });
}
export function fmtTime(iso) {
  if (!iso) return "—";
  var d = new Date(iso);
  var h = d.getHours(), m = d.getMinutes();
  var ampm = h >= 12 ? "PM" : "AM";
  var h12 = h % 12; if (h12 === 0) h12 = 12;
  return h12 + ":" + pad2(m) + " " + ampm;
}
export function fmtDuration(mins, lang) {
  if (mins === null || mins === undefined) return "—";
  mins = Math.max(0, Math.round(mins));
  var h = Math.floor(mins / 60), m = mins % 60;
  if (h <= 0) return m + " " + t("minutes", lang);
  return h + " " + t("hours", lang) + " " + m + " " + t("minutes", lang);
}
export function minutesBetween(aIso, bIso) {
  if (!aIso || !bIso) return null;
  return (new Date(bIso).getTime() - new Date(aIso).getTime()) / 60000;
}
export function addMonths(dateStr, n) {
  var d = new Date(dateStr + "T00:00:00");
  d.setMonth(d.getMonth() + n);
  return dateStrFromDate(d);
}
export function fmtDateLong(dateStr, lang) {
  if (!dateStr) return "—";
  try {
    var d = new Date(dateStr + "T00:00:00");
    return d.toLocaleDateString(DATE_LOCALE[lang] || "en-US", { year: "numeric", month: "short", day: "numeric" });
  } catch (e) { return dateStr; }
}
// -- Calendar-grid helpers for components/DatePicker.jsx. Kept here alongside
// the other date utilities rather than a new file, same reasoning as
// addMonths()/fmtDateLong() already living in this module.
export function addDays(dateStr, n) {
  var d = new Date(dateStr + "T00:00:00");
  d.setDate(d.getDate() + n);
  return dateStrFromDate(d);
}
export function monthYearLabel(year, month, lang) {
  var d = new Date(year, month, 1);
  return d.toLocaleDateString(DATE_LOCALE[lang] || "en-US", { year: "numeric", month: "long" });
}
// Locale-correct short weekday names (Mon..Sun) without hand-translating 28
// strings -- Jan 1 2024 was a Monday, so formatting that reference week in
// the target locale gives the right labels for free.
export function weekdayShortLabels(lang) {
  var out = [];
  for (var i = 0; i < 7; i++) {
    var d = new Date(2024, 0, 1 + i);
    out.push(d.toLocaleDateString(DATE_LOCALE[lang] || "en-US", { weekday: "short" }));
  }
  return out;
}
// 6 weeks x 7 days (Monday-first), including enough leading/trailing days
// from adjacent months to fill the grid.
export function buildMonthGrid(year, month) {
  var firstOfMonth = new Date(year, month, 1);
  var firstWeekday = (firstOfMonth.getDay() + 6) % 7; // 0=Mon .. 6=Sun
  var start = new Date(year, month, 1 - firstWeekday);
  var cells = [];
  for (var i = 0; i < 42; i++) {
    var d = new Date(start.getFullYear(), start.getMonth(), start.getDate() + i);
    cells.push({ dateStr: dateStrFromDate(d), day: d.getDate(), inMonth: d.getMonth() === month });
  }
  return cells;
}
export function csvEscape(v) {
  var s = String(v === null || v === undefined ? "" : v);
  if (/[",\n]/.test(s)) s = '"' + s.replace(/"/g, '""') + '"';
  return s;
}
export function downloadBlob(content, filename, mime) {
  var blob = new Blob([content], { type: mime });
  var url = URL.createObjectURL(blob);
  var a = document.createElement("a");
  a.href = url; a.download = filename;
  document.body.appendChild(a); a.click(); document.body.removeChild(a);
  setTimeout(function () { URL.revokeObjectURL(url); }, 1000);
}
export function parseCSVText(text) {
  var lines = text.split(/\r\n|\n|\r/).filter(function (l) { return l.trim() !== ""; });
  return lines.map(function (line) {
    var cells = [], cur = "", inQuotes = false;
    for (var i = 0; i < line.length; i++) {
      var ch = line[i];
      if (inQuotes) {
        if (ch === '"' && line[i + 1] === '"') { cur += '"'; i++; }
        else if (ch === '"') { inQuotes = false; }
        else cur += ch;
      } else {
        if (ch === '"') inQuotes = true;
        else if (ch === ",") { cells.push(cur); cur = ""; }
        else cur += ch;
      }
    }
    cells.push(cur);
    return cells;
  });
}
// Role display name, translated. Ported from users_settings.js's roleLabel()
// -- kept here (rather than starting a one-function users_settings.js) since
// it's used by the shell/nav header, which is being built before the Users
// page itself.
export function roleLabel(role, lang) {
  if (role === "administrator") return t("roleAdmin", lang);
  if (role === "staff") return t("roleStaff", lang);
  if (role === "receptionist") return t("roleReceptionist", lang);
  if (role === "case_manager") return t("roleCaseManager", lang);
  if (role === "job_developer") return t("roleJobDeveloper", lang);
  return role;
}
// Initials-in-a-circle avatar chip fallback -- none of this app's records
// (students, case/job clients) store an actual photo, so this stands in
// for the round profile picture a reference design showed.
export function initialsOf(rec) {
  var f = ((rec && rec.firstName) || "").trim().charAt(0);
  var l = ((rec && rec.lastName) || "").trim().charAt(0);
  return (f + l).toUpperCase() || "?";
}
export function formatAddress(rec) {
  if (!rec || (!rec.street && !rec.city && !rec.zip)) return "";
  var line2Parts = [];
  if (rec.city) line2Parts.push(rec.city);
  line2Parts.push("RI");
  var line2 = line2Parts.join(", ") + (rec.zip ? " " + rec.zip : "");
  return [rec.street, line2].filter(function (p) { return p; }).join(", ");
}
