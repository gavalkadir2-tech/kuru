// Çevrimdışı-öncelikli veri deposu.
// Tüm kayıtlar önce localStorage'a yazılır; Supabase ayarlıysa ve oturum açıksa
// arka planda `kuru_records` tablosuyla senkronize edilir (son yazan kazanır).
import { useEffect, useSyncExternalStore } from 'react'
import { supabase } from './supabase'
import { uploadPendingPhotos } from './photos'

export const COLLECTIONS = [
  'pigeons',
  'pairs',
  'clutches',
  'health',
  'feedings',
  'rations',
  'notes',
  'stock',
  'stockMoves',
  'ledger',
  'people',
  'accounts',
  'flights',
  'weights',
  'config',
]

const DATA_KEY = 'kuru:data:v1'
const DIRTY_KEY = 'kuru:dirty:v1'
const PULL_KEY = 'kuru:lastPull:v1'
const SETTINGS_KEY = 'kuru:settings:v1'

function readJSON(key, fallback) {
  try {
    const v = localStorage.getItem(key)
    return v ? JSON.parse(v) : fallback
  } catch {
    return fallback
  }
}
function writeJSON(key, value) {
  try {
    localStorage.setItem(key, JSON.stringify(value))
    return true
  } catch (e) {
    console.error('Depolama hatası', e)
    alert('Cihaz depolama alanı dolu olabilir. Fotoğrafları azaltmayı veya yedek alıp eski kayıtları silmeyi deneyin.')
    return false
  }
}

let data = readJSON(DATA_KEY, {})
for (const c of COLLECTIONS) data[c] ||= {}
let dirty = new Set(readJSON(DIRTY_KEY, []))
let version = 0
const listeners = new Set()

function emit() {
  version++
  cache.clear()
  listeners.forEach((l) => l())
}
function persist() {
  writeJSON(DATA_KEY, data)
  writeJSON(DIRTY_KEY, [...dirty])
}

export function uid() {
  if (crypto.randomUUID) return crypto.randomUUID()
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0
    return (c === 'x' ? r : (r & 0x3) | 0x8).toString(16)
  })
}

export function subscribe(fn) {
  listeners.add(fn)
  return () => listeners.delete(fn)
}

const cache = new Map()
export function list(collection) {
  if (!cache.has(collection)) {
    cache.set(
      collection,
      Object.values(data[collection] || {})
        .filter((r) => !r.deleted)
        .sort((a, b) => (b.created_at || '').localeCompare(a.created_at || '')),
    )
  }
  return cache.get(collection)
}

export function get(collection, id) {
  const r = data[collection]?.[id]
  return r && !r.deleted ? r : null
}

export function save(collection, record) {
  const now = new Date().toISOString()
  const existing = record.id ? data[collection][record.id] : null
  const rec = {
    ...existing,
    ...record,
    id: record.id || uid(),
    created_at: existing?.created_at || record.created_at || now,
    updated_at: now,
    deleted: false,
  }
  data[collection][rec.id] = rec
  dirty.add(`${collection}:${rec.id}`)
  persist()
  emit()
  scheduleSync()
  return rec
}

export function remove(collection, id) {
  const existing = data[collection][id]
  if (!existing) return
  data[collection][id] = { ...existing, deleted: true, updated_at: new Date().toISOString() }
  dirty.add(`${collection}:${id}`)
  persist()
  emit()
  scheduleSync()
}

export function useCollection(collection) {
  useSyncExternalStore(subscribe, () => version)
  return list(collection)
}

export function useRecord(collection, id) {
  useSyncExternalStore(subscribe, () => version)
  return id ? get(collection, id) : null
}

// ---------- Yapılandırma (tüm cihazlarda eşitlenir) ----------
// `config` koleksiyonunda tek kayıt tutulur; iki cihaz aynı anda ilk kaydı oluşturursa
// en son güncellenen geçerli sayılır ve sonraki yazımlar ona yapılır.
export function getConfigRecord() {
  return list('config').reduce((best, r) => (!best || (r.updated_at || '') > (best.updated_at || '') ? r : best), null)
}
export function getConfig() {
  return getConfigRecord() || {}
}
export function saveConfig(patch) {
  const rec = getConfigRecord()
  return save('config', { ...(rec || {}), ...patch })
}

// ---------- Ayarlar ----------
// Güvercinlik bilgileri eşitlenen yapılandırmada, diğerleri (tema, bildirim saati…) yalnızca bu cihazda tutulur.
const LOFT_KEYS = ['loftName', 'owner', 'ringPrefix']
const defaultSettings = { loftName: 'Samet Kuru Güvercinliği', owner: 'Samet Kuru', ringPrefix: 'TR' }
let settings = { ...defaultSettings, ...readJSON(SETTINGS_KEY, {}) }
export function getSettings() {
  const loft = getConfig().loft || {}
  return { ...settings, ...Object.fromEntries(LOFT_KEYS.filter((k) => loft[k] != null).map((k) => [k, loft[k]])) }
}
export function saveSettings(s) {
  const loftPatch = Object.fromEntries(Object.entries(s).filter(([k]) => LOFT_KEYS.includes(k)))
  const local = Object.fromEntries(Object.entries(s).filter(([k]) => !LOFT_KEYS.includes(k)))
  settings = { ...settings, ...local }
  writeJSON(SETTINGS_KEY, settings)
  if (Object.keys(loftPatch).length) saveConfig({ loft: { ...(getConfig().loft || {}), ...loftPatch } })
  else emit()
}
export function useSettings() {
  useSyncExternalStore(subscribe, () => version)
  return getSettings()
}

// ---------- Yedekleme ----------
export function exportBackup() {
  return { app: 'kuru', version: 1, exported_at: new Date().toISOString(), settings: getSettings(), data }
}
export function importBackup(json) {
  if (!json || json.app !== 'kuru' || !json.data) throw new Error('Geçersiz yedek dosyası')
  for (const c of COLLECTIONS) {
    const incoming = json.data[c] || {}
    data[c] ||= {}
    for (const [id, rec] of Object.entries(incoming)) {
      const cur = data[c][id]
      if (!cur || (rec.updated_at || '') >= (cur.updated_at || '')) {
        data[c][id] = rec
        dirty.add(`${c}:${id}`)
      }
    }
  }
  if (json.settings) settings = { ...settings, ...json.settings }
  writeJSON(SETTINGS_KEY, settings)
  persist()
  emit()
  scheduleSync()
}

// ---------- Bulut senkronu ----------
const syncState = { status: 'idle', lastSync: null, error: null, user: null, ownerId: null, role: 'sahip' }
const syncListeners = new Set()
function setSync(patch) {
  Object.assign(syncState, patch)
  syncSnapshot = { ...syncState }
  syncListeners.forEach((l) => l())
}
let syncSnapshot = { ...syncState }
export function useSyncState() {
  return useSyncExternalStore(
    (fn) => {
      syncListeners.add(fn)
      return () => syncListeners.delete(fn)
    },
    () => syncSnapshot,
  )
}

// role: 'sahip' (kendi güvercinliği) veya 'yardimci' (başkasının güvercinliğinde yardımcı)
export function setSyncUser(user, ownerId, role = 'sahip') {
  setSync({ user, ownerId: user ? ownerId || user.id : null, role: user ? role : 'sahip' })
  if (user) syncNow()
}

export function isHelper() {
  return syncState.role === 'yardimci'
}

// Güvercinlik başına ayrı senkron sınırı (aynı cihazda farklı hesapla giriş yapılabilir)
const pullKey = () => `${PULL_KEY}:${syncState.ownerId}`

const isRlsError = (e) => e?.code === '42501' || /row-level security/i.test(e?.message || '')

// Sunucunun reddettiği (ör. yardımcının silme denemesi) kayıtları sunucudaki haline döndürür
async function revertRejected(rows) {
  const ids = rows.map((r) => r.id)
  const { data: server } = await supabase.from('kuru_records').select('id, collection, data, deleted').in('id', ids)
  const byId = new Map((server || []).map((r) => [r.id, r]))
  for (const r of rows) {
    const srv = byId.get(r.id)
    if (srv) data[r.collection][r.id] = { ...srv.data, deleted: srv.deleted }
    else delete data[r.collection][r.id]
    dirty.delete(`${r.collection}:${r.id}`)
  }
}

// Bulutta kayıtların ait olduğu güvercinlik sahibinin kimliği
export function cloudOwnerId() {
  return syncState.ownerId
}

let syncTimer = null
function scheduleSync() {
  if (!supabase || !syncState.user) return
  clearTimeout(syncTimer)
  syncTimer = setTimeout(syncNow, 1500)
}

let syncing = false
export async function syncNow() {
  if (!supabase || !syncState.user || syncing) return
  if (!navigator.onLine) {
    setSync({ status: 'offline' })
    return
  }
  syncing = true
  setSync({ status: 'syncing', error: null })
  try {
    await uploadPendingPhotos()
    // 1) Yerel değişiklikleri gönder
    const keys = [...dirty]
    if (keys.length) {
      const rows = keys
        .map((k) => {
          const [collection, id] = k.split(':')
          const rec = data[collection]?.[id]
          if (!rec) return null
          return {
            id,
            owner_id: syncState.ownerId,
            collection,
            data: rec,
            updated_at: rec.updated_at,
            deleted: !!rec.deleted,
          }
        })
        .filter(Boolean)
      const rejected = []
      for (let i = 0; i < rows.length; i += 200) {
        const chunk = rows.slice(i, i + 200)
        const { error } = await supabase.from('kuru_records').upsert(chunk)
        if (!error) continue
        if (!isRlsError(error)) throw error
        // Yetki hatası: satırları tek tek dene, reddedilenleri ayıkla
        for (const row of chunk) {
          const { error: e1 } = await supabase.from('kuru_records').upsert(row)
          if (e1) {
            if (!isRlsError(e1)) throw e1
            rejected.push(row)
          }
        }
      }
      keys.forEach((k) => dirty.delete(k))
      if (rejected.length) {
        await revertRejected(rejected)
        emit()
        setSync({ error: `${rejected.length} değişiklik yetki olmadığı için geri alındı.` })
      }
      persist()
    }

    // 2) Sunucudaki yenilikleri çek
    const since = readJSON(pullKey(), null)
    let changed = false
    let maxSeen = since
    let from = 0
    for (;;) {
      let q = supabase
        .from('kuru_records')
        .select('id, collection, data, updated_at, deleted, server_updated_at')
        .eq('owner_id', syncState.ownerId)
        .order('server_updated_at', { ascending: true })
        .range(from, from + 999)
      // gte: aynı anda yazılmış satırları kaçırmamak için sınırı dahil et (tekrar gelen satır zararsızdır)
      if (since) q = q.gte('server_updated_at', since)
      const { data: rows, error } = await q
      if (error) throw error
      for (const row of rows) {
        if (!COLLECTIONS.includes(row.collection)) continue
        const cur = data[row.collection][row.id]
        if (!cur || (row.updated_at || '') > (cur.updated_at || '')) {
          data[row.collection][row.id] = { ...row.data, deleted: row.deleted }
          changed = true
        }
        if (!maxSeen || row.server_updated_at > maxSeen) maxSeen = row.server_updated_at
      }
      if (rows.length < 1000) break
      from += 1000
    }
    if (changed) {
      persist()
      emit()
    }
    writeJSON(pullKey(), maxSeen)
    setSync({ status: 'ok', lastSync: new Date().toISOString() })
  } catch (e) {
    console.error(e)
    setSync({ status: 'error', error: e.message || String(e) })
  } finally {
    syncing = false
  }
}

export function useAutoSync() {
  useEffect(() => {
    if (!supabase) return
    const onOnline = () => syncNow()
    window.addEventListener('online', onOnline)
    const t = setInterval(syncNow, 60_000)
    return () => {
      window.removeEventListener('online', onOnline)
      clearInterval(t)
    }
  }, [])
}

export function pendingCount() {
  return dirty.size
}

export function clearLocalCloudMarkers() {
  try {
    localStorage.removeItem(PULL_KEY)
  } catch {}
}

