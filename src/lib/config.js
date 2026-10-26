// Kullanıcının düzenleyebildiği listeler ve üretim süreleri (tüm cihazlarda eşitlenir)
import { BREEDS, COLORS, MEDICINES } from './constants'
import { getConfig, saveConfig, subscribe } from './store'
import { useSyncExternalStore } from 'react'

export const LIST_DEFS = {
  breeds: { label: 'Irklar', hint: 'Kuş kaydında ve filtrelerde', defaults: BREEDS },
  colors: { label: 'Renkler / desenler', hint: 'Kuş kaydında, eşleştirme ve filtrelerde', defaults: COLORS },
  eyeColors: { label: 'Göz renkleri', hint: 'Kuş kaydında', defaults: ['İnci (beyaz)', 'Turuncu / kırmızı', 'Sarı', 'Mermer / yılan', 'Koyu (boncuk)', 'Çift renkli'] },
  groups: { label: 'Kuş grupları / kategoriler', hint: 'Kuşları sınıflandırmak için (damızlık, uçucu…)', defaults: ['Damızlık', 'Uçucu', 'Yavru', 'Bakıcı', 'Satılık', 'Gösteri'] },
  lofts: { label: 'Kümes bölmeleri / kafesler', hint: 'Kuş kaydında kafes alanı', defaults: [] },
  pairTypes: { label: 'Eşleştirme türleri', hint: 'Çift kaydında', defaults: ['Üretim', 'Bakıcı', 'Deneme', 'Hat yetiştirme', 'Renk çalışması'] },
  medicines: { label: 'İlaç / aşı listesi', hint: 'Sağlık kaydında öneri olarak', defaults: MEDICINES.map((m) => m.name) },
  incomeCats: { label: 'Gelir kategorileri', hint: 'Gelir-gider defterinde', defaults: ['Kuş satışı', 'Yarış / Yarışma ödülü', 'Gübre satışı', 'Diğer gelir'] },
  expenseCats: {
    label: 'Gider kategorileri',
    hint: 'Gelir-gider defterinde',
    defaults: ['Yem', 'İlaç / Aşı', 'Vitamin / Takviye', 'Veteriner / Sağlık', 'Kuş alımı', 'Malzeme / Ekipman', 'Kümes bakım / Tadilat', 'Halka / Aidat', 'Ulaşım', 'Diğer gider'],
  },
  weather: { label: 'Hava durumları', hint: 'Uçuş kaydında', defaults: ['Açık', 'Parçalı bulutlu', 'Kapalı', 'Rüzgârlı', 'Yağmurlu', 'Sisli', 'Sıcak', 'Soğuk'] },
}

export const TIMING_DEFS = {
  incubationDays: { label: 'Kuluçka süresi (gün)', hint: '2. yumurtadan çıkışa', def: 18, min: 14, max: 25 },
  candleDay: { label: 'Işık kontrolü (gün)', hint: 'Yumurtlamadan sonra', def: 7, min: 3, max: 12 },
  ringDay: { label: 'Halkalama (gün)', hint: 'Çıkıştan sonra', def: 6, min: 3, max: 12 },
  weanDay: { label: 'Yavru ayırma (gün)', hint: 'Çıkıştan sonra', def: 28, min: 18, max: 45 },
}

export function getList(key) {
  const custom = getConfig().lists?.[key]
  return Array.isArray(custom) ? custom : LIST_DEFS[key].defaults
}

export function saveList(key, items) {
  const clean = [...new Set(items.map((x) => String(x).trim()).filter(Boolean))]
  saveConfig({ lists: { ...(getConfig().lists || {}), [key]: clean } })
}

export function resetList(key) {
  const lists = { ...(getConfig().lists || {}) }
  delete lists[key]
  saveConfig({ lists })
}

export function getTimings() {
  const t = getConfig().timings || {}
  return Object.fromEntries(Object.entries(TIMING_DEFS).map(([k, d]) => [k, Number.isFinite(+t[k]) && t[k] !== '' && t[k] != null ? +t[k] : d.def]))
}

export function saveTimings(patch) {
  saveConfig({ timings: { ...(getConfig().timings || {}), ...patch } })
}

let v = 0
subscribe(() => v++)
// Liste değişince yeniden çizilir
export function useList(key) {
  useSyncExternalStore(subscribe, () => v)
  return getList(key)
}
export function useTimings() {
  useSyncExternalStore(subscribe, () => v)
  return getTimings()
}
