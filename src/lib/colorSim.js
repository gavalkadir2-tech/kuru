// Güvercin renk kalıtımı — görünür renkten yavru renk tahmini (benzetim).
//
// Ebeveynin görünür rengi (fenotip) ve bilinen taşıyıcılıkları, olası genotiplere çevrilir;
// görünmeyen taşıyıcılıklar için yaygın olasılıklar kullanılır. Ardından binlerce sanal
// yavru üretilip renklerin oranı hesaplanır (Monte Carlo). Sonuçlar yaklaşık değerlerdir.
//
// Lokuslar:
//   Cinsiyete bağlı (Z): temel renk B (BA kırmızı > + gök/kara > b kahve), seyreltme d, badem St
//   Otozomal: desen C (CT > C > + > c), yayılma S, resesif kırmızı e, resesif ak z,
//             kırçıl G, indigo In, karabaş (renkli baş / ak gövde) h (resesif kabul edilir)
//   Alacalık miktarı çok genlidir: ebeveynlerin ortalaması etrafında dağılan bir puanla yaklaşık modellenir.

// ---------- Arayüz seçenekleri ----------
export const COLOR_OPTIONS = {
  kirmizi: 'Kırmızı (kül kırmızı)',
  sari: 'Sarı',
  gok: 'Gök (mavi)',
  gumusi: 'Gümüşi / kurşuni',
  kara: 'Kara (siyah)',
  boz: 'Boz',
  kahve: 'Kahverengi',
  haki: 'Haki',
  reskirmizi: 'Resesif kırmızı (koyu, parlak kızıl)',
  ressari: 'Resesif sarı',
  ak: 'Ak (tamamen beyaz)',
}
export const PATTERN_OPTIONS = { cubuklu: 'Çubuklu', pullu: 'Pullu', koyupullu: 'Koyu pullu (çakmaklı)', cubuksuz: 'Çubuksuz (sade)', bilinmiyor: 'Bilinmiyor / görünmüyor' }
export const WHITE_OPTIONS = {
  yok: 'Beyazlık yok (tam renkli)',
  az: 'Az alacalı (birkaç beyaz tüy)',
  karabas: 'Karabaş tipi (ak gövde, renkli baş/kuyruk)',
  alaca: 'Alaca / çil',
  cokak: 'Çoğunlukla ak (renkli lekeler)',
}
export const AK_TYPES = {
  bilinmiyor: 'Bilinmiyor',
  resesif: 'Resesif ak (gözü koyu, ak × ak hep ak verir)',
  alaca: 'Alaca kökenli ak',
  kircil: 'Kırçıldan ak (çift kırçıl)',
}
export const GRIZZLE_OPTIONS = { yok: 'Yok', kircil: 'Kırçıl', cokkircil: 'Çok kırçıl (neredeyse ak)' }
export const ALMOND_OPTIONS = { yok: 'Yok', badem: 'Badem (almond)' }
export const INDIGO_OPTIONS = { yok: 'Yok', tek: 'İndigo', cift: 'Çift indigo (Andaluz tipi)' }
export const CARRIER_OPTIONS = {
  mavi: 'Gök (mavi) taşır',
  kahve: 'Kahve taşır',
  seyreltme: 'Seyreltme (sarı/gümüşi) taşır',
  reskirmizi: 'Resesif kırmızı taşır',
  resak: 'Resesif ak taşır',
  karabas: 'Karabaş taşır',
  cubuksuz: 'Çubuksuz taşır',
}
// Cinsiyete bağlı taşıyıcılık dişide olamaz
export const MALE_ONLY_CARRIERS = ['mavi', 'kahve', 'seyreltme']

export const DEFAULT_PHENO = { color: 'gok', pattern: 'cubuklu', white: 'yok', grizzle: 'yok', almond: 'yok', indigo: 'yok', akType: 'bilinmiyor', carriers: [] }

// ---------- Rastgelelik (tekrarlanabilir sonuç için tohumlu) ----------
function rng(seed) {
  let a = seed >>> 0
  return () => {
    a = (a + 0x6d2b79f5) >>> 0
    let t = a
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}
const pick = (r, weights) => {
  let x = r() * Object.values(weights).reduce((a, b) => a + b, 0)
  for (const [k, w] of Object.entries(weights)) if ((x -= w) <= 0) return k
  return Object.keys(weights)[0]
}
const chance = (r, p) => r() < p
const gauss = (r) => Math.sqrt(-2 * Math.log(r() || 1e-9)) * Math.cos(2 * Math.PI * r())

const B_RANK = { BA: 3, '+': 2, b: 1 }
const C_RANK = { CT: 4, C: 3, '+': 2, c: 1 }
const domB = (a) => a.slice().sort((x, y) => B_RANK[y] - B_RANK[x])[0]
const domC = (a) => a.slice().sort((x, y) => C_RANK[y] - C_RANK[x])[0]

// Yaygın (bilinmeyen) alel olasılıkları
const POP_C = { '+': 0.45, C: 0.33, CT: 0.17, c: 0.05 }
const PATTERN_TO_C = { cubuklu: '+', pullu: 'C', koyupullu: 'CT', cubuksuz: 'c' }

// ---------- Görünür renkten olası genotip örnekleme ----------
function hiddenB(r, shown, carriers) {
  if (shown === 'b') return 'b'
  if (shown === '+') return carriers.includes('kahve') ? 'b' : chance(r, 0.1) ? 'b' : '+'
  // kırmızı erkek: ikinci alel
  if (carriers.includes('mavi')) return '+'
  if (carriers.includes('kahve')) return 'b'
  return pick(r, { BA: 0.45, '+': 0.47, b: 0.08 })
}

function hiddenC(r, shown, carriers) {
  if (carriers.includes('cubuksuz') && shown !== 'c') return 'c'
  const lower = { CT: { CT: 0.4, C: 0.3, '+': 0.27, c: 0.03 }, C: { C: 0.5, '+': 0.45, c: 0.05 }, '+': { '+': 0.93, c: 0.07 }, c: { c: 1 } }
  return pick(r, lower[shown])
}

const AK_MODES = { z: 0.5, pied: 0.4, G: 0.1 }
const AK_TYPE_MODE = { resesif: 'z', alaca: 'pied', kircil: 'G' }

// sharedAk: aynı benzetim turunda iki ak ebeveyn için ortak varsayılan ak nedeni
export function sampleGenotype(r, sex, ph, sharedAk) {
  const male = sex === 'E'
  const carriers = ph.carriers || []
  const g = {}
  let color = ph.color
  // Ak: üç farklı yoldan olabilir (resesif ak, aşırı alaca, çift kırçıl); alttaki renk bilinmez
  let akMode = null
  if (color === 'ak') {
    akMode = AK_TYPE_MODE[ph.akType] || (sharedAk && chance(r, 0.75) ? sharedAk : pick(r, AK_MODES))
    color = pick(r, { kirmizi: 0.25, gok: 0.35, kara: 0.25, sari: 0.05, gumusi: 0.05, kahve: 0.05 })
  }
  const recRed = color === 'reskirmizi' || color === 'ressari'
  if (recRed) color = color === 'ressari' ? pick(r, { sari: 0.4, gumusi: 0.4, haki: 0.2 }) : pick(r, { kirmizi: 0.35, gok: 0.35, kara: 0.25, kahve: 0.05 })

  const baseOf = { kirmizi: 'BA', sari: 'BA', gok: '+', gumusi: '+', kara: '+', boz: '+', kahve: 'b', haki: 'b' }
  const dilute = ['sari', 'gumusi', 'boz', 'haki'].includes(color)
  const spread = ['kara', 'boz'].includes(color)

  // B ve d (Z kromozomu)
  const b1 = baseOf[color]
  g.B = male ? [b1, hiddenB(r, b1, carriers)] : [b1]
  if (male) {
    if (dilute) g.D = ['d', 'd']
    else g.D = ['D', carriers.includes('seyreltme') || chance(r, 0.12) ? 'd' : 'D']
  } else g.D = [dilute ? 'd' : 'D']
  // Badem (Z, baskın)
  g.St = male ? [ph.almond === 'badem' ? 'St' : '+', '+'] : [ph.almond === 'badem' ? 'St' : '+']

  // Desen: görünmüyorsa yaygın dağılımdan
  const shownC = !spread && !recRed && !akMode && PATTERN_TO_C[ph.pattern] ? PATTERN_TO_C[ph.pattern] : pick(r, POP_C)
  g.C = [shownC, hiddenC(r, shownC, carriers)]
  // Yayılma
  g.S = spread ? (chance(r, 0.35) ? ['S', 'S'] : ['S', '+']) : recRed || akMode ? (chance(r, 0.3) ? ['S', '+'] : ['+', '+']) : ['+', '+']
  // Resesif kırmızı
  g.e = recRed ? ['e', 'e'] : ['+', carriers.includes('reskirmizi') || chance(r, 0.08) ? 'e' : '+']
  // Resesif ak
  g.z = akMode === 'z' ? ['z', 'z'] : ['+', carriers.includes('resak') || chance(r, 0.04) ? 'z' : '+']
  // Kırçıl
  g.G = akMode === 'G' || ph.grizzle === 'cokkircil' ? ['G', 'G'] : ph.grizzle === 'kircil' ? ['G', '+'] : ['+', '+']
  // İndigo
  g.In = ph.indigo === 'cift' ? ['In', 'In'] : ph.indigo === 'tek' ? ['In', '+'] : ['+', '+']
  // Karabaş (renkli baş, ak gövde)
  g.h = ph.white === 'karabas' ? ['h', 'h'] : ['+', carriers.includes('karabas') || chance(r, 0.08) ? 'h' : '+']
  // Alacalık puanı (0 yok … 3 çoğunlukla ak)
  g.pied = akMode === 'pied' ? 3 : { yok: 0, az: 1, karabas: 0, alaca: 2, cokak: 3 }[ph.white] ?? 0
  g.sex = sex
  return g
}

// ---------- Yavru üretimi ----------
const one = (r, pair) => pair[r() < 0.5 ? 0 : 1]

function child(r, father, mother) {
  const sex = r() < 0.5 ? 'E' : 'D'
  const k = {}
  // Babadan bir Z; erkek yavruya anneden de Z gelir, dişi yavruya anneden W gelir
  const fz = { B: one(r, father.B), D: one(r, father.D), St: one(r, father.St) }
  for (const key of ['B', 'D', 'St']) k[key] = sex === 'E' ? [fz[key], mother[key][0]] : [fz[key]]
  for (const key of ['C', 'S', 'e', 'z', 'G', 'In', 'h']) k[key] = [one(r, father[key]), one(r, mother[key])]
  // Alacalık: ebeveyn ortalaması etrafında; iki renkli ebeveynden alaca yavru nadirdir
  const mean = (father.pied + mother.pied) / 2
  k.pied = Math.max(0, Math.min(3, Math.round(mean + gauss(r) * (mean === 0 ? 0.28 : 0.6))))
  k.sex = sex
  return k
}

// ---------- Görünür renk adı ----------
const CORE = {
  BA: { n: 'Kırmızı', d: 'Sarı', s: 'Kırmızı (düz)', sd: 'Sarı (düz)', head: 'Kızılbaş', headD: 'Sarıbaş' },
  '+': { n: 'Gök', d: 'Gümüşi', s: 'Kara', sd: 'Boz', head: 'Gökbaş', headD: 'Gümüşbaş', headS: 'Karabaş', headSD: 'Bozbaş' },
  b: { n: 'Kahverengi', d: 'Haki', s: 'Koyu kahve', sd: 'Açık haki', head: 'Kahvebaş', headD: 'Hakibaş' },
}
const PATTERN_NAME = { CT: 'koyu pullu', C: 'pullu', '+': 'çubuklu', c: 'çubuksuz' }

export function describeBird(g) {
  if (g.z[0] === 'z' && g.z[1] === 'z') return { name: 'Ak (resesif beyaz)', mods: [] }
  const b = domB(g.B)
  const dil = g.D.every((x) => x === 'd')
  const spread = g.S.includes('S')
  const recRed = g.e[0] === 'e' && g.e[1] === 'e'
  let core
  let head
  if (recRed) {
    core = dil ? 'Resesif sarı' : 'Resesif kırmızı'
    head = dil ? 'Sarıbaş' : 'Kızılbaş'
  } else if (spread) {
    core = dil ? CORE[b].sd : CORE[b].s
    head = (dil ? CORE[b].headSD : CORE[b].headS) || (dil ? CORE[b].headD : CORE[b].head)
  } else {
    core = `${dil ? CORE[b].d : CORE[b].n} ${PATTERN_NAME[domC(g.C)]}`
    head = dil ? CORE[b].headD : CORE[b].head
  }
  const mods = []
  const gg = g.G.filter((x) => x === 'G').length
  if (gg === 2) mods.push('çok kırçıl (neredeyse ak)')
  else if (gg === 1) mods.push('kırçıl')
  if (g.St.includes('St')) mods.push('badem')
  const ii = g.In.filter((x) => x === 'In').length
  if (ii) mods.push(ii === 2 ? 'çift indigo' : 'indigo')
  let name
  if (g.h[0] === 'h' && g.h[1] === 'h') name = `${head} (ak gövde, renkli baş)`
  else if (g.pied === 3) name = `Çoğunlukla ak (${core.toLocaleLowerCase('tr')} lekeli)`
  else name = core + (g.pied === 2 ? ' alaca' : g.pied === 1 ? ', az alacalı' : '')
  return { name, mods }
}

// Görünmeyen ama taşınan özellikler
function hiddenTraits(g) {
  const out = []
  const shown = domB(g.B)
  for (const a of new Set(g.B)) if (a !== shown) out.push(a === '+' ? 'gök taşır' : a === 'b' ? 'kahve taşır' : 'kırmızı taşır')
  if (g.D.includes('d') && !g.D.every((x) => x === 'd')) out.push('seyreltme taşır')
  if (g.e.includes('e') && !(g.e[0] === 'e' && g.e[1] === 'e')) out.push('resesif kırmızı taşır')
  if (g.z.includes('z') && !(g.z[0] === 'z' && g.z[1] === 'z')) out.push('resesif ak taşır')
  if (g.h.includes('h') && !(g.h[0] === 'h' && g.h[1] === 'h')) out.push('karabaş taşır')
  return out
}

/**
 * Yavru renk olasılıkları.
 * father / mother: { color, pattern, white, grizzle, almond, indigo, carriers: [] }
 * Dönüş: { E: [{ name, mods, p, carriers? }], D: [...] } — her cinsiyet kendi içinde %100
 */
export function simulate(father, mother, { n = 20000, seed = 12345, detail = false } = {}) {
  const r = rng(seed)
  const counts = { E: new Map(), D: new Map() }
  const totals = { E: 0, D: 0 }
  for (let i = 0; i < n; i++) {
    // Her yavru için ebeveyn genotipi yeniden örneklenir: bilinmeyen taşıyıcılık olasılıkları böylece sonuca yansır
    const sharedAk = pick(r, AK_MODES)
    const f = sampleGenotype(r, 'E', father, sharedAk)
    const m = sampleGenotype(r, 'D', mother, sharedAk)
    const k = child(r, f, m)
    const d = describeBird(k)
    const label = d.name + (d.mods.length ? ', ' + d.mods.join(', ') : '')
    const key = detail ? label + '|' + hiddenTraits(k).join(', ') : label
    const cur = counts[k.sex].get(key) || { name: label, carriers: detail ? hiddenTraits(k) : [], c: 0 }
    cur.c++
    counts[k.sex].set(key, cur)
    totals[k.sex]++
  }
  const out = {}
  for (const sex of ['E', 'D'])
    out[sex] = [...counts[sex].values()]
      .map((x) => ({ name: x.name, carriers: x.carriers, p: x.c / totals[sex] }))
      .filter((x) => x.p >= 0.005)
      .sort((a, b) => b.p - a.p)
  return out
}

// ---------- Kayıtlı kuşun renk yazısından tahmin ----------
// Örn: "Kara karabaş", "Sarı alaca", "Kırmızı pullu kırçıl", "Ak"
export function phenoFromText(text = '') {
  const t = ' ' + text.toLocaleLowerCase('tr') + ' '
  const has = (...w) => w.some((x) => t.includes(x))
  const ph = { ...DEFAULT_PHENO, carriers: [] }
  if (has('karabaş', 'kara baş')) ph.white = 'karabas'
  else if (has('sarıbaş', 'sarı baş', 'kızılbaş', 'kızıl baş', 'gökbaş', 'bozbaş', 'başlı')) ph.white = 'karabas'
  else if (has('alaca', 'çil', 'benekli', 'ala ')) ph.white = 'alaca'
  if (has('kırçıl', 'kircil')) ph.grizzle = has('çok kırçıl') ? 'cokkircil' : 'kircil'
  if (has('badem')) ph.almond = 'badem'
  if (has('indigo', 'andaluz')) ph.indigo = 'tek'
  if (has('pullu', 'çakmak')) ph.pattern = has('koyu pullu', 'çakmak') ? 'koyupullu' : 'pullu'
  else if (has('çubuksuz', 'sade')) ph.pattern = 'cubuksuz'
  else if (has('çubuklu')) ph.pattern = 'cubuklu'
  // Renk: başlı tiplerde baş rengi esas alınır
  if (has('resesif kırmızı', 'resesif kızıl')) ph.color = 'reskirmizi'
  else if (has('resesif sarı')) ph.color = 'ressari'
  else if (has('karabaş', 'kara baş', ' kara', 'siyah')) ph.color = 'kara'
  else if (has('sarıbaş', 'sarı')) ph.color = 'sari'
  else if (has('kızılbaş', 'kırmızı', 'kızıl')) ph.color = 'kirmizi'
  else if (has('gümüş', 'kurşun')) ph.color = 'gumusi'
  else if (has('boz')) ph.color = 'boz'
  else if (has('haki')) ph.color = 'haki'
  else if (has('kahve')) ph.color = 'kahve'
  else if (has('gök', 'mavi', 'gökbaş')) ph.color = 'gok'
  else if (has(' ak ', 'beyaz', ' ak(', ' ak,')) ph.color = 'ak'
  else return null
  if (ph.color === 'ak' && ph.white === 'yok') ph.white = 'yok'
  return ph
}

// Eski sürümde kaydedilmiş genotipi (base: 'BA/+' …) görünür renk biçimine çevirir
export function phenoFromGenotype(g, sex) {
  if (!g) return null
  const male = sex === 'E'
  const base = g.base?.split('/') || ['+']
  const dil = male ? g.dilute === 'd/d' : g.dilute === 'd'
  const spread = g.spread && g.spread !== '+/+'
  const recRed = g.recred === 'e/e'
  const b = domB(base)
  const color = recRed ? (dil ? 'ressari' : 'reskirmizi') : b === 'BA' ? (dil ? 'sari' : 'kirmizi') : b === 'b' ? (dil ? 'haki' : 'kahve') : spread ? (dil ? 'boz' : 'kara') : dil ? 'gumusi' : 'gok'
  const pc = g.pattern?.split('/') || ['+', '+']
  const carriers = []
  if (male && base.includes('+') && b !== '+') carriers.push('mavi')
  if (male && base.includes('b') && b !== 'b') carriers.push('kahve')
  if (male && g.dilute === 'D/d') carriers.push('seyreltme')
  if (g.recred === '+/e') carriers.push('reskirmizi')
  if (pc.includes('c') && domC(pc) !== 'c') carriers.push('cubuksuz')
  const pattern = { CT: 'koyupullu', C: 'pullu', '+': 'cubuklu', c: 'cubuksuz' }[domC(pc)]
  return { ...DEFAULT_PHENO, color, pattern, carriers }
}

// Kuşun en iyi bilinen renk bilgisi: kayıtlı renk genetiği > eski genotip > renk yazısı
export function phenoOfBird(p) {
  if (!p) return null
  if (p.colorGenetics) return { ...DEFAULT_PHENO, ...p.colorGenetics }
  if (p.genotype) return phenoFromGenotype(p.genotype, p.sex)
  return phenoFromText(p.color || '')
}
