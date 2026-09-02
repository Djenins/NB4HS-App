// supabaseAuth.js -- thin wrapper around Supabase Auth for staff sign-in.
// Phase 1 of the Supabase migration (see plans/wobbly-munching-rose.md):
// replaces the old plaintext `data.users` password check with real auth.
// `profiles` (role/name/active) is a separate table keyed by auth.users.id,
// auto-populated by a `handle_new_user` DB trigger on signup.
import { supabase } from "./supabase.js";

export async function signIn(email, password) {
  return supabase.auth.signInWithPassword({ email, password });
}

export async function signOut() {
  return supabase.auth.signOut();
}

export async function resetPasswordForEmail(email) {
  return supabase.auth.resetPasswordForEmail(email, { redirectTo: `${window.location.origin}/reset-password` });
}

export async function updatePassword(password) {
  return supabase.auth.updateUser({ password });
}

export async function getSession() {
  const { data } = await supabase.auth.getSession();
  return data.session || null;
}

// Fires immediately with the current session, then on every change
// (sign-in/sign-out/token refresh). Returns an unsubscribe function.
export function onAuthStateChange(callback) {
  const { data } = supabase.auth.onAuthStateChange((_event, session) => callback(session));
  return () => data.subscription.unsubscribe();
}

export async function fetchProfile(userId) {
  const { data, error } = await supabase.from("profiles").select("*").eq("id", userId).maybeSingle();
  if (error) { console.warn("fetchProfile failed", error); return null; }
  return data;
}

export async function fetchAllProfiles() {
  const { data, error } = await supabase.from("profiles").select("*").order("name");
  if (error) { console.warn("fetchAllProfiles failed", error); return []; }
  return data;
}

// Self-service signup used by Users.jsx's "Add User" -- doesn't require
// service-role/admin privileges. `role`/`name` ride along as auth user
// metadata so the handle_new_user trigger can populate `profiles` on insert.
export async function signUpStaff(email, password, name, role) {
  return supabase.auth.signUp({ email, password, options: { data: { name, role } } });
}

export async function updateProfile(id, patch) {
  const { data, error } = await supabase.from("profiles").update(patch).eq("id", id).select().maybeSingle();
  if (error) throw error;
  return data;
}

export function profileToSession(profile) {
  if (!profile) return null;
  return { id: profile.id, role: profile.role, currentUserEmail: profile.email, currentUserName: profile.name };
}
