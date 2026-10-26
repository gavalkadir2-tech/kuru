import { Package, TriangleAlert, X } from 'lucide-react'
import { useMemo, useState } from 'react'
import { exportCSV, fmtDate, money, num, today } from '../lib/format'
import { MOVE_SOURCES, STOCK_CATEGORIES, STOCK_UNITS, fmtQty, stockLevels } from '../lib/stock'
import { get, isHelper, list, remove, save, useCollection } from '../lib/store'
import { Badge, confirmDel, Empty, ErrorText, Field, Modal, PageTitle, SearchBox, Select, Tabs } from '../components/ui'

function ItemForm({ initial, onClose }) {
  const [f, setF] = useState({ name: '', category: 'yem', unit: 'kg', minQty: '', notes: '', ...initial })
  const [startQty, setStartQty] = useState('')
  const [err, setErr] = useState('')
  const set = (k) => (v) => setF((s) => ({ ...s, [k]: v?.target ? v.target.value : v }))
  const submit = (e) => {
    e.preventDefault()
    if (!f.name.trim()) return setErr('Ad zorunludur.')
    const dup = list('stock').find((x) => x.name.trim().toLocaleLowerCase('tr') === f.name.trim().toLocaleLowerCase('tr') && x.id !== f.id)
    if (dup) return setErr('Bu adla bir stok kalemi zaten var.')
    const rec = save('stock', { ...f, name: f.name.trim(), minQty: num(f.minQty) })
    if (!f.id && num(startQty)) save('stockMoves', { itemId: rec.id, date: today(), qty: num(startQty), source: 'sayim', note: 'Başlangıç stoku' })
    onClose()
  }
  return (
    <Modal
      title={f.id ? 'Stok kalemini düzenle' : 'Yeni stok kalemi'}
      onClose={onClose}
      footer={
        <>
          <button className="btn ghost" onClick={onClose}>
            Vazgeç
          </button>
          <button className="btn primary" form="item-form">
            Kaydet
          </button>
        </>
      }
    >
      <form id="item-form" onSubmit={submit} className="form-grid">
        <ErrorText>{err}</ErrorText>
        <Field label="Ad *" full>
          <input value={f.name} onChange={set('name')} placeholder="Örn: Mısır, Ronidazol, Grit" />
        </Field>
        <Field label="Kategori">
          <Select value={f.category} onChange={set('category')} options={STOCK_CATEGORIES} placeholder="—" />
        </Field>
        <Field label="Birim">
          <Select value={f.unit} onChange={set('unit')} options={STOCK_UNITS} placeholder="—" />
        </Field>
        <Field label="Uyarı seviyesi" hint="Bu miktara düşünce uyarır">
          <input inputMode="decimal" value={f.minQty} onChange={set('minQty')} />
        </Field>
        {!f.id && (
          <Field label="Mevcut miktar">
            <input inputMode="decimal" value={startQty} onChange={(e) => setStartQty(e.target.value)} />
          </Field>
        )}
        <Field label="Notlar" full>
          <textarea rows={2} value={f.notes} onChange={set('notes')} />
        </Field>
      </form>
    </Modal>
  )
}

function MoveForm({ item, kind, onClose }) {
  const [f, setF] = useState({ date: today(), qty: '', cost: '', supplier: '', note: '' })
  const [err, setErr] = useState('')
  const set = (k) => (e) => setF((s) => ({ ...s, [k]: e.target.value }))
  const titles = { alim: 'Alım ekle', kullanim: 'Kullanım düş', sayim: 'Sayım düzeltmesi' }
  const submit = (e) => {
    e.preventDefault()
    const q = num(f.qty)
    if (q === '' || (kind !== 'sayim' && q <= 0)) return setErr('Geçerli bir miktar girin.')
    if (kind === 'sayim') {
      // Sayım: girilen değer gerçek mevcut miktardır, fark hareket olarak yazılır
      const current = stockLevels().find((l) => l.item.id === item.id)?.qty || 0
      const diff = q - current
      if (!diff) return onClose()
      save('stockMoves', { itemId: item.id, date: f.date, qty: diff, source: 'sayim', note: f.note || `Sayım: ${q} ${item.unit}` })
    } else {
      save('stockMoves', {
        itemId: item.id,
        date: f.date,
        qty: kind === 'alim' ? q : -q,
        source: kind,
        cost: kind === 'alim' ? num(f.cost) : '',
        supplier: kind === 'alim' ? f.supplier.trim() : '',
        note: f.note,
      })
    }
    onClose()
  }
  return (
    <Modal
      title={`${titles[kind]} — ${item.name}`}
      onClose={onClose}
      footer={
        <>
          <button className="btn ghost" onClick={onClose}>
            Vazgeç
          </button>
          <button className="btn primary" form="move-form">
            Kaydet
          </button>
        </>
      }
    >
      <form id="move-form" onSubmit={submit} className="form-grid">
        <ErrorText>{err}</ErrorText>
        <Field label="Tarih">
          <input type="date" value={f.date} onChange={set('date')} />
        </Field>
        <Field label={kind === 'sayim' ? `Sayılan miktar (${item.unit})` : `Miktar (${item.unit})`}>
          <input inputMode="decimal" value={f.qty} onChange={set('qty')} autoFocus />
        </Field>
        {kind === 'alim' && (
          <>
            {!isHelper() && (
              <Field label="Toplam tutar (₺)" hint="Gider defterine işlenir">
                <input inputMode="decimal" value={f.cost} onChange={set('cost')} />
              </Field>
            )}
            <Field label="Nereden alındı">
              <input value={f.supplier} onChange={set('supplier')} />
            </Field>
          </>
        )}
        <Field label="Not" full>
          <input value={f.note} onChange={set('note')} />
        </Field>
      </form>
    </Modal>
  )
}

export default function Stock() {
  useCollection('stock')
  const moves = useCollection('stockMoves')
  const [tab, setTab] = useState('liste')
  const [q, setQ] = useState('')
  const [cat, setCat] = useState('')
  const [edit, setEdit] = useState(null)
  const [move, setMove] = useState(null)
  const levels = stockLevels()
  const s = q.toLocaleLowerCase('tr')
  const rows = levels
    .filter((l) => (!cat || l.item.category === cat) && (!s || l.item.name.toLocaleLowerCase('tr').includes(s)))
    .sort((a, b) => b.low - a.low || a.item.name.localeCompare(b.item.name, 'tr'))
  const lowCount = levels.filter((l) => l.low).length
  const history = useMemo(() => moves.slice().sort((a, b) => (b.date || '').localeCompare(a.date || '') || (b.created_at || '').localeCompare(a.created_at || '')), [moves])

  return (
    <div className="page">
      <div className="page-head">
        <PageTitle icon={Package} title="Stok" subtitle="Yem, ilaç ve malzeme stoğu" />
        <div className="row gap-s">
          <button
            className="btn ghost small"
            onClick={() =>
              exportCSV(
                levels.map((l) => ({ Ad: l.item.name, Kategori: STOCK_CATEGORIES[l.item.category], Miktar: fmtQty(l.qty), Birim: l.item.unit, 'Uyarı Seviyesi': l.item.minQty, Durum: l.low ? 'Azaldı' : 'Yeterli' })),
                `kuru-stok-${today()}.csv`,
              )
            }
          >
            Excel
          </button>
          <button className="btn primary" onClick={() => setEdit({})}>
            + Kalem
          </button>
        </div>
      </div>
      {lowCount > 0 && (
        <div className="alert warn inline-icon">
          <TriangleAlert size={16} /> {lowCount} kalem uyarı seviyesinin altında.
        </div>
      )}
      <Tabs value={tab} onChange={setTab} tabs={{ liste: 'Stok Durumu', hareket: 'Hareketler' }} />

      {tab === 'liste' && (
        <>
          <div className="toolbar">
            <SearchBox value={q} onChange={setQ} placeholder="Kalem ara" />
            <Select value={cat} onChange={setCat} options={STOCK_CATEGORIES} placeholder="Tüm kategoriler" />
          </div>
          {rows.length === 0 ? (
            <Empty icon={Package} title="Stok kalemi yok">
              Yem, ilaç ve vitaminleri ekleyin; yemleme ve ilaç kayıtlarında seçtiğinizde stoktan otomatik düşer.
            </Empty>
          ) : (
            <div className="card-list">
              {rows.map(({ item, qty, low }) => (
                <div key={item.id} className="card">
                  <div className="row between wrap gap-s">
                    <strong>{item.name}</strong>
                    <Badge tone={low ? 'warn' : 'ok'}>
                      {fmtQty(qty)} {item.unit}
                    </Badge>
                  </div>
                  <div className="small muted">
                    {STOCK_CATEGORIES[item.category]}
                    {item.minQty !== '' && item.minQty != null && ` · Uyarı: ${fmtQty(+item.minQty)} ${item.unit}`}
                  </div>
                  <div className="row gap-s wrap">
                    <button className="btn small primary" onClick={() => setMove({ item, kind: 'alim' })}>
                      + Alım
                    </button>
                    <button className="btn small" onClick={() => setMove({ item, kind: 'kullanim' })}>
                      − Kullanım
                    </button>
                    <button className="btn small" onClick={() => setMove({ item, kind: 'sayim' })}>
                      Sayım
                    </button>
                    <button className="btn small ghost" onClick={() => setEdit(item)}>
                      Düzenle
                    </button>
                    <button
                      className="btn small ghost danger-text"
                      onClick={() => {
                        if (!confirmDel(item.name)) return
                        remove('stock', item.id)
                        list('stockMoves')
                          .filter((m) => m.itemId === item.id)
                          .forEach((m) => remove('stockMoves', m.id))
                      }}
                    >
                      Sil
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </>
      )}

      {tab === 'hareket' &&
        (history.length === 0 ? (
          <Empty icon={Package} title="Hareket yok" />
        ) : (
          <div className="card table-wrap">
            <table className="table">
              <thead>
                <tr>
                  <th>Tarih</th>
                  <th>Kalem</th>
                  <th>Miktar</th>
                  <th>Tür</th>
                  <th>Tutar</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {history.map((m) => {
                  const item = get('stock', m.itemId)
                  return (
                    <tr key={m.id}>
                      <td>{fmtDate(m.date)}</td>
                      <td>
                        {item?.name || 'Silinmiş kalem'}
                        {m.note && <div className="tiny muted">{m.note}</div>}
                      </td>
                      <td className={m.qty < 0 ? 'danger-text' : ''}>
                        {m.qty > 0 ? '+' : ''}
                        {fmtQty(+m.qty)} {item?.unit}
                      </td>
                      <td>{MOVE_SOURCES[m.source] || '—'}</td>
                      <td>{m.cost ? money(m.cost) : '—'}</td>
                      <td>
                        {!m.refId && (
                          <button aria-label="Sil" className="btn tiny ghost danger-text" onClick={() => confirmDel('Stok hareketi') && remove('stockMoves', m.id)}>
                            <X size={14} />
                          </button>
                        )}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
            <p className="tiny muted">Yemleme ve sağlık kayıtlarından gelen hareketler o kayıt düzenlenince/silinince otomatik güncellenir.</p>
          </div>
        ))}

      {edit && <ItemForm initial={edit} onClose={() => setEdit(null)} />}
      {move && <MoveForm item={move.item} kind={move.kind} onClose={() => setMove(null)} />}
    </div>
  )
}
