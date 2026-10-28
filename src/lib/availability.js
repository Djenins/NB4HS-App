// availability.js -- staff availability (weekly hours + time off) and client
// self-booking against it. Tables and functions come from
// supabase/migrations/20261026192423_staff_availability_booking.sql.
//
// The weekly calendar on My Availability edits a set of 30-minute cells
// ("1-09:30" = Monday 9:30); it's stored as merged time ranges per weekday.
import { supabase } from "./supabase.js";

export var SLOT_MINUTES = 30;
// The editable day: 7:00 AM to 8:00 PM.
export var DAY_START_MIN = 7 * 60;
export var DAY_END_MIN = 20 * 60;

export function minToHHMM(min) {
  return String(Math.floor(min / 60)).padStart(2, "0") + ":" + String(min % 60).padStart(2, "0");
}
function hhmmToMin(hhmm) {
  var p = String(hhmm).split(":");
  return Number(p[0]) * 60 + Number(p[1]);
}
export function cellKey(weekday, min) { return weekday + "-" + minToHHMM(min); }

// "9:30 AM" -- for slot buttons and labels.
export function fmtSlotTime(hhmm) {
  var min = hhmmToMin(hhmm);
  var h = Math.floor(min / 60), m = min % 60;
  return (h % 12 || 12) + ":" + String(m).padStart(2, "0") + " " + (h < 12 ? "AM" : "PM");
}

// rows ({ weekday, start_time, end_time }) -> Set of cell keys
export function rangesToCells(rows) {
  var cells = new Set();
  (rows || []).forEach(function (r) {
    for (var m = hhmmToMin(r.start_time); m < hhmmToMin(r.end_time); m += SLOT_MINUTES) cells.add(cellKey(r.weekday, m));
  });
  return cells;
}

// Set of cell keys -> merged ranges ({ weekday, start_time, end_time })
export function cellsToRanges(cells) {
  var byDay = {};
  cells.forEach(function (k) {
    var parts = k.split("-");
    (byDay[parts[0]] = byDay[parts[0]] || []).push(hhmmToMin(parts[1]));
  });
  var out = [];
  Object.keys(byDay).forEach(function (wd) {
    var mins = byDay[wd].sort(function (a, b) { return a - b; });
    var start = mins[0], prev = mins[0];
    for (var i = 1; i <= mins.length; i++) {
      if (i < mins.length && mins[i] === prev + SLOT_MINUTES) { prev = mins[i]; continue; }
      out.push({ weekday: Number(wd), start_time: minToHHMM(start), end_time: minToHHMM(prev + SLOT_MINUTES) });
      if (i < mins.length) { start = mins[i]; prev = mins[i]; }
    }
  });
  return out.sort(function (a, b) { return a.weekday - b.weekday || a.start_time.localeCompare(b.start_time); });
}

// ---------- staff side ----------

export async function fetchWeeklyAvailability(profileId) {
  var res = await supabase.from("staff_availability").select("weekday, start_time, end_time").eq("profile_id", profileId);
  if (res.error) throw res.error;
  return res.data.map(function (r) { return { weekday: r.weekday, start_time: r.start_time.slice(0, 5), end_time: r.end_time.slice(0, 5) }; });
}

// Replaces the person's whole weekly schedule with `ranges`.
export async function saveWeeklyAvailability(profileId, ranges) {
  var del = await supabase.from("staff_availability").delete().eq("profile_id", profileId);
  if (del.error) throw del.error;
  if (!ranges.length) return;
  var ins = await supabase.from("staff_availability").insert(ranges.map(function (r) {
    return { profile_id: profileId, weekday: r.weekday, start_time: r.start_time, end_time: r.end_time };
  }));
  if (ins.error) throw ins.error;
}

export async function fetchTimeOff(profileId) {
  var res = await supabase.from("staff_time_off").select("*").eq("profile_id", profileId).order("start_date");
  if (res.error) throw res.error;
  return res.data.map(function (r) { return { id: r.id, startDate: r.start_date, endDate: r.end_date, note: r.note || "" }; });
}
export async function addTimeOff(profileId, entry) {
  var res = await supabase.from("staff_time_off").insert({
    profile_id: profileId, start_date: entry.startDate, end_date: entry.endDate || entry.startDate, note: entry.note || null
  });
  if (res.error) throw res.error;
}
export async function deleteTimeOff(id) {
  var res = await supabase.from("staff_time_off").delete().eq("id", id);
  if (res.error) throw res.error;
}

// ---------- shared with the client booking form ----------

export async function fetchOpenSlots(staffId, fromDate, days) {
  var res = await supabase.rpc("staff_open_slots", { p_staff: staffId, p_from: fromDate, p_days: days });
  if (res.error) throw res.error;
  return res.data.map(function (r) { return { date: r.slot_date, time: r.slot_time }; });
}

export async function fetchBookableStaff() {
  var res = await supabase.rpc("bookable_staff");
  if (res.error) { console.warn("bookable_staff failed", res.error); return []; }
  return res.data;
}

// Holds the slot as a 'requested' appointment. Rejects with
// err.slotTaken = true when someone else got there first.
export async function bookStaffAppointment(fields) {
  var res = await supabase.rpc("book_staff_appointment", {
    p: {
      staff_id: fields.staffId, date: fields.date, time: fields.time,
      first_name: fields.firstName, last_name: fields.lastName, phone: fields.phone,
      email: fields.email || null, reason: fields.reason || null
    }
  });
  if (res.error) {
    var err = new Error(res.error.message);
    err.slotTaken = /slot_taken/.test(res.error.message || "");
    throw err;
  }
}
