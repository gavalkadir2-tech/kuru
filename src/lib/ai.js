// Yapay zeka çağrıları Supabase Edge Function (kuru-ai) üzerinden yapılır;
// API anahtarı tarayıcıya hiç gelmez. Bağlantı yoksa yerel motora düşülür.
import { supabase } from './supabase'

export async function askAI(task, payload) {
  if (!supabase) throw new Error('Bulut bağlantısı ayarlı değil (yerel mod).')
  if (!navigator.onLine) throw new Error('İnternet bağlantısı yok.')
  const { data: sess } = await supabase.auth.getSession()
  if (!sess?.session) throw new Error('Yapay zeka için giriş yapmalısınız.')
  const { data, error } = await supabase.functions.invoke('kuru-ai', { body: { task, ...payload } })
  if (error) {
    let msg = error.message
    try {
      const body = await error.context?.json?.()
      if (body?.error) msg = body.error
    } catch {}
    throw new Error(msg)
  }
  if (data?.error) throw new Error(data.error)
  return data.text
}
