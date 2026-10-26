import { useMemo, useState } from 'react'
import { STATUS } from '../lib/constants'
import { exportCSV, fmtDate, money, num, today } from '../lib/format'
import { ACCOUNT_KINDS, PERSON_TYPES, balanceOf, personBirds, phoneLinks } from '../lib/people'
import { list, remove, save, useCollection, useRecord } from '../lib/store'
import { Badge, Empty, ErrorText, Field, Modal, SearchBox, Select, Stat, confirmDel } from '../components/ui'

function PersonForm({ initial, onClose, onSaved }) {
  const [f, setF] = useState({ name: '', type: 'musteri', phone: '', city: '', notes: '', ...initial })
  const [err, setErr] = useState('')
  const set = (k) => (v) => setF((s) => ({ ...s, [k]: v?.target ? v.target.value : v }))
  const submit = (e) => {
    e.preventDefault()
    if (!f.name.trim()) return setErr('Ad zorunludur.')
    const dup = list('people').find((p) => p.name.trim().toLocaleLowerCase('tr') === f.name.trim().toLocaleLowerCase('tr') && p.id !== f.id)
    if (dup) return setErr('Bu adla bir kişi zaten kayıtlı.')
    if (f.id && initial.name && initial.name !== f.name.trim()) {
      // Kuş kayıtlarındaki eski adı da güncelle ki eşleşme kopmasın
      for (const p of list('pigeons')) {
        const patch = {}
        if (p.toName === initial.name) patch.toName = f.name.trim()
        if (p.fromName === initial.name) patch.fromName = f.name.trim()
        if (Object.keys(patch).length) save('pigeons', { ...p, ...patch })
      }
    }
    const rec = save('people', { ...f, name: f.name.trim() })
    onSaved?.(rec)
    onClose()
  }
  return (
    <Modal
      title={f.id ? 'Kişiyi düzenle' : 'Yeni kişi'}
      onClose={onClose}
      footer={
        <>
          <button className="btn ghost" onClick={onClose}>
            Vazgeç
          </button>
          <button className="btn primary" form="person-form">
            Kaydet
          </button>
        </>
      }
    >
      <form id="person-form" onSubmit={submit} className="form-grid">
        <ErrorText>{err}</ErrorText>
        <Field label="Ad Soyad *">
          <input value={f.name} onChange={set('name')} autoFocus />
        </Field>
        <Field label="Tür">
          <Select value={f.type} onChange={set('type')} options={PERSON_TYPES} placeholder="—" />
        </Field>
        <Field label="Telefon">
          <input type="tel" value={f.phone} onChange={set('phone')} placeholder="05xx xxx xx xx" />
        </Field>
        <Field label="Şehir">
          <input value={f.city} onChange={set('city')} />
        </Field>
        <Field label="Notlar" full>
          <textarea rows={2} value={f.notes} onChange={set('notes')} />
        </Field>
      </form>
    </Modal>
  )
}

function AccountForm({ personId, initial, onClose }) {
  const [f, setF] = useState({ kind: 'tahsilat', date: today(), amount: '', note: '', ...initial, personId })
  const [err, setErr] = useState('')
  const set = (k) => (v) => setF((s) => ({ ...s, [k]: v?.target ? v.target.value : v }))
  const submit = (e) => {
    e.preventDefault()
    if (!num(f.amount) || num(f.amount) <= 0) return setErr('Geçerli bir tutar girin.')
    save('accounts', { ...f, amount: num(f.amount) })
    onClose()
  }
  return (
    <Modal
      title="Cari hareket"
      onClose={onClose}
      footer={
        <>
          <button className="btn ghost" onClick={onClose}>
            Vazgeç
          </button>
          <button className="btn primary" form="acc-form">
            Kaydet
          </button>
        </>
      }
    >
      <form id="acc-form" onSubmit={submit} className="form-grid">
        <ErrorText>{err}</ErrorText>
        <Field label="İşlem" full>
          <Select value={f.kind} onChange={set('kind')} options={Object.fromEntries(Object.entries(ACCOUNT_KINDS).map(([k, v]) => [k, v.label]))} placeholder="—" />
        </Field>
        <Field label="Tarih">
          <input type="date" value={f.date} onChange={set('date')} />
        </Field>
        <Field label="Tutar (₺)">
          <input inputMode="decimal" value={f.amount} onChange={set('amount')} autoFocus />
        </Field>
        <Field label="Açıklama" full>
          <input value={f.note} onChange={set('note')} />
        </Field>
      </form>
    </Modal>
  )
}

function BalanceBadge({ value }) {
  if (Math.abs(value) < 0.005) return <Badge>Borç yok</Badge>
  return value > 0 ? <Badge tone="warn">Bize borçlu {money(value)}</Badge> : <Badge tone="info">Biz borçluyuz {money(-value)}</Badge>
}

export function PersonDetail({ id, go }) {
  const person = useRecord('people', id)
  const accounts = useCollection('accounts')
  const pigeons = useCollection('pigeons')
  const [edit, setEdit] = useState(false)
  const [acc, setAcc] = useState(null)
  if (!person) return <Empty title="Kişi bulunamadı" />
  const birds = personBirds(person, pigeons)
  const moves = accounts.filter((a) => a.personId === id).sort((a, b) => (b.date || '').localeCompare(a.date || ''))
  const balance = balanceOf(id, accounts)
  const links = phoneLinks(person.phone)
  const soldTotal = birds.sold.reduce((t, p) => t + (+p.toPrice || 0), 0)
  const boughtTotal = birds.bought.reduce((t, p) => t + (+p.fromPrice || 0), 0)
  return (
    <div className="page">
      <div className="page-head">
        <button className="btn ghost small" onClick={() => go('kisiler')}>
          ← Kişiler
        </button>
        <div className="row gap-s">
          <button className="btn small" onClick={() => setEdit(true)}>
            Düzenle
          </button>
          <button
            className="btn small danger"
            onClick={() => {
              if (!confirmDel(person.name)) return
              moves.forEach((m) => remove('accounts', m.id))
              remove('people', id)
              go('kisiler')
            }}
          >
            Sil
          </button>
        </div>
      </div>
      <div className="card">
        <h1>{person.name}</h1>
        <div className="row gap-s wrap">
          <Badge>{PERSON_TYPES[person.type] || '—'}</Badge>
          {person.city && <Badge>{person.city}</Badge>}
          <BalanceBadge value={balance} />
        </div>
        {person.phone && (
          <div className="row gap-s wrap">
            <a className="btn small" href={links.tel}>
              📞 {person.phone}
            </a>
            <a className="btn small" href={links.wa} target="_blank" rel="noreferrer">
              💬 WhatsApp
            </a>
          </div>
        )}
        {person.notes && <p className="small">{person.notes}</p>}
      </div>
      <div className="stats">
        <Stat label="Ona satılan kuş" value={birds.sold.length} sub={money(soldTotal)} />
        <Stat label="Ondan alınan kuş" value={birds.bought.length} sub={money(boughtTotal)} />
        <Stat label="Bakiye" value={money(Math.abs(balance))} sub={balance > 0 ? 'bize borçlu' : balance < 0 ? 'biz borçluyuz' : 'kapalı'} tone={balance > 0 ? 'warn' : ''} />
      </div>

      <div className="card">
        <div className="row between">
          <h3>Cari hesap</h3>
          <button className="btn small primary" onClick={() => setAcc({})}>
            + Hareket
          </button>
        </div>
        {moves.length === 0 && <p className="small muted">Hareket yok. Veresiye satışlar kuş kaydında "veresiye" işaretlenince buraya gelir.</p>}
        {moves.map((m) => (
          <div key={m.id} className="row between list-row small">
            <span>
              {fmtDate(m.date)} · {ACCOUNT_KINDS[m.kind]?.label}
              {m.note && <span className="muted"> · {m.note}</span>}
            </span>
            <span className="row gap-s nowrap">
              <strong className={ACCOUNT_KINDS[m.kind]?.sign > 0 ? 'warn-text' : 'ok-text'}>{money(m.amount)}</strong>
              {!m.refId && (
                <button className="btn tiny ghost danger-text" onClick={() => confirmDel('Cari hareket') && remove('accounts', m.id)}>
                  ✕
                </button>
              )}
            </span>
          </div>
        ))}
      </div>

      {[
        ['Ona satılan / verilen kuşlar', birds.sold, 'to'],
        ['Ondan gelen kuşlar', birds.bought, 'from'],
      ].map(([title, arr, side]) =>
        arr.length ? (
          <div key={title} className="card">
            <h3>{title}</h3>
            {arr.map((p) => (
              <button key={p.id} className="row between list-row link-row small" onClick={() => go(`kus/${p.id}`)}>
                <span>
                  {p.ring} {p.name && `· ${p.name}`} <span className="muted">· {fmtDate(p[side + 'Date'])}</span>
                </span>
                <span>{side === 'to' ? `${STATUS[p.status]} ${p.toPrice ? money(p.toPrice) : ''}` : money(p.fromPrice)}</span>
              </button>
            ))}
          </div>
        ) : null,
      )}
      {edit && <PersonForm initial={person} onClose={() => setEdit(false)} />}
      {acc && <AccountForm personId={id} initial={acc} onClose={() => setAcc(null)} />}
    </div>
  )
}

export default function People({ go }) {
  const people = useCollection('people')
  const accounts = useCollection('accounts')
  const pigeons = useCollection('pigeons')
  const [q, setQ] = useState('')
  const [type, setType] = useState('')
  const [onlyDebt, setOnlyDebt] = useState(false)
  const [add, setAdd] = useState(false)
  const rows = useMemo(() => {
    const s = q.toLocaleLowerCase('tr')
    return people
      .map((p) => ({ p, balance: balanceOf(p.id, accounts), birds: personBirds(p, pigeons) }))
      .filter(({ p, balance }) => (!type || p.type === type) && (!onlyDebt || Math.abs(balance) > 0.005))
      .filter(({ p }) => !s || [p.name, p.phone, p.city].some((v) => (v || '').toLocaleLowerCase('tr').includes(s)))
      .sort((a, b) => a.p.name.localeCompare(b.p.name, 'tr'))
  }, [people, accounts, pigeons, q, type, onlyDebt])
  const receivable = people.reduce((t, p) => t + Math.max(0, balanceOf(p.id, accounts)), 0)
  const payable = people.reduce((t, p) => t + Math.max(0, -balanceOf(p.id, accounts)), 0)

  return (
    <div className="page">
      <div className="page-head">
        <h1>Kişiler</h1>
        <div className="row gap-s">
          <button
            className="btn ghost small"
            onClick={() =>
              exportCSV(
                rows.map(({ p, balance, birds }) => ({ Ad: p.name, Tür: PERSON_TYPES[p.type], Telefon: p.phone, Şehir: p.city, 'Satılan Kuş': birds.sold.length, 'Alınan Kuş': birds.bought.length, Bakiye: balance })),
                `kuru-kisiler-${today()}.csv`,
              )
            }
          >
            Excel
          </button>
          <button className="btn primary" onClick={() => setAdd(true)}>
            + Kişi
          </button>
        </div>
      </div>
      <div className="stats">
        <Stat label="Alacaklarımız" value={money(receivable)} tone={receivable ? 'warn' : ''} onClick={() => setOnlyDebt(true)} />
        <Stat label="Borçlarımız" value={money(payable)} onClick={() => setOnlyDebt(true)} />
      </div>
      <div className="toolbar">
        <SearchBox value={q} onChange={setQ} placeholder="Ad, telefon, şehir" />
        <Select value={type} onChange={setType} options={PERSON_TYPES} placeholder="Tüm kişiler" />
      </div>
      <label className="check small">
        <input type="checkbox" checked={onlyDebt} onChange={(e) => setOnlyDebt(e.target.checked)} /> Yalnızca borcu/alacağı olanlar
      </label>
      {rows.length === 0 ? (
        <Empty icon="👥" title="Kişi yok">
          Kuş satarken veya alırken yazdığınız kişiler buraya otomatik eklenir.
        </Empty>
      ) : (
        <div className="card-list">
          {rows.map(({ p, balance, birds }) => (
            <button key={p.id} className="pigeon-card" onClick={() => go(`kisi/${p.id}`)}>
              <div className="avatar">{p.name[0]?.toLocaleUpperCase('tr')}</div>
              <div className="pc-body">
                <strong>{p.name}</strong>
                <div className="pc-meta">{[p.phone, p.city, PERSON_TYPES[p.type]].filter(Boolean).join(' · ')}</div>
                <div className="pc-meta">
                  {birds.sold.length} kuş sattık · {birds.bought.length} kuş aldık
                </div>
              </div>
              <BalanceBadge value={balance} />
            </button>
          ))}
        </div>
      )}
      {add && <PersonForm onClose={() => setAdd(false)} onSaved={(r) => go(`kisi/${r.id}`)} />}
    </div>
  )
}
