// Güvercin renk genetiği — yavru renk olasılıkları.
// Kapsanan lokuslar:
//   Cinsiyete bağlı (Z): temel renk B (BA kırmızı > + mavi/kara > b kahve), seyreltme d (resesif)
//   Otozomal: desen C (CT koyu pullu > C pullu > + çubuklu > c çubuksuz), yayılma S (baskın), resesif kırmızı e
// Erkek ZZ (iki kopya), dişi ZW (tek kopya). B ve d lokusları aslında bağlıdır; burada bağımsız
// kabul edilir, bu yüzden sonuçlar yaklaşık değerlerdir. Değiştirici genler (grizzle, opal, almond…) dahil değildir.

export const BASE_RANK = { BA: 3, '+': 2, b: 1 }
export const PATTERN_RANK = { CT: 4, C: 3, '+': 2, c: 1 }

const BASE_NAME = { BA: 'Kırmızı', '+': 'Gök (mavi)', b: 'Kahverengi' }
const BASE_DILUTE = { BA: 'Sarı', '+': 'Gümüşi (kurşuni)', b: 'Haki' }
const SPREAD_NAME = { BA: 'Kırmızı (yayılmış)', '+': 'Kara', b: 'Koyu kahve' }
const SPREAD_DILUTE = { BA: 'Sarı (yayılmış)', '+': 'Boz', b: 'Açık haki' }
const PATTERN_NAME = { CT: 'koyu pullu', C: 'pullu', '+': 'çubuklu', c: 'çubuksuz' }

// Arayüz seçenekleri: [genotip, açıklama]
export const MALE_BASE = [
  ['BA/BA', 'Kırmızı (saf)'],
  ['BA/+', 'Kırmızı — mavi taşır'],
  ['BA/b', 'Kırmızı — kahve taşır'],
  ['+/+', 'Gök / Kara (saf)'],
  ['+/b', 'Gök / Kara — kahve taşır'],
  ['b/b', 'Kahverengi'],
]
export const FEMALE_BASE = [
  ['BA', 'Kırmızı'],
  ['+', 'Gök / Kara'],
  ['b', 'Kahverengi'],
]
export const MALE_DILUTE = [
  ['D/D', 'Normal renk'],
  ['D/d', 'Normal — seyreltme taşır'],
  ['d/d', 'Seyreltik (sarı, gümüşi, boz…)'],
]
export const FEMALE_DILUTE = [
  ['D', 'Normal renk'],
  ['d', 'Seyreltik (sarı, gümüşi, boz…)'],
]
export const PATTERN = [
  ['CT/CT', 'Koyu pullu (saf)'],
  ['CT/C', 'Koyu pullu — pullu taşır'],
  ['CT/+', 'Koyu pullu — çubuklu taşır'],
  ['CT/c', 'Koyu pullu — çubuksuz taşır'],
  ['C/C', 'Pullu (saf)'],
  ['C/+', 'Pullu — çubuklu taşır'],
  ['C/c', 'Pullu — çubuksuz taşır'],
  ['+/+', 'Çubuklu (saf)'],
  ['+/c', 'Çubuklu — çubuksuz taşır'],
  ['c/c', 'Çubuksuz'],
]
export const SPREAD = [
  ['+/+', 'Yayılma yok'],
  ['S/+', 'Yayılmış (tek kopya)'],
  ['S/S', 'Yayılmış (saf)'],
]
export const RECRED = [
  ['+/+', 'Resesif kırmızı yok'],
  ['+/e', 'Resesif kırmızı taşır'],
  ['e/e', 'Resesif kırmızı / sarı'],
]

const split = (g) => g.split('/')
const top = (alleles, rank) => alleles.slice().sort((a, b) => rank[b] - rank[a])[0]

// Bir lokus için yavru genotip dağılımı: { "A/a": olasılık }
function cross(a, b, rank) {
  const out = {}
  for (const x of split(a))
    for (const y of split(b)) {
      const key = [x, y].sort((p, q) => (rank ? rank[q] - rank[p] : p < q ? -1 : 1)).join('/')
      out[key] = (out[key] || 0) + 0.25
    }
  return out
}

function phenotype({ base, dilute, pattern, spread, recred }) {
  if (recred === 'e/e') return dilute ? 'Resesif sarı' : 'Resesif kırmızı'
  const b = top(base, BASE_RANK)
  if (spread !== '+/+') return dilute ? SPREAD_DILUTE[b] : SPREAD_NAME[b]
  const p = top(split(pattern), PATTERN_RANK)
  return `${dilute ? BASE_DILUTE[b] : BASE_NAME[b]} ${PATTERN_NAME[p]}`
}

// Görünmeyen ama taşınan özellikler
function carriers({ base, dilute, diluteCarrier, pattern, spread, recred }) {
  const out = []
  const shown = top(base, BASE_RANK)
  for (const a of new Set(base)) if (a !== shown) out.push(a === '+' ? 'mavi taşır' : a === 'b' ? 'kahve taşır' : 'kırmızı taşır')
  if (!dilute && diluteCarrier) out.push('seyreltme taşır')
  if (recred === '+/e') out.push('resesif kırmızı taşır')
  if (recred !== 'e/e' && spread === '+/+') {
    const [x, y] = split(pattern)
    const shownP = top([x, y], PATTERN_RANK)
    if (x !== y) out.push(`${PATTERN_NAME[shownP === x ? y : x]} taşır`)
  }
  return out
}

/**
 * father: { base: 'BA/+', dilute: 'D/d', pattern: 'C/+', spread: '+/+', recred: '+/+' }
 * mother: { base: 'BA', dilute: 'D', pattern: '+/+', spread: '+/+', recred: '+/+' }
 * Dönüş: [{ sex: 'E'|'D', name, carriers: [], p }] — her cinsiyet kendi içinde %100
 */
export function predict(father, mother) {
  const fBase = split(father.base)
  const fDil = split(father.dilute)
  const auto = []
  for (const [pattern, pp] of Object.entries(cross(father.pattern, mother.pattern, PATTERN_RANK)))
    for (const [spread, ps] of Object.entries(cross(father.spread, mother.spread, { S: 2, '+': 1 })))
      for (const [recred, pr] of Object.entries(cross(father.recred, mother.recred, { '+': 2, e: 1 }))) auto.push({ pattern, spread, recred, p: pp * ps * pr })

  const groups = new Map()
  const add = (sex, g, p) => {
    const name = phenotype(g)
    const carry = carriers(g)
    const key = `${sex}|${name}|${carry.join(',')}`
    const cur = groups.get(key) || { sex, name, carriers: carry, p: 0 }
    cur.p += p
    groups.set(key, cur)
  }
  // Babadan gelen Z: temel renk ve seyreltme alelleri (bağımsız kabul)
  for (const zb of fBase)
    for (const zd of fDil)
      for (const a of auto) {
        const p = 0.25 * a.p
        // Erkek yavru: babanın Z'si + annenin Z'si
        const sonDil = [zd, mother.dilute]
        add('E', { base: [zb, mother.base], dilute: sonDil.every((x) => x === 'd'), diluteCarrier: sonDil.includes('d'), ...a }, p)
        // Dişi yavru: yalnızca babanın Z'si
        add('D', { base: [zb], dilute: zd === 'd', diluteCarrier: false, ...a }, p)
      }
  return [...groups.values()].sort((x, y) => (x.sex === y.sex ? y.p - x.p : x.sex === 'E' ? -1 : 1))
}
