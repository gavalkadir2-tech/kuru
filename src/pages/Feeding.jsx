import { Wheat } from 'lucide-react'
import { useMemo, useState } from 'react'
import { GRAINS, PERIODS } from '../lib/constants'
import { exportCSV, fmtDate, money, num, today } from '../lib/format'
import { askAI } from '../lib/ai'
import { optimizeRation } from '../lib/localAi'
import { fmtQty, gramsToUnit, removeLinkedMove, stockLevels, syncLinkedMove } from '../lib/stock'
import { get, remove, save, useCollection } from '../lib/store'
import { cloudEnabled } from '../lib/supabase'
import { confirmDel, Empty, ErrorText, Field, Markdown, Modal, PageTitle, Select, Tabs } from '../components/ui'

const DEFAULT_GRAINS = ['misir', 'bugday', 'arpa', 'dari', 'bezelye', 'aspir']
const grainName = (id) => GRAINS.find((g) => g.id === id)?.name || id
const fmt1 = (n) => (Math.round(n * 10) / 10).toLocaleString('tr-TR')

function RationBuilder() {
  const pigeons = useCollection('pigeons')
  const activeCount = pigeons.filter((p) => p.status === 'aktif').length
  const [period, setPeriod] = useState('bakim')
  const [count, setCount] = useState(activeCount || 10)
  const [grains, setGrains] = useState(DEFAULT_GRAINS)
  const [result, setResult] = useState(null)
  const [ai, setAi] = useState('')
  const [err, setErr] = useState('')
  const [loading, setLoading] = useState(false)
  const [name, setName] = useState('')

  const toggle = (id) => setGrains((g) => (g.includes(id) ? g.filter((x) => x !== id) : [...g, id]))
  const calc = () => {
    setErr('')
    if (grains.length < 2) return setErr('En az 2 yem seçin.')
    setResult(optimizeRation(grains, period))
  }
  const per = PERIODS[period]
  const daily = (+count || 0) * per.gram

  const runAI = async () => {
    setLoading(true)
    setErr('')
    try {
      setAi(
        await askAI('ration', {
          period: per.name,
          count: +count || 0,
          grains: grains.map(grainName),
          target: { protein: per.p, fat: per.f, gramPerBird: per.gram },
          localMix: result ? Object.entries(result.mix).map(([id, pct]) => `${grainName(id)} %${pct}`) : [],
        }),
      )
    } catch (e) {
      setErr(e.message)
    } finally {
      setLoading(false)
    }
  }

  const saveRation = () => {
    if (!result) return
    save('rations', { name: name.trim() || `${per.name} rasyonu`, period, mix: result.mix, nutrients: result.nutrients, aiNote: ai })
    setName('')
    alert('Rasyon kaydedildi.')
  }

  return (
    <>
      <div className="card">
        <div className="form-grid">
          <Field label="Dönem">
            <Select value={period} onChange={(v) => (setPeriod(v), setResult(null))} options={Object.fromEntries(Object.entries(PERIODS).map(([k, v]) => [k, v.name]))} placeholder="—" />
          </Field>
          <Field label="Kuş sayısı" hint={`Aktif kayıtlı: ${activeCount}`}>
            <input type="number" min="1" value={count} onChange={(e) => setCount(e.target.value)} />
          </Field>
        </div>
        <p className="small muted">
          Hedef: protein %{per.p}, yağ %{per.f}, kuş başı ~{per.gram} g/gün. {per.note}
        </p>
        <h3>Elinizdeki yemler</h3>
        <div className="chips">
          {GRAINS.map((g) => (
            <button key={g.id} className={'chip' + (grains.includes(g.id) ? ' on' : '')} onClick={() => (toggle(g.id), setResult(null))}>
              {g.name}
            </button>
          ))}
        </div>
        <ErrorText>{err}</ErrorText>
        <div className="row gap-s mt wrap">
          <button className="btn primary" onClick={calc}>
            Rasyonu hesapla
          </button>
          <button className="btn" onClick={runAI} disabled={loading || !cloudEnabled}>
            {loading ? 'Hazırlanıyor…' : '🤖 Yapay zeka önerisi'}
          </button>
        </div>
      </div>

      {result && (
        <div className="card">
          <h3>Önerilen karışım — {per.name}</h3>
          <div className="table-wrap">
            <table className="table">
              <thead>
                <tr>
                  <th>Yem</th>
                  <th>%</th>
                  <th>Günlük (g)</th>
                  <th>Haftalık (kg)</th>
                </tr>
              </thead>
              <tbody>
                {Object.entries(result.mix)
                  .sort((a, b) => b[1] - a[1])
                  .map(([id, pct]) => (
                    <tr key={id}>
                      <td>{grainName(id)}</td>
                      <td>%{pct}</td>
                      <td>{fmt1((daily * pct) / 100)}</td>
                      <td>{fmt1((daily * pct * 7) / 100000)}</td>
                    </tr>
                  ))}
                <tr className="total">
                  <td>Toplam</td>
                  <td>%100</td>
                  <td>{fmt1(daily)}</td>
                  <td>{fmt1((daily * 7) / 1000)}</td>
                </tr>
              </tbody>
            </table>
          </div>
          <div className="nutri">
            <div>
              Protein <strong>%{fmt1(result.nutrients.p)}</strong> <span className="muted">(hedef %{per.p})</span>
            </div>
            <div>
              Yağ <strong>%{fmt1(result.nutrients.f)}</strong> <span className="muted">(hedef %{per.f})</span>
            </div>
            <div>
              Karbonhidrat <strong>%{fmt1(result.nutrients.c)}</strong>
            </div>
          </div>
          {result.nutrients.p < per.p - 0.7 && <div className="alert warn">Protein hedefin altında: listeye bezelye, fiğ, mercimek veya bakla gibi baklagil ekleyin.</div>}
          {result.nutrients.p > per.p + 0.7 && <div className="alert warn">Protein hedefin üstünde: mısır, buğday, arpa veya çeltik gibi tahıl ekleyin.</div>}
          {result.nutrients.f < per.f - 0.7 && <div className="alert warn">Yağ hedefin altında: kenevir, aspir veya ayçiçeği gibi yağlı tohum ekleyin.</div>}
          <p className="small muted">Yanında her zaman grit/mineral ve temiz su bulundurun. Değerler yaklaşıktır.</p>
          <div className="row gap-s wrap">
            <input className="grow" value={name} onChange={(e) => setName(e.target.value)} placeholder="Rasyon adı (isteğe bağlı)" />
            <button className="btn primary" onClick={saveRation}>
              Rasyonu kaydet
            </button>
          </div>
        </div>
      )}

      {ai && (
        <div className="card ai-card">
          <h3>🤖 Yapay zeka önerisi</h3>
          <Markdown text={ai} />
        </div>
      )}
    </>
  )
}

function SavedRations() {
  const rations = useCollection('rations')
  const [open, setOpen] = useState(null)
  if (!rations.length) return <Empty icon="🌾" title="Kayıtlı rasyon yok">Rasyon Oluştur sekmesinden hesaplayıp kaydedin.</Empty>
  return (
    <div className="card-list">
      {rations.map((r) => (
        <div key={r.id} className="card">
          <div className="row between wrap gap-s">
            <strong>{r.name}</strong>
            <span className="small muted">{PERIODS[r.period]?.name}</span>
          </div>
          <div className="small">
            {Object.entries(r.mix || {})
              .sort((a, b) => b[1] - a[1])
              .map(([id, pct]) => `${grainName(id)} %${pct}`)
              .join(' · ')}
          </div>
          {r.nutrients && (
            <div className="small muted">
              Protein %{fmt1(r.nutrients.p)} · Yağ %{fmt1(r.nutrients.f)}
            </div>
          )}
          <div className="row gap-s">
            {r.aiNote && (
              <button className="btn small" onClick={() => setOpen(r)}>
                AI notu
              </button>
            )}
            <button className="btn small ghost danger-text" onClick={() => confirmDel(r.name) && remove('rations', r.id)}>
              Sil
            </button>
          </div>
        </div>
      ))}
      {open && (
        <Modal title={open.name} onClose={() => setOpen(null)}>
          <Markdown text={open.aiNote} />
        </Modal>
      )}
    </div>
  )
}

function FeedForm({ initial, onClose }) {
  const rations = useCollection('rations')
  const pigeons = useCollection('pigeons')
  useCollection('stockMoves')
  const stockOpts = stockLevels().filter((l) => ['yem', 'vitamin'].includes(l.item.category))
  const [f, setF] = useState({
    date: today(),
    rationId: '',
    feed: '',
    stockItemId: '',
    stockQty: '',
    amount: '',
    count: pigeons.filter((p) => p.status === 'aktif').length || '',
    cost: '',
    notes: '',
    ...initial,
  })
  const [err, setErr] = useState('')
  const set = (k) => (v) => setF((s) => ({ ...s, [k]: v?.target ? v.target.value : v }))
  const submit = (e) => {
    e.preventDefault()
    if (!f.rationId && !f.feed.trim()) return setErr('Rasyon seçin veya yem adını yazın.')
    if (!num(f.amount)) return setErr('Verilen miktarı (gram) girin.')
    const item = stockOpts.find((l) => l.item.id === f.stockItemId)?.item
    const used = item ? gramsToUnit(num(f.amount), item.unit) ?? num(f.stockQty) : ''
    if (item && !used) return setErr(`Stoktan düşülecek miktarı (${item.unit}) girin.`)
    const rec = save('feedings', { ...f, amount: num(f.amount), count: num(f.count), cost: num(f.cost), stockQty: item ? used : '' })
    syncLinkedMove({ refId: rec.id, source: 'feeding', itemId: item?.id, qty: used, date: rec.date, note: 'Yemleme' })
    onClose()
  }
  return (
    <Modal
      title={f.id ? 'Yemleme kaydını düzenle' : 'Yemleme kaydı'}
      onClose={onClose}
      footer={
        <>
          <button className="btn ghost" onClick={onClose}>
            Vazgeç
          </button>
          <button className="btn primary" form="feed-form">
            Kaydet
          </button>
        </>
      }
    >
      <form id="feed-form" onSubmit={submit} className="form-grid">
        <ErrorText>{err}</ErrorText>
        <Field label="Tarih">
          <input type="date" value={f.date} onChange={set('date')} />
        </Field>
        <Field label="Rasyon">
          <Select value={f.rationId} onChange={set('rationId')} options={rations.map((r) => [r.id, r.name])} placeholder="— Yok —" />
        </Field>
        <Field label="…veya yem / ek gıda">
          <input value={f.feed} onChange={set('feed')} placeholder="Örn: Hazır yem, vitamin, grit" />
        </Field>
        <Field label="Miktar (gram) *">
          <input inputMode="decimal" value={f.amount} onChange={set('amount')} />
        </Field>
        <Field label="Kuş sayısı">
          <input inputMode="numeric" value={f.count} onChange={set('count')} />
        </Field>
        <Field label="Stoktan düş" hint={stockOpts.length ? '' : 'Stok sayfasından yem ekleyince seçilebilir'}>
          <select value={f.stockItemId} onChange={set('stockItemId')} disabled={!stockOpts.length}>
            <option value="">— Düşme —</option>
            {stockOpts.map((l) => (
              <option key={l.item.id} value={l.item.id}>
                {l.item.name} ({fmtQty(l.qty)} {l.item.unit})
              </option>
            ))}
          </select>
        </Field>
        {(() => {
          const item = stockOpts.find((l) => l.item.id === f.stockItemId)?.item
          if (!item || gramsToUnit(1, item.unit) != null) return null
          return (
            <Field label={`Düşülecek miktar (${item.unit})`}>
              <input inputMode="decimal" value={f.stockQty} onChange={set('stockQty')} />
            </Field>
          )
        })()}
        <Field label="Maliyet (₺)">
          <input inputMode="decimal" value={f.cost} onChange={set('cost')} />
        </Field>
        <Field label="Notlar" full>
          <textarea rows={2} value={f.notes} onChange={set('notes')} />
        </Field>
      </form>
    </Modal>
  )
}

function FeedLog() {
  const feedings = useCollection('feedings')
  useCollection('rations')
  const [edit, setEdit] = useState(null)
  const rows = feedings.slice().sort((a, b) => (b.date || '').localeCompare(a.date || ''))
  const month = today().slice(0, 7)
  const stats = useMemo(() => {
    const m = rows.filter((r) => (r.date || '').startsWith(month))
    return { kg: m.reduce((s, r) => s + (+r.amount || 0), 0) / 1000, cost: m.reduce((s, r) => s + (+r.cost || 0), 0), days: new Set(m.map((r) => r.date)).size }
  }, [rows, month])
  const label = (r) => (r.rationId ? get('rations', r.rationId)?.name || 'Silinmiş rasyon' : r.feed)

  return (
    <>
      <div className="row between wrap gap-s">
        <p className="small muted">
          Bu ay: {fmt1(stats.kg)} kg · {stats.days} gün · {money(stats.cost)}
        </p>
        <div className="row gap-s">
          <button
            className="btn ghost small"
            onClick={() =>
              exportCSV(
                rows.map((r) => ({ Tarih: fmtDate(r.date), Yem: label(r), 'Miktar (g)': r.amount, 'Kuş Sayısı': r.count, Maliyet: r.cost, Notlar: r.notes })),
                `kuru-yemleme-${today()}.csv`,
              )
            }
          >
            Excel
          </button>
          <button className="btn primary" onClick={() => setEdit({})}>
            + Yemleme
          </button>
        </div>
      </div>
      {rows.length === 0 ? (
        <Empty icon="🌾" title="Yemleme kaydı yok" />
      ) : (
        <div className="table-wrap card">
          <table className="table">
            <thead>
              <tr>
                <th>Tarih</th>
                <th>Yem</th>
                <th>Miktar</th>
                <th>Kuş başı</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.id}>
                  <td>{fmtDate(r.date)}</td>
                  <td>{label(r)}</td>
                  <td>{fmt1(+r.amount || 0)} g</td>
                  <td>{r.count ? `${fmt1(r.amount / r.count)} g` : '—'}</td>
                  <td className="nowrap">
                    <button className="btn tiny" onClick={() => setEdit(r)}>
                      ✎
                    </button>
                    <button className="btn tiny ghost danger-text" onClick={() => {
                        if (!confirmDel(`${fmtDate(r.date)} yemleme`)) return
                        remove('feedings', r.id)
                        removeLinkedMove(r.id)
                      }}>
                      ✕
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {edit && <FeedForm initial={edit} onClose={() => setEdit(null)} />}
    </>
  )
}

export default function Feeding() {
  const [tab, setTab] = useState('rasyon')
  return (
    <div className="page">
      <div className="page-head">
        <PageTitle icon={Wheat} title="Yemleme & Rasyon" subtitle="Döneme göre karışım ve yemleme kaydı" />
      </div>
      <Tabs value={tab} onChange={setTab} tabs={{ rasyon: 'Rasyon Oluştur', kayit: 'Yemleme Kaydı', kayitli: 'Kayıtlı Rasyonlar' }} />
      {tab === 'rasyon' && <RationBuilder />}
      {tab === 'kayit' && <FeedLog />}
      {tab === 'kayitli' && <SavedRations />}
    </div>
  )
}
