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

// ---------- Akrabalık katsayısı (Wright) ----------
// f(a,b): a ve b'den rastgele alınan iki genin soyca aynı olma olasılığı (kinship).
// Yavrunun akrabalık katsayısı F = f(baba, anne). Kayıtlı olmayan atalar akraba sayılmaz.
const MAX_DEPTH = 12

function parentsOf(id) {
  const p = get('pigeons', id)
  return p ? [p.fatherId || null, p.motherId || null] : [null, null]
}

function isAncestor(a, b, seen = new Set()) {
  for (const pid of parentsOf(b)) {
    if (!pid || seen.has(pid)) continue
    if (pid === a) return true
    seen.add(pid)
    if (isAncestor(a, pid, seen)) return true
  }
  return false
}

export function kinshipCoef(a, b, memo = new Map(), depth = 0) {
  if (!a || !b || depth > MAX_DEPTH) return 0
  const key = a < b ? `${a}|${b}` : `${b}|${a}`
  if (memo.has(key)) return memo.get(key)
  let v
  if (a === b) {
    const [s, d] = parentsOf(a)
    v = 0.5 * (1 + kinshipCoef(s, d, memo, depth + 1))
  } else {
    // Diğerinin atası olmayanı (daha genç olanı) açarak ilerle
    const [x, y] = isAncestor(a, b) ? [b, a] : [a, b]
    const [s, d] = parentsOf(x)
    v = 0.5 * (kinshipCoef(s, y, memo, depth + 1) + kinshipCoef(d, y, memo, depth + 1))
  }
  memo.set(key, v)
  return v
}

export function inbreedingOf(id) {
  const [s, d] = parentsOf(id)
  return kinshipCoef(s, d)
}

export function coiLabel(f) {
  const pct = f * 100
  if (pct === 0) return { text: '%0 — akrabalık yok', tone: 'ok' }
  const t = `%${pct.toLocaleString('tr-TR', { maximumFractionDigits: 2 })}`
  if (pct >= 12.5) return { text: `${t} — yakın akraba (kardeş/ebeveyn düzeyi), önerilmez`, tone: 'danger' }
  if (pct >= 6.25) return { text: `${t} — yüksek, dikkatli olun`, tone: 'warn' }
  if (pct >= 3) return { text: `${t} — hat yetiştirme düzeyi`, tone: 'info' }
  return { text: `${t} — düşük`, tone: 'ok' }
}

// Bir kuş için en uygun eş adayları (akrabalığı en düşükten yükseğe)
export function suggestMates(id) {
  const bird = get('pigeons', id)
  if (!bird) return []
  const want = bird.sex === 'E' ? 'D' : 'E'
  const memo = new Map()
  return list('pigeons')
    .filter((p) => p.status === 'aktif' && p.sex === want && p.id !== id)
    .map((p) => ({ pigeon: p, coi: kinshipCoef(id, p.id, memo), sameBreed: !!bird.breed && p.breed === bird.breed }))
    .sort((a, b) => a.coi - b.coi || b.sameBreed - a.sameBreed)
}
