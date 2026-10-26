import { Egg } from 'lucide-react'
import { useMemo, useState } from 'react'
import { STATUS } from '../lib/constants'
import { getTimings, useList, useTimings } from '../lib/config'
import { addDays, daysBetween, exportCSV, fmtDate, money, pigeonLabel, today } from '../lib/format'
import { flightStats } from '../lib/performance'
import { coiLabel, kinship, kinshipCoef, suggestMates } from '../lib/pedigree'
import { get, list, remove, save, useCollection } from '../lib/store'
import { Badge, confirmDel, Empty, ErrorText, Field, Modal, PageTitle, PigeonSelect, Stat, Tabs } from '../components/ui'
import { PigeonForm } from './Pigeons'
import ColorGenetics from './ColorGenetics'

export function pairLabel(pr) {
  if (!pr) return '—'
  const m = get('pigeons', pr.maleId)
  const f = get('pigeons', pr.femaleId)
  return `${m?.ring || '?'} × ${f?.ring || '?'}${pr.nest ? ` (Yuva ${pr.nest})` : ''}`
}

// Bakıcı bilgisi metni (kuluçka kartı, ana sayfa)
export function fosterText(c) {
  if (!c?.fosterPairId) return ''
  return `Bakıcı: ${pairLabel(get('pairs', c.fosterPairId))}${c.fosterDate ? ` · ${fmtDate(c.fosterDate)}` : ''}`
}

export function clutchDates(c) {
  const { incubationDays: INCUBATION_DAYS, ringDay: RING_DAY, weanDay: WEAN_DAY, candleDay } = getTimings()
  const start = c.egg2Date || c.egg1Date
  const expectedHatch = start ? addDays(start, INCUBATION_DAYS) : ''
  const hatch = c.hatchDate || ''
  const base = hatch || expectedHatch
  return {
    expectedHatch,
    ringDate: base ? addDays(base, RING_DAY) : '',
    weanDate: base ? addDays(base, WEAN_DAY) : '',
    candleDate: start ? addDays(start, candleDay) : '',
  }
}

export function clutchStatus(c) {
  const { incubationDays: INCUBATION_DAYS, weanDay: WEAN_DAY } = getTimings()
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
  const coi = f.maleId && f.femaleId ? coiLabel(kinshipCoef(f.maleId, f.femaleId)) : null
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
        {coi && (
          <div className={'alert full ' + (coi.tone === 'danger' ? 'error' : coi.tone === 'ok' ? 'info' : coi.tone)}>
            Yavrunun akrabalık katsayısı: <strong>{coi.text}</strong>
          </div>
        )}
        <Field label="Eşleştirme tarihi">
          <input type="date" value={f.startDate} onChange={set('startDate')} />
        </Field>
        <Field label="Yuva / Göz no">
          <input value={f.nest} onChange={set('nest')} />
        </Field>
        <label className="check full">
          <input type="checkbox" checked={f.active !== false} onChange={set('active')} /> Çift aktif
        </label>
        <label className="check full">
          <input type="checkbox" checked={!!f.foster} onChange={set('foster')} /> Bakıcı çift (başka çiftlerin yumurtalarını kuluçkaya yatırır, yavrularını besler)
        </label>
        <Field label="Notlar" full>
          <textarea rows={2} value={f.notes} onChange={set('notes')} />
        </Field>
      </form>
    </Modal>
  )
}

// Yumurtaların bakıcı çifte aktarılması
function FosterForm({ clutch, onClose }) {
  const pairs = useCollection('pairs')
  const [f, setF] = useState({
    fosterPairId: clutch.fosterPairId || '',
    fosterDate: clutch.fosterDate || clutch.egg2Date || clutch.egg1Date || today(),
    fosterEggs: clutch.fosterEggs || clutch.eggs || '',
  })
  const [err, setErr] = useState('')
  const set = (k) => (e) => setF((s) => ({ ...s, [k]: e.target.value }))
  const options = pairs
    .filter((p) => p.id !== clutch.pairId && (p.active !== false || p.id === f.fosterPairId))
    .sort((a, b) => !!b.foster - !!a.foster)
  const submit = (e) => {
    e.preventDefault()
    if (!f.fosterPairId) return setErr('Bakıcı çifti seçin.')
    if (clutch.egg1Date && f.fosterDate < clutch.egg1Date) return setErr('Aktarma tarihi yumurtlamadan önce olamaz.')
    if (+f.fosterEggs > (+clutch.eggs || 3)) return setErr('Aktarılan yumurta, yumurta sayısından fazla olamaz.')
    save('clutches', { ...clutch, fosterPairId: f.fosterPairId, fosterDate: f.fosterDate, fosterEggs: f.fosterEggs })
    // Bu kuluçkadan önceden kaydedilmiş yavrulara da bakıcıyı yaz
    for (const p of list('pigeons').filter((p) => p.clutchId === clutch.id && !p.fosterPairId)) save('pigeons', { ...p, fosterPairId: f.fosterPairId })
    onClose()
  }
  const clear = () => {
    save('clutches', { ...clutch, fosterPairId: '', fosterDate: '', fosterEggs: '' })
    onClose()
  }
  return (
    <Modal
      title="🔄 Bakıcıya aktar"
      onClose={onClose}
      footer={
        <>
          {clutch.fosterPairId && (
            <button className="btn ghost danger-text" onClick={clear}>
              Aktarmayı kaldır
            </button>
          )}
          <button className="btn ghost" onClick={onClose}>
            Vazgeç
          </button>
          <button className="btn primary" form="foster-form">
            Kaydet
          </button>
        </>
      }
    >
      <form id="foster-form" onSubmit={submit} className="form-grid">
        <ErrorText>{err}</ErrorText>
        <p className="small muted full">
          Gerçek anne-baba: <strong>{pairLabel(get('pairs', clutch.pairId))}</strong>. Soy ağacında gerçek anne-baba kalır; bakıcı ayrıca kaydedilir.
        </p>
        <Field label="Bakıcı çift *" full>
          <select value={f.fosterPairId} onChange={set('fosterPairId')}>
            <option value="">Seçiniz</option>
            {options.map((p) => (
              <option key={p.id} value={p.id}>
                {pairLabel(p)}
                {p.foster ? ' — bakıcı' : ''}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Aktarma tarihi">
          <input type="date" value={f.fosterDate} onChange={set('fosterDate')} />
        </Field>
        <Field label="Aktarılan yumurta">
          <input type="number" min="1" max="3" value={f.fosterEggs} onChange={set('fosterEggs')} />
        </Field>
        {!options.length && <div className="alert warn full">Başka çift yok. Çiftler sekmesinden bakıcı çifti ekleyin ("Bakıcı çift" işaretiyle).</div>}
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

// Çift karnesi: üretim verimi, yavruların uçuş başarısı ve satış geliri
function pairReport(pr, clutches, pigeons, stats) {
  const cl = clutches.filter((c) => c.pairId === pr.id)
  const fostered = clutches.filter((c) => c.fosterPairId === pr.id)
  const eggs = cl.reduce((t, c) => t + (+c.eggs || 0), 0)
  const fertileKnown = cl.filter((c) => c.fertile !== '' && c.fertile != null)
  const fertile = fertileKnown.reduce((t, c) => t + (+c.fertile || 0), 0)
  const fertileEggs = fertileKnown.reduce((t, c) => t + (+c.eggs || 0), 0)
  const hatched = cl.reduce((t, c) => t + (+c.hatched || 0), 0)
  const kids = pigeons.filter((p) => p.fatherId === pr.maleId && p.motherId === pr.femaleId)
  const sold = kids.filter((k) => k.status === 'satildi')
  const scored = kids.map((k) => stats.get(k.id)).filter((s) => s?.avgScore != null)
  return {
    clutches: cl.length,
    failed: cl.filter((c) => c.failed).length,
    eggs,
    fertileRate: fertileEggs ? fertile / fertileEggs : null,
    hatchRate: eggs ? hatched / eggs : null,
    hatched,
    kids,
    alive: kids.filter((k) => k.status === 'aktif').length,
    sold: sold.length,
    revenue: sold.reduce((t, k) => t + (+k.toPrice || 0), 0),
    flightAvg: scored.length ? scored.reduce((t, s) => t + s.avgScore, 0) / scored.length : null,
    flown: scored.length,
    toFoster: cl.filter((c) => c.fosterPairId).length,
    fostered,
    fosteredEggs: fostered.reduce((t, c) => t + (+c.fosterEggs || +c.eggs || 0), 0),
    fosteredHatched: fostered.reduce((t, c) => t + (+c.hatched || 0), 0),
    fosterKids: pigeons.filter((p) => p.fosterPairId === pr.id),
  }
}
const pct = (v) => (v == null ? '—' : `%${Math.round(v * 100)}`)

function PairReport({ pr, onClose, go }) {
  const clutches = useCollection('clutches')
  const pigeons = useCollection('pigeons')
  const flights = useCollection('flights')
  const stats = useMemo(() => flightStats(flights), [flights])
  const r = pairReport(pr, clutches, pigeons, stats)
  const coi = coiLabel(kinshipCoef(pr.maleId, pr.femaleId))
  return (
    <Modal title={`Çift karnesi — ${pairLabel(pr)}`} onClose={onClose} wide>
      <div className="stats">
        <Stat label="Kuluçka" value={r.clutches} sub={r.failed ? `${r.failed} bozuldu` : ''} />
        <Stat label="Yumurta" value={r.eggs} sub={`Döllülük ${pct(r.fertileRate)}`} />
        <Stat label="Çıkan yavru" value={r.hatched} sub={`Çıkım ${pct(r.hatchRate)}`} />
        <Stat label="Kayıtlı yavru" value={r.kids.length} sub={`${r.alive} aktif`} />
        <Stat label="Yavru uçuş puanı" value={r.flightAvg != null ? r.flightAvg.toFixed(1) : '—'} sub={r.flown ? `${r.flown} yavrudan` : 'kayıt yok'} />
        <Stat label="Satış" value={r.sold} sub={money(r.revenue)} />
      </div>
      {(r.fostered.length > 0 || pr.foster) && (
        <>
          <h3>Bakıcı olarak</h3>
          <div className="stats">
            <Stat label="Baktığı kuluçka" value={r.fostered.length} />
            <Stat label="Aldığı yumurta" value={r.fosteredEggs} />
            <Stat label="Çıkardığı yavru" value={r.fosteredHatched} sub={`Başarı ${pct(r.fosteredEggs ? r.fosteredHatched / r.fosteredEggs : null)}`} />
            <Stat label="Büyüttüğü kayıtlı yavru" value={r.fosterKids.length} />
          </div>
          {r.fostered.map((c) => (
            <div key={c.id} className="row between list-row small">
              <span>
                {fmtDate(c.fosterDate)} · {pairLabel(get('pairs', c.pairId))} çiftinin yumurtası
              </span>
              <span>{c.hatchDate ? `${c.hatched || 0} yavru çıktı` : c.failed ? 'bozuldu' : 'kuluçkada'}</span>
            </div>
          ))}
        </>
      )}
      <p className="small">
        {r.toFoster > 0 && `${r.toFoster} kuluçkası bakıcıya verildi · `}
        Başlangıç: {fmtDate(pr.startDate)} · Yavru akrabalığı: <Badge tone={coi.tone}>{coi.text.split(' — ')[0]}</Badge>
      </p>
      <h3>Yavrular</h3>
      {r.kids.length === 0 ? (
        <p className="small muted">Bu çiftten kayıtlı yavru yok.</p>
      ) : (
        <div className="table-wrap">
          <table className="table">
            <thead>
              <tr>
                <th>Kuş</th>
                <th>Doğum</th>
                <th>Durum</th>
                <th>Bakıcı</th>
                <th>Uçuş puanı</th>
              </tr>
            </thead>
            <tbody>
              {r.kids.map((k) => (
                <tr key={k.id} className="link-tr" onClick={() => go(`kus/${k.id}`)}>
                  <td>{pigeonLabel(k)}</td>
                  <td>{fmtDate(k.birthDate)}</td>
                  <td>{STATUS[k.status]}</td>
                  <td>{k.fosterPairId ? pairLabel(get('pairs', k.fosterPairId)) : 'Kendisi'}</td>
                  <td>{stats.get(k.id)?.avgScore?.toFixed(1) ?? '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </Modal>
  )
}

function MateSuggest({ onPair }) {
  const pigeons = useCollection('pigeons')
  const pairs = useCollection('pairs')
  const [id, setId] = useState('')
  const bird = id ? get('pigeons', id) : null
  const rows = useMemo(() => (id ? suggestMates(id) : []), [id, pigeons])
  const paired = new Set(pairs.filter((p) => p.active !== false).flatMap((p) => [p.maleId, p.femaleId]))
  return (
    <>
      <div className="card">
        <Field label="Eş aranacak kuş">
          <PigeonSelect value={id} onChange={setId} includeInactive={false} placeholder="Kuş seçin" />
        </Field>
        <p className="small muted">
          Adaylar yavrunun akrabalık katsayısına göre en düşükten sıralanır. Katsayı, kayıtlı soy bilgisinden hesaplanır; kayıtsız atalar akraba sayılmaz.
        </p>
      </div>
      {bird && !['E', 'D'].includes(bird.sex) && <div className="alert warn">Cinsiyeti belirsiz kuş için öneri yapılamaz.</div>}
      {bird && ['E', 'D'].includes(bird.sex) && rows.length === 0 && <Empty title="Uygun aktif eş adayı yok" />}
      {rows.length > 0 && (
        <div className="card table-wrap">
          <table className="table">
            <thead>
              <tr>
                <th>Aday</th>
                <th>Irk</th>
                <th>Yavru akrabalığı</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {rows.map(({ pigeon: p, coi, sameBreed }) => {
                const c = coiLabel(coi)
                return (
                  <tr key={p.id}>
                    <td>
                      {pigeonLabel(p)}
                      {paired.has(p.id) && <span className="tiny muted"> · eşli</span>}
                    </td>
                    <td>
                      {p.breed || '—'} {sameBreed && '✓'}
                    </td>
                    <td>
                      <Badge tone={c.tone}>{c.text.split(' — ')[0]}</Badge>
                    </td>
                    <td>
                      <button className="btn tiny" onClick={() => (bird.sex === 'E' ? onPair(bird.id, p.id) : onPair(p.id, bird.id))}>
                        Eşleştir
                      </button>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}
    </>
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
  const [report, setReport] = useState(null)
  const [geneticsPair, setGeneticsPair] = useState(null)
  const [fosterOf, setFosterOf] = useState(null)

  const pairStats = useMemo(() => {
    const m = {}
    for (const c of clutches) {
      m[c.pairId] ||= { clutches: 0, eggs: 0, hatched: 0, fostered: 0, fosterHatched: 0 }
      m[c.pairId].clutches++
      m[c.pairId].eggs += +c.eggs || 0
      m[c.pairId].hatched += +c.hatched || 0
      if (c.fosterPairId) {
        m[c.fosterPairId] ||= { clutches: 0, eggs: 0, hatched: 0, fostered: 0, fosterHatched: 0 }
        m[c.fosterPairId].fostered++
        m[c.fosterPairId].fosterHatched += +c.hatched || 0
      }
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
    setNewChick({ fatherId: pr?.maleId, motherId: pr?.femaleId, birthDate: c.hatchDate || today(), origin: 'uretim', clutchId: c.id, fosterPairId: c.fosterPairId || '' })
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
          Bakıcı: c.fosterPairId ? pairLabel(get('pairs', c.fosterPairId)) : '',
          'Aktarma Tarihi': fmtDate(c.fosterDate),
          Durum: clutchStatus(c).text,
          Notlar: c.notes,
        }
      }),
      `kuru-uretim-${today()}.csv`,
    )

  return (
    <div className="page">
      <div className="page-head">
        <PageTitle icon={Egg} title="Üretim" subtitle="Eşleştirme, yumurtlama, kuluçka ve yavrular" />
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
      <Tabs value={tab} onChange={setTab} tabs={{ kulucka: 'Yumurtlama & Kuluçka', ciftler: `Çiftler (${pairs.length})`, oner: 'Eş Önerisi', renk: 'Renk Tahmini' }} />

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
                    {c.fosterPairId && <div className="alert info small">🔄 {fosterText(c)}{c.fosterEggs ? ` · ${c.fosterEggs} yumurta` : ''}</div>}
                    {c.notes && <p className="small muted">{c.notes}</p>}
                    <div className="row gap-s wrap">
                      <button className="btn small" onClick={() => setClutchEdit(c)}>
                        Düzenle
                      </button>
                      {!c.failed && (
                        <button className="btn small" onClick={() => setFosterOf(c)}>
                          🔄 {c.fosterPairId ? 'Bakıcıyı değiştir' : 'Bakıcıya aktar'}
                        </button>
                      )}
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
              const coi = coiLabel(kinshipCoef(pr.maleId, pr.femaleId))
              return (
                <div key={pr.id} className="card">
                  <div className="row between wrap gap-s">
                    <strong>{pairLabel(pr)}</strong>
                    <span className="row gap-s">
                      {pr.foster && <Badge tone="info">Bakıcı</Badge>}
                      <Badge tone={pr.active !== false ? 'ok' : 'neutral'}>{pr.active !== false ? 'Aktif' : 'Ayrıldı'}</Badge>
                    </span>
                  </div>
                  <div className="small muted">
                    ♂ {pigeonLabel(get('pigeons', pr.maleId))} · ♀ {pigeonLabel(get('pigeons', pr.femaleId))}
                  </div>
                  <div className="small">
                    {fmtDate(pr.startDate)} · {s.clutches} kuluçka · {s.eggs} yumurta · {s.hatched} yavru
                    {rate != null && ` · Verim %${rate}`}
                  </div>
                  {s.fostered > 0 && (
                    <div className="small">
                      🔄 Bakıcı olarak: {s.fostered} kuluçka, {s.fosterHatched} yavru çıkardı
                    </div>
                  )}
                  <div className="small">
                    Yavru akrabalığı: <Badge tone={coi.tone}>{coi.text.split(' — ')[0]}</Badge>
                  </div>
                  {kin && <div className="small warn-text">⚠️ {kin.text}</div>}
                  <div className="row gap-s">
                    <button className="btn small primary" onClick={() => setReport(pr)}>
                      📋 Karne
                    </button>
                    <button
                      className="btn small"
                      onClick={() => {
                        setGeneticsPair(pr)
                        setTab('renk')
                      }}
                    >
                      🎨 Renk
                    </button>
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

      {tab === 'oner' && <MateSuggest onPair={(m, f) => setPairEdit({ maleId: m, femaleId: f })} />}

      {tab === 'renk' && <ColorGenetics key={geneticsPair?.id || 'yok'} initialMale={geneticsPair?.maleId} initialFemale={geneticsPair?.femaleId} />}

      {fosterOf && <FosterForm clutch={fosterOf} onClose={() => setFosterOf(null)} />}
      {report && <PairReport pr={report} onClose={() => setReport(null)} go={go} />}
      {pairEdit && <PairForm initial={pairEdit} onClose={() => setPairEdit(null)} />}
      {clutchEdit && <ClutchForm initial={clutchEdit} onClose={() => setClutchEdit(null)} />}
      {newChick && <PigeonForm initial={newChick} onClose={() => setNewChick(null)} onSaved={(r) => go(`kus/${r.id}`)} />}
    </div>
  )
}
