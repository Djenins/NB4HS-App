// admin-users Edge Function entry point. The logic and its rules live in
// handler.ts; this file only wires up the two Supabase clients from the
// variables every Edge Function gets (no secrets to configure).
import { createClient } from "npm:@supabase/supabase-js@2.118.0";
import { createHandler } from "./handler.ts";

const url = Deno.env.get("SUPABASE_URL")!;
const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const noSession = { auth: { persistSession: false, autoRefreshToken: false } };

Deno.serve(createHandler({
  callerFor: (authHeader) => createClient(url, anonKey, { ...noSession, global: { headers: { Authorization: authHeader } } }),
  admin: createClient(url, serviceKey, noSession),
  siteUrl: Deno.env.get("SITE_URL") || undefined
}));
