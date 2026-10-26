import { useMemo, useState } from 'react'
import { BREEDS, COLORS, ORIGIN, SEX, STATUS } from '../lib/constants'
import { ageText, exportCSV, fmtDate, money, num, pigeonLabel, today } from '../lib/format'
import { get, list, save, useCollection, useSettings } from '../lib/store'
import { Badge, Empty, ErrorText, Field, Modal, PhotoInput, PigeonSelect, SearchBox, Select } from '../components/ui'

export const STATUS_TONE = { aktif: 'ok', satildi: 'info', verildi: 'info', oldu: 'danger', kayip: 'warn' }

export function emptyPigeon(extra = {}) {
  return {
    ring: '',
    name: '',
    sex: '',
    breed: '',
    color: '',
    birthDate: '',
    loft: '',
    fatherId: '',
    motherId: '',
    fatherText: '',
    motherText: '',
    origin: 'uretim',
    fromName: '',
    fromPhone: '',
    fromCity: '',
    fromDate: '',
    fromPrice: '',
    status: 'aktif',
    toName: '',
    toPhone: '',
    toCity: '',
    toDate: '',
    toPrice: '',
    lossReason: '',
    traits: '',
    notes: '',
    photo: '',
    ...extra,
  }
}

export function PigeonForm({ initial, onClose, onSaved }) {
  const settings = useSettings()
  const [f, setF] = useState(() => emptyPigeon(initial))
  const [err, setErr] = useState('')
  const set = (k) => (v) => setF((s) => ({ ...s, [k]: v?.target ? v.target.value : v }))

  const submit = (e) => {
    e.preventDefault()
    const ring = f.ring.trim().toUpperCase()
    if (!ring) return setErr('Ayak seri numarası (halka no) zorunludur.')
    if (!f.sex) return setErr('Cinsiyet seçiniz.')
    const dup = list('pigeons').find((p) => p.ring?.toUpperCase() === ring && p.id !== f.id)
    if (dup) return setErr(`Bu halka numarası zaten kayıtlı: ${pigeonLabel(dup)}`)
    if (f.fatherId && f.fatherId === f.motherId) return setErr('Anne ve baba aynı kuş olamaz.')
    if (['satildi', 'verildi'].includes(f.status) && !f.toName.trim()) return setErr('Kime satıldığını / verildiğini yazınız.')
    const rec = save('pigeons', {
      ...f,
      ring,
      fromPrice: num(f.fromPrice),
      toPrice: num(f.toPrice),
      toDate: ['satildi', 'verildi', 'oldu', 'kayip'].includes(f.status) ? f.toDate || today() : f.toDate,
    })
    onSaved?.(rec)
    onClose()
  }

  const transfer = ['satildi', 'verildi'].includes(f.status)
  const lost = ['oldu', 'kayip'].includes(f.status)

  return (
    <Modal
      title={f.id ? 'Güvercini düzenle' : 'Yeni güvercin'}
      onClose={onClose}
      wide
      footer={
        <>
          <button className="btn ghost" onClick={onClose}>
            Vazgeç
          </button>
          <button className="btn primary" form="pigeon-form">
            Kaydet
          </button>
        </>
      }
    >
      <form id="pigeon-form" onSubmit={submit} className="form-grid">
        <ErrorText>{err}</ErrorText>
        <div className="full row gap">
          <PhotoInput value={f.photo} onChange={set('photo')} />
        </div>
        <Field label="Ayak seri no (halka) *" hint={`Örn: ${settings.ringPrefix}-${new Date().getFullYear()}-123456`}>
          <input value={f.ring} onChange={set('ring')} autoCapitalize="characters" placeholder={`${settings.ringPrefix}-${new Date().getFullYear()}-`} />
        </Field>
        <Field label="Adı">
          <input value={f.name} onChange={set('name')} />
        </Field>
        <Field label="Cinsiyet *">
          <Select value={f.sex} onChange={set('sex')} options={SEX} />
        </Field>
        <Field label="Irk">
          <input list="breeds" value={f.breed} onChange={set('breed')} />
          <datalist id="breeds">
            {BREEDS.map((b) => (
              <option key={b} value={b} />
            ))}
          </datalist>
        </Field>
        <Field label="Renk / Desen">
          <input list="colors" value={f.color} onChange={set('color')} />
          <datalist id="colors">
            {COLORS.map((b) => (
              <option key={b} value={b} />
            ))}
          </datalist>
        </Field>
        <Field label="Doğum tarihi">
          <input type="date" value={f.birthDate} onChange={set('birthDate')} max={today()} />
        </Field>
        <Field label="Kafes / Bölme">
          <input value={f.loft} onChange={set('loft')} />
        </Field>

        <h3 className="full section-title">Soy (Anne – Baba)</h3>
        <Field label="Baba (kayıtlı kuşlardan)">
          <PigeonSelect value={f.fatherId} onChange={set('fatherId')} sex="E" exclude={f.id} placeholder="— Seçilmedi —" />
        </Field>
        <Field label="…veya baba halka no / bilgisi" hint="Kayıtlı değilse yazın">
          <input value={f.fatherText} onChange={set('fatherText')} disabled={!!f.fatherId} />
        </Field>
        <Field label="Anne (kayıtlı kuşlardan)">
          <PigeonSelect value={f.motherId} onChange={set('motherId')} sex="D" exclude={f.id} placeholder="— Seçilmedi —" />
        </Field>
        <Field label="…veya anne halka no / bilgisi">
          <input value={f.motherText} onChange={set('motherText')} disabled={!!f.motherId} />
        </Field>

        <h3 className="full section-title">Nereden geldi?</h3>
        <Field label="Köken">
          <Select value={f.origin} onChange={set('origin')} options={ORIGIN} placeholder="—" />
        </Field>
        {f.origin && f.origin !== 'uretim' && (
          <>
            <Field label="Kimden">
              <input value={f.fromName} onChange={set('fromName')} />
            </Field>
            <Field label="Telefon">
              <input type="tel" value={f.fromPhone} onChange={set('fromPhone')} />
            </Field>
            <Field label="Şehir">
              <input value={f.fromCity} onChange={set('fromCity')} />
            </Field>
            <Field label="Geliş tarihi">
              <input type="date" value={f.fromDate} onChange={set('fromDate')} />
            </Field>
            {f.origin === 'alis' && (
              <Field label="Alış fiyatı (₺)">
                <input inputMode="decimal" value={f.fromPrice} onChange={set('fromPrice')} />
              </Field>
            )}
          </>
        )}

        <h3 className="full section-title">Durum</h3>
        <Field label="Durum">
          <Select value={f.status} onChange={set('status')} options={STATUS} placeholder="—" />
        </Field>
        {transfer && (
          <>
            <Field label={f.status === 'satildi' ? 'Kime satıldı *' : 'Kime verildi *'}>
              <input value={f.toName} onChange={set('toName')} />
            </Field>
            <Field label="Telefon">
              <input type="tel" value={f.toPhone} onChange={set('toPhone')} />
            </Field>
            <Field label="Şehir">
              <input value={f.toCity} onChange={set('toCity')} />
            </Field>
            <Field label="Tarih">
              <input type="date" value={f.toDate} onChange={set('toDate')} />
            </Field>
            {f.status === 'satildi' && (
              <Field label="Satış fiyatı (₺)">
                <input inputMode="decimal" value={f.toPrice} onChange={set('toPrice')} />
              </Field>
            )}
          </>
        )}
        {lost && (
          <>
            <Field label="Tarih">
              <input type="date" value={f.toDate} onChange={set('toDate')} />
            </Field>
            <Field label="Sebep / Açıklama">
              <input value={f.lossReason} onChange={set('lossReason')} />
            </Field>
          </>
        )}

        <Field label="Özellikler (uçuş, oyun, başarılar)" full>
          <textarea rows={2} value={f.traits} onChange={set('traits')} />
        </Field>
        <Field label="Notlar" full>
          <textarea rows={2} value={f.notes} onChange={set('notes')} />
        </Field>
      </form>
    </Modal>
  )
}

export function parentLabel(p, which) {
  const id = p[which + 'Id']
  if (id) return pigeonLabel(get('pigeons', id))
  return p[which + 'Text'] || '—'
}

export default function Pigeons({ go }) {
  const pigeons = useCollection('pigeons')
  const [q, setQ] = useState('')
  const [status, setStatus] = useState('aktif')
  const [sex, setSex] = useState('')
  const [editing, setEditing] = useState(null)

  const filtered = useMemo(() => {
    const s = q.trim().toLocaleLowerCase('tr')
    return pigeons
      .filter((p) => (!status || p.status === status) && (!sex || p.sex === sex))
      .filter(
        (p) =>
          !s ||
          [p.ring, p.name, p.breed, p.color, p.loft, p.fromName, p.toName].some((v) => (v || '').toLocaleLowerCase('tr').includes(s)),
      )
      .sort((a, b) => (a.ring || '').localeCompare(b.ring || ''))
  }, [pigeons, q, status, sex])

  const exportRows = () =>
    exportCSV(
      filtered.map((p) => ({
        'Halka No': p.ring,
        Ad: p.name,
        Cinsiyet: SEX[p.sex] || '',
        Irk: p.breed,
        Renk: p.color,
        'Doğum Tarihi': fmtDate(p.birthDate),
        Baba: parentLabel(p, 'father'),
        Anne: parentLabel(p, 'mother'),
        Köken: ORIGIN[p.origin] || '',
        Kimden: p.fromName,
        'Alış Fiyatı': p.fromPrice,
        Durum: STATUS[p.status] || '',
        Kime: p.toName,
        'Satış Fiyatı': p.toPrice,
        Kafes: p.loft,
        Notlar: p.notes,
      })),
      `kuru-guvercinler-${today()}.csv`,
    )

  return (
    <div className="page">
      <div className="page-head">
        <h1>Güvercinler</h1>
        <div className="row gap-s">
          <button className="btn ghost small" onClick={exportRows}>
            Excel
          </button>
          <button className="btn primary" onClick={() => setEditing({})}>
            + Güvercin
          </button>
        </div>
      </div>
      <div className="toolbar">
        <SearchBox value={q} onChange={setQ} placeholder="Halka no, ad, ırk, kişi…" />
        <Select value={status} onChange={setStatus} options={STATUS} placeholder="Tüm durumlar" />
        <Select value={sex} onChange={setSex} options={SEX} placeholder="Tüm cinsiyetler" />
      </div>
      <p className="muted small">{filtered.length} kayıt</p>
      {filtered.length === 0 ? (
        <Empty title={pigeons.length ? 'Aramaya uyan kayıt yok' : 'Henüz güvercin eklenmedi'}>
          {!pigeons.length && 'İlk güvercininizi "+ Güvercin" ile ekleyin.'}
        </Empty>
      ) : (
        <div className="card-list">
          {filtered.map((p) => (
            <button key={p.id} className="pigeon-card" onClick={() => go(`kus/${p.id}`)}>
              {p.photo ? <img src={p.photo} alt="" /> : <div className="avatar">{p.sex === 'D' ? '♀' : p.sex === 'E' ? '♂' : '🕊️'}</div>}
              <div className="pc-body">
                <div className="pc-title">
                  <strong>{p.ring}</strong> {p.name && <span>· {p.name}</span>}
                </div>
                <div className="pc-meta">
                  {SEX[p.sex]} · {p.breed || 'Irk yok'} · {p.color || 'Renk yok'} · {ageText(p.birthDate)}
                </div>
                <div className="pc-meta">
                  Baba: {parentLabel(p, 'father')} · Anne: {parentLabel(p, 'mother')}
                </div>
              </div>
              <div className="pc-side">
                <Badge tone={STATUS_TONE[p.status]}>{STATUS[p.status]}</Badge>
                {p.status === 'satildi' && <span className="small muted">{money(p.toPrice)}</span>}
              </div>
            </button>
          ))}
        </div>
      )}
      {editing && <PigeonForm initial={editing} onClose={() => setEditing(null)} onSaved={(r) => !editing.id && go(`kus/${r.id}`)} />}
    </div>
  )
}
