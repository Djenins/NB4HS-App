// mileage.js -- the staff mileage log (My Mileage; the `mileage_trips` table,
// m1_mileage_log migration). Staff who drive their own car for work --
// Outreach workers most of all -- log each trip and print a monthly sheet to
// sign and hand in. RLS is the real control: everyone reads and writes their
// own trips; administrators read everyone's, and a program's supervisors read
// their program members'.
//
// Miles are stored one way; a round trip counts double. The reimbursement
// rate is the organization's (app_settings 'mileage_rate'); a sheet
// multiplies the month's miles by the rate in force when it is printed.
import { supabase } from "./supabase.js";

export const MAX_MILES = 1000;

// ---------- pure helpers ----------

// "2026-11" for a Date (local time).
export function monthKey(date) {
  const d = date || new Date();
  return d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0");
}

// First and last day of a "YYYY-MM" month, as YYYY-MM-DD.
export function monthRange(key) {
  const [y, m] = key.split("-").map(Number);
  const last = new Date(y, m, 0).getDate();
  const mm = String(m).padStart(2, "0");
  return { from: y + "-" + mm + "-01", to: y + "-" + mm + "-" + String(last).padStart(2, "0") };
}

// The month before or after ("2026-01", -1 -> "2025-12").
export function shiftMonth(key, delta) {
  const [y, m] = key.split("-").map(Number);
  return monthKey(new Date(y, m - 1 + delta, 1));
}

// "November 2026".
export function monthLabel(key, locale) {
  const [y, m] = key.split("-").map(Number);
  return new Date(y, m - 1, 1).toLocaleDateString(locale || "en-US", { month: "long", year: "numeric" });
}

// "Tue, Nov 3" (or with the year: "Nov 3, 2026").
export function tripDateLabel(iso, withYear) {
  const [y, m, d] = iso.split("-").map(Number);
  const opts = withYear ? { month: "short", day: "numeric", year: "numeric" } : { weekday: "short", month: "short", day: "numeric" };
  return new Date(y, m - 1, d).toLocaleDateString("en-US", opts);
}

// Miles a trip counts for: one way, or double for a round trip. One decimal.
export function tripMiles(trip) {
  const miles = Number(trip.miles) || 0;
  return round1(trip.roundTrip ? miles * 2 : miles);
}

export function totalMiles(trips) {
  return round1((trips || []).reduce((sum, trip) => sum + tripMiles(trip), 0));
}

function round1(n) {
  return Math.round(n * 10) / 10;
}

// Dollars for these miles at this rate, to the cent; null with no rate.
export function reimbursement(miles, rate) {
  if (rate === null || rate === undefined || rate === "" || !Number.isFinite(Number(rate))) return null;
  return Math.round(miles * Number(rate) * 100) / 100;
}

export function fmtMiles(n) {
  return (Number(n) || 0).toLocaleString("en-US", { minimumFractionDigits: 1, maximumFractionDigits: 1 });
}

export function fmtMoney(n) {
  return n === null || n === undefined ? "" : Number(n).toLocaleString("en-US", { style: "currency", currency: "USD" });
}

// The organization's rate from app_settings ({ mileage_rate: 0.7 }), or null.
export function orgMileageRate(orgSettings) {
  const v = orgSettings ? orgSettings.mileage_rate : undefined;
  return typeof v === "number" && Number.isFinite(v) ? v : null;
}

// Miles from odometer readings, when both are given and in order.
export function odometerMiles(start, end) {
  const s = parseInt(start, 10), e = parseInt(end, 10);
  if (!Number.isFinite(s) || !Number.isFinite(e) || e < s) return null;
  return e - s;
}

export function emptyTripForm(today) {
  return { tripDate: today, startLocation: "", destination: "", purpose: "", miles: "", roundTrip: false, odometerStart: "", odometerEnd: "", notes: "" };
}

export function tripToForm(trip) {
  return {
    tripDate: trip.tripDate, startLocation: trip.startLocation, destination: trip.destination, purpose: trip.purpose,
    miles: String(trip.miles), roundTrip: !!trip.roundTrip,
    odometerStart: trip.odometerStart === null ? "" : String(trip.odometerStart),
    odometerEnd: trip.odometerEnd === null ? "" : String(trip.odometerEnd),
    notes: trip.notes || ""
  };
}

// Field -> what's wrong with it, mirroring the table's checks. Empty when fine.
// (A staff-only screen: English, like My Availability.)
export function validateTrip(form) {
  const errors = {};
  if (!/^\d{4}-\d{2}-\d{2}$/.test(form.tripDate || "")) errors.tripDate = "Pick the day of the trip.";
  if (!(form.startLocation || "").trim()) errors.startLocation = "Say where you started.";
  if (!(form.destination || "").trim()) errors.destination = "Say where you went.";
  if (!(form.purpose || "").trim()) errors.purpose = "Say what the trip was for.";
  const miles = Number(form.miles);
  if (form.miles === "" || !Number.isFinite(miles) || miles <= 0 || miles > MAX_MILES) errors.miles = "Enter the miles, more than 0 and up to " + MAX_MILES + ".";
  const hasStart = form.odometerStart !== "", hasEnd = form.odometerEnd !== "";
  if (hasStart && !/^\d{1,7}$/.test(form.odometerStart)) errors.odometerStart = "Whole miles only, as on the odometer.";
  if (hasEnd && !/^\d{1,7}$/.test(form.odometerEnd)) errors.odometerEnd = "Whole miles only, as on the odometer.";
  if (hasStart && hasEnd && !errors.odometerStart && !errors.odometerEnd && Number(form.odometerEnd) < Number(form.odometerStart)) {
    errors.odometerEnd = "The end reading must be at least the start reading.";
  }
  return errors;
}

export function formToRow(form) {
  return {
    trip_date: form.tripDate,
    start_location: form.startLocation.trim(),
    destination: form.destination.trim(),
    purpose: form.purpose.trim(),
    miles: Math.round(Number(form.miles) * 10) / 10,
    round_trip: !!form.roundTrip,
    odometer_start: form.odometerStart === "" ? null : Number(form.odometerStart),
    odometer_end: form.odometerEnd === "" ? null : Number(form.odometerEnd),
    notes: (form.notes || "").trim() || null
  };
}

export function rowToTrip(row) {
  return {
    id: row.id, staffId: row.staff_id, tripDate: row.trip_date, startLocation: row.start_location,
    destination: row.destination, purpose: row.purpose, miles: Number(row.miles), roundTrip: row.round_trip,
    odometerStart: row.odometer_start, odometerEnd: row.odometer_end, notes: row.notes || ""
  };
}

// Places someone has driven from or to, most used first -- quick picks for the form.
export function frequentPlaces(trips, limit) {
  const counts = new Map();
  (trips || []).forEach((trip) => {
    [trip.startLocation, trip.destination].forEach((p) => {
      const key = (p || "").trim();
      if (key) counts.set(key, (counts.get(key) || 0) + 1);
    });
  });
  return [...counts.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0])).slice(0, limit || 8).map((e) => e[0]);
}

// ---------- data ----------

export async function fetchTrips(staffId, from, to) {
  const { data, error } = await supabase.from("mileage_trips").select("*")
    .eq("staff_id", staffId).gte("trip_date", from).lte("trip_date", to)
    .order("trip_date", { ascending: true }).order("created_at", { ascending: true });
  if (error) throw error;
  return data.map(rowToTrip);
}

// The person's last few trips, for the form's quick picks.
export async function fetchRecentTrips(staffId) {
  const { data, error } = await supabase.from("mileage_trips").select("*")
    .eq("staff_id", staffId).order("trip_date", { ascending: false }).limit(60);
  if (error) throw error;
  return data.map(rowToTrip);
}

export async function saveTrip(id, form) {
  const row = formToRow(form);
  const query = id
    ? supabase.from("mileage_trips").update(row).eq("id", id)
    : supabase.from("mileage_trips").insert(row);
  const { data, error } = await query.select().single();
  if (error) throw error;
  return rowToTrip(data);
}

export async function deleteTrip(id) {
  const { error } = await supabase.from("mileage_trips").delete().eq("id", id);
  if (error) throw error;
}

// Whose mileage the signed-in person may open besides their own: everyone
// for an administrator, their programs' members for a program supervisor,
// nobody for everyone else (mileage_team(), same rule as the table's RLS).
export async function fetchMileageTeam() {
  const { data, error } = await supabase.rpc("mileage_team");
  if (error) throw error;
  return data || [];
}

// ---------- emailing the sheet ----------

export const MAX_EMAIL_RECIPIENTS = 5;
export const MAX_EMAIL_NOTE = 500;

// Staff a sheet can be emailed to: active accounts with an email address,
// the signed-in person first, then by name.
export function emailableStaff(profiles, selfId) {
  return (profiles || [])
    .filter((p) => p.active !== false && p.email)
    .slice()
    .sort((a, b) => (a.id === selfId ? -1 : b.id === selfId ? 1 : (a.name || a.email).localeCompare(b.name || b.email)));
}

// What to tell the person for each answer of the email-mileage-sheet function.
export function mileageEmailError(code) {
  if (code === "email_not_configured") return "Email isn't set up for the app yet, so nothing was sent. Download the PDF and attach it to an email instead.";
  if (code === "bad_recipients") return "One of the people you picked can't receive email. Pick someone else.";
  if (code === "forbidden") return "You can't email this person's mileage sheet.";
  if (code === "pdf_too_large") return "The sheet is too large to email. Download it instead.";
  if (code === "not_signed_in") return "Your session ended. Sign in again, then try once more.";
  return "Couldn't send the email. Check your connection and try again.";
}

// Sends the built PDF (base64, no data: prefix) to the chosen staff through
// the email-mileage-sheet Edge Function. Throws { code } on failure.
export async function emailMileageSheet({ staffId, month, recipients, note, fileName, pdfBase64 }) {
  const { data, error } = await supabase.functions.invoke("email-mileage-sheet", {
    body: { staffId, month, recipients, note: note || "", fileName, pdf: pdfBase64 }
  });
  if (!error) return data;
  let detail = null;
  try { detail = error.context && typeof error.context.json === "function" ? await error.context.json() : null; } catch (e) { detail = null; }
  throw { code: (detail && detail.error) || "send_failed", message: error.message };
}
