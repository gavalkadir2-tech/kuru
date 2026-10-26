// Uçuş/oyun performansı istatistikleri
import { list } from './store'

export function flightStats(flights = list('flights')) {
  const by = new Map()
  for (const f of flights) {
    for (const id of f.pigeonIds || []) {
      const s = by.get(id) || { count: 0, scoreSum: 0, scored: 0, durSum: 0, timed: 0, best: 0, plays: 0, last: '' }
      s.count++
      if (+f.score) {
        s.scoreSum += +f.score
        s.scored++
      }
      if (+f.durationMin) {
        s.durSum += +f.durationMin
        s.timed++
        s.best = Math.max(s.best, +f.durationMin)
      }
      s.plays += +f.plays || 0
      if ((f.date || '') > s.last) s.last = f.date
      by.set(id, s)
    }
  }
  for (const s of by.values()) {
    s.avgScore = s.scored ? s.scoreSum / s.scored : null
    s.avgDur = s.timed ? s.durSum / s.timed : null
  }
  return by
}

// Ebeveyn hattı: bir babanın/annenin yavrularının ortalama puanı
export function lineStats(stats, side = 'fatherId') {
  const pigeons = list('pigeons')
  const lines = new Map()
  for (const p of pigeons) {
    const parent = p[side]
    const s = stats.get(p.id)
    if (!parent || !s || s.avgScore == null) continue
    const l = lines.get(parent) || { kids: 0, sum: 0, flights: 0 }
    l.kids++
    l.sum += s.avgScore
    l.flights += s.count
    lines.set(parent, l)
  }
  return [...lines.entries()]
    .map(([id, l]) => ({ id, kids: l.kids, avg: l.sum / l.kids, flights: l.flights }))
    .sort((a, b) => b.avg - a.avg)
}

export function fmtDuration(min) {
  if (min == null || min === '' || isNaN(min)) return '—'
  const h = Math.floor(min / 60)
  const m = Math.round(min % 60)
  return h ? `${h} sa ${m} dk` : `${m} dk`
}
