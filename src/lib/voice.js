// Sesle kayıt: konuşma → yazı (tarayıcı) → eylemler (yapay zeka) → onaylı kayıt
import { askAI } from './ai'
import { STATUS } from './constants'
import { fmtDate, num, pigeonLabel, today } from './format'
import { afterPigeonSave } from './people'
import { stockLevels, syncLinkedMove } from './stock'
import { get, list, save } from './store'

export function speechSupported() {
  return !!(window.SpeechRecognition || window.webkitSpeechRecognition)
}

export function startListening({ onText, onEnd, onError }) {
  const SR = window.SpeechRecognition || window.webkitSpeechRecognition
  const rec = new SR()
  rec.lang = 'tr-TR'
  rec.interimResults = true
  rec.continuous = true
  let finalText = ''
  rec.onresult = (e) => {
    let interim = ''
    for (let i = e.resultIndex; i < e.results.length; i++) {
      if (e.results[i].isFinal) finalText += e.results[i][0].transcript + ' '
      else interim += e.results[i][0].transcript
    }
    onText((finalText + interim).trim())
  }
  rec.onerror = (e) => onError?.(e.error === 'not-allowed' ? 'Mikrofon izni verilmedi.' : 'Ses tanınamadı: ' + e.error)
  rec.onend = () => onEnd?.()
  rec.start()
  return () => rec.stop()
}

const pairText = (pr) => {
  const m = get('pigeons', pr.maleId)
  const f = get('pigeons', pr.femaleId)
  return `${m?.ring || '?'} (${m?.name || ''}) × ${f?.ring || '?'} (${f?.name || ''})${pr.nest ? ` yuva ${pr.nest}` : ''}`
}

export function buildContext() {
  return {
    pigeons: list('pigeons')
      .filter((p) => p.status === 'aktif')
      .slice(0, 400)
      .map((p) => ({ id: p.id, ring: p.ring, name: p.name || undefined, sex: p.sex })),
    pairs: list('pairs')
      .filter((p) => p.active !== false)
      .map((p) => ({ id: p.id, nest: p.nest || undefined, text: pairText(p), foster: p.foster || undefined })),
    openClutches: list('clutches')
      .filter((c) => !c.closed && !c.failed)
      .map((c) => ({ pairId: c.pairId, egg1Date: c.egg1Date, egg2Date: c.egg2Date || undefined, hatchDate: c.hatchDate || undefined, fosterPairId: c.fosterPairId || undefined })),
    stock: list('stock').map((s) => ({ id: s.id, name: s.name, unit: s.unit, category: s.category })),
    rations: list('rations').map((r) => ({ id: r.id, name: r.name })),
  }
}

export async function parseSpeech(text) {
  const raw = await askAI('parse', { text, context: buildContext(), date: today() })
  const m = raw.match(/\{[\s\S]*\}/)
  let data
  try {
    data = JSON.parse(m ? m[0] : raw)
  } catch {
    throw new Error('Yapay zeka yanıtı anlaşılamadı; cümleyi daha açık söyleyip tekrar deneyin.')
  }
  return (data.actions || []).filter((a) => a && a.type)
}

const ring = (id) => get('pigeons', id)?.ring || '?'
const latestOpenClutch = (pairId, pred) =>
  list('clutches')
    .filter((c) => c.pairId === pairId && !c.closed && !c.failed && pred(c))
    .sort((a, b) => (b.egg1Date || '').localeCompare(a.egg1Date || ''))[0]

// Kullanıcıya gösterilecek açıklama ve eksik bilgi kontrolü
export function describe(a) {
  const d = a.date ? fmtDate(a.date) : 'bugün'
  const pr = a.pairId && get('pairs', a.pairId)
  switch (a.type) {
    case 'egg':
      return pr ? { text: `🥚 ${pairText(pr)} — ${a.eggNo === 2 ? '2.' : '1.'} yumurta, ${d}` } : { text: '🥚 Yumurtlama', error: 'Çift bulunamadı' }
    case 'hatch':
      return pr ? { text: `🐣 ${pairText(pr)} — ${a.count || 1} yavru çıktı, ${d}` } : { text: '🐣 Çıkış', error: 'Çift bulunamadı' }
    case 'pair': {
      const m = get('pigeons', a.maleId)
      const f = get('pigeons', a.femaleId)
      if (!m || !f) return { text: '💞 Yeni çift', error: 'Kuş bulunamadı' }
      if (m.sex !== 'E' || f.sex !== 'D') return { text: `💞 ${m.ring} × ${f.ring}`, error: 'Erkek ve dişi ters ya da cinsiyet belirsiz' }
      if (list('pairs').some((pr) => pr.active !== false && pr.maleId === m.id && pr.femaleId === f.id)) return { text: `💞 ${m.ring} × ${f.ring}`, error: 'Bu çift zaten var' }
      return { text: `💞 Yeni çift: ${pigeonLabel(m)} × ${pigeonLabel(f)}${a.pairType ? ` (${a.pairType})` : ''}${a.nest ? `, yuva ${a.nest}` : ''}` }
    }
    case 'foster': {
      const fp = a.fosterPairId && get('pairs', a.fosterPairId)
      if (!pr || !fp) return { text: '🔄 Bakıcıya aktarma', error: 'Çift veya bakıcı bulunamadı' }
      if (fp.id === pr.id) return { text: '🔄 Bakıcıya aktarma', error: 'Bakıcı, yumurtanın kendi çifti olamaz' }
      if (!latestOpenClutch(a.pairId, (c) => !c.hatchDate)) return { text: `🔄 ${pairText(pr)}`, error: 'Bu çiftin açık kuluçkası yok' }
      return { text: `🔄 ${pairText(pr)} yumurtaları (${a.eggs || 'hepsi'}) → bakıcı ${pairText(fp)}, ${d}` }
    }
    case 'health': {
      const who = a.scope === 'some' && a.pigeonIds?.length ? a.pigeonIds.map(ring).join(', ') : 'Tüm sürü'
      return a.medicine || a.diagnosis
        ? { text: `💊 ${a.medicine || a.diagnosis}${a.dose ? ` (${a.dose})` : ''} — ${who}, ${d}${a.nextDate ? `, tekrar ${fmtDate(a.nextDate)}` : ''}` }
        : { text: '💊 Sağlık kaydı', error: 'İlaç adı yok' }
    }
    case 'feeding':
      return num(a.amountGram) ? { text: `🌾 ${a.feed || get('rations', a.rationId)?.name || 'Yem'} ${a.amountGram} g, ${d}` } : { text: '🌾 Yemleme', error: 'Miktar yok' }
    case 'weight':
      return a.pigeonId && get('pigeons', a.pigeonId) && num(a.gram) ? { text: `⚖️ ${pigeonLabel(get('pigeons', a.pigeonId))} — ${a.gram} g, ${d}` } : { text: '⚖️ Tartı', error: 'Kuş veya ağırlık bulunamadı' }
    case 'flight': {
      const ids = (a.pigeonIds || []).filter((id) => get('pigeons', id))
      return ids.length ? { text: `🕊️ Uçuş: ${ids.map(ring).join(', ')}${a.durationMin ? ` — ${a.durationMin} dk` : ''}${a.score ? `, puan ${a.score}` : ''}, ${d}` } : { text: '🕊️ Uçuş', error: 'Kuş bulunamadı' }
    }
    case 'status':
      return a.pigeonId && get('pigeons', a.pigeonId) && STATUS[a.status]
        ? { text: `🔁 ${pigeonLabel(get('pigeons', a.pigeonId))} → ${STATUS[a.status]}${a.toName ? ` (${a.toName}${a.toPrice ? `, ${a.toPrice} ₺` : ''})` : ''}` }
        : { text: '🔁 Durum değişikliği', error: 'Kuş bulunamadı' }
    case 'stock_buy': {
      const s = get('stock', a.stockItemId)
      return s && num(a.qty) ? { text: `📦 ${s.name} alımı ${a.qty} ${s.unit}${a.cost ? `, ${a.cost} ₺` : ''}` } : { text: '📦 Stok alımı', error: 'Stok kalemi veya miktar yok' }
    }
    case 'expense':
    case 'income':
      return num(a.amount) ? { text: `${a.type === 'income' ? '➕ Gelir' : '➖ Gider'}: ${a.amount} ₺ ${a.category || ''} ${a.note || ''}` } : { text: 'Gelir/gider', error: 'Tutar yok' }
    case 'note':
      return a.text ? { text: `📝 Not: ${a.text}` } : { text: '📝 Not', error: 'Boş' }
    default:
      return { text: a.summary || a.type, error: 'Bilinmeyen işlem' }
  }
}

export function apply(a) {
  const date = a.date || today()
  switch (a.type) {
    case 'egg': {
      const open = a.eggNo === 2 ? latestOpenClutch(a.pairId, (c) => !c.hatchDate && !c.egg2Date) : null
      if (open) return save('clutches', { ...open, egg2Date: date })
      return save('clutches', { pairId: a.pairId, egg1Date: date, egg2Date: '', eggs: a.eggNo === 2 ? 2 : 1, fertile: '', hatchDate: '', hatched: '', notes: 'Sesle eklendi' })
    }
    case 'pair':
      return save('pairs', {
        maleId: a.maleId,
        femaleId: a.femaleId,
        startDate: date,
        season: String(new Date().getFullYear()),
        type: a.pairType || '',
        targetColor: a.targetColor || '',
        nest: a.nest || '',
        active: true,
        notes: a.summary || 'Yapay zeka önerisi',
      })
    case 'foster': {
      const open = latestOpenClutch(a.pairId, (c) => !c.hatchDate)
      return save('clutches', { ...open, fosterPairId: a.fosterPairId, fosterDate: date, fosterEggs: a.eggs || open.eggs || '' })
    }
    case 'hatch': {
      const open = latestOpenClutch(a.pairId, (c) => !c.hatchDate)
      if (open) return save('clutches', { ...open, hatchDate: date, hatched: a.count || 1 })
      return save('clutches', { pairId: a.pairId, egg1Date: '', hatchDate: date, hatched: a.count || 1, eggs: a.count || 1, notes: 'Sesle eklendi' })
    }
    case 'health': {
      const item = a.stockItemId && stockLevels().find((l) => l.item.id === a.stockItemId)
      const rec = save('health', {
        type: 'ilac',
        date,
        scope: a.scope === 'some' && a.pigeonIds?.length ? 'some' : 'all',
        pigeonIds: a.scope === 'some' ? (a.pigeonIds || []).filter((id) => get('pigeons', id)) : [],
        medicine: a.medicine || '',
        dose: a.dose || '',
        diagnosis: a.diagnosis || '',
        nextDate: a.nextDate || '',
        stockItemId: item ? a.stockItemId : '',
        stockQty: item ? num(a.stockQty) : '',
        notes: 'Sesle eklendi',
      })
      if (item && num(a.stockQty)) syncLinkedMove({ refId: rec.id, source: 'health', itemId: a.stockItemId, qty: num(a.stockQty), date, note: rec.medicine })
      return rec
    }
    case 'feeding': {
      const item = a.stockItemId && get('stock', a.stockItemId)
      const used = item ? (item.unit === 'kg' ? num(a.amountGram) / 1000 : item.unit === 'g' ? num(a.amountGram) : '') : ''
      const rec = save('feedings', {
        date,
        feed: a.feed || '',
        rationId: get('rations', a.rationId) ? a.rationId : '',
        amount: num(a.amountGram),
        count: list('pigeons').filter((p) => p.status === 'aktif').length,
        stockItemId: used ? a.stockItemId : '',
        stockQty: used,
        notes: 'Sesle eklendi',
      })
      if (used) syncLinkedMove({ refId: rec.id, source: 'feeding', itemId: a.stockItemId, qty: used, date, note: 'Yemleme' })
      return rec
    }
    case 'weight':
      return save('weights', { pigeonId: a.pigeonId, date, gram: num(a.gram) })
    case 'flight':
      return save('flights', {
        pigeonIds: (a.pigeonIds || []).filter((id) => get('pigeons', id)),
        date,
        durationMin: num(a.durationMin),
        score: num(a.score),
        notes: a.notes || '',
      })
    case 'status': {
      const p = get('pigeons', a.pigeonId)
      const rec = save('pigeons', { ...p, status: a.status, toName: a.toName || p.toName || '', toPrice: num(a.toPrice) || p.toPrice || '', toDate: date })
      afterPigeonSave(rec)
      return rec
    }
    case 'stock_buy':
      return save('stockMoves', { itemId: a.stockItemId, date, qty: num(a.qty), source: 'alim', cost: num(a.cost), note: 'Sesle eklendi' })
    case 'expense':
    case 'income':
      return save('ledger', { date, type: a.type === 'income' ? 'gelir' : 'gider', category: a.category || (a.type === 'income' ? 'Diğer gelir' : 'Diğer gider'), amount: num(a.amount), note: a.note || '' })
    case 'note':
      return save('notes', { date: today(), text: a.text })
    default:
      throw new Error('Bilinmeyen işlem')
  }
}
