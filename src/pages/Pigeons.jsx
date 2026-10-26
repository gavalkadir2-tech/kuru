import { useMemo, useState } from 'react'
import { BREEDS, COLORS, ORIGIN, SEX, STATUS } from '../lib/constants'
import { ageText, exportCSV, fmtDate, money, num, pigeonLabel, today } from '../lib/format'
import { get, list, save, useCollection, useSettings } from '../lib/store'
import { Badge, Empty, ErrorText, Field, Modal, PhotosEditor, PigeonSelect, SearchBox, Select, persistPhotos } from '../components/ui'
import { PhotoImg } from '../lib/photos'
import { afterPigeonSave, findPerson } from '../lib/people'
import { useIsHelper } from '../lib/members'
import { HealthForm } from './Health'
import { FlightForm } from './Flights'

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
    photos: [],
    ...extra,
  }
}

export function PigeonForm({ initial, onClose, onSaved }) {
  const settings = useSettings()
  const [f, setF] = useState(() => emptyPigeon(initial))
  const [err, setErr] = useState('')
  const set = (k) => (v) => setF((s) => ({ ...s, [k]: v?.target ? v.target.value : v }))

  const [saving, setSaving] = useState(false)
  const submit = async (e) => {
    e.preventDefault()
    if (saving) return
    const ring = f.ring.trim().toUpperCase()
    if (!ring) return setErr('Ayak seri numarası (halka no) zorunludur.')
    if (!f.sex) return setErr('Cinsiyet seçiniz.')
    const dup = list('pigeons').find((p) => p.ring?.toUpperCase() === ring && p.id !== f.id)
    if (dup) return setErr(`Bu halka numarası zaten kayıtlı: ${pigeonLabel(dup)}`)
    if (f.fatherId && f.fatherId === f.motherId) return setErr('Anne ve baba aynı kuş olamaz.')
    if (['satildi', 'verildi'].includes(f.status) && !f.toName.trim()) return setErr('Kime satıldığını / verildiğini yazınız.')
    setSaving(true)
    let photos
    try {
      photos = await persistPhotos(f.photos || [], initial?.photos || [])
    } catch (ex) {
      setSaving(false)
      return setErr('Fotoğraf kaydedilemedi: ' + ex.message)
    }
    const rec = save('pigeons', {
      ...f,
      photos,
      ring,
      fromPrice: num(f.fromPrice),
      toPrice: num(f.toPrice),
      toDate: ['satildi', 'verildi', 'oldu', 'kayip'].includes(f.status) ? f.toDate || today() : f.toDate,
    })
    // Kişi listesini ve veresiye cari kaydını güncelle
    afterPigeonSave(rec)
    onSaved?.(rec)
    onClose()
  }

  // Kayıtlı kişi seçilince telefon ve şehri doldur
  const fillPerson = (side) => {
    const person = findPerson(f[side + 'Name'])
    if (!person) return
    setF((s) => ({ ...s, [side + 'Phone']: s[side + 'Phone'] || person.phone || '', [side + 'City']: s[side + 'City'] || person.city || '' }))
  }
  const people = useCollection('people')
  const pairs = useCollection('pairs')
  const helper = useIsHelper()

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
          <button className="btn primary" form="pigeon-form" disabled={saving}>
            {saving ? 'Kaydediliyor…' : 'Kaydet'}
          </button>
        </>
      }
    >
      <form id="pigeon-form" onSubmit={submit} className="form-grid">
        <ErrorText>{err}</ErrorText>
        <div className="full">
          <PhotosEditor value={f.photos || []} onChange={set('photos')} />
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
        <Field label="Bakıcı çift" hint="Yumurtası bakıcıya verildiyse onu büyüten çift">
          <select value={f.fosterPairId || ''} onChange={set('fosterPairId')}>
            <option value="">— Kendi anne-babası —</option>
            {pairs
              .filter((pr) => pr.active !== false || pr.id === f.fosterPairId)
              .map((pr) => (
                <option key={pr.id} value={pr.id}>
                  {pairText(pr)}
                  {pr.foster ? ' — bakıcı' : ''}
                </option>
              ))}
          </select>
        </Field>

        <datalist id="people-list">
          {people.map((p) => (
            <option key={p.id} value={p.name} />
          ))}
        </datalist>
        <h3 className="full section-title">Nereden geldi?</h3>
        <Field label="Köken">
          <Select value={f.origin} onChange={set('origin')} options={ORIGIN} placeholder="—" />
        </Field>
        {f.origin && f.origin !== 'uretim' && (
          <>
            <Field label="Kimden">
              <input list="people-list" value={f.fromName} onChange={set('fromName')} onBlur={() => fillPerson('from')} />
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
            {f.origin === 'alis' && !helper && (
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
              <input list="people-list" value={f.toName} onChange={set('toName')} onBlur={() => fillPerson('to')} />
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
            {f.status === 'satildi' && !helper && (
              <Field label="Satış fiyatı (₺)">
                <input inputMode="decimal" value={f.toPrice} onChange={set('toPrice')} />
              </Field>
            )}
            {f.status === 'satildi' && !helper && (
              <label className="check full">
                <input type="checkbox" checked={!!f.onCredit} onChange={(e) => setF((s) => ({ ...s, onCredit: e.target.checked }))} /> Ödeme alınmadı (veresiye) — müşterinin
                cari hesabına borç yazılır
              </label>
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

// Çift adı (Breeding'e bağımlı olmamak için burada)
export function pairText(pr) {
  if (!pr) return '—'
  return `${get('pigeons', pr.maleId)?.ring || '?'} × ${get('pigeons', pr.femaleId)?.ring || '?'}${pr.nest ? ` (Yuva ${pr.nest})` : ''}`
}

export function parentLabel(p, which) {
  const id = p[which + 'Id']
  if (id) return pigeonLabel(get('pigeons', id))
  return p[which + 'Text'] || '—'
}

function BulkStatusForm({ ids, onClose }) {
  const [f, setF] = useState({ status: 'satildi', date: today(), toName: '', unitPrice: '', reason: '', loft: '' })
  const [err, setErr] = useState('')
  const set = (k) => (e) => setF((s) => ({ ...s, [k]: e.target.value }))
  const submit = (e) => {
    e.preventDefault()
    if (f.status === 'kafes') {
      if (!f.loft.trim()) return setErr('Kafes / bölme adını yazın.')
      ids.forEach((id) => save('pigeons', { ...get('pigeons', id), loft: f.loft.trim() }))
      return onClose()
    }
    if (['satildi', 'verildi'].includes(f.status) && !f.toName.trim()) return setErr('Kime satıldığını / verildiğini yazın.')
    for (const id of ids) {
      const p = get('pigeons', id)
      const rec = save('pigeons', {
        ...p,
        status: f.status,
        toDate: f.status === 'aktif' ? '' : f.date,
        toName: ['satildi', 'verildi'].includes(f.status) ? f.toName.trim() : p.toName,
        toPrice: f.status === 'satildi' ? num(f.unitPrice) : p.toPrice,
        lossReason: ['oldu', 'kayip'].includes(f.status) ? f.reason : p.lossReason,
      })
      afterPigeonSave(rec)
    }
    onClose()
  }
  return (
    <Modal
      title={`${ids.length} kuş için toplu işlem`}
      onClose={onClose}
      footer={
        <>
          <button className="btn ghost" onClick={onClose}>
            Vazgeç
          </button>
          <button className="btn primary" form="bulk-form">
            Uygula
          </button>
        </>
      }
    >
      <form id="bulk-form" onSubmit={submit} className="form-grid">
        <ErrorText>{err}</ErrorText>
        <Field label="İşlem" full>
          <select value={f.status} onChange={set('status')}>
            {Object.entries(STATUS).map(([k, v]) => (
              <option key={k} value={k}>
                Durum: {v}
              </option>
            ))}
            <option value="kafes">Kafes / bölme değiştir</option>
          </select>
        </Field>
        {f.status === 'kafes' ? (
          <Field label="Yeni kafes / bölme">
            <input value={f.loft} onChange={set('loft')} />
          </Field>
        ) : (
          f.status !== 'aktif' && (
            <Field label="Tarih">
              <input type="date" value={f.date} onChange={set('date')} />
            </Field>
          )
        )}
        {['satildi', 'verildi'].includes(f.status) && (
          <Field label={f.status === 'satildi' ? 'Kime satıldı *' : 'Kime verildi *'}>
            <input list="people-bulk" value={f.toName} onChange={set('toName')} />
          </Field>
        )}
        {f.status === 'satildi' && (
          <Field label="Kuş başı fiyat (₺)">
            <input inputMode="decimal" value={f.unitPrice} onChange={set('unitPrice')} />
          </Field>
        )}
        {['oldu', 'kayip'].includes(f.status) && (
          <Field label="Sebep">
            <input value={f.reason} onChange={set('reason')} />
          </Field>
        )}
        <datalist id="people-bulk">
          {list('people').map((p) => (
            <option key={p.id} value={p.name} />
          ))}
        </datalist>
      </form>
    </Modal>
  )
}

export default function Pigeons({ go }) {
  const pigeons = useCollection('pigeons')
  const helper = useIsHelper()
  const [q, setQ] = useState('')
  const [status, setStatus] = useState('aktif')
  const [sex, setSex] = useState('')
  const [breed, setBreed] = useState('')
  const [editing, setEditing] = useState(null)
  const [selecting, setSelecting] = useState(false)
  const [sel, setSel] = useState([])
  const [bulk, setBulk] = useState(null)
  const breeds = [...new Set(pigeons.map((p) => p.breed).filter(Boolean))].sort((a, b) => a.localeCompare(b, 'tr'))
  const toggle = (id) => setSel((s) => (s.includes(id) ? s.filter((x) => x !== id) : [...s, id]))

  const filtered = useMemo(() => {
    const s = q.trim().toLocaleLowerCase('tr')
    return pigeons
      .filter((p) => (!status || p.status === status) && (!sex || p.sex === sex) && (!breed || p.breed === breed))
      .filter(
        (p) =>
          !s ||
          [p.ring, p.name, p.breed, p.color, p.loft, p.fromName, p.toName].some((v) => (v || '').toLocaleLowerCase('tr').includes(s)),
      )
      .sort((a, b) => (a.ring || '').localeCompare(b.ring || ''))
  }, [pigeons, q, status, sex, breed])

  const exportRows = (rows = filtered) =>
    exportCSV(
      rows.map((p) => ({
        'Halka No': p.ring,
        Ad: p.name,
        Cinsiyet: SEX[p.sex] || '',
        Irk: p.breed,
        Renk: p.color,
        'Doğum Tarihi': fmtDate(p.birthDate),
        Baba: parentLabel(p, 'father'),
        Anne: parentLabel(p, 'mother'),
        Bakıcı: p.fosterPairId ? pairText(get('pairs', p.fosterPairId)) : '',
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
          <button className="btn ghost small" onClick={() => exportRows()}>
            Excel
          </button>
          <button
            className={'btn small ' + (selecting ? 'primary' : 'ghost')}
            onClick={() => {
              setSelecting(!selecting)
              setSel([])
            }}
          >
            {selecting ? 'Seçimi bitir' : 'Seç'}
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
        {breeds.length > 1 && <Select value={breed} onChange={setBreed} options={breeds} placeholder="Tüm ırklar" />}
      </div>
      <div className="row between">
        <p className="muted small">
          {filtered.length} kayıt{selecting && ` · ${sel.length} seçili`}
        </p>
        {selecting && (
          <button className="btn tiny ghost" onClick={() => setSel(sel.length === filtered.length ? [] : filtered.map((p) => p.id))}>
            {sel.length === filtered.length ? 'Seçimi kaldır' : 'Tümünü seç'}
          </button>
        )}
      </div>
      {filtered.length === 0 ? (
        <Empty title={pigeons.length ? 'Aramaya uyan kayıt yok' : 'Henüz güvercin eklenmedi'}>
          {!pigeons.length && 'İlk güvercininizi "+ Güvercin" ile ekleyin.'}
        </Empty>
      ) : (
        <div className="card-list">
          {filtered.map((p) => (
            <button key={p.id} className={'pigeon-card' + (sel.includes(p.id) ? ' selected' : '')} onClick={() => (selecting ? toggle(p.id) : go(`kus/${p.id}`))}>
              {selecting && <input type="checkbox" readOnly checked={sel.includes(p.id)} tabIndex={-1} />}
              <PhotoImg id={p.photos?.[0]?.id} className="thumb" fallback={<div className="avatar">{p.sex === 'D' ? '♀' : p.sex === 'E' ? '♂' : '🕊️'}</div>} />
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
                {p.status === 'satildi' && !helper && <span className="small muted">{money(p.toPrice)}</span>}
              </div>
            </button>
          ))}
        </div>
      )}
      {selecting && sel.length > 0 && (
        <div className="bulk-bar no-print">
          <span className="small">{sel.length} kuş</span>
          <button className="btn small" onClick={() => setBulk('health')}>
            💊 İlaç
          </button>
          <button className="btn small" onClick={() => setBulk('flight')}>
            🏆 Uçuş
          </button>
          <button className="btn small" onClick={() => setBulk('status')}>
            🔁 Durum
          </button>
          <button className="btn small" onClick={() => go(`etiket/${sel.join(',')}`)}>
            🏷️ Etiket
          </button>
          <button className="btn small" onClick={() => exportRows(filtered.filter((p) => sel.includes(p.id)))}>
            Excel
          </button>
        </div>
      )}
      {bulk === 'health' && <HealthForm initial={{ scope: 'some', pigeonIds: sel }} onClose={() => setBulk(null)} />}
      {bulk === 'flight' && <FlightForm initial={{ pigeonIds: sel }} onClose={() => setBulk(null)} />}
      {bulk === 'status' && (
        <BulkStatusForm
          ids={sel}
          onClose={() => {
            setBulk(null)
            setSel([])
          }}
        />
      )}
      {editing && <PigeonForm initial={editing} onClose={() => setEditing(null)} onSaved={(r) => !editing.id && go(`kus/${r.id}`)} />}
    </div>
  )
}
