// deno test supabase/functions/admin-users/handler.test.ts
import { assertEquals } from "jsr:@std/assert@1";
import { createHandler, redirectFor } from "./handler.ts";

// deno-lint-ignore no-explicit-any
type Any = any;

function fakes(opts: { perms?: string[]; signedIn?: boolean; lastSignIn?: string | null; rpcError?: Any; inviteError?: Any } = {}) {
  const calls: Any[] = [];
  const perms = opts.perms || ["admin.users.invite", "admin.users.edit"];
  const caller = {
    auth: { getUser: (token: string) => Promise.resolve(opts.signedIn === false ? { data: { user: null }, error: { message: "bad jwt" } } : { data: { user: { id: "me", token } }, error: null }) },
    rpc: (name: string, args: Any) => {
      calls.push(["rpc", name, args]);
      if (name === "has_permission") return Promise.resolve({ data: perms.indexOf(args.p_key) !== -1, error: null });
      return Promise.resolve(opts.rpcError ? { data: null, error: opts.rpcError } : { data: null, error: null });
    }
  };
  const user = { id: "11111111-1111-1111-1111-111111111111", email: "new@nb4hs.org", last_sign_in_at: opts.lastSignIn ?? null };
  const admin = {
    auth: {
      admin: {
        inviteUserByEmail: (email: string, o: Any) => { calls.push(["invite", email, o]); return Promise.resolve(opts.inviteError ? { data: null, error: opts.inviteError } : { data: { user }, error: null }); },
        generateLink: (o: Any) => { calls.push(["link", o]); return Promise.resolve({ data: { user, properties: { action_link: "https://x/verify?token=t" } }, error: null }); },
        getUserById: (id: string) => Promise.resolve(id === user.id ? { data: { user }, error: null } : { data: { user: null }, error: { message: "nope" } })
      },
      resetPasswordForEmail: (email: string, o: Any) => { calls.push(["reset", email, o]); return Promise.resolve({ data: {}, error: null }); }
    }
  };
  const handle = createHandler({ callerFor: () => caller, admin });
  return { handle, calls, user };
}

function post(body: unknown, headers: Record<string, string> = { Authorization: "Bearer tok", Origin: "https://nb4hs-app.vercel.app" }) {
  return new Request("http://f/admin-users", { method: "POST", headers, body: JSON.stringify(body) });
}

const INVITE = { action: "invite", email: " New@NB4HS.org ", name: "New Person", role: "case_manager", delivery: "email" };

Deno.test("redirects only to our own app", () => {
  assertEquals(redirectFor("https://nb4hs-app.vercel.app"), "https://nb4hs-app.vercel.app/reset-password");
  assertEquals(redirectFor("https://nb4hs-app-git-x-marcdeeh.vercel.app"), "https://nb4hs-app-git-x-marcdeeh.vercel.app/reset-password");
  assertEquals(redirectFor("http://localhost:5173"), "http://localhost:5173/reset-password");
  assertEquals(redirectFor("https://evil.example"), "https://nb4hs-app.vercel.app/reset-password");
  assertEquals(redirectFor(null, "https://site"), "https://site/reset-password");
});

Deno.test("refuses without a token, without sign-in, or without the permission", async () => {
  assertEquals((await fakes().handle(post(INVITE, {}))).status, 401);
  assertEquals((await fakes({ signedIn: false }).handle(post(INVITE))).status, 401);
  const f = fakes({ perms: [] });
  assertEquals((await f.handle(post(INVITE))).status, 403);
  assertEquals(f.calls.filter((c) => c[0] !== "rpc").length, 0); // nothing sent
});

Deno.test("invite by email creates the account and records it as the admin", async () => {
  const f = fakes();
  const res = await f.handle(post(INVITE));
  assertEquals(res.status, 200);
  assertEquals((await res.json()).link, null);
  const invite = f.calls.find((c) => c[0] === "invite");
  assertEquals(invite[1], "new@nb4hs.org");
  assertEquals(invite[2].data, { name: "New Person", role: "case_manager" });
  assertEquals(invite[2].redirectTo, "https://nb4hs-app.vercel.app/reset-password");
  const rec = f.calls.find((c) => c[1] === "admin_record_invite");
  assertEquals(rec[2], { p_user: f.user.id, p_delivery: "email", p_reason: "Invited" });
});

Deno.test("invite by link hands the link back once", async () => {
  const f = fakes();
  const res = await f.handle(post({ ...INVITE, delivery: "link" }));
  assertEquals((await res.json()).link, "https://x/verify?token=t");
  assertEquals(f.calls.find((c) => c[0] === "link")[1].type, "invite");
});

Deno.test("invite validates fields and never invites an administrator", async () => {
  assertEquals((await fakes().handle(post({ ...INVITE, email: "nope" }))).status, 400);
  assertEquals((await fakes().handle(post({ ...INVITE, name: " " }))).status, 400);
  assertEquals((await fakes().handle(post({ ...INVITE, role: "administrator" }))).status, 400);
});

Deno.test("an email that is already registered comes back as 409", async () => {
  const res = await fakes({ inviteError: { message: "A user with this email address has already been registered" } }).handle(post(INVITE));
  assertEquals(res.status, 409);
});

Deno.test("resend is refused once the person has signed in, and checks before sending", async () => {
  const signedIn = fakes({ lastSignIn: "2026-10-01T00:00:00Z" });
  assertEquals((await signedIn.handle(post({ action: "resend_invite", user_id: signedIn.user.id }))).status, 409);
  const blocked = fakes({ rpcError: { code: "42501", message: "only a System Administrator" } });
  assertEquals((await blocked.handle(post({ action: "resend_invite", user_id: blocked.user.id, delivery: "link" }))).status, 403);
  assertEquals(blocked.calls.filter((c) => c[0] === "link").length, 0);
});

Deno.test("password reset is emailed only, after the audit check", async () => {
  const f = fakes();
  const res = await f.handle(post({ action: "password_reset", user_id: f.user.id, delivery: "link" }));
  assertEquals(res.status, 200);
  const body = await res.json();
  assertEquals(body.link, undefined);
  const order = f.calls.filter((c) => c[0] === "reset" || c[1] === "admin_log_auth_action").map((c) => c[0] === "reset" ? "reset" : "log");
  assertEquals(order, ["log", "reset"]);
  const blocked = fakes({ perms: ["admin.users.invite"] });
  assertEquals((await blocked.handle(post({ action: "password_reset", user_id: blocked.user.id }))).status, 403);
});

Deno.test("unknown actions and bad ids", async () => {
  assertEquals((await fakes().handle(post({ action: "delete_everyone" }))).status, 400);
  assertEquals((await fakes().handle(post({ action: "password_reset", user_id: "x" }))).status, 400);
  assertEquals((await fakes().handle(post({ action: "password_reset", user_id: "22222222-2222-2222-2222-222222222222" }))).status, 404);
});
