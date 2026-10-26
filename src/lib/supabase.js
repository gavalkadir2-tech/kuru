import { createClient } from '@supabase/supabase-js'

const url = import.meta.env.VITE_SUPABASE_URL
const key = import.meta.env.VITE_SUPABASE_ANON_KEY

// Supabase ayarlı değilse uygulama yalnızca yerel modda çalışır.
export const supabase = url && key ? createClient(url, key, { auth: { persistSession: true } }) : null
export const cloudEnabled = !!supabase
