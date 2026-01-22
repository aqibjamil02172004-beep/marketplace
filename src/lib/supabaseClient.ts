// src/lib/supabaseClient.ts
import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,

    // ✅ Safer for email/password flows. Turn on only if you use OAuth/magic-link callbacks.
    detectSessionInUrl: false,

    // ✅ Forces deterministic storage in production.
    storage: typeof window !== "undefined" ? window.localStorage : undefined,
  },
});

export default supabase;
