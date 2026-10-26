// Kuru bildirim uç noktası (Supabase Edge Function).
// Saatlik çalışan zamanlanmış görev (pg_cron) bu fonksiyonu çağırır; ayarlanan saatte
// her aboneliğe o günün işlerini (çıkış, halkalama, ilaç tekrarı…) Web Push ile gönderir.
// Uygulamadan "Test bildirimi" ile de çağrılabilir.
//
// Gerekli secret'lar (Edge Functions → Secrets):
//   VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY  — uygulamadaki Ayarlar → Bildirimler bölümünde üretilir
//   CRON_SECRET                         — zamanlanmış görevin kullandığı rastgele parola
//   VAPID_SUBJECT (isteğe bağlı)        — mailto:adresiniz
// Bu fonksiyonda "Enforce JWT Verification" KAPALI olmalı (zamanlanmış görev JWT göndermez);
// test çağrılarında kullanıcı oturumu fonksiyon içinde doğrulanır.
import { createClient } from 'npm:@supabase/supabase-js@2'

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-cron-secret',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...cors, 'Content-Type': 'application/json' } })

// ---------- base64url ----------
const enc = new TextEncoder()
function b64u(bytes: Uint8Array) {
  let s = ''
  for (const b of bytes) s += String.fromCharCode(b)
  return btoa(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}
function unb64u(s: string) {
  const bin = atob(s.replace(/-/g, '+').replace(/_/g, '/') + '==='.slice((s.length + 3) % 4))
  return Uint8Array.from(bin, (c) => c.charCodeAt(0))
}
function concat(...parts: Uint8Array[]) {
  const out = new Uint8Array(parts.reduce((n, p) => n + p.length, 0))
  let o = 0
  for (const p of parts) {
    out.set(p, o)
    o += p.length
  }
  return out
}

// ---------- VAPID (RFC 8292) ----------
async function vapidHeader(endpoint: string, publicKey: string, privateKey: string, subject: string) {
  const pub = unb64u(publicKey)
  const key = await crypto.subtle.importKey(
    'jwk',
    { kty: 'EC', crv: 'P-256', d: privateKey, x: b64u(pub.slice(1, 33)), y: b64u(pub.slice(33, 65)), ext: true },
    { name: 'ECDSA', namedCurve: 'P-256' },
    false,
    ['sign'],
  )
  const header = b64u(enc.encode(JSON.stringify({ typ: 'JWT', alg: 'ES256' })))
  const claims = b64u(
    enc.encode(JSON.stringify({ aud: new URL(endpoint).origin, exp: Math.floor(Date.now() / 1000) + 12 * 3600, sub: subject })),
  )
  const sig = new Uint8Array(await crypto.subtle.sign({ name: 'ECDSA', hash: 'SHA-256' }, key, enc.encode(`${header}.${claims}`)))
  return `vapid t=${header}.${claims}.${b64u(sig)}, k=${publicKey}`
}

// ---------- İçerik şifreleme (RFC 8291, aes128gcm) ----------
async function hkdf(salt: Uint8Array, ikm: Uint8Array, info: Uint8Array, length: number) {
  const key = await crypto.subtle.importKey('raw', ikm, 'HKDF', false, ['deriveBits'])
  return new Uint8Array(await crypto.subtle.deriveBits({ name: 'HKDF', hash: 'SHA-256', salt, info }, key, length * 8))
}

export async function encryptPayload(payload: string, p256dh: string, auth: string) {
  const uaPublic = unb64u(p256dh)
  const authSecret = unb64u(auth)
  const asKeys = (await crypto.subtle.generateKey({ name: 'ECDH', namedCurve: 'P-256' }, true, ['deriveBits'])) as CryptoKeyPair
  const asPublic = new Uint8Array(await crypto.subtle.exportKey('raw', asKeys.publicKey))
  const uaKey = await crypto.subtle.importKey('raw', uaPublic, { name: 'ECDH', namedCurve: 'P-256' }, false, [])
  const shared = new Uint8Array(await crypto.subtle.deriveBits({ name: 'ECDH', public: uaKey }, asKeys.privateKey, 256))

  const ikm = await hkdf(authSecret, shared, concat(enc.encode('WebPush: info\0'), uaPublic, asPublic), 32)
  const salt = crypto.getRandomValues(new Uint8Array(16))
  const cek = await hkdf(salt, ikm, enc.encode('Content-Encoding: aes128gcm\0'), 16)
  const nonce = await hkdf(salt, ikm, enc.encode('Content-Encoding: nonce\0'), 12)

  const aesKey = await crypto.subtle.importKey('raw', cek, 'AES-GCM', false, ['encrypt'])
  const plain = concat(enc.encode(payload), new Uint8Array([2])) // tek kayıt, son kayıt sınırlayıcısı
  const cipher = new Uint8Array(await crypto.subtle.encrypt({ name: 'AES-GCM', iv: nonce }, aesKey, plain))

  const rs = new Uint8Array([0, 0, 16, 0]) // 4096
  return concat(salt, rs, new Uint8Array([asPublic.length]), asPublic, cipher)
}

type Sub = { endpoint: string; keys: { p256dh: string; auth: string } }

export async function sendPush(sub: Sub, message: unknown, vapid: { publicKey: string; privateKey: string; subject: string }) {
  const body = await encryptPayload(JSON.stringify(message), sub.keys.p256dh, sub.keys.auth)
  return fetch(sub.endpoint, {
    method: 'POST',
    headers: {
      Authorization: await vapidHeader(sub.endpoint, vapid.publicKey, vapid.privateKey, vapid.subject),
      'Content-Encoding': 'aes128gcm',
      'Content-Type': 'application/octet-stream',
      TTL: '86400',
      Urgency: 'normal',
    },
    body,
  })
}

// ---------- Günün işleri (uygulamadaki Ana Sayfa mantığıyla aynı) ----------
const INCUBATION_DAYS = 18
const RING_DAY = 6
const WEAN_DAY = 28
const addDays = (d: string, n: number) => {
  const x = new Date(d + 'T12:00:00Z')
  x.setUTCDate(x.getUTCDate() + n)
  return x.toISOString().slice(0, 10)
}

// deno-lint-ignore no-explicit-any
type Rec = Record<string, any>
export function dueEvents(data: Record<string, Rec[]>, today: string) {
  const pigeons = data.pigeons || []
  const pairs = new Map((data.pairs || []).map((p) => [p.id, p]))
  const ring = (id: string) => pigeons.find((p) => p.id === id)?.ring || '?'
  const pairName = (id: string) => {
    const p = pairs.get(id)
    return p ? `${ring(p.maleId)} × ${ring(p.femaleId)}${p.nest ? ` (Yuva ${p.nest})` : ''}` : 'Çift'
  }
  const tomorrow = addDays(today, 1)
  const out: string[] = []
  for (const c of data.clutches || []) {
    if (c.closed || c.failed) continue
    // Yumurtalar bakıcıdaysa kontrol edilecek yuva bakıcınınkidir
    const name = (id: string) => (id === c.pairId && c.fosterPairId ? `${pairName(c.pairId)} → bakıcıda: ${pairName(c.fosterPairId)}` : pairName(id))
    const start = c.egg2Date || c.egg1Date
    if (!c.hatchDate && start) {
      const hatch = addDays(start, INCUBATION_DAYS)
      if (hatch === today) out.push(`🐣 Bugün çıkış bekleniyor: ${name(c.pairId)}`)
      else if (hatch === tomorrow) out.push(`🐣 Yarın çıkış bekleniyor: ${name(c.pairId)}`)
      if (addDays(start, 7) === today) out.push(`🔦 Yumurta ışık kontrolü: ${name(c.pairId)}`)
    }
    if (c.hatchDate) {
      const ringed = pigeons.filter((p) => p.clutchId === c.id).length
      if (addDays(c.hatchDate, RING_DAY) === today && ringed < (+c.hatched || 0)) out.push(`💍 Halkalama günü: ${name(c.pairId)}`)
      if (addDays(c.hatchDate, WEAN_DAY) === today) out.push(`🕊️ Yavru ayırma: ${name(c.pairId)}`)
    }
  }
  for (const h of data.health || []) {
    if (h.nextDate === today) out.push(`💊 ${h.medicine || h.diagnosis || 'Uygulama'} tekrarı bugün`)
  }
  const moves = data.stockMoves || []
  const low = (data.stock || []).filter((s) => {
    if (s.minQty === '' || s.minQty == null) return false
    const qty = moves.filter((m) => m.itemId === s.id).reduce((t, m) => t + (+m.qty || 0), 0)
    return qty <= +s.minQty
  })
  if (low.length) out.push(`📦 Stok azaldı: ${low.map((s) => s.name).join(', ')}`)
  return out
}

function localNow(tz: string) {
  const parts = Object.fromEntries(
    new Intl.DateTimeFormat('en-CA', { timeZone: tz, year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', hourCycle: 'h23' })
      .formatToParts(new Date())
      .map((p) => [p.type, p.value]),
  )
  return { date: `${parts.year}-${parts.month}-${parts.day}`, hour: +parts.hour }
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors })
  if (req.method !== 'POST') return json({ error: 'Yalnızca POST' }, 405)

  const vapid = {
    publicKey: Deno.env.get('VAPID_PUBLIC_KEY') || '',
    privateKey: Deno.env.get('VAPID_PRIVATE_KEY') || '',
    subject: Deno.env.get('VAPID_SUBJECT') || 'mailto:kuru@example.com',
  }
  if (!vapid.publicKey || !vapid.privateKey) return json({ error: 'Sunucuda VAPID anahtarları tanımlı değil.' }, 500)

  const admin = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!)
  const isCron = !!Deno.env.get('CRON_SECRET') && req.headers.get('x-cron-secret') === Deno.env.get('CRON_SECRET')

  let ownerFilter: string | null = null
  let test = false
  if (!isCron) {
    // Uygulamadan test çağrısı: yalnızca kendi aboneliklerine gönder
    const token = (req.headers.get('Authorization') || '').replace(/^Bearer\s+/i, '')
    const { data } = await admin.auth.getUser(token)
    if (!data?.user) return json({ error: 'Yetkisiz' }, 401)
    ownerFilter = data.user.id
    test = true
  }

  let q = admin.from('kuru_push_subs').select('*')
  if (ownerFilter) q = q.eq('user_id', ownerFilter)
  const { data: subs, error } = await q
  if (error) return json({ error: error.message }, 500)

  const cache = new Map<string, Record<string, Rec[]>>()
  async function loftData(ownerId: string) {
    if (!cache.has(ownerId)) {
      const { data: rows } = await admin.from('kuru_records').select('collection, data').eq('owner_id', ownerId).eq('deleted', false)
      const grouped: Record<string, Rec[]> = {}
      for (const r of rows || []) (grouped[r.collection] ||= []).push(r.data)
      cache.set(ownerId, grouped)
    }
    return cache.get(ownerId)!
  }

  let sent = 0
  const gone: string[] = []
  for (const s of subs || []) {
    const now = localNow(s.tz || 'Europe/Istanbul')
    let message
    if (test) {
      const events = dueEvents(await loftData(s.owner_id), now.date)
      message = { title: 'Kuru — Test bildirimi', body: events.length ? events.slice(0, 4).join('\n') : 'Bildirimler çalışıyor. Bugün için planlı iş yok.', url: '/#/ana' }
    } else {
      if (now.hour !== (s.hour ?? 8) || s.last_sent === now.date) continue
      const events = dueEvents(await loftData(s.owner_id), now.date)
      await admin.from('kuru_push_subs').update({ last_sent: now.date }).eq('endpoint', s.endpoint)
      if (!events.length) continue
      message = {
        title: `Kuru — Bugün ${events.length} iş var`,
        body: events.slice(0, 4).join('\n') + (events.length > 4 ? `\n+${events.length - 4} iş daha` : ''),
        url: '/#/ana',
      }
    }
    try {
      const res = await sendPush(s.sub, message, vapid)
      if (res.status === 404 || res.status === 410) gone.push(s.endpoint)
      else if (res.ok) sent++
      else console.warn('Push hatası', res.status, await res.text())
    } catch (e) {
      console.warn('Push gönderilemedi', e)
    }
  }
  if (gone.length) await admin.from('kuru_push_subs').delete().in('endpoint', gone)
  return json({ sent, removed: gone.length })
})
