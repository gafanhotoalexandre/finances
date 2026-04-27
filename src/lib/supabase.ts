import { createClient } from "@supabase/supabase-js"

const fallbackSupabaseUrl = "https://your-project-ref.supabase.co"
const fallbackSupabaseAnonKey = "your-publishable-anon-key"

const supabaseUrl =
  import.meta.env.VITE_SUPABASE_URL?.trim() || fallbackSupabaseUrl
const supabaseAnonKey =
  import.meta.env.VITE_SUPABASE_ANON_KEY?.trim() || fallbackSupabaseAnonKey

export const hasSupabaseEnv = Boolean(
  import.meta.env.VITE_SUPABASE_URL?.trim() &&
    import.meta.env.VITE_SUPABASE_ANON_KEY?.trim()
)

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    autoRefreshToken: true,
    persistSession: true,
  },
})