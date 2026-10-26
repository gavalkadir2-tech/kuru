// Yardımcı hesapları: sahibin eklediği e-postalar
import { useSyncState } from './store'
import { supabase } from './supabase'

const ROLE_CACHE = 'kuru:role:'

// Giriş yapan kullanıcı başka bir güvercinliğin yardımcısı mı? Çevrimdışıyken son bilinen sonucu kullanır.
export async function resolveLoft(user) {
  const cacheKey = ROLE_CACHE + user.id
  try {
    const { data, error } = await supabase
      .from('kuru_members')
      .select('owner_id')
      .eq('member_email', (user.email || '').toLowerCase())
      .neq('owner_id', user.id)
      .limit(1)
    if (error) throw error
    const res = data?.[0] ? { ownerId: data[0].owner_id, role: 'yardimci' } : { ownerId: user.id, role: 'sahip' }
    localStorage.setItem(cacheKey, JSON.stringify(res))
    return res
  } catch {
    try {
      const cached = JSON.parse(localStorage.getItem(cacheKey))
      if (cached) return cached
    } catch {}
    return { ownerId: user.id, role: 'sahip' }
  }
}

export async function listMembers() {
  const { data: s } = await supabase.auth.getSession()
  const { data, error } = await supabase.from('kuru_members').select('*').eq('owner_id', s.session.user.id).order('created_at')
  if (error) throw error
  return data
}

export async function addMember(email) {
  const e = email.trim().toLowerCase()
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(e)) throw new Error('Geçerli bir e-posta yazın.')
  const { error } = await supabase.from('kuru_members').insert({ member_email: e })
  if (error) throw new Error(error.code === '23505' ? 'Bu e-posta zaten ekli.' : error.message)
}

export async function removeMember(email) {
  const { error } = await supabase.from('kuru_members').delete().eq('member_email', email)
  if (error) throw error
}

export function useIsHelper() {
  return useSyncState().role === 'yardimci'
}
