// Stok: kalemler (`stock`) ve hareketler (`stockMoves`). Mevcut miktar hareketlerin toplamıdır.
import { list, remove, save } from './store'

export const STOCK_CATEGORIES = { yem: 'Yem', ilac: 'İlaç / Aşı', vitamin: 'Vitamin / Takviye', malzeme: 'Malzeme' }
export const STOCK_UNITS = ['kg', 'g', 'lt', 'ml', 'adet', 'paket', 'doz']
export const MOVE_SOURCES = { alim: 'Alım', kullanim: 'Kullanım', feeding: 'Yemleme', health: 'Sağlık kaydı', sayim: 'Sayım düzeltmesi' }

export function stockQty(itemId, moves = list('stockMoves')) {
  return moves.filter((m) => m.itemId === itemId).reduce((t, m) => t + (+m.qty || 0), 0)
}

export function stockLevels() {
  const moves = list('stockMoves')
  return list('stock').map((item) => {
    const qty = stockQty(item.id, moves)
    const low = item.minQty !== '' && item.minQty != null && qty <= +item.minQty
    return { item, qty, low }
  })
}

// Yemleme gramını kalemin birimine çevirir; çevrilemiyorsa null
export function gramsToUnit(grams, unit) {
  if (unit === 'kg') return grams / 1000
  if (unit === 'g') return grams
  return null
}

// Bir kayda (yemleme, sağlık) bağlı stok düşümünü oluşturur/günceller/siler
export function syncLinkedMove({ refId, source, itemId, qty, date, note }) {
  const existing = list('stockMoves').find((m) => m.refId === refId)
  if (!itemId || !qty) {
    if (existing) remove('stockMoves', existing.id)
    return
  }
  save('stockMoves', { ...(existing || {}), refId, source, itemId, qty: -Math.abs(qty), date, note })
}

export function removeLinkedMove(refId) {
  const existing = list('stockMoves').find((m) => m.refId === refId)
  if (existing) remove('stockMoves', existing.id)
}

export const fmtQty = (n) => (Math.round(n * 1000) / 1000).toLocaleString('tr-TR')
