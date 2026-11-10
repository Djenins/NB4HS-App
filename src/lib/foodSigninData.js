// foodSigninData.js -- Supabase calls for online food distribution sign-in
// (migration f1_food_signin_events). Staff manage events and read sign-ins
// under RLS; the public page (pages/FoodSignIn.jsx) goes through two
// security-definer functions that only read an event's heading and add a
// sign-in.
import { supabase } from "./supabase.js";

export function eventFromRow(r) {
  return {
    id: r.id, occasion: r.occasion, customOccasion: r.custom_occasion || "", date: r.event_date || "",
    location: r.location || "", lang: r.lang, isOpen: r.is_open, createdAt: r.created_at,
  };
}
function signinFromRow(r) {
  return { id: r.id, eventId: r.event_id, name: r.name, address: r.address, phone: r.phone, signature: r.signature, createdAt: r.created_at };
}

// The public link for an event; the uuid is the only key.
export function foodSigninUrl(eventId, origin) {
  return (origin || window.location.origin) + "/food-signin/" + eventId;
}

export async function fetchFoodSigninEvents() {
  const { data, error } = await supabase.from("food_signin_events").select("*, food_signins(count)").order("created_at", { ascending: false });
  if (error) { console.warn("fetchFoodSigninEvents failed", error); return []; }
  return data.map((r) => Object.assign(eventFromRow(r), { count: (r.food_signins && r.food_signins[0] && r.food_signins[0].count) || 0 }));
}
export async function createFoodSigninEvent(fields) {
  const { data, error } = await supabase.from("food_signin_events").insert({
    occasion: fields.occasion, custom_occasion: fields.customOccasion || "", event_date: fields.date || null,
    location: fields.location || "", lang: fields.lang,
  }).select().single();
  if (error) throw error;
  return Object.assign(eventFromRow(data), { count: 0 });
}
export async function setFoodSigninEventOpen(id, isOpen) {
  const { error } = await supabase.from("food_signin_events").update({ is_open: isOpen }).eq("id", id);
  if (error) throw error;
}
export async function deleteFoodSigninEvent(id) {
  const { error } = await supabase.from("food_signin_events").delete().eq("id", id);
  if (error) throw error;
}
export async function fetchFoodSignins(eventId) {
  const { data, error } = await supabase.from("food_signins").select("*").eq("event_id", eventId).order("created_at");
  if (error) { console.warn("fetchFoodSignins failed", error); return []; }
  return data.map(signinFromRow);
}
export async function deleteFoodSignin(id) {
  const { error } = await supabase.from("food_signins").delete().eq("id", id);
  if (error) throw error;
}

// Public: null when the link is wrong.
export async function publicFoodEvent(id) {
  const { data, error } = await supabase.rpc("public_food_event", { p_id: id });
  if (error) throw error;
  return data ? eventFromRow(data) : null;
}
export async function publicFoodSignin(eventId, fields) {
  const { error } = await supabase.rpc("public_food_signin", {
    p_event: eventId,
    p: { name: fields.name, address: fields.address, phone: fields.phone, signature: fields.signature },
  });
  if (error) throw error;
}
