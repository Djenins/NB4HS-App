// admin-users -- the account actions only Supabase Auth itself can do
// (plans/unified-access-architecture.md §6, "Account lifecycle"):
//
//   invite          create a staff account and send (or hand back) a
//                   one-time link to set a password
//   resend_invite   again, for an account that has never signed in
//   password_reset  email a password-reset link
//
// Deactivate, reactivate and "sign out everywhere" don't need this function:
// they are database functions (admin_set_user_active, admin_revoke_sessions
// in p2a_admin_accounts) the browser calls directly.
//
// Every request runs as the signed-in admin: the caller's own token is
// checked with has_permission() before anything happens, and the audit row
// is written by a database function called with that same token, so it
// names the admin. The service-role key is only used for the Auth admin
// calls and never leaves this function.
//
// Links are handed back only for invites -- to accounts that have never
// signed in. A password-reset link is only ever emailed: showing it to an
// admin would let them sign in as that person.

export const LEGACY_ROLES = ["staff", "receptionist", "case_manager", "job_developer"];
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const DEFAULT_SITE = "https://nb4hs-app.vercel.app";

export const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS"
};

// deno-lint-ignore no-explicit-any
type Any = any;
export interface Deps {
  // A client acting as whoever sent the request.
  callerFor(authHeader: string): Any;
  // The service-role client.
  admin: Any;
  siteUrl?: string;
}

function json(status: number, body: unknown) {
  return new Response(JSON.stringify(body), { status, headers: { ...CORS, "Content-Type": "application/json" } });
}

// Where the link sends people: the app that asked, if it's ours.
export function redirectFor(origin: string | null, siteUrl?: string) {
  const ok = origin && (/^https:\/\/nb4hs-app(-[a-z0-9-]+)?\.vercel\.app$/.test(origin) || /^http:\/\/localhost:\d+$/.test(origin));
  return (ok ? origin : siteUrl || DEFAULT_SITE) + "/reset-password";
}

// Postgres error codes from the admin_* functions -> HTTP.
function statusForDbError(error: Any) {
  if (!error) return 500;
  if (error.code === "42501") return 403;
  if (error.code === "P0002") return 404;
  if (error.code === "22023") return 400;
  return 500;
}

function authError(error: Any) {
  const text = String((error && error.message) || "");
  if (/already (been )?registered|already exists/i.test(text)) return json(409, { error: "already_registered" });
  if (/rate limit/i.test(text)) return json(429, { error: "rate_limited" });
  if (/sending|smtp|email/i.test(text)) return json(502, { error: "email_failed", detail: text });
  return json(500, { error: "auth_failed", detail: text });
}

async function sendInvite(deps: Deps, email: string, delivery: string, redirectTo: string, data?: Record<string, string>) {
  if (delivery === "email") {
    const res = await deps.admin.auth.admin.inviteUserByEmail(email, { data, redirectTo });
    if (res.error) return { error: res.error };
    return { userId: res.data.user.id as string };
  }
  const res = await deps.admin.auth.admin.generateLink({ type: "invite", email, options: { data, redirectTo } });
  if (res.error) return { error: res.error };
  return { userId: res.data.user.id as string, link: res.data.properties.action_link as string };
}

export function createHandler(deps: Deps) {
  return async function handle(req: Request): Promise<Response> {
    if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
    if (req.method !== "POST") return json(405, { error: "method_not_allowed" });

    const authHeader = req.headers.get("Authorization") || "";
    if (!/^Bearer .+/.test(authHeader)) return json(401, { error: "not_signed_in" });
    const caller = deps.callerFor(authHeader);
    const { data: who, error: whoError } = await caller.auth.getUser(authHeader.slice(7));
    if (whoError || !who || !who.user) return json(401, { error: "not_signed_in" });

    let body: Any;
    try { body = await req.json(); } catch { return json(400, { error: "bad_request" }); }
    const action = body && body.action;
    const needs = action === "password_reset" ? "admin.users.edit"
      : action === "invite" || action === "resend_invite" ? "admin.users.invite" : null;
    if (!needs) return json(400, { error: "unknown_action" });

    const perm = await caller.rpc("has_permission", { p_key: needs });
    if (perm.error || perm.data !== true) return json(403, { error: "forbidden" });

    const redirectTo = redirectFor(req.headers.get("Origin"), deps.siteUrl);
    const delivery = body.delivery === "link" ? "link" : "email";
    const reason = typeof body.reason === "string" ? body.reason.trim().slice(0, 1000) : "";

    if (action === "invite") {
      const email = String(body.email || "").trim().toLowerCase();
      const name = String(body.name || "").trim();
      const role = String(body.role || "staff");
      if (!EMAIL.test(email) || !name || name.length > 120 || LEGACY_ROLES.indexOf(role) === -1) {
        return json(400, { error: "invalid_fields" });
      }
      const sent = await sendInvite(deps, email, delivery, redirectTo, { name, role });
      if (sent.error) return authError(sent.error);
      // The account exists now; if recording fails it shows as "pending
      // approval" and the invite can be resent.
      const rec = await caller.rpc("admin_record_invite", { p_user: sent.userId, p_delivery: delivery, p_reason: reason || "Invited" });
      if (rec.error) return json(statusForDbError(rec.error), { error: "not_recorded", detail: rec.error.message, user_id: sent.userId });
      return json(200, { user_id: sent.userId, link: sent.link || null });
    }

    const userId = String(body.user_id || "");
    if (!/^[0-9a-f-]{36}$/i.test(userId)) return json(400, { error: "invalid_fields" });
    const found = await deps.admin.auth.admin.getUserById(userId);
    if (found.error || !found.data || !found.data.user) return json(404, { error: "not_found" });
    const user = found.data.user;

    if (action === "resend_invite") {
      if (user.last_sign_in_at) return json(409, { error: "already_signed_in" });
      // Record first: it makes the checks (not yourself, administrators only
      // by a System Administrator) before any link exists.
      const rec = await caller.rpc("admin_record_invite", { p_user: userId, p_delivery: delivery, p_reason: reason || "Invite resent" });
      if (rec.error) return json(statusForDbError(rec.error), { error: "forbidden", detail: rec.error.message });
      const sent = await sendInvite(deps, user.email, delivery, redirectTo);
      if (sent.error) return authError(sent.error);
      return json(200, { user_id: userId, link: sent.link || null });
    }

    // password_reset
    const log = await caller.rpc("admin_log_auth_action", { p_user: userId, p_action: "password_reset", p_reason: reason || "Password reset requested" });
    if (log.error) return json(statusForDbError(log.error), { error: "forbidden", detail: log.error.message });
    const sent = await deps.admin.auth.resetPasswordForEmail(user.email, { redirectTo });
    if (sent.error) return authError(sent.error);
    return json(200, { user_id: userId });
  };
}
