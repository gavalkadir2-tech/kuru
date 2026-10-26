// İnternet/yapay zeka erişimi yokken çalışan yerel kural tabanlı motor.
import { DISEASES, GRAINS, PERIODS, SYMPTOMS, URGENCY } from './constants'

export function diagnoseLocal(symptomIds) {
  const set = new Set(symptomIds)
  if (!set.size) return []
  return DISEASES.map((d) => {
    const entries = Object.entries(d.signs)
    const total = entries.reduce((s, [, w]) => s + w, 0)
    const matched = entries.filter(([k]) => set.has(k))
    const hit = matched.reduce((s, [, w]) => s + w, 0)
    // Hastalıkla ilgisiz belirtiler skoru hafifçe düşürür
    const unrelated = [...set].filter((s) => !(s in d.signs)).length
    const score = (hit / total) * 0.75 + (matched.length / set.size) * 0.25 - unrelated * 0.02
    return { ...d, score: Math.max(0, Math.min(1, score)), matched: matched.map(([k]) => SYMPTOMS[k]) }
  })
    .filter((d) => d.matched.length)
    .sort((a, b) => b.score - a.score)
    .slice(0, 4)
}

export function diagnoseLocalText(symptomIds) {
  const res = diagnoseLocal(symptomIds)
  if (!res.length) return 'Seçilen belirtilerle eşleşen hastalık bulunamadı. Belirtileri gözden geçirin veya veterinere danışın.'
  return res
    .map(
      (d, i) =>
        `### ${i + 1}. ${d.name} — %${Math.round(d.score * 100)}\n` +
        `**Aciliyet:** ${URGENCY[d.urgency]}${d.contagious ? ' · Bulaşıcı, hasta kuşu ayırın' : ''}\n\n` +
        `**Eşleşen belirtiler:** ${d.matched.join(', ')}\n\n` +
        `**Tedavi:** ${d.treatment}\n\n**Korunma:** ${d.prevention}`,
    )
    .join('\n\n')
}

function mixNutrients(mix) {
  let p = 0, f = 0, c = 0
  for (const [id, pct] of Object.entries(mix)) {
    const g = GRAINS.find((x) => x.id === id)
    if (!g) continue
    p += (g.p * pct) / 100
    f += (g.f * pct) / 100
    c += (g.c * pct) / 100
  }
  return { p, f, c }
}

// Seçilen yemlerden hedef protein/yağ değerine en yakın karışımı arar.
// Her yem en az %5, en fazla %40 (yağlı tohumlar en fazla %10).
export function optimizeRation(grainIds, periodKey) {
  const target = PERIODS[periodKey]
  const ids = grainIds.filter((id) => GRAINS.some((g) => g.id === id))
  if (!ids.length || !target) return null
  const maxOf = (id) => (GRAINS.find((g) => g.id === id).f >= 18 ? 10 : 40)
  const minOf = () => 5
  let mix = {}
  // Başlangıç: eşit dağılım, sınırlara uydur
  ids.forEach((id) => (mix[id] = 100 / ids.length))
  const cost = (m) => {
    const n = mixNutrients(m)
    return (n.p - target.p) ** 2 + 1.5 * (n.f - target.f) ** 2
  }
  const clampOk = (m) => ids.every((id) => m[id] >= minOf(id) - 1e-9 && m[id] <= maxOf(id) + 1e-9)
  // Sınır dışıysa önce düzelt
  for (let k = 0; k < 200 && !clampOk(mix); k++) {
    for (const id of ids) mix[id] = Math.min(maxOf(id), Math.max(minOf(id), mix[id]))
    const sum = ids.reduce((s, id) => s + mix[id], 0)
    const free = ids.filter((id) => (sum > 100 ? mix[id] > minOf(id) : mix[id] < maxOf(id)))
    if (!free.length) break
    free.forEach((id) => (mix[id] += (100 - sum) / free.length))
  }
  // Yerel arama: bir yemden diğerine %1 aktar
  let best = cost(mix)
  for (let iter = 0; iter < 3000; iter++) {
    let improved = false
    for (const a of ids)
      for (const b of ids) {
        if (a === b) continue
        if (mix[a] - 1 < minOf(a) || mix[b] + 1 > maxOf(b)) continue
        mix[a] -= 1
        mix[b] += 1
        const c = cost(mix)
        if (c < best - 1e-9) {
          best = c
          improved = true
        } else {
          mix[a] += 1
          mix[b] -= 1
        }
      }
    if (!improved) break
  }
  // Tam sayıya yuvarla, toplamı 100'e sabitle
  const rounded = {}
  ids.forEach((id) => (rounded[id] = Math.round(mix[id])))
  const diff = 100 - ids.reduce((s, id) => s + rounded[id], 0)
  if (diff) {
    const top = ids.slice().sort((x, y) => rounded[y] - rounded[x])[0]
    rounded[top] += diff
  }
  return { mix: rounded, nutrients: mixNutrients(rounded), target }
}

export function flockSummary({ pigeons, pairs, clutches, health }) {
  const active = pigeons.filter((p) => p.status === 'aktif')
  const males = active.filter((p) => p.sex === 'E').length
  const females = active.filter((p) => p.sex === 'D').length
  const breeds = {}
  active.forEach((p) => p.breed && (breeds[p.breed] = (breeds[p.breed] || 0) + 1))
  const lastHealth = health.slice(0, 8).map((h) => `${h.date || ''} ${h.medicine || h.title || ''} (${h.diagnosis || h.type || ''})`)
  return [
    `Aktif güvercin: ${active.length} (erkek ${males}, dişi ${females})`,
    `Irklar: ${Object.entries(breeds).map(([k, v]) => `${k} ${v}`).join(', ') || 'belirtilmemiş'}`,
    `Aktif çift: ${pairs.filter((p) => p.active !== false).length}, kayıtlı kuluçka: ${clutches.length}`,
    `Son sağlık kayıtları: ${lastHealth.join('; ') || 'yok'}`,
  ].join('\n')
}
