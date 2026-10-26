import { useMemo, useState } from 'react'
import { INCUBATION_DAYS, RING_DAY, WEAN_DAY } from '../lib/constants'
import { addDays, daysBetween, exportCSV, fmtDate, pigeonLabel, today } from '../lib/format'
import { kinship } from '../lib/pedigree'
import { get, remove, save, useCollection } from '../lib/store'
import { Badge, Empty, ErrorText, Field, Modal, PigeonSelect, Tabs, confirmDel } from '../components/ui'
import { PigeonForm } from './Pigeons'

export function pairLabel(pr) {
  if (!pr) return '—'
  const m = get('pigeons', pr.maleId)
  const f = get('pigeons', pr.femaleId)
  return `${m?.ring || '?'} × ${f?.ring || '?'}${pr.nest ? ` (Yuva ${pr.nest})` : ''}`
}

export function clutchDates(c) {
  const start = c.egg2Date || c.egg1Date
  const expectedHatch = start ? addDays(start, INCUBATION_DAYS) : ''
  const hatch = c.hatchDate || ''
  const base = hatch || expectedHatch
  return {
    expectedHatch,
    ringDate: base ? addDays(base, RING_DAY) : '',
    weanDate: base ? addDays(base, WEAN_DAY) : '',
    candleDate: start ? addDays(start, 7) : '',
  }
}

export function clutchStatus(c) {
  const d = clutchDates(c)
  const t = today()
  if (c.closed) return { text: 'Tamamlandı', tone: 'neutral' }
  if (c.failed) return { text: 'Bozuldu', tone: 'danger' }
  if (c.hatchDate) {
    const age = daysBetween(c.hatchDate, t)
    if (age >= WEAN_DAY) return { text: `Yavru ${age} günlük · ayrılabilir`, tone: 'info' }
    return { text: `Yavrulu · ${age}. gün`, tone: 'ok' }
  }
  if (!c.egg1Date) return { text: 'Yumurta bekleniyor', tone: 'neutral' }
  const day = daysBetween(c.egg2Date || c.egg1Date, t)
  if (day > INCUBATION_DAYS + 3) return { text: `Çıkış gecikti (${day}. gün)`, tone: 'danger' }
  if (day >= INCUBATION_DAYS - 1) return { text: `Çıkış zamanı (${fmtDate(d.expectedHatch)})`, tone: 'warn' }
  return { text: `Kuluçkada · ${Math.max(0, day)}/${INCUBATION_DAYS}. gün`, tone: 'info' }
}

function PairForm({ initial, onClose }) {
  const [f, setF] = useState({ maleId: '', femaleId: '', startDate: today(), nest: '', active: true, notes: '', ...initial })
  const [err, setErr] = useState('')
  const set = (k) => (v) => setF((s) => ({ ...s, [k]: v?.target ? (v.target.type === 'checkbox' ? v.target.checked : v.target.value) : v }))
  const kin = kinship(f.maleId, f.femaleId)
  const submit = (e) => {
    e.preventDefault()
    if (!f.maleId || !f.femaleId) return setErr('Erkek ve dişi seçiniz.')
    save('pairs', f)
    onClose()
  }
  return (
    <Modal
      title={f.id ? 'Çifti düzenle' : 'Yeni eşleştirme'}
      onClose={onClose}
      footer={
        <>
          <button className="btn ghost" onClick={onClose}>
            Vazgeç
          </button>
          <button className="btn primary" form="pair-form">
            Kaydet
          </button>
        </>
      }
    >
      <form id="pair-form" onSubmit={submit} className="form-grid">
        <ErrorText>{err}</ErrorText>
        <Field label="Erkek *">
          <PigeonSelect value={f.maleId} onChange={set('maleId')} sex="E" includeInactive={false} />
        </Field>
        <Field label="Dişi *">
          <PigeonSelect value={f.femaleId} onChange={set('femaleId')} sex="D" includeInactive={false} />
        </Field>
        {kin && <div className={'alert full ' + (kin.type === 'direct' || kin.closest <= 1 ? 'error' : 'warn')}>⚠️ {kin.text}</div>}
        <Field label="Eşleştirme tarihi">
          <input type="date" value={f.startDate} onChange={set('startDate')} />
        </Field>
        <Field label="Yuva / Göz no">
          <input value={f.nest} onChange={set('nest')} />
        </Field>
        <label className="check full">
          <input type="checkbox" checked={f.active !== false} onChange={set('active')} /> Çift aktif
        </label>
        <Field label="Notlar" full>
          <textarea rows={2} value={f.notes} onChange={set('notes')} />
        </Field>
      </form>
    </Modal>
  )
}

function ClutchForm({ initial, onClose }) {
  const pairs = useCollection('pairs')
  const [f, setF] = useState({
    pairId: '',
    egg1Date: today(),
    egg2Date: '',
    eggs: 2,
    fertile: '',
    hatchDate: '',
    hatched: '',
    failed: false,
    closed: false,
    notes: '',
    ...initial,
  })
  const [err, setErr] = useState('')
  const set = (k) => (v) => setF((s) => ({ ...s, [k]: v?.target ? (v.target.type === 'checkbox' ? v.target.checked : v.target.value) : v }))
  const d = clutchDates(f)
  const submit = (e) => {
    e.preventDefault()
    if (!f.pairId) return setErr('Çift seçiniz.')
    if (f.egg2Date && f.egg1Date && f.egg2Date < f.egg1Date) return setErr('2. yumurta tarihi 1. yumurtadan önce olamaz.')
    if (f.hatchDate && f.egg1Date && f.hatchDate < f.egg1Date) return setErr('Çıkış tarihi yumurtlamadan önce olamaz.')
    if (+f.hatched > +f.eggs) return setErr('Çıkan yavru sayısı yumurta sayısından fazla olamaz.')
    save('clutches', f)
    onClose()
  }
  return (
    <Modal
      title={f.id ? 'Kuluçkayı düzenle' : 'Yeni yumurtlama'}
      onClose={onClose}
      footer={
        <>
          <button className="btn ghost" onClick={onClose}>
            Vazgeç
          </button>
          <button className="btn primary" form="clutch-form">
            Kaydet
          </button>
        </>
      }
    >
      <form id="clutch-form" onSubmit={submit} className="form-grid">
        <ErrorText>{err}</ErrorText>
        <Field label="Çift *" full>
          <select value={f.pairId} onChange={set('pairId')}>
            <option value="">Seçiniz</option>
            {pairs
              .filter((p) => p.active !== false || p.id === f.pairId)
              .map((p) => (
                <option key={p.id} value={p.id}>
                  {pairLabel(p)}
                </option>
              ))}
          </select>
        </Field>
        <Field label="1. yumurta">
          <input type="date" value={f.egg1Date} onChange={set('egg1Date')} />
        </Field>
        <Field label="2. yumurta" hint="Genelde 44-48 saat sonra">
          <input type="date" value={f.egg2Date} onChange={set('egg2Date')} />
        </Field>
        <Field label="Yumurta sayısı">
          <input type="number" min="0" max="3" value={f.eggs} onChange={set('eggs')} />
        </Field>
        <Field label="Döllü yumurta" hint={d.candleDate ? `Işık kontrolü: ${fmtDate(d.candleDate)}` : ''}>
          <input type="number" min="0" max="3" value={f.fertile} onChange={set('fertile')} />
        </Field>
        <div className="alert info full">
          Tahmini çıkış: <strong>{fmtDate(d.expectedHatch)}</strong> · Halkalama: <strong>{fmtDate(d.ringDate)}</strong> · Ayırma:{' '}
          <strong>{fmtDate(d.weanDate)}</strong>
        </div>
        <Field label="Çıkış tarihi">
          <input type="date" value={f.hatchDate} onChange={set('hatchDate')} />
        </Field>
        <Field label="Çıkan yavru">
          <input type="number" min="0" max="3" value={f.hatched} onChange={set('hatched')} />
        </Field>
        <label className="check">
          <input type="checkbox" checked={!!f.failed} onChange={set('failed')} /> Kuluçka bozuldu
        </label>
        <label className="check">
          <input type="checkbox" checked={!!f.closed} onChange={set('closed')} /> Tamamlandı (arşivle)
        </label>
        <Field label="Notlar" full>
          <textarea rows={2} value={f.notes} onChange={set('notes')} />
        </Field>
      </form>
    </Modal>
  )
}

export default function Breeding({ go }) {
  const pairs = useCollection('pairs')
  const clutches = useCollection('clutches')
  const pigeons = useCollection('pigeons')
  const [tab, setTab] = useState('kulucka')
  const [pairEdit, setPairEdit] = useState(null)
  const [clutchEdit, setClutchEdit] = useState(null)
  const [newChick, setNewChick] = useState(null)
  const [showClosed, setShowClosed] = useState(false)

  const pairStats = useMemo(() => {
    const m = {}
    for (const c of clutches) {
      m[c.pairId] ||= { clutches: 0, eggs: 0, hatched: 0 }
      m[c.pairId].clutches++
      m[c.pairId].eggs += +c.eggs || 0
      m[c.pairId].hatched += +c.hatched || 0
    }
    return m
  }, [clutches])

  const visibleClutches = clutches
    .filter((c) => showClosed || !c.closed)
    .slice()
    .sort((a, b) => (b.egg1Date || '').localeCompare(a.egg1Date || ''))

  const chicksOf = (c) => pigeons.filter((p) => p.clutchId === c.id)

  const registerChick = (c) => {
    const pr = get('pairs', c.pairId)
    setNewChick({ fatherId: pr?.maleId, motherId: pr?.femaleId, birthDate: c.hatchDate || today(), origin: 'uretim', clutchId: c.id })
  }

  const exportRows = () =>
    exportCSV(
      clutches.map((c) => {
        const d = clutchDates(c)
        return {
          Çift: pairLabel(get('pairs', c.pairId)),
          '1. Yumurta': fmtDate(c.egg1Date),
          '2. Yumurta': fmtDate(c.egg2Date),
          Yumurta: c.eggs,
          Döllü: c.fertile,
          'Tahmini Çıkış': fmtDate(d.expectedHatch),
          'Çıkış': fmtDate(c.hatchDate),
          'Çıkan Yavru': c.hatched,
          Durum: clutchStatus(c).text,
          Notlar: c.notes,
        }
      }),
      `kuru-uretim-${today()}.csv`,
    )

  return (
    <div className="page">
      <div className="page-head">
        <h1>Üretim</h1>
        <div className="row gap-s">
          <button className="btn ghost small" onClick={exportRows}>
            Excel
          </button>
          {tab === 'kulucka' ? (
            <button className="btn primary" onClick={() => (pairs.length ? setClutchEdit({}) : alert('Önce bir çift oluşturun.'))}>
              + Yumurtlama
            </button>
          ) : (
            <button className="btn primary" onClick={() => setPairEdit({})}>
              + Çift
            </button>
          )}
        </div>
      </div>
      <Tabs value={tab} onChange={setTab} tabs={{ kulucka: 'Yumurtlama & Kuluçka', ciftler: `Çiftler (${pairs.length})` }} />

      {tab === 'kulucka' && (
        <>
          <label className="check small">
            <input type="checkbox" checked={showClosed} onChange={(e) => setShowClosed(e.target.checked)} /> Tamamlananları göster
          </label>
          {visibleClutches.length === 0 ? (
            <Empty icon="🥚" title="Aktif kuluçka yok">
              Çift oluşturup yumurtlama kaydı ekleyin; çıkış, halkalama ve ayırma tarihleri otomatik hesaplanır.
            </Empty>
          ) : (
            <div className="card-list">
              {visibleClutches.map((c) => {
                const st = clutchStatus(c)
                const d = clutchDates(c)
                const chicks = chicksOf(c)
                return (
                  <div key={c.id} className="card clutch">
                    <div className="row between wrap gap-s">
                      <strong>{pairLabel(get('pairs', c.pairId))}</strong>
                      <Badge tone={st.tone}>{st.text}</Badge>
                    </div>
                    <div className="clutch-grid">
                      <div>
                        <span>1. yumurta</span>
                        {fmtDate(c.egg1Date)}
                      </div>
                      <div>
                        <span>2. yumurta</span>
                        {fmtDate(c.egg2Date)}
                      </div>
                      <div>
                        <span>Tahmini çıkış</span>
                        {fmtDate(d.expectedHatch)}
                      </div>
                      <div>
                        <span>Halkalama</span>
                        {fmtDate(d.ringDate)}
                      </div>
                      <div>
                        <span>Yumurta / Döllü / Çıkan</span>
                        {c.eggs || 0} / {c.fertile || '—'} / {c.hatched || '—'}
                      </div>
                      <div>
                        <span>Kayıtlı yavru</span>
                        {chicks.length ? chicks.map((k) => k.ring).join(', ') : '—'}
                      </div>
                    </div>
                    {c.notes && <p className="small muted">{c.notes}</p>}
                    <div className="row gap-s wrap">
                      <button className="btn small" onClick={() => setClutchEdit(c)}>
                        Düzenle
                      </button>
                      {!c.hatchDate && !c.failed && (
                        <button className="btn small" onClick={() => save('clutches', { ...c, hatchDate: today(), hatched: c.hatched || c.fertile || c.eggs })}>
                          Bugün çıktı
                        </button>
                      )}
                      {c.hatchDate && chicks.length < (+c.hatched || 0) && (
                        <button className="btn small primary" onClick={() => registerChick(c)}>
                          Yavruyu halkala / kaydet
                        </button>
                      )}
                      <button
                        className="btn small ghost danger-text"
                        onClick={() => confirmDel(`${pairLabel(get('pairs', c.pairId))} kuluçkası`) && remove('clutches', c.id)}
                      >
                        Sil
                      </button>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </>
      )}

      {tab === 'ciftler' &&
        (pairs.length === 0 ? (
          <Empty icon="💞" title="Henüz çift yok" />
        ) : (
          <div className="card-list">
            {pairs.map((pr) => {
              const s = pairStats[pr.id] || { clutches: 0, eggs: 0, hatched: 0 }
              const rate = s.eggs ? Math.round((s.hatched / s.eggs) * 100) : null
              const kin = kinship(pr.maleId, pr.femaleId)
              return (
                <div key={pr.id} className="card">
                  <div className="row between wrap gap-s">
                    <strong>{pairLabel(pr)}</strong>
                    <Badge tone={pr.active !== false ? 'ok' : 'neutral'}>{pr.active !== false ? 'Aktif' : 'Ayrıldı'}</Badge>
                  </div>
                  <div className="small muted">
                    ♂ {pigeonLabel(get('pigeons', pr.maleId))} · ♀ {pigeonLabel(get('pigeons', pr.femaleId))}
                  </div>
                  <div className="small">
                    {fmtDate(pr.startDate)} · {s.clutches} kuluçka · {s.eggs} yumurta · {s.hatched} yavru
                    {rate != null && ` · Verim %${rate}`}
                  </div>
                  {kin && <div className="small warn-text">⚠️ {kin.text}</div>}
                  <div className="row gap-s">
                    <button className="btn small" onClick={() => setPairEdit(pr)}>
                      Düzenle
                    </button>
                    <button className="btn small" onClick={() => setClutchEdit({ pairId: pr.id })}>
                      + Yumurtlama
                    </button>
                    <button className="btn small ghost danger-text" onClick={() => confirmDel(pairLabel(pr)) && remove('pairs', pr.id)}>
                      Sil
                    </button>
                  </div>
                </div>
              )
            })}
          </div>
        ))}

      {pairEdit && <PairForm initial={pairEdit} onClose={() => setPairEdit(null)} />}
      {clutchEdit && <ClutchForm initial={clutchEdit} onClose={() => setClutchEdit(null)} />}
      {newChick && <PigeonForm initial={newChick} onClose={() => setNewChick(null)} onSaved={(r) => go(`kus/${r.id}`)} />}
    </div>
  )
}
