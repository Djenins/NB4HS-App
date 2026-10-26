// deno test supabase/functions/send-outbound/handler.test.ts
import { assert, assertEquals } from "jsr:@std/assert@1";
import { appLink, createHandler, escapeHtml, renderEmail, resendSender } from "./handler.ts";

// deno-lint-ignore no-explicit-any
type Any = any;

const MESSAGES = [
  { id: "m1", to_address: "director@nb4hs.org", template: "staff_report_submitted",
    payload: { staff_name: "Jane <b>Pierre</b>", period: "Nov 2 – Nov 15, 2026", submitted_at: "Mon, Nov 16, 2026 at 3:00 PM EST", link: "/staffreports/r1" } },
  { id: "m2", to_address: "jane@nb4hs.org", template: "staff_report_revision_requested", payload: { period: "Nov 2 – Nov 15, 2026", link: "/myreports/r1" } },
  { id: "m3", to_address: "x@nb4hs.org", template: "something_else", payload: {} }
];

function fakes(opts: { sendResults?: Record<string, { ok: boolean; id?: string; error?: string }>; claimError?: Any; providerConfigured?: boolean } = {}) {
  const calls: Any[] = [];
  const sent: Any[] = [];
  const admin = {
    rpc: (name: string, args: Any) => {
      calls.push([name, args]);
      if (name === "claim_outbound_messages") return Promise.resolve(opts.claimError ? { data: null, error: opts.claimError } : { data: MESSAGES, error: null });
      return Promise.resolve({ data: null, error: null });
    }
  };
  const send = (email: Any) => {
    sent.push(email);
    const r = (opts.sendResults || {})[email.to];
    if (r && r.error === "throw") return Promise.reject(new Error("network down"));
    return Promise.resolve(r || { ok: true, id: "prov-" + email.to });
  };
  const handle = createHandler({ admin, send, cronSecret: "s3cret", appUrl: "https://app.example/", providerConfigured: opts.providerConfigured ?? true });
  return { handle, calls, sent };
}

const post = (token = "s3cret") => new Request("http://f/send-outbound", { method: "POST", headers: { Authorization: "Bearer " + token } });

Deno.test("refuses anyone without the cron secret", async () => {
  const f = fakes();
  assertEquals((await f.handle(post("wrong"))).status, 401);
  assertEquals((await f.handle(new Request("http://f", { method: "POST" }))).status, 401);
  assertEquals((await f.handle(new Request("http://f", { method: "GET", headers: { Authorization: "Bearer s3cret" } }))).status, 405);
  assertEquals(f.calls.length, 0);
});

Deno.test("claims nothing until a provider is configured", async () => {
  const f = fakes({ providerConfigured: false });
  const res = await f.handle(post());
  assertEquals(res.status, 200);
  assertEquals((await res.json()).skipped, "no_provider");
  assertEquals(f.calls.length, 0);
});

Deno.test("sends each claimed message and reports every result", async () => {
  const f = fakes({ sendResults: { "jane@nb4hs.org": { ok: false, error: "provider 500" } } });
  const res = await f.handle(post());
  assertEquals(await res.json(), { claimed: 3, sent: 1, failed: 2 });
  assertEquals(f.calls[0], ["claim_outbound_messages", { p_limit: 20 }]);
  const done = f.calls.filter((c) => c[0] === "complete_outbound_message").map((c) => c[1]);
  assertEquals(done, [
    { p_id: "m1", p_ok: true, p_provider_id: "prov-director@nb4hs.org", p_error: null },
    { p_id: "m2", p_ok: false, p_provider_id: null, p_error: "provider 500" },
    { p_id: "m3", p_ok: false, p_provider_id: null, p_error: "unknown template something_else" }
  ]);
  assertEquals(f.sent.length, 2); // the unknown template is never sent
});

Deno.test("a thrown send is a failure, not a crash", async () => {
  const f = fakes({ sendResults: { "director@nb4hs.org": { ok: false, error: "throw" } } });
  const body = await (await f.handle(post())).json();
  assertEquals(body.failed, 2);
  const m1 = f.calls.find((c) => c[0] === "complete_outbound_message" && c[1].p_id === "m1");
  assertEquals(m1[1].p_error, "network down");
});

Deno.test("a claim error stops the run", async () => {
  const f = fakes({ claimError: { message: "boom" } });
  assertEquals((await f.handle(post())).status, 500);
});

Deno.test("emails name the person and period, link into the app, and escape", () => {
  const e = renderEmail("staff_report_submitted", MESSAGES[0].payload, "https://app.example/")!;
  assertEquals(e.subject, "New NB4HS Biweekly Report — Jane <b>Pierre</b>");
  assert(e.html.includes("Jane &lt;b&gt;Pierre&lt;/b&gt;"));
  assert(!e.html.includes("<b>Pierre"));
  assert(e.html.includes('href="https://app.example/staffreports/r1"'));
  assert(e.text.includes("https://app.example/staffreports/r1"));
  assert(e.html.includes("does not contain its content"));
});

Deno.test("links never leave the app", () => {
  assertEquals(appLink("https://app.example", "/myreports/r1"), "https://app.example/myreports/r1");
  assertEquals(appLink("https://app.example", "https://evil.example/x"), "https://app.example/");
  assertEquals(appLink("https://app.example", "//evil.example"), "https://app.example/");
  assertEquals(appLink("", "/x"), "https://nb4hs-app.vercel.app/x");
  assertEquals(escapeHtml(`<a href="x">'&`), "&lt;a href=&quot;x&quot;&gt;&#39;&amp;");
});

Deno.test("revision and acknowledgement emails go to the author without the comment", () => {
  const r = renderEmail("staff_report_revision_requested", { period: "Nov 2 – Nov 15, 2026", link: "/myreports/r1", comment: "SECRET" }, "https://a")!;
  assert(!r.html.includes("SECRET") && !r.text.includes("SECRET"));
  assert(r.text.includes("https://a/myreports/r1"));
  assert(renderEmail("staff_report_acknowledged", { period: "P", link: "/myreports/r1" }, "https://a")!.subject.includes("acknowledged"));
  assertEquals(renderEmail("nope", {}, "https://a"), null);
});

Deno.test("Resend: 2xx is sent with its id; anything else is an error", async () => {
  const seen: Any[] = [];
  const okFetch = ((u: string, init: Any) => { seen.push([u, JSON.parse(init.body), init.headers]); return Promise.resolve(new Response(JSON.stringify({ id: "re_1" }), { status: 200 })); }) as Any;
  const r1 = await resendSender("key", "NB4HS <r@nb4hs.org>", okFetch)({ to: "a@b.org", subject: "S", html: "<p>h</p>", text: "t" });
  assertEquals(r1, { ok: true, id: "re_1" });
  assertEquals(seen[0][0], "https://api.resend.com/emails");
  assertEquals(seen[0][1], { from: "NB4HS <r@nb4hs.org>", to: ["a@b.org"], subject: "S", html: "<p>h</p>", text: "t" });
  assertEquals(seen[0][2].Authorization, "Bearer key");
  const badFetch = (() => Promise.resolve(new Response(JSON.stringify({ message: "domain not verified" }), { status: 403 }))) as Any;
  assertEquals(await resendSender("key", "f", badFetch)({ to: "a@b.org", subject: "S", html: "", text: "" }), { ok: false, error: "provider 403: domain not verified" });
});
