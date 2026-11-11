// foodSigninData.js -- Supabase calls for food distribution sign-up and
// day-of sign-in (migration f1_food_signin_events). Staff manage events and
// read sign-ups under RLS and mark pickups through food_signup_pickup();
// the public sign-up page (pages/FoodSignUp.jsx) goes through two
// security-definer functions that only read an event's heading and add a
// sign-up.
import { supabase } from "./supabase.js";

export function eventFromRow(r) {
  return {
    id: r.id, shortCode: r.short_code || "", occasion: r.occasion, customOccasion: r.custom_occasion || "", date: r.event_date || "",
    location: r.location || "", lang: r.lang, isOpen: r.is_open, createdAt: r.created_at,
  };
}
export function signupFromRow(r) {
  return {
    id: r.id, eventId: r.event_id, clientId: r.client_id, foodClientId: r.food_client_id,
    firstName: r.first_name, lastName: r.last_name, phone: r.phone,
    street: r.street, unit: r.unit || "", city: r.city || "", zip: r.zip || "", householdSize: r.household_size || "",
    signedUpAt: r.signed_up_at, pickedUpAt: r.picked_up_at || "", signature: r.signature || "",
  };
}

export function signupName(s) {
  return [s.firstName, s.lastName].filter(Boolean).join(" ");
}
// "12 Main St, Apt 2, Providence 02905"
export function signupAddress(s) {
  const unit = s.unit ? (/^[0-9a-z-]+$/i.test(s.unit) ? "Apt " + s.unit : s.unit) : "";
  return [s.street, unit, [s.city, s.zip].filter(Boolean).join(" ")].filter(Boolean).join(", ");
}

// Staff search on the day: any part of the name, or the phone's digits.
export function signupMatches(s, query) {
  const q = (query || "").trim().toLowerCase();
  if (!q) return true;
  const digits = q.replace(/\D/g, "");
  if (digits.length >= 3 && (s.phone || "").replace(/\D/g, "").includes(digits)) return true;
  const name = signupName(s).toLowerCase();
  return q.split(/\s+/).every((part) => name.includes(part));
}

// The public sign-up link for an event: the short /f/<code> form (migration
// f2), or the original /food-signup/<uuid>, which still works.
export function foodSignupUrl(ev, origin) {
  const base = origin || window.location.origin;
  return ev.shortCode ? base + "/f/" + ev.shortCode : base + "/food-signup/" + ev.id;
}

export async function fetchFoodSigninEvents() {
  const { data, error } = await supabase.from("food_signin_events")
    .select("*, food_signups(picked_up_at)").order("created_at", { ascending: false });
  if (error) { console.warn("fetchFoodSigninEvents failed", error); return []; }
  return data.map((r) => {
    const rows = r.food_signups || [];
    return Object.assign(eventFromRow(r), { count: rows.length, pickedUp: rows.filter((x) => x.picked_up_at).length });
  });
}
export async function createFoodSigninEvent(fields) {
  const { data, error } = await supabase.from("food_signin_events").insert({
    occasion: fields.occasion, custom_occasion: fields.customOccasion || "", event_date: fields.date || null,
    location: fields.location || "", lang: fields.lang,
  }).select().single();
  if (error) throw error;
  return Object.assign(eventFromRow(data), { count: 0, pickedUp: 0 });
}
export async function setFoodSigninEventOpen(id, isOpen) {
  const { error } = await supabase.from("food_signin_events").update({ is_open: isOpen }).eq("id", id);
  if (error) throw error;
}
export async function deleteFoodSigninEvent(id) {
  const { error } = await supabase.from("food_signin_events").delete().eq("id", id);
  if (error) throw error;
}
export async function fetchFoodSignups(eventId) {
  const { data, error } = await supabase.from("food_signups").select("*").eq("event_id", eventId).order("last_name").order("first_name");
  if (error) { console.warn("fetchFoodSignups failed", error); return []; }
  return data.map(signupFromRow);
}
export async function deleteFoodSignup(id) {
  const { error } = await supabase.from("food_signups").delete().eq("id", id);
  if (error) throw error;
}
export async function pickUpFoodSignup(id, signature, items) {
  const { data, error } = await supabase.rpc("food_signup_pickup", { p_signup: id, p_signature: signature, p_items: items });
  if (error) throw error;
  return signupFromRow(data);
}
export async function undoFoodSignupPickup(id) {
  const { data, error } = await supabase.rpc("food_signup_undo_pickup", { p_signup: id });
  if (error) throw error;
  return signupFromRow(data);
}

// Public: null when the link is wrong.
export async function publicFoodEvent(id) {
  const { data, error } = await supabase.rpc("public_food_event", { p_id: id });
  if (error) throw error;
  return data ? eventFromRow(data) : null;
}
// Public, from a short link: the same, with the event's id.
export async function publicFoodEventByCode(code) {
  const { data, error } = await supabase.rpc("public_food_event_code", { p_code: code });
  if (error) throw error;
  return data ? eventFromRow(data) : null;
}
// Resolves to "ok" | "already" | "duplicate_address" | "closed".
export async function publicFoodSignup(eventId, fields) {
  const { data, error } = await supabase.rpc("public_food_signup", {
    p_event: eventId,
    p: {
      first_name: fields.firstName, last_name: fields.lastName, phone: fields.phone,
      street: fields.street, unit: fields.unit, city: fields.city, zip: fields.zip, household_size: fields.householdSize,
    },
  });
  if (error) throw error;
  return (data && data.status) || "ok";
}
