// email-mileage-sheet Edge Function entry point. The logic and its rules live
// in handler.ts. It sends with the same secrets as send-outbound:
//   RESEND_API_KEY  the provider key (sending domain verified in Resend)
//   EMAIL_FROM      e.g. "NB4HS <mileage@nb4hs.org>"
// Until both are set it answers "email_not_configured" and sends nothing.
// Deploy with JWT verification on (the default): only signed-in staff call it.
import { createClient } from "npm:@supabase/supabase-js@2.118.0";
import { createHandler, resendSender } from "./handler.ts";

const url = Deno.env.get("SUPABASE_URL")!;
const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const apiKey = Deno.env.get("RESEND_API_KEY") || "";
const from = Deno.env.get("EMAIL_FROM") || "";
const noSession = { auth: { persistSession: false, autoRefreshToken: false } };

Deno.serve(createHandler({
  callerFor: (authHeader) => createClient(url, anonKey, { ...noSession, global: { headers: { Authorization: authHeader } } }),
  admin: createClient(url, serviceKey, noSession),
  send: resendSender(apiKey, from),
  providerConfigured: !!apiKey && !!from
}));
