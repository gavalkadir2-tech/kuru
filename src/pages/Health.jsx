import { HeartPulse, Sparkles } from 'lucide-react'
import { useMemo, useState } from 'react'
import { CARE_GUIDE, HEALTH_TYPES, MEDICINES, SEX, SYMPTOMS, URGENCY } from '../lib/constants'
import { ageText, daysBetween, exportCSV, fmtDate, money, num, pigeonLabel, today } from '../lib/format'
import { askAI } from '../lib/ai'
import { useList } from '../lib/config'
import { diagnoseLocal, flockSummary } from '../lib/localAi'
import { fmtQty, removeLinkedMove, stockLevels, syncLinkedMove } from '../lib/stock'
import { get, list, remove, save, useCollection } from '../lib/store'
import { cloudEnabled } from '../lib/supabase'
import { Badge, confirmDel, Empty, ErrorText, Field, Markdown, Modal, PageTitle, PhotoInput, PigeonSelect, SearchBox, Select, Tabs } from '../components/ui'

export function PigeonMulti({ value, onChange }) {
  const pigeons = useCollection('pigeons').filter((p) => p.status === 'aktif')
  const [q, setQ] = useState('')
  const s = q.toLocaleLowerCase('tr')
  const shown = pigeons.filter((p) => !s || pigeonLabel(p).toLocaleLowerCase('tr').includes(s))
  const toggle = (id) => onChange(value.includes(id) ? value.filter((x) => x !== id) : [...value, id])
  return (
    <div className="multi">
      <SearchBox value={q} onChange={setQ} placeholder="Kuş ara" />
      <div className="multi-list">
        {shown.map((p) => (
          <label key={p.id} className="check">
            <input type="checkbox" checked={value.includes(p.id)} onChange={() => toggle(p.id)} /> {pigeonLabel(p)}
          </label>
        ))}
        {!shown.length && <span className="muted small">Aktif kuş yok</span>}
      </div>
      <span className="small muted">{value.length} kuş seçili</span>
    </div>
  )
}

export function HealthForm({ initial, onClose }) {
  useCollection('stockMoves')
  const stockOpts = stockLevels().filter((l) => ['ilac', 'vitamin'].includes(l.item.category))
  const [f, setF] = useState({
    type: 'ilac',
    date: today(),
    scope: 'all',
    pigeonIds: [],
    medicine: '',
    dose: '',
    durationDays: '',
    nextDate: '',
    diagnosis: '',
    vet: '',
    cost: '',
    notes: '',
    ...initial,
  })
  const [err, setErr] = useState('')
  const set = (k) => (v) => setF((s) => ({ ...s, [k]: v?.target ? v.target.value : v }))
  const medNames = useList('medicines')
  const onMedicine = (v) => {
    const m = MEDICINES.find((x) => x.name === v)
    setF((s) => ({ ...s, medicine: v, type: m ? m.type : s.type, dose: s.dose || (m ? m.note : '') }))
  }
  const submit = (e) => {
    e.preventDefault()
    if (!f.date) return setErr('Tarih zorunludur.')
    if (!f.medicine.trim() && !f.diagnosis.trim()) return setErr('İlaç/uygulama veya teşhis alanlarından en az birini doldurun.')
    if (f.scope === 'some' && !f.pigeonIds.length) return setErr('En az bir kuş seçin veya "Tüm sürü" seçeneğini kullanın.')
    if (f.nextDate && f.nextDate < f.date) return setErr('Tekrar tarihi uygulama tarihinden önce olamaz.')
    if (f.stockItemId && !num(f.stockQty)) return setErr('Stoktan düşülecek miktarı girin.')
    const rec = save('health', { ...f, cost: num(f.cost), stockQty: num(f.stockQty), pigeonIds: f.scope === 'all' ? [] : f.pigeonIds })
    syncLinkedMove({ refId: rec.id, source: 'health', itemId: f.stockItemId, qty: num(f.stockQty), date: rec.date, note: rec.medicine || rec.diagnosis })
    onClose()
  }
  return (
    <Modal
      title={f.id ? 'Sağlık kaydını düzenle' : 'Yeni sağlık / ilaçlama kaydı'}
      onClose={onClose}
      wide
      footer={
        <>
          <button className="btn ghost" onClick={onClose}>
            Vazgeç
          </button>
          <button className="btn primary" form="health-form">
            Kaydet
          </button>
        </>
      }
    >
      <form id="health-form" onSubmit={submit} className="form-grid">
        <ErrorText>{err}</ErrorText>
        <Field label="Tür">
          <Select value={f.type} onChange={set('type')} options={HEALTH_TYPES} placeholder="—" />
        </Field>
        <Field label="Tarih *">
          <input type="date" value={f.date} onChange={set('date')} />
        </Field>
        <Field label="İlaç / Aşı / Uygulama" full>
          <input list="meds" value={f.medicine} onChange={(e) => onMedicine(e.target.value)} placeholder="Listeden seçin veya yazın" />
          <datalist id="meds">
            {medNames.map((name) => (
              <option key={name} value={name}>
                {MEDICINES.find((m) => m.name === name)?.note || ''}
              </option>
            ))}
          </datalist>
        </Field>
        <Field label="Doz / Uygulama şekli">
          <input value={f.dose} onChange={set('dose')} placeholder="Örn: 1 g / 2 lt suya" />
        </Field>
        <Field label="Süre (gün)">
          <input type="number" min="0" value={f.durationDays} onChange={set('durationDays')} />
        </Field>
        <Field label="Tekrar / Sonraki uygulama" hint="Hatırlatma olarak ana sayfada görünür">
          <input type="date" value={f.nextDate} onChange={set('nextDate')} />
        </Field>
        <Field label="Teşhis / Sebep">
          <input value={f.diagnosis} onChange={set('diagnosis')} />
        </Field>
        <Field label="Veteriner">
          <input value={f.vet} onChange={set('vet')} />
        </Field>
        <Field label="Maliyet (₺)">
          <input inputMode="decimal" value={f.cost} onChange={set('cost')} />
        </Field>
        <Field label="Stoktan düş">
          <select value={f.stockItemId || ''} onChange={set('stockItemId')} disabled={!stockOpts.length}>
            <option value="">— Düşme —</option>
            {stockOpts.map((l) => (
              <option key={l.item.id} value={l.item.id}>
                {l.item.name} ({fmtQty(l.qty)} {l.item.unit})
              </option>
            ))}
          </select>
        </Field>
        {f.stockItemId && (
          <Field label={`Kullanılan miktar (${stockOpts.find((l) => l.item.id === f.stockItemId)?.item.unit || ''})`}>
            <input inputMode="decimal" value={f.stockQty || ''} onChange={set('stockQty')} />
          </Field>
        )}
        <Field label="Uygulanan" full>
          <div className="row gap">
            <label className="check">
              <input type="radio" checked={f.scope === 'all'} onChange={() => set('scope')('all')} /> Tüm sürü
            </label>
            <label className="check">
              <input type="radio" checked={f.scope === 'some'} onChange={() => set('scope')('some')} /> Seçili kuşlar
            </label>
          </div>
        </Field>
        {f.scope === 'some' && (
          <div className="full">
            <PigeonMulti value={f.pigeonIds} onChange={set('pigeonIds')} />
          </div>
        )}
        <Field label="Notlar" full>
          <textarea rows={2} value={f.notes} onChange={set('notes')} />
        </Field>
      </form>
    </Modal>
  )
}

function Records() {
  const health = useCollection('health')
  useCollection('pigeons')
  const [edit, setEdit] = useState(null)
  const [q, setQ] = useState('')
  const [type, setType] = useState('')
  const s = q.toLocaleLowerCase('tr')
  const rows = health
    .filter((h) => !type || h.type === type)
    .filter((h) => !s || [h.medicine, h.diagnosis, h.notes, h.vet].some((v) => (v || '').toLocaleLowerCase('tr').includes(s)))
    .slice()
    .sort((a, b) => (b.date || '').localeCompare(a.date || ''))
  const upcoming = health.filter((h) => h.nextDate && h.nextDate >= today()).sort((a, b) => a.nextDate.localeCompare(b.nextDate))
  const target = (h) => (h.scope === 'all' ? 'Tüm sürü' : (h.pigeonIds || []).map((id) => get('pigeons', id)?.ring || '?').join(', '))
  const totalCost = rows.reduce((t, h) => t + (+h.cost || 0), 0)

  return (
    <>
      <div className="row between wrap gap-s">
        <div className="toolbar grow">
          <SearchBox value={q} onChange={setQ} placeholder="İlaç, teşhis, not…" />
          <Select value={type} onChange={setType} options={HEALTH_TYPES} placeholder="Tüm türler" />
        </div>
        <div className="row gap-s">
          <button
            className="btn ghost small"
            onClick={() =>
              exportCSV(
                rows.map((h) => ({
                  Tarih: fmtDate(h.date),
                  Tür: HEALTH_TYPES[h.type],
                  Uygulama: h.medicine,
                  Doz: h.dose,
                  'Süre (gün)': h.durationDays,
                  Teşhis: h.diagnosis,
                  Kuşlar: target(h),
                  Tekrar: fmtDate(h.nextDate),
                  Veteriner: h.vet,
                  Maliyet: h.cost,
                  Notlar: h.notes,
                })),
                `kuru-saglik-${today()}.csv`,
              )
            }
          >
            Excel
          </button>
          <button className="btn primary" onClick={() => setEdit({})}>
            + Kayıt
          </button>
        </div>
      </div>

      {upcoming.length > 0 && (
        <div className="card">
          <h3>Yaklaşan uygulamalar</h3>
          {upcoming.slice(0, 6).map((h) => (
            <div key={h.id} className="row between small list-row">
              <span>
                {h.medicine || h.diagnosis} · {target(h)}
              </span>
              <Badge tone={daysBetween(today(), h.nextDate) <= 3 ? 'warn' : 'info'}>{fmtDate(h.nextDate)}</Badge>
            </div>
          ))}
        </div>
      )}

      {rows.length === 0 ? (
        <Empty icon={HeartPulse} title="Sağlık kaydı yok">
          İlaçlama, aşı ve tedavileri kaydederek sağlık geçmişini takip edin.
        </Empty>
      ) : (
        <>
          <p className="muted small">
            {rows.length} kayıt · Toplam maliyet {money(totalCost)}
          </p>
          <div className="card-list">
            {rows.map((h) => (
              <div key={h.id} className="card">
                <div className="row between wrap gap-s">
                  <strong>{h.medicine || h.diagnosis}</strong>
                  <Badge tone="info">{HEALTH_TYPES[h.type]}</Badge>
                </div>
                <div className="small muted">
                  {fmtDate(h.date)} · {target(h)} {h.dose && `· ${h.dose}`} {h.durationDays && `· ${h.durationDays} gün`}
                </div>
                {h.diagnosis && h.medicine && <div className="small">Teşhis: {h.diagnosis}</div>}
                {h.nextDate && <div className="small">Tekrar: {fmtDate(h.nextDate)}</div>}
                {h.notes && <div className="small">{h.notes}</div>}
                <div className="row gap-s">
                  <button className="btn small" onClick={() => setEdit(h)}>
                    Düzenle
                  </button>
                  <button className="btn small ghost danger-text" onClick={() => {
                      if (!confirmDel(h.medicine || h.diagnosis)) return
                      remove('health', h.id)
                      removeLinkedMove(h.id)
                    }}>
                    Sil
                  </button>
                </div>
              </div>
            ))}
          </div>
        </>
      )}
      {edit && <HealthForm initial={edit} onClose={() => setEdit(null)} />}
    </>
  )
}

function Diagnose() {
  const [sel, setSel] = useState([])
  const [pigeonId, setPigeonId] = useState('')
  const [notes, setNotes] = useState('')
  const [photo, setPhoto] = useState('')
  const [ai, setAi] = useState('')
  const [aiErr, setAiErr] = useState('')
  const [loading, setLoading] = useState(false)
  const [treat, setTreat] = useState(null)
  const local = useMemo(() => diagnoseLocal(sel), [sel])
  const toggle = (k) => setSel((s) => (s.includes(k) ? s.filter((x) => x !== k) : [...s, k]))

  const runAI = async () => {
    if (!sel.length && !notes.trim() && !photo) return setAiErr('Belirti seçin, açıklama yazın veya fotoğraf ekleyin.')
    setLoading(true)
    setAiErr('')
    setAi('')
    try {
      const p = pigeonId ? get('pigeons', pigeonId) : null
      const recent = list('health')
        .filter((h) => !p || h.scope === 'all' || h.pigeonIds?.includes(p.id))
        .slice(0, 6)
        .map((h) => `${h.date} ${h.medicine || ''} ${h.diagnosis || ''}`)
      const text = await askAI('diagnose', {
        symptoms: sel.map((k) => SYMPTOMS[k]),
        notes,
        image: photo || undefined,
        pigeon: p ? { ring: p.ring, sex: SEX[p.sex], age: ageText(p.birthDate), breed: p.breed } : null,
        recentHealth: recent,
        localGuess: local.slice(0, 3).map((d) => `${d.name} (%${Math.round(d.score * 100)})`),
      })
      setAi(text)
    } catch (e) {
      setAiErr(e.message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <>
      <div className="card">
        <h3>Belirtileri seçin</h3>
        <div className="chips">
          {Object.entries(SYMPTOMS).map(([k, v]) => (
            <button key={k} className={'chip' + (sel.includes(k) ? ' on' : '')} onClick={() => toggle(k)}>
              {v}
            </button>
          ))}
        </div>
        <div className="form-grid mt">
          <Field label="Hasta kuş (isteğe bağlı)">
            <PigeonSelect value={pigeonId} onChange={setPigeonId} includeInactive={false} placeholder="— Genel / sürü —" />
          </Field>
          <Field label="Ek açıklama" full>
            <textarea rows={2} value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Ne zamandır, kaç kuşta, dışkı rengi, son verilen ilaçlar…" />
          </Field>
          <div className="full">
            <PhotoInput value={photo} onChange={setPhoto} label="Kuş / dışkı fotoğrafı" />
          </div>
        </div>
      </div>

      {sel.length > 0 && (
        <div className="card">
          <h3>Ön tahmin (çevrimdışı)</h3>
          {local.length === 0 && <p className="muted">Eşleşme bulunamadı.</p>}
          {local.map((d) => (
            <div key={d.id} className="diag">
              <div className="row between wrap gap-s">
                <strong>{d.name}</strong>
                <div className="row gap-s">
                  <Badge tone={d.urgency === 'yuksek' ? 'danger' : d.urgency === 'orta' ? 'warn' : 'neutral'}>{URGENCY[d.urgency]}</Badge>
                  <Badge tone="info">%{Math.round(d.score * 100)}</Badge>
                </div>
              </div>
              <div className="bar">
                <span style={{ width: `${Math.round(d.score * 100)}%` }} />
              </div>
              <p className="small muted">Eşleşen: {d.matched.join(', ')}</p>
              <p className="small">
                <strong>Tedavi:</strong> {d.treatment}
              </p>
              <p className="small">
                <strong>Korunma:</strong> {d.prevention}
              </p>
              <button
                className="btn small"
                onClick={() => setTreat({ type: 'tedavi', diagnosis: d.name, scope: pigeonId ? 'some' : 'all', pigeonIds: pigeonId ? [pigeonId] : [] })}
              >
                Tedavi kaydı oluştur
              </button>
            </div>
          ))}
        </div>
      )}

      <div className="card ai-card">
        <div className="row between wrap gap-s">
          <h3>
            <Sparkles size={18} /> Yapay zeka analizi
          </h3>
          <button className="btn primary" onClick={runAI} disabled={loading || !cloudEnabled}>
            {loading ? 'Analiz ediliyor…' : 'Analiz et'}
          </button>
        </div>
        {!cloudEnabled && <p className="small muted">Yapay zeka için bulut bağlantısı (Supabase) gerekir. Şu an yerel tahmin motoru çalışıyor.</p>}
        <ErrorText>{aiErr && `${aiErr} — Yukarıdaki çevrimdışı tahmini kullanabilirsiniz.`}</ErrorText>
        {ai && <Markdown text={ai} />}
        <p className="tiny muted">Bu sonuçlar ön bilgilendirme amaçlıdır; kesin teşhis ve ilaç dozu için veteriner hekime danışın.</p>
      </div>
      {treat && <HealthForm initial={treat} onClose={() => setTreat(null)} />}
    </>
  )
}

function CareGuide() {
  const [season, setSeason] = useState('')
  const [goal, setGoal] = useState('')
  const [ai, setAi] = useState('')
  const [err, setErr] = useState('')
  const [loading, setLoading] = useState(false)
  const run = async () => {
    setLoading(true)
    setErr('')
    try {
      const summary = flockSummary({ pigeons: list('pigeons'), pairs: list('pairs'), clutches: list('clutches'), health: list('health') })
      setAi(await askAI('care', { season, goal, summary, date: today() }))
    } catch (e) {
      setErr(e.message)
    } finally {
      setLoading(false)
    }
  }
  return (
    <>
      <div className="card ai-card">
        <h3>
          <Sparkles size={18} /> Kişisel bakım planı
        </h3>
        <div className="form-grid">
          <Field label="Dönem">
            <Select
              value={season}
              onChange={setSeason}
              options={['Üreme öncesi hazırlık', 'Üreme dönemi', 'Tüy değişimi', 'Uçuş/Yarış sezonu', 'Kış bakımı', 'Yaz sıcakları']}
              placeholder="Mevcut tarihe göre"
            />
          </Field>
          <Field label="Hedef / Not">
            <input value={goal} onChange={(e) => setGoal(e.target.value)} placeholder="Örn: yavru verimini artırmak" />
          </Field>
        </div>
        <button className="btn primary" onClick={run} disabled={loading || !cloudEnabled}>
          {loading ? 'Hazırlanıyor…' : 'Bakım planı oluştur'}
        </button>
        <ErrorText>{err}</ErrorText>
        {ai && <Markdown text={ai} />}
      </div>
      <div className="guide-grid">
        {CARE_GUIDE.map((g) => (
          <div key={g.title} className="card">
            <h3>{g.title}</h3>
            <ul>
              {g.items.map((i) => (
                <li key={i}>{i}</li>
              ))}
            </ul>
          </div>
        ))}
      </div>
    </>
  )
}

export default function Health() {
  const [tab, setTab] = useState('kayit')
  return (
    <div className="page">
      <div className="page-head">
        <PageTitle icon={HeartPulse} title="Sağlık & Bakım" subtitle="İlaçlama, aşı, hastalık tahmini ve bakım" />
      </div>
      <Tabs value={tab} onChange={setTab} tabs={{ kayit: 'İlaçlama & Kayıtlar', teshis: 'Hastalık Tahmini', bakim: 'Bakım Rehberi' }} />
      {tab === 'kayit' && <Records />}
      {tab === 'teshis' && <Diagnose />}
      {tab === 'bakim' && <CareGuide />}
    </div>
  )
}
