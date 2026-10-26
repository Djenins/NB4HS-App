// send-outbound Edge Function entry point. The logic lives in handler.ts.
// Secrets to set before it sends anything (supabase secrets set ...):
//   CRON_SECRET     shared with the Vault secret send_outbound_secret
//   RESEND_API_KEY  the provider key (sending domain verified in Resend)
//   EMAIL_FROM      e.g. "NB4HS Reports <reports@nb4hs.org>"
//   APP_URL         optional; defaults to https://nb4hs-app.vercel.app
// Deploy with --no-verify-jwt: pg_cron authenticates with CRON_SECRET, not a
// user session.
import { createClient } from "npm:@supabase/supabase-js@2.49.1";
import { createHandler, resendSender } from "./handler.ts";

const url = Deno.env.get("SUPABASE_URL")!;
const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const apiKey = Deno.env.get("RESEND_API_KEY") || "";
const from = Deno.env.get("EMAIL_FROM") || "";

Deno.serve(createHandler({
  admin: createClient(url, serviceKey, { auth: { persistSession: false, autoRefreshToken: false } }),
  send: resendSender(apiKey, from),
  cronSecret: Deno.env.get("CRON_SECRET") || undefined,
  appUrl: Deno.env.get("APP_URL") || "https://nb4hs-app.vercel.app",
  providerConfigured: !!apiKey && !!from
}));
