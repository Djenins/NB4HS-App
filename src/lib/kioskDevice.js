// kioskDevice.js -- what this browser holds as a kiosk (k1_kiosk_devices).
//
// A paired front-desk tablet keeps its device key here; supabase.js sends it
// as the x-kiosk-key header, and only then do kiosk_roster / kiosk_visits
// answer. Every other signed-out browser -- a client's phone from the
// check-in poster -- is unpaired and never sees a name: it only remembers
// the visits it checked in itself, so it can check those out again.
//
// No supabase import here: supabase.js reads the key from this module.

const KEY_STORAGE = "nb4hs.kioskDeviceKey";
const VISITS_STORAGE = "nb4hs.myVisits";

function read(name) {
  try { return window.localStorage.getItem(name); } catch (e) { return null; }
}
function write(name, value) {
  try {
    if (value === null) window.localStorage.removeItem(name);
    else window.localStorage.setItem(name, value);
  } catch (e) { /* private mode: nothing survives a refresh anyway */ }
}

export function kioskDeviceKey() {
  if (typeof window === "undefined") return null;
  const k = read(KEY_STORAGE);
  return k && /^[0-9a-f]{64}$/.test(k) ? k : null;
}
export function isKioskPaired() {
  return !!kioskDeviceKey();
}
export function saveKioskDeviceKey(key) {
  write(KEY_STORAGE, key);
}
export function forgetKioskDeviceKey() {
  write(KEY_STORAGE, null);
}

// ---- the visits an unpaired phone checked in itself ----
// Kept in app shape ({ id, firstName, lastName, date, timeIn, timeOut,
// studentId, className }) and only for today and yesterday, so a phone
// never piles up old names.

function recentEnough(v) {
  if (!v || !v.id || !v.timeIn) return false;
  return Date.now() - new Date(v.timeIn).getTime() < 36 * 3600 * 1000;
}

export function myVisits() {
  let list = [];
  try { list = JSON.parse(read(VISITS_STORAGE) || "[]"); } catch (e) { list = []; }
  return Array.isArray(list) ? list.filter(recentEnough) : [];
}
export function rememberMyVisit(visit) {
  if (!visit || !visit.id) return;
  const list = myVisits().filter((v) => v.id !== visit.id);
  list.push({
    id: visit.id, firstName: visit.firstName || "", lastName: visit.lastName || "",
    date: visit.date || null, timeIn: visit.timeIn || new Date().toISOString(), timeOut: visit.timeOut || null,
    studentId: visit.studentId || null, className: visit.className || ""
  });
  write(VISITS_STORAGE, JSON.stringify(list));
}
export function markMyVisitOut(id, timeOut) {
  const list = myVisits().map((v) => (v.id === id ? Object.assign({}, v, { timeOut: timeOut || new Date().toISOString() }) : v));
  write(VISITS_STORAGE, JSON.stringify(list));
}
