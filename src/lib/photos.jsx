// Fotoğraf deposu.
// Fotoğraflar cihazda IndexedDB'de tutulur (localStorage'ın ~5 MB sınırına takılmaz).
// Bulut açıksa Supabase Storage'daki `kuru-photos` kovasına yüklenir ve diğer cihazlar
// ihtiyaç duyduğunda oradan indirir. Kayıtlarda yalnızca fotoğraf kimliği saklanır.
import { useEffect, useState } from 'react'
import { supabase } from './supabase'
import { cloudOwnerId, uid } from './store'

const DB_NAME = 'kuru-photos'
const STORE = 'photos'
const BUCKET = 'kuru-photos'

let dbPromise
function db() {
  if (!dbPromise) {
    dbPromise = new Promise((resolve, reject) => {
      const req = indexedDB.open(DB_NAME, 1)
      req.onupgradeneeded = () => req.result.createObjectStore(STORE, { keyPath: 'id' })
      req.onsuccess = () => resolve(req.result)
      req.onerror = () => reject(req.error)
    })
  }
  return dbPromise
}

async function tx(mode, fn) {
  const d = await db()
  return new Promise((resolve, reject) => {
    const t = d.transaction(STORE, mode)
    const req = fn(t.objectStore(STORE))
    t.oncomplete = () => resolve(req?.result)
    t.onerror = () => reject(t.error)
  })
}

const idbGet = (id) => tx('readonly', (s) => s.get(id))
const idbPut = (row) => tx('readwrite', (s) => s.put(row))
const idbDel = (id) => tx('readwrite', (s) => s.delete(id))
const idbAll = () => tx('readonly', (s) => s.getAll())

const memory = new Map() // id -> dataUrl (oturum içi önbellek)
const pathOf = (owner, id) => `${owner}/${id}.jpg`

export const PHOTO_LABELS = ['Genel', 'Göz', 'Kanat', 'Tüy', 'Ayak / Halka', 'Diğer']

// Yeni fotoğrafı kaydeder, kimliğini döndürür
export async function putPhoto(dataUrl) {
  const id = uid()
  await idbPut({ id, dataUrl, uploaded: false })
  memory.set(id, dataUrl)
  uploadPendingPhotos()
  return id
}

export async function deletePhoto(id) {
  memory.delete(id)
  try {
    await idbDel(id)
  } catch {}
  const owner = cloudOwnerId()
  if (supabase && owner && navigator.onLine) {
    supabase.storage.from(BUCKET).remove([pathOf(owner, id)]).catch(() => {})
  }
}

async function dataUrlToBlob(dataUrl) {
  return (await fetch(dataUrl)).blob()
}
function blobToDataUrl(blob) {
  return new Promise((resolve, reject) => {
    const r = new FileReader()
    r.onload = () => resolve(r.result)
    r.onerror = () => reject(r.error)
    r.readAsDataURL(blob)
  })
}

export async function getPhoto(id) {
  if (!id) return null
  if (memory.has(id)) return memory.get(id)
  const row = await idbGet(id).catch(() => null)
  if (row) {
    memory.set(id, row.dataUrl)
    return row.dataUrl
  }
  // Bu cihazda yok: buluttan indir ve önbelleğe al
  const owner = cloudOwnerId()
  if (!supabase || !owner || !navigator.onLine) return null
  const { data, error } = await supabase.storage.from(BUCKET).download(pathOf(owner, id))
  if (error || !data) return null
  const dataUrl = await blobToDataUrl(data)
  memory.set(id, dataUrl)
  idbPut({ id, dataUrl, uploaded: true }).catch(() => {})
  return dataUrl
}

let uploading = false
export async function uploadPendingPhotos() {
  const owner = cloudOwnerId()
  if (!supabase || !owner || !navigator.onLine || uploading) return
  uploading = true
  try {
    const rows = (await idbAll()).filter((r) => !r.uploaded)
    for (const r of rows) {
      const { error } = await supabase.storage
        .from(BUCKET)
        .upload(pathOf(owner, r.id), await dataUrlToBlob(r.dataUrl), { contentType: 'image/jpeg', upsert: true })
      if (error) {
        console.warn('Fotoğraf yüklenemedi', error.message)
        break
      }
      await idbPut({ ...r, uploaded: true })
    }
  } catch (e) {
    console.warn(e)
  } finally {
    uploading = false
  }
}

export function usePhoto(id) {
  const [url, setUrl] = useState(() => (id ? memory.get(id) || null : null))
  useEffect(() => {
    let alive = true
    if (!id) return setUrl(null)
    getPhoto(id).then((u) => alive && setUrl(u))
    return () => {
      alive = false
    }
  }, [id])
  return url
}

export function PhotoImg({ id, alt = '', className, fallback = null, ...rest }) {
  const url = usePhoto(id)
  if (!url) return fallback
  return <img src={url} alt={alt} className={className} {...rest} />
}

// Eski sürümde kayıt içinde tutulan `photo` (dataURL) alanını yeni yapıya taşır
let migrated = false
export async function migrateLegacyPhotos(list, save) {
  if (migrated) return
  migrated = true
  for (const p of list('pigeons')) {
    if (p.photo && p.photo.startsWith('data:')) {
      try {
        const id = await putPhoto(p.photo)
        save('pigeons', { ...p, photo: '', photos: [{ id, label: 'Genel' }, ...(p.photos || [])] })
      } catch (e) {
        console.warn('Fotoğraf taşınamadı', e)
      }
    }
  }
}
