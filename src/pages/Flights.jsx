import { Trophy } from 'lucide-react'
import { useMemo, useState } from 'react'
import { exportCSV, fmtDate, num, pigeonLabel, today } from '../lib/format'
import { flightStats, fmtDuration, lineStats } from '../lib/performance'
import { get, remove, save, useCollection } from '../lib/store'
import { Badge, confirmDel, Empty, ErrorText, Field, Modal, PageTitle, Tabs } from '../components/ui'
import { PigeonMulti } from './Health'

import { useList } from '../lib/config'

export function FlightForm({ initial, onClose }) {
  const WEATHER = useList('weather')
  const [f, setF] = useState(() => {
    const d = { date: today(), pigeonIds: [], hours: '', minutes: '', score: '', plays: '', weather: '', notes: '', ...initial }
    if (initial?.durationMin) {
      d.hours = Math.floor(initial.durationMin / 60) || ''
      d.minutes = initial.durationMin % 60 || ''
    }
    return d
  })
  const [err, setErr] = useState('')
  const set = (k) => (v) => setF((s) => ({ ...s, [k]: v?.target ? v.target.value : v }))
  const submit = (e) => {
    e.preventDefault()
    if (!f.pigeonIds.length) return setErr('En az bir kuş seçin.')
    const durationMin = (num(f.hours) || 0) * 60 + (num(f.minutes) || 0)
    if (!durationMin && !num(f.score)) return setErr('Uçuş süresi veya puan girin.')
    const { hours, minutes, ...rest } = f
    save('flights', { ...rest, durationMin: durationMin || '', score: num(f.score), plays: num(f.plays) })
    onClose()
  }
  return (
    <Modal
      title={f.id ? 'Uçuş kaydını düzenle' : 'Uçuş / oyun kaydı'}
      onClose={onClose}
      wide
      footer={
        <>
          <button className="btn ghost" onClick={onClose}>
            Vazgeç
          </button>
          <button className="btn primary" form="flight-form">
            Kaydet
          </button>
        </>
      }
    >
      <form id="flight-form" onSubmit={submit} className="form-grid">
        <ErrorText>{err}</ErrorText>
        <Field label="Tarih">
          <input type="date" value={f.date} onChange={set('date')} />
        </Field>
        <Field label="Hava">
          <input list="weather" value={f.weather} onChange={set('weather')} />
          <datalist id="weather">
            {WEATHER.map((w) => (
              <option key={w} value={w} />
            ))}
          </datalist>
        </Field>
        <Field label="Süre (saat)">
          <input type="number" min="0" max="24" value={f.hours} onChange={set('hours')} />
        </Field>
        <Field label="Süre (dakika)">
          <input type="number" min="0" max="59" value={f.minutes} onChange={set('minutes')} />
        </Field>
        <Field label="Oyun / uçuş puanı (1-10)">
          <select value={f.score} onChange={set('score')}>
            <option value="">—</option>
            {Array.from({ length: 10 }, (_, i) => 10 - i).map((n) => (
              <option key={n}>{n}</option>
            ))}
          </select>
        </Field>
        <Field label="Takla / oyun sayısı">
          <input inputMode="numeric" value={f.plays} onChange={set('plays')} />
        </Field>
        <div className="full">
          <span className="field-label">Uçan kuşlar *</span>
          <PigeonMulti value={f.pigeonIds} onChange={set('pigeonIds')} />
        </div>
        <Field label="Notlar (oyun kalitesi, dönüş, derinlik…)" full>
          <textarea rows={2} value={f.notes} onChange={set('notes')} />
        </Field>
      </form>
    </Modal>
  )
}

export function PigeonFlights({ pigeonId }) {
  const flights = useCollection('flights')
  const [edit, setEdit] = useState(null)
  const mine = flights.filter((f) => f.pigeonIds?.includes(pigeonId)).sort((a, b) => (b.date || '').localeCompare(a.date || ''))
  const s = flightStats(mine).get(pigeonId)
  return (
    <>
      <button className="btn small primary no-print" onClick={() => setEdit({ pigeonIds: [pigeonId] })}>
        + Uçuş kaydı
      </button>
      {s && (
        <div className="stats">
          <div className="stat">
            <span className="stat-value">{s.count}</span>
            <span className="stat-label">Uçuş</span>
          </div>
          <div className="stat">
            <span className="stat-value">{s.avgScore != null ? s.avgScore.toFixed(1) : '—'}</span>
            <span className="stat-label">Ort. puan</span>
          </div>
          <div className="stat">
            <span className="stat-value">{fmtDuration(s.avgDur)}</span>
            <span className="stat-label">Ort. süre</span>
          </div>
          <div className="stat">
            <span className="stat-value">{fmtDuration(s.best || null)}</span>
            <span className="stat-label">En uzun</span>
          </div>
        </div>
      )}
      {mine.length ? (
        <div className="timeline">
          {mine.map((f) => (
            <div key={f.id} className="tl-item">
              <span className="tl-date">{fmtDate(f.date)}</span>
              <div className="grow">
                <strong>
                  {fmtDuration(f.durationMin || null)}
                  {f.score ? ` · ${f.score} puan` : ''}
                </strong>
                <div className="small muted">{[f.weather, f.plays && `${f.plays} oyun`, f.pigeonIds.length > 1 && `${f.pigeonIds.length} kuşla`].filter(Boolean).join(' · ')}</div>
                {f.notes && <div className="small">{f.notes}</div>}
              </div>
              <button className="btn tiny" onClick={() => setEdit(f)}>
                ✎
              </button>
            </div>
          ))}
        </div>
      ) : (
        <Empty icon="🕊️" title="Uçuş kaydı yok" />
      )}
      {edit && <FlightForm initial={edit} onClose={() => setEdit(null)} />}
    </>
  )
}

export default function Flights({ go }) {
  const flights = useCollection('flights')
  useCollection('pigeons')
  const [tab, setTab] = useState('kayit')
  const [edit, setEdit] = useState(null)
  const stats = useMemo(() => flightStats(flights), [flights])
  const rows = flights.slice().sort((a, b) => (b.date || '').localeCompare(a.date || ''))
  const ranking = [...stats.entries()]
    .map(([id, s]) => ({ id, ...s, p: get('pigeons', id) }))
    .filter((r) => r.p)
    .sort((a, b) => (b.avgScore ?? -1) - (a.avgScore ?? -1) || (b.avgDur ?? 0) - (a.avgDur ?? 0))

  return (
    <div className="page">
      <div className="page-head">
        <PageTitle icon={Trophy} title="Uçuş & Oyun" subtitle="Uçuş süresi, oyun puanı ve en iyi hatlar" />
        <div className="row gap-s">
          <button
            className="btn ghost small"
            onClick={() =>
              exportCSV(
                rows.map((f) => ({
                  Tarih: fmtDate(f.date),
                  Kuşlar: (f.pigeonIds || []).map((id) => get('pigeons', id)?.ring || '?').join(', '),
                  'Süre (dk)': f.durationMin,
                  Puan: f.score,
                  Oyun: f.plays,
                  Hava: f.weather,
                  Notlar: f.notes,
                })),
                `kuru-ucuslar-${today()}.csv`,
              )
            }
          >
            Excel
          </button>
          <button className="btn primary" onClick={() => setEdit({})}>
            + Uçuş
          </button>
        </div>
      </div>
      <Tabs value={tab} onChange={setTab} tabs={{ kayit: 'Kayıtlar', sira: 'Sıralama', hat: 'Hatlar' }} />

      {tab === 'kayit' &&
        (rows.length === 0 ? (
          <Empty icon="🕊️" title="Uçuş kaydı yok">
            Taklacı, dolapçı veya posta kuşlarınızın uçuş süresini ve oyun puanını kaydedin; en iyi kuşlar ve hatlar ortaya çıkar.
          </Empty>
        ) : (
          <div className="card-list">
            {rows.map((f) => (
              <div key={f.id} className="card">
                <div className="row between wrap gap-s">
                  <strong>
                    {fmtDate(f.date)} · {fmtDuration(f.durationMin || null)}
                  </strong>
                  {f.score ? <Badge tone={f.score >= 8 ? 'ok' : f.score >= 5 ? 'info' : 'warn'}>{f.score} puan</Badge> : null}
                </div>
                <div className="small">{(f.pigeonIds || []).map((id) => pigeonLabel(get('pigeons', id))).join(', ')}</div>
                <div className="small muted">{[f.weather, f.plays && `${f.plays} oyun`, f.notes].filter(Boolean).join(' · ')}</div>
                <div className="row gap-s">
                  <button className="btn small" onClick={() => setEdit(f)}>
                    Düzenle
                  </button>
                  <button className="btn small ghost danger-text" onClick={() => confirmDel(`${fmtDate(f.date)} uçuşu`) && remove('flights', f.id)}>
                    Sil
                  </button>
                </div>
              </div>
            ))}
          </div>
        ))}

      {tab === 'sira' &&
        (ranking.length === 0 ? (
          <Empty icon="🏆" title="Sıralama için uçuş kaydı gerekli" />
        ) : (
          <div className="card table-wrap">
            <table className="table">
              <thead>
                <tr>
                  <th>#</th>
                  <th>Kuş</th>
                  <th>Uçuş</th>
                  <th>Ort. puan</th>
                  <th>Ort. süre</th>
                  <th>En uzun</th>
                </tr>
              </thead>
              <tbody>
                {ranking.map((r, i) => (
                  <tr key={r.id} className="link-tr" onClick={() => go(`kus/${r.id}`)}>
                    <td>{i < 3 ? ['🥇', '🥈', '🥉'][i] : i + 1}</td>
                    <td>{pigeonLabel(r.p)}</td>
                    <td>{r.count}</td>
                    <td>{r.avgScore != null ? r.avgScore.toFixed(1) : '—'}</td>
                    <td>{fmtDuration(r.avgDur)}</td>
                    <td>{fmtDuration(r.best || null)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ))}

      {tab === 'hat' && (
        <div className="grid-2">
          {[
            ['fatherId', 'Baba hatları'],
            ['motherId', 'Anne hatları'],
          ].map(([side, title]) => {
            const lines = lineStats(stats, side)
            return (
              <div key={side} className="card">
                <h3>{title}</h3>
                <p className="tiny muted">Yavrularının ortalama uçuş puanına göre</p>
                {lines.length === 0 && <p className="small muted">Puanlı uçuşu olan yavru yok.</p>}
                {lines.map((l) => (
                  <button key={l.id} className="row between list-row link-row small" onClick={() => go(`kus/${l.id}`)}>
                    <span>{pigeonLabel(get('pigeons', l.id))}</span>
                    <span>
                      {l.avg.toFixed(1)} puan · {l.kids} yavru
                    </span>
                  </button>
                ))}
              </div>
            )
          })}
        </div>
      )}
      {edit && <FlightForm initial={edit} onClose={() => setEdit(null)} />}
    </div>
  )
}
