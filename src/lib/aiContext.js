// Yapay zekaya gönderilen, programdaki verilerin derli toplu özeti.
// Kimlikler (id) gönderilir ki yapay zeka önerdiği kayıtları doğru kuşa/çifte bağlayabilsin.
import { getTimings } from './config'
import { SEX, STATUS } from './constants'
import { addDays, daysBetween, today } from './format'
import { inbreedingOf, kinshipCoef } from './pedigree'
import { flightStats } from './performance'
import { stockLevels } from './stock'
import { get, getSettings, list } from './store'

const ring = (id) => get('pigeons', id)?.ring
const age = (birth) => (birth ? daysBetween(birth, today()) : undefined)
const pct = (v) => Math.round(v * 1000) / 10
const compact = (o) => Object.fromEntries(Object.entries(o).filter(([, v]) => v !== undefined && v !== '' && v !== null && !(Array.isArray(v) && !v.length)))

function birdRow(p, fs, lastWeight) {
  return compact({
    id: p.id,
    ring: p.ring,
    name: p.name,
    sex: SEX[p.sex],
    status: p.status !== 'aktif' ? STATUS[p.status] : undefined,
    breed: p.breed,
    color: p.color,
    group: p.group,
    ageDays: age(p.birthDate),
    father: ring(p.fatherId) || p.fatherText,
    mother: ring(p.motherId) || p.motherText,
    foster: p.fosterPairId ? pairName(get('pairs', p.fosterPairId)) : undefined,
    coi: p.fatherId && p.motherId ? pct(inbreedingOf(p.id)) : undefined,
    flights: fs ? `${fs.count} uçuş, ort. puan ${fs.avgScore?.toFixed(1) ?? '-'}, ort. ${fs.avgDur ? Math.round(fs.avgDur) + ' dk' : '-'}` : undefined,
    weight: lastWeight ? `${lastWeight.gram} g (${lastWeight.date})` : undefined,
    traits: p.traits,
    notes: p.notes,
  })
}

export function pairName(pr) {
  if (!pr) return undefined
  return `${ring(pr.maleId) || '?'} × ${ring(pr.femaleId) || '?'}${pr.nest ? ` (yuva ${pr.nest})` : ''}`
}

function lastWeights() {
  const m = new Map()
  for (const w of list('weights')) if (!m.has(w.pigeonId) || w.date > m.get(w.pigeonId).date) m.set(w.pigeonId, w)
  return m
}

// Tüm güvercinlik: sohbet ve günlük özet için
export function flockContext({ includeInactive = false } = {}) {
  const t = today()
  const tm = getTimings()
  const fs = flightStats()
  const lw = lastWeights()
  const pigeons = list('pigeons').filter((p) => includeInactive || p.status === 'aktif')
  const clutches = list('clutches').filter((c) => !c.closed)
  const recentHealth = list('health')
    .filter((h) => h.date && daysBetween(h.date, t) <= 120)
    .sort((a, b) => b.date.localeCompare(a.date))
  return compact({
    today: t,
    loft: getSettings().loftName,
    productionDays: tm,
    counts: {
      activeBirds: pigeons.length,
      males: pigeons.filter((p) => p.sex === 'E').length,
      females: pigeons.filter((p) => p.sex === 'D').length,
      soldThisYear: list('pigeons').filter((p) => p.status === 'satildi' && (p.toDate || '').startsWith(t.slice(0, 4))).length,
    },
    birds: pigeons.slice(0, 500).map((p) => birdRow(p, fs.get(p.id), lw.get(p.id))),
    pairs: list('pairs')
      .filter((p) => p.active !== false)
      .map((p) => compact({ id: p.id, pair: pairName(p), type: p.type, season: p.season, foster: p.foster || undefined, targetColor: p.targetColor, offspringCoi: pct(kinshipCoef(p.maleId, p.femaleId)) })),
    clutches: clutches.map((c) => {
      const start = c.egg2Date || c.egg1Date
      return compact({
        pairId: c.pairId,
        pair: pairName(get('pairs', c.pairId)),
        egg1: c.egg1Date,
        egg2: c.egg2Date,
        eggs: c.eggs,
        fertile: c.fertile,
        expectedHatch: start && !c.hatchDate ? addDays(start, tm.incubationDays) : undefined,
        hatched: c.hatchDate ? `${c.hatched || 0} yavru, ${c.hatchDate}` : undefined,
        failed: c.failed || undefined,
        fosterAt: c.fosterPairId ? pairName(get('pairs', c.fosterPairId)) : undefined,
      })
    }),
    health: recentHealth.slice(0, 40).map((h) =>
      compact({
        date: h.date,
        what: h.medicine || h.diagnosis,
        dose: h.dose,
        diagnosis: h.medicine ? h.diagnosis : undefined,
        who: h.scope === 'all' ? 'tüm sürü' : (h.pigeonIds || []).map(ring).join(', '),
        next: h.nextDate,
      }),
    ),
    lowStock: stockLevels()
      .filter((l) => l.low)
      .map((l) => `${l.item.name}: ${Math.round(l.qty * 100) / 100} ${l.item.unit}`),
    stock: list('stock').map((s) => compact({ id: s.id, name: s.name, unit: s.unit })),
    rations: list('rations').map((r) => ({ id: r.id, name: r.name })),
    recentNotes: list('notes')
      .slice(0, 10)
      .map((n) => `${n.date}: ${n.text}`),
  })
}

// Tek kuş: ayrıntılı değerlendirme için
export function birdContext(id) {
  const p = get('pigeons', id)
  if (!p) return null
  const fs = flightStats()
  const lw = lastWeights()
  const anc = (pid, depth) => {
    const a = pid && get('pigeons', pid)
    if (!a) return undefined
    return compact({ ...birdRow(a, fs.get(a.id), lw.get(a.id)), id: undefined, father: depth > 1 ? anc(a.fatherId, depth - 1) || a.fatherText : undefined, mother: depth > 1 ? anc(a.motherId, depth - 1) || a.motherText : undefined })
  }
  const kids = list('pigeons').filter((k) => k.fatherId === id || k.motherId === id)
  return compact({
    today: today(),
    bird: { ...birdRow(p, fs.get(id), lw.get(id)), origin: p.origin, fromName: p.fromName, genotype: p.genotype },
    pedigree: { father: anc(p.fatherId, 3) || p.fatherText, mother: anc(p.motherId, 3) || p.motherText },
    offspring: kids.map((k) => birdRow(k, fs.get(k.id), lw.get(k.id))),
    pairs: list('pairs')
      .filter((pr) => pr.maleId === id || pr.femaleId === id)
      .map((pr) => {
        const cl = list('clutches').filter((c) => c.pairId === pr.id)
        return compact({ pair: pairName(pr), active: pr.active !== false, clutches: cl.length, eggs: cl.reduce((t, c) => t + (+c.eggs || 0), 0), hatched: cl.reduce((t, c) => t + (+c.hatched || 0), 0) })
      }),
    health: list('health')
      .filter((h) => h.scope === 'all' || h.pigeonIds?.includes(id))
      .slice(0, 30)
      .map((h) => compact({ date: h.date, what: h.medicine || h.diagnosis, diagnosis: h.diagnosis, notes: h.notes })),
    weights: list('weights')
      .filter((w) => w.pigeonId === id)
      .sort((a, b) => a.date.localeCompare(b.date))
      .map((w) => `${w.date}: ${w.gram} g`),
    flights: list('flights')
      .filter((f) => f.pigeonIds?.includes(id))
      .slice(0, 30)
      .map((f) => compact({ date: f.date, min: f.durationMin, score: f.score, plays: f.plays, weather: f.weather, notes: f.notes })),
  })
}

// Eşleştirme danışmanı: olası tüm aktif erkek × dişi kombinasyonları (akrabalığı düşük olanlar önce)
export function matingContext({ maxCandidates = 60 } = {}) {
  const fs = flightStats()
  const birds = list('pigeons').filter((p) => p.status === 'aktif')
  const males = birds.filter((p) => p.sex === 'E')
  const females = birds.filter((p) => p.sex === 'D')
  const memo = new Map()
  const combos = []
  for (const m of males)
    for (const f of females) {
      const coi = kinshipCoef(m.id, f.id, memo)
      combos.push({ maleId: m.id, femaleId: f.id, male: m.ring, female: f.ring, offspringCoi: pct(coi), sameBreed: !!m.breed && m.breed === f.breed })
    }
  combos.sort((a, b) => a.offspringCoi - b.offspringCoi)
  return {
    ...flockContext(),
    candidatePairs: combos.slice(0, maxCandidates),
    breedersWithFlightStats: birds
      .filter((p) => fs.get(p.id))
      .map((p) => ({ ring: p.ring, ...fs.get(p.id), avgScore: fs.get(p.id).avgScore?.toFixed(1) })),
  }
}
