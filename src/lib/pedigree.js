import { get, list } from './store'

// Bir kuşun atalarını {id -> en yakın kuşak} olarak döndürür
export function ancestors(id, depth = 4, acc = new Map(), gen = 1) {
  const p = id && get('pigeons', id)
  if (!p || gen > depth) return acc
  for (const pid of [p.fatherId, p.motherId]) {
    if (!pid) continue
    if (!acc.has(pid) || acc.get(pid) > gen) acc.set(pid, gen)
    ancestors(pid, depth, acc, gen + 1)
  }
  return acc
}

// İki kuş arasında ortak ata / doğrudan akrabalık kontrolü
export function kinship(aId, bId, depth = 4) {
  if (!aId || !bId) return null
  const a = ancestors(aId, depth)
  const b = ancestors(bId, depth)
  if (a.has(bId)) return { type: 'direct', text: 'Dişi, erkeğin atası (anne/nine). Eşleştirme önerilmez.' }
  if (b.has(aId)) return { type: 'direct', text: 'Erkek, dişinin atası (baba/dede). Eşleştirme önerilmez.' }
  const common = [...a.keys()].filter((k) => b.has(k))
  if (!common.length) return null
  const closest = Math.min(...common.map((k) => Math.max(a.get(k), b.get(k))))
  const rel = closest === 1 ? 'kardeş' : closest === 2 ? 'kuzen (ortak dede/nine)' : 'uzak akraba'
  return { type: 'common', closest, common, text: `Ortak ata bulundu: ${rel}. ${closest <= 2 ? 'Yakın akraba eşleştirmesi; dikkatli olun.' : 'Hat yetiştirme sayılabilir.'}` }
}

export function offspring(id) {
  return list('pigeons').filter((p) => p.fatherId === id || p.motherId === id)
}
