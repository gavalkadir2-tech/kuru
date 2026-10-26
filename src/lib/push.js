// Web Push abonelik yönetimi
import { cloudOwnerId } from './store'
import { supabase } from './supabase'

const VAPID_PUBLIC = import.meta.env.VITE_VAPID_PUBLIC_KEY

export const pushConfigured = !!(supabase && VAPID_PUBLIC)

export function pushSupported() {
  return 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window
}

// iPhone'da bildirim yalnızca ana ekrana eklenmiş uygulamada çalışır
export function needsInstallForPush() {
  const ios = /iphone|ipad|ipod/i.test(navigator.userAgent)
  const standalone = window.matchMedia('(display-mode: standalone)').matches || navigator.standalone
  return ios && !standalone
}

function b64uToBytes(s) {
  const bin = atob(s.replace(/-/g, '+').replace(/_/g, '/') + '==='.slice((s.length + 3) % 4))
  return Uint8Array.from(bin, (c) => c.charCodeAt(0))
}
function bytesToB64u(bytes) {
  let s = ''
  for (const b of new Uint8Array(bytes)) s += String.fromCharCode(b)
  return btoa(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}

export async function currentSubscription() {
  if (!pushSupported()) return null
  const reg = await navigator.serviceWorker.getRegistration()
  return reg ? reg.pushManager.getSubscription() : null
}

export async function enablePush(hour) {
  if (!pushConfigured) throw new Error('Bildirim anahtarı (VITE_VAPID_PUBLIC_KEY) ayarlı değil.')
  if (!pushSupported()) throw new Error('Bu tarayıcı bildirimleri desteklemiyor.')
  if (needsInstallForPush()) throw new Error('iPhone’da bildirim için önce Safari → Paylaş → Ana Ekrana Ekle ile uygulamayı kurun ve oradan açın.')
  const perm = await Notification.requestPermission()
  if (perm !== 'granted') throw new Error('Bildirim izni verilmedi. Tarayıcı ayarlarından izin verebilirsiniz.')
  const reg = await navigator.serviceWorker.ready
  let sub = await reg.pushManager.getSubscription()
  if (!sub) sub = await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: b64uToBytes(VAPID_PUBLIC) })
  const { data: s } = await supabase.auth.getSession()
  if (!s?.session) throw new Error('Bildirimler için giriş yapmalısınız.')
  const { error } = await supabase.from('kuru_push_subs').upsert(
    {
      endpoint: sub.endpoint,
      user_id: s.session.user.id,
      owner_id: cloudOwnerId() || s.session.user.id,
      sub: sub.toJSON(),
      hour,
      tz: Intl.DateTimeFormat().resolvedOptions().timeZone || 'Europe/Istanbul',
    },
    { onConflict: 'endpoint' },
  )
  if (error) throw error
  return sub
}

export async function disablePush() {
  const sub = await currentSubscription()
  if (!sub) return
  await supabase?.from('kuru_push_subs').delete().eq('endpoint', sub.endpoint)
  await sub.unsubscribe()
}

export async function sendTestPush() {
  const { data, error } = await supabase.functions.invoke('kuru-notify', { body: { test: true } })
  if (error) {
    let msg = error.message
    try {
      msg = (await error.context?.json?.())?.error || msg
    } catch {}
    throw new Error(msg)
  }
  return data
}

// Kurulum yardımcısı: VAPID anahtar çifti üretir (tarayıcıda, hiçbir yere gönderilmez)
export async function generateVapidKeys() {
  const kp = await crypto.subtle.generateKey({ name: 'ECDSA', namedCurve: 'P-256' }, true, ['sign'])
  const pub = await crypto.subtle.exportKey('raw', kp.publicKey)
  const jwk = await crypto.subtle.exportKey('jwk', kp.privateKey)
  return { publicKey: bytesToB64u(pub), privateKey: jwk.d }
}
