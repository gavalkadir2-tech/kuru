import { Wallet } from 'lucide-react'
import { useMemo, useState } from 'react'
import { exportCSV, fmtDate, money, num, pigeonLabel, today } from '../lib/format'
import { get, remove, save, useCollection } from '../lib/store'
import { Badge, confirmDel, Empty, ErrorText, Field, Modal, PageTitle, Select, Stat, Tabs } from '../components/ui'

import { useList } from '../lib/config'
const MONTHS = ['Ocak', 'Şubat', 'Mart', 'Nisan', 'Mayıs', 'Haziran', 'Temmuz', 'Ağustos', 'Eylül', 'Ekim', 'Kasım', 'Aralık']

// Elle girilen kayıtlar + diğer modüllerdeki tutarlardan otomatik türeyen kayıtlar
export function ledgerEntries({ ledger, pigeons, stockMoves, health, feedings }) {
  const out = ledger.map((l) => ({ ...l, amount: +l.amount || 0, manual: true }))
  for (const p of pigeons) {
    if (p.status === 'satildi' && +p.toPrice) out.push({ id: 's-' + p.id, date: p.toDate, type: 'gelir', category: 'Kuş satışı', amount: +p.toPrice, note: `${pigeonLabel(p)} → ${p.toName || ''}`, link: `kus/${p.id}`, person: p.toName })
    if (p.origin === 'alis' && +p.fromPrice) out.push({ id: 'a-' + p.id, date: p.fromDate || (p.created_at || '').slice(0, 10), type: 'gider', category: 'Kuş alımı', amount: +p.fromPrice, note: `${pigeonLabel(p)} ← ${p.fromName || ''}`, link: `kus/${p.id}`, person: p.fromName })
  }
  for (const m of stockMoves) {
    if (m.source === 'alim' && +m.cost) {
      const item = get('stock', m.itemId)
      const cat = { yem: 'Yem', ilac: 'İlaç / Aşı', vitamin: 'Vitamin / Takviye', malzeme: 'Malzeme / Ekipman' }[item?.category] || 'Diğer gider'
      out.push({ id: 'm-' + m.id, date: m.date, type: 'gider', category: cat, amount: +m.cost, note: `${item?.name || 'Stok'} alımı ${m.qty} ${item?.unit || ''}${m.supplier ? ' · ' + m.supplier : ''}`, link: 'stok', person: m.supplier })
    }
  }
  for (const h of health) if (+h.cost) out.push({ id: 'h-' + h.id, date: h.date, type: 'gider', category: 'Veteriner / Sağlık', amount: +h.cost, note: h.medicine || h.diagnosis, link: 'saglik', person: h.vet })
  for (const f of feedings) if (+f.cost) out.push({ id: 'f-' + f.id, date: f.date, type: 'gider', category: 'Yem', amount: +f.cost, note: 'Yemleme ' + (f.feed || ''), link: 'yem' })
  return out.filter((e) => e.date).sort((a, b) => b.date.localeCompare(a.date))
}

function EntryForm({ initial, onClose }) {
  const [f, setF] = useState({ date: today(), type: 'gider', category: '', amount: '', note: '', person: '', ...initial })
  const [err, setErr] = useState('')
  const set = (k) => (v) => setF((s) => ({ ...s, [k]: v?.target ? v.target.value : v }))
  const incomeCats = useList('incomeCats')
  const expenseCats = useList('expenseCats')
  const base = f.type === 'gelir' ? incomeCats : expenseCats
  const cats = f.category && !base.includes(f.category) ? [...base, f.category] : base
  const submit = (e) => {
    e.preventDefault()
    if (!num(f.amount) || num(f.amount) <= 0) return setErr('Geçerli bir tutar girin.')
    if (!f.category) return setErr('Kategori seçin.')
    save('ledger', { ...f, amount: num(f.amount) })
    onClose()
  }
  return (
    <Modal
      title={f.id ? 'Kaydı düzenle' : 'Gelir / gider ekle'}
      onClose={onClose}
      footer={
        <>
          <button className="btn ghost" onClick={onClose}>
            Vazgeç
          </button>
          <button className="btn primary" form="ledger-form">
            Kaydet
          </button>
        </>
      }
    >
      <form id="ledger-form" onSubmit={submit} className="form-grid">
        <ErrorText>{err}</ErrorText>
        <Field label="Tür" full>
          <div className="row gap">
            <label className="check">
              <input type="radio" checked={f.type === 'gider'} onChange={() => setF((s) => ({ ...s, type: 'gider', category: '' }))} /> Gider
            </label>
            <label className="check">
              <input type="radio" checked={f.type === 'gelir'} onChange={() => setF((s) => ({ ...s, type: 'gelir', category: '' }))} /> Gelir
            </label>
          </div>
        </Field>
        <Field label="Tarih">
          <input type="date" value={f.date} onChange={set('date')} />
        </Field>
        <Field label="Tutar (₺) *">
          <input inputMode="decimal" value={f.amount} onChange={set('amount')} autoFocus />
        </Field>
        <Field label="Kategori *">
          <Select value={f.category} onChange={set('category')} options={cats} />
        </Field>
        <Field label="Kişi / Firma">
          <input value={f.person} onChange={set('person')} />
        </Field>
        <Field label="Açıklama" full>
          <input value={f.note} onChange={set('note')} />
        </Field>
      </form>
    </Modal>
  )
}

export default function Ledger({ go }) {
  const ledger = useCollection('ledger')
  const pigeons = useCollection('pigeons')
  const stockMoves = useCollection('stockMoves')
  const health = useCollection('health')
  const feedings = useCollection('feedings')
  useCollection('stock')
  const [year, setYear] = useState(today().slice(0, 4))
  const [tab, setTab] = useState('ozet')
  const [type, setType] = useState('')
  const [edit, setEdit] = useState(null)

  const all = useMemo(() => ledgerEntries({ ledger, pigeons, stockMoves, health, feedings }), [ledger, pigeons, stockMoves, health, feedings])
  const years = [...new Set([today().slice(0, 4), ...all.map((e) => e.date.slice(0, 4))])].sort().reverse()
  const rows = all.filter((e) => (!year || e.date.startsWith(year)) && (!type || e.type === type))
  const sum = (arr, t) => arr.filter((e) => e.type === t).reduce((s, e) => s + e.amount, 0)
  const yearRows = all.filter((e) => !year || e.date.startsWith(year))
  const income = sum(yearRows, 'gelir')
  const expense = sum(yearRows, 'gider')

  const monthly = MONTHS.map((name, i) => {
    const key = `${year}-${String(i + 1).padStart(2, '0')}`
    const m = yearRows.filter((e) => e.date.startsWith(key))
    return { name, gelir: sum(m, 'gelir'), gider: sum(m, 'gider') }
  })
  const byCat = Object.entries(
    yearRows.reduce((acc, e) => {
      const k = `${e.type}|${e.category}`
      acc[k] = (acc[k] || 0) + e.amount
      return acc
    }, {}),
  ).sort((a, b) => b[1] - a[1])

  return (
    <div className="page">
      <div className="page-head">
        <PageTitle icon={Wallet} title="Gelir – Gider" subtitle="Kâr-zarar ve kategori dağılımı" />
        <div className="row gap-s">
          <button
            className="btn ghost small"
            onClick={() =>
              exportCSV(
                rows.map((e) => ({ Tarih: fmtDate(e.date), Tür: e.type === 'gelir' ? 'Gelir' : 'Gider', Kategori: e.category, Tutar: e.amount, Kişi: e.person || '', Açıklama: e.note || '', Kaynak: e.manual ? 'Elle' : 'Otomatik' })),
                `kuru-gelir-gider-${year || 'tum'}.csv`,
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
      <div className="toolbar">
        <select value={year} onChange={(e) => setYear(e.target.value)}>
          <option value="">Tüm yıllar</option>
          {years.map((y) => (
            <option key={y}>{y}</option>
          ))}
        </select>
      </div>
      <div className="stats">
        <Stat label="Gelir" value={money(income)} />
        <Stat label="Gider" value={money(expense)} />
        <Stat label={income - expense >= 0 ? 'Kâr' : 'Zarar'} value={money(Math.abs(income - expense))} tone={income - expense < 0 ? 'warn' : ''} />
      </div>
      <Tabs value={tab} onChange={setTab} tabs={{ ozet: 'Aylık Özet', kategori: 'Kategoriler', liste: `Kayıtlar (${rows.length})` }} />

      {tab === 'ozet' &&
        (year ? (
          <div className="card table-wrap">
            <table className="table">
              <thead>
                <tr>
                  <th>Ay</th>
                  <th>Gelir</th>
                  <th>Gider</th>
                  <th>Net</th>
                </tr>
              </thead>
              <tbody>
                {monthly.map((m) => (
                  <tr key={m.name} className={!m.gelir && !m.gider ? 'muted' : ''}>
                    <td>{m.name}</td>
                    <td>{m.gelir ? money(m.gelir) : '—'}</td>
                    <td>{m.gider ? money(m.gider) : '—'}</td>
                    <td className={m.gelir - m.gider < 0 ? 'danger-text' : ''}>{m.gelir || m.gider ? money(m.gelir - m.gider) : '—'}</td>
                  </tr>
                ))}
                <tr className="total">
                  <td>Toplam</td>
                  <td>{money(income)}</td>
                  <td>{money(expense)}</td>
                  <td className={income - expense < 0 ? 'danger-text' : ''}>{money(income - expense)}</td>
                </tr>
              </tbody>
            </table>
          </div>
        ) : (
          <p className="muted small">Aylık özet için bir yıl seçin.</p>
        ))}

      {tab === 'kategori' &&
        (byCat.length ? (
          <div className="card table-wrap">
            <table className="table">
              <tbody>
                {byCat.map(([k, v]) => {
                  const [t, c] = k.split('|')
                  const base = t === 'gelir' ? income : expense
                  return (
                    <tr key={k}>
                      <td>
                        <Badge tone={t === 'gelir' ? 'ok' : 'warn'}>{t === 'gelir' ? 'Gelir' : 'Gider'}</Badge> {c}
                      </td>
                      <td>{money(v)}</td>
                      <td className="muted">%{base ? Math.round((v / base) * 100) : 0}</td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        ) : (
          <Empty icon="📒" title="Bu dönemde kayıt yok" />
        ))}

      {tab === 'liste' && (
        <>
          <Select value={type} onChange={setType} options={{ gelir: 'Gelirler', gider: 'Giderler' }} placeholder="Gelir ve gider" />
          {rows.length === 0 ? (
            <Empty icon="📒" title="Kayıt yok">
              Kuş satış/alış fiyatları, stok alımları, sağlık ve yemleme maliyetleri buraya otomatik gelir. Diğer gelir-giderleri "+ Kayıt" ile ekleyin.
            </Empty>
          ) : (
            <div className="card table-wrap">
              <table className="table">
                <thead>
                  <tr>
                    <th>Tarih</th>
                    <th>Kategori</th>
                    <th>Tutar</th>
                    <th />
                  </tr>
                </thead>
                <tbody>
                  {rows.map((e) => (
                    <tr key={e.id}>
                      <td className="nowrap">{fmtDate(e.date)}</td>
                      <td>
                        {e.category}
                        {(e.note || e.person) && <div className="tiny muted">{[e.person, e.note].filter(Boolean).join(' · ')}</div>}
                      </td>
                      <td className={'nowrap ' + (e.type === 'gelir' ? 'ok-text' : 'danger-text')}>
                        {e.type === 'gelir' ? '+' : '−'}
                        {money(e.amount)}
                      </td>
                      <td className="nowrap">
                        {e.manual ? (
                          <>
                            <button className="btn tiny" onClick={() => setEdit(e)}>
                              ✎
                            </button>
                            <button className="btn tiny ghost danger-text" onClick={() => confirmDel(`${e.category} ${money(e.amount)}`) && remove('ledger', e.id)}>
                              ✕
                            </button>
                          </>
                        ) : (
                          <button className="btn tiny ghost" title="Kaynağa git" onClick={() => go(e.link)}>
                            ↗
                          </button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <p className="tiny muted">↗ işaretli kayıtlar diğer sayfalardan otomatik gelir; değiştirmek için kaynağına gidin.</p>
            </div>
          )}
        </>
      )}
      {edit && <EntryForm initial={edit} onClose={() => setEdit(null)} />}
    </div>
  )
}
