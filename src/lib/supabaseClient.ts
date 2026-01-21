// src/lib/supabaseClient.ts
import { createClient as createSupabaseClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

// ✅ create a reusable singleton client
const supabase = createSupabaseClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// ✅ default export (so `import supabase from ...` works)
export default supabase;

// ✅ named export for new code (so `createClient()` also works)
export function createClient() {
  return createSupabaseClient(SUPABASE_URL, SUPABASE_ANON_KEY);
}
