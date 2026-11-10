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

// ---- Two-step sign-in (TOTP) ----
// Every staff account needs an authenticator app. After the password, a
// session is "aal1"; it becomes "aal2" once a 6-digit code is verified. The
// database refuses aal1 sessions while the require_mfa setting is on (s1),
// so the app treats aal1 as not signed in yet.
//
// Returns "done" (aal2), "verify" (has an authenticator, needs a code),
// "enroll" (no authenticator yet) or null (no session).
export async function mfaStep() {
  const { data, error } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel();
  if (error || !data) return null;
  if (data.currentLevel === "aal2") return "done";
  if (data.nextLevel === "aal2") return "verify";
  return "enroll";
}

export async function verifiedTotpFactor() {
  const { data, error } = await supabase.auth.mfa.listFactors();
  if (error) throw error;
  return (data.totp || []).find((f) => f.status === "verified") || null;
}

// Starts setting up an authenticator: returns { factorId, qrCode, secret }.
// Leftover unverified factors (an abandoned setup) are removed first, since
// Supabase refuses a second factor with the same name.
export async function startTotpEnrollment() {
  const { data: list } = await supabase.auth.mfa.listFactors();
  const stale = ((list && list.all) || []).filter((f) => f.status !== "verified");
  for (const f of stale) await supabase.auth.mfa.unenroll({ factorId: f.id });
  const { data, error } = await supabase.auth.mfa.enroll({ factorType: "totp", friendlyName: "Authenticator app" });
  if (error) throw error;
  return { factorId: data.id, qrCode: data.totp.qr_code, secret: data.totp.secret };
}

export async function verifyTotp(factorId, code) {
  const { error } = await supabase.auth.mfa.challengeAndVerify({ factorId, code: String(code).replace(/\s+/g, "") });
  if (error) throw error;
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

export async function updateProfile(id, patch) {
  const { data, error } = await supabase.from("profiles").update(patch).eq("id", id).select().maybeSingle();
  if (error) throw error;
  return data;
}

// A deactivated profile is no session: StaffLogin refuses it at sign-in, and
// this refuses it when a still-unexpired session is restored on reload.
export function profileToSession(profile) {
  if (!profile || profile.active === false) return null;
  return {
    id: profile.id, role: profile.role, currentUserEmail: profile.email, currentUserName: profile.name,
    primaryWorkspace: profile.primary_workspace || null
  };
}
