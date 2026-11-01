import { createClient } from "@supabase/supabase-js";
import { kioskDeviceKey } from "./kioskDevice.js";

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL?.trim();
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY?.trim();

export const isSupabaseConfigured = Boolean(supabaseUrl && supabaseAnonKey);

// Keeping this nullable lets the existing local demo continue to run until
// project credentials have been added to .env.local.
// A paired front-desk tablet sends its device key on every request (see
// kioskDevice.js); pairing and unpairing reload the page to pick it up.
const deviceKey = kioskDeviceKey();
export const supabase = isSupabaseConfigured
  ? createClient(supabaseUrl, supabaseAnonKey, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: true
      },
      global: { headers: deviceKey ? { "x-kiosk-key": deviceKey } : {} }
    })
  : null;

