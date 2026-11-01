// send-outbound Edge Function entry point. The logic lives in handler.ts.
// Secrets to set before it sends anything (supabase secrets set ...):
//   CRON_SECRET     shared with the Vault secret send_outbound_secret
//   RESEND_API_KEY  the provider key (sending domain verified in Resend)
//   EMAIL_FROM      e.g. "NB4HS Reports <reports@nb4hs.org>"
//   APP_URL         optional; defaults to https://app.nb4hs.org
// For text messages to clients (optional; texts wait in the queue until set):
//   TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN
//   TWILIO_FROM     a Twilio number (+1401...) or Messaging Service SID (MG...)
// Deploy with --no-verify-jwt: pg_cron authenticates with CRON_SECRET, not a
// user session.
import { createClient } from "npm:@supabase/supabase-js@2.118.0";
import { createHandler, resendSender, twilioSender } from "./handler.ts";

const url = Deno.env.get("SUPABASE_URL")!;
const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const apiKey = Deno.env.get("RESEND_API_KEY") || "";
const from = Deno.env.get("EMAIL_FROM") || "";
const twilioSid = Deno.env.get("TWILIO_ACCOUNT_SID") || "";
const twilioToken = Deno.env.get("TWILIO_AUTH_TOKEN") || "";
const twilioFrom = Deno.env.get("TWILIO_FROM") || "";

Deno.serve(createHandler({
  admin: createClient(url, serviceKey, { auth: { persistSession: false, autoRefreshToken: false } }),
  send: resendSender(apiKey, from),
  sendSms: twilioSender(twilioSid, twilioToken, twilioFrom),
  cronSecret: Deno.env.get("CRON_SECRET") || undefined,
  appUrl: Deno.env.get("APP_URL") || "https://app.nb4hs.org",
  providerConfigured: !!apiKey && !!from,
  smsConfigured: !!twilioSid && !!twilioToken && !!twilioFrom
}));
