// deno test supabase/functions/email-mileage-sheet/handler.test.ts
import { assertEquals } from "jsr:@std/assert@1";
import { base64Bytes, createHandler, renderEmail, resendSender, safeFileName } from "./handler.ts";

// deno-lint-ignore no-explicit-any
type Any = any;

const ME = "11111111-1111-1111-1111-111111111111";
const BOSS = "22222222-2222-2222-2222-222222222222";
const GONE = "33333333-3333-3333-3333-333333333333";
const PDF = btoa("%PDF-1.4 fake sheet");

function fakes(opts: { canView?: boolean; configured?: boolean; sendOk?: boolean; signedIn?: boolean } = {}) {
  const sent: Any[] = [];
  const caller = {
    auth: { getUser: () => Promise.resolve(opts.signedIn === false ? { data: { user: null }, error: { message: "bad" } } : { data: { user: { id: ME } }, error: null }) },
    rpc: (name: string, args: Any) => Promise.resolve({ data: name === "mileage_can_view" ? (opts.canView ?? args.p_staff === ME) : null, error: null })
  };
  const profiles = [
    { id: ME, name: "Ada Admin", email: "ada@nb4hs.org", active: true },
    { id: BOSS, name: "Sam Super", email: "sam@nb4hs.org", active: true },
    { id: GONE, name: "Old Staff", email: "old@nb4hs.org", active: false }
  ];
  const admin = { from: () => ({ select: () => ({ in: (_c: string, ids: string[]) => Promise.resolve({ data: profiles.filter((p) => ids.includes(p.id)), error: null }) }) }) };
  const handle = createHandler({
    callerFor: () => caller, admin,
    send: (e) => { sent.push(e); return Promise.resolve(opts.sendOk === false ? { ok: false, error: "provider 500" } : { ok: true, id: "re_1" }); },
    providerConfigured: opts.configured ?? true
  });
  return { handle, sent };
}

function post(body: unknown, auth = "Bearer tok") {
  return new Request("http://f/email-mileage-sheet", { method: "POST", headers: { Authorization: auth }, body: JSON.stringify(body) });
}
const OK = { staffId: ME, month: "2026-11", recipients: [ME, BOSS], note: "For November.", fileName: "mileage-Ada-Admin-2026-11.pdf", pdf: PDF };

Deno.test("sends the PDF to the chosen staff, replying to the sender", async () => {
  const { handle, sent } = fakes();
  const res = await handle(post(OK));
  assertEquals(res.status, 200);
  assertEquals(await res.json(), { sent: 2, id: "re_1" });
  assertEquals(sent[0].to, ["ada@nb4hs.org", "sam@nb4hs.org"]);
  assertEquals(sent[0].replyTo, "ada@nb4hs.org");
  assertEquals(sent[0].subject, "Mileage sheet — Ada Admin, November 2026");
  assertEquals(sent[0].attachments, [{ filename: "mileage-Ada-Admin-2026-11.pdf", content: PDF }]);
});

Deno.test("needs a signed-in caller who may see that log", async () => {
  assertEquals((await fakes({ signedIn: false }).handle(post(OK))).status, 401);
  assertEquals((await fakes().handle(post(OK, ""))).status, 401);
  const res = await fakes({ canView: false }).handle(post(OK));
  assertEquals(res.status, 403);
});

Deno.test("only active staff accounts, at most five", async () => {
  const { handle, sent } = fakes();
  assertEquals((await handle(post({ ...OK, recipients: [GONE] }))).status, 400);
  assertEquals((await handle(post({ ...OK, recipients: ["someone@gmail.com"] }))).status, 400);
  assertEquals((await handle(post({ ...OK, recipients: [] }))).status, 400);
  const six = ["a", "b", "c", "d", "e", "f"].map((c) => c.repeat(8) + "-1111-1111-1111-111111111111");
  assertEquals((await handle(post({ ...OK, recipients: six }))).status, 400);
  assertEquals(sent.length, 0);
});

Deno.test("rejects what isn't a PDF, and long notes", async () => {
  const { handle } = fakes();
  assertEquals((await handle(post({ ...OK, pdf: btoa("<html>") }))).status, 400);
  assertEquals((await handle(post({ ...OK, pdf: "not base64!" }))).status, 400);
  assertEquals((await handle(post({ ...OK, note: "x".repeat(501) }))).status, 400);
  assertEquals((await handle(post({ ...OK, month: "2026-13" }))).status, 400);
});

Deno.test("says when email isn't set up, and when the provider fails", async () => {
  const off = await fakes({ configured: false }).handle(post(OK));
  assertEquals(off.status, 503);
  assertEquals((await off.json()).error, "email_not_configured");
  assertEquals((await fakes({ sendOk: false }).handle(post(OK))).status, 502);
});

Deno.test("helpers", () => {
  assertEquals(base64Bytes(btoa("12345")), 5);
  assertEquals(safeFileName("../../etc/passwd", "2026-11"), "..-..-etc-passwd.pdf");
  assertEquals(safeFileName("", "2026-11"), "mileage-2026-11.pdf");
  const own = renderEmail({ senderName: "Ada", staffName: "Ada", month: "2026-11", note: "<b>hi</b>" });
  assertEquals(own.text.startsWith("Ada sent you their mileage sheet for November 2026."), true);
  assertEquals(own.html.includes("&lt;b&gt;hi&lt;/b&gt;"), true);
  const other = renderEmail({ senderName: "Sam", staffName: "Ada", month: "2026-01", note: "" });
  assertEquals(other.subject, "Mileage sheet — Ada, January 2026");
});

Deno.test("resendSender posts attachments and reply_to", async () => {
  let posted: Any = null;
  const send = resendSender("key", "NB4HS <m@nb4hs.org>", ((_u: string, init: Any) => { posted = JSON.parse(init.body); return Promise.resolve(new Response(JSON.stringify({ id: "x" }), { status: 200 })); }) as Any);
  const r = await send({ to: ["a@nb4hs.org"], replyTo: "b@nb4hs.org", subject: "s", html: "h", text: "t", attachments: [{ filename: "f.pdf", content: PDF }] });
  assertEquals(r, { ok: true, id: "x" });
  assertEquals(posted.reply_to, "b@nb4hs.org");
  assertEquals(posted.attachments[0].filename, "f.pdf");
});
