import { ArrowDownLeft, ArrowLeftRight, ArrowUpRight, Handshake } from 'lucide-react'
import { useMemo, useState } from 'react'
import { ORIGIN, STATUS } from '../lib/constants'
import { exportCSV, fmtDate, money, today } from '../lib/format'
import { useCollection } from '../lib/store'
import { Badge, Empty, PageTitle, SearchBox, Stat, Tabs } from '../components/ui'

// Nereden geldi / kime satıldı kayıtlarının tek yerden izlenmesi
export default function Trade({ go }) {
  const pigeons = useCollection('pigeons')
  const [tab, setTab] = useState('satis')
  const [q, setQ] = useState('')
  const [year, setYear] = useState(today().slice(0, 4))

  const sales = pigeons.filter((p) => ['satildi', 'verildi'].includes(p.status))
  const buys = pigeons.filter((p) => p.origin && p.origin !== 'uretim')
  const inYear = (d) => !year || (d || '').startsWith(year)
  const s = q.toLocaleLowerCase('tr')
  const match = (p, name, phone, city) => !s || [p.ring, p.name, name, phone, city].some((v) => (v || '').toLocaleLowerCase('tr').includes(s))

  const rows = tab === 'satis' ? sales.filter((p) => inYear(p.toDate) && match(p, p.toName, p.toPhone, p.toCity)) : buys.filter((p) => inYear(p.fromDate) && match(p, p.fromName, p.fromPhone, p.fromCity))
  rows.sort((a, b) => ((tab === 'satis' ? b.toDate : b.fromDate) || '').localeCompare((tab === 'satis' ? a.toDate : a.fromDate) || ''))

  const totals = useMemo(() => {
    const sold = sales.filter((p) => p.status === 'satildi' && inYear(p.toDate)).reduce((t, p) => t + (+p.toPrice || 0), 0)
    const bought = buys.filter((p) => p.origin === 'alis' && inYear(p.fromDate)).reduce((t, p) => t + (+p.fromPrice || 0), 0)
    return { sold, bought }
  }, [sales, buys, year])

  // Kişi bazında özet (müşteri / tedarikçi)
  const people = useMemo(() => {
    const m = {}
    for (const p of rows) {
      const n = (tab === 'satis' ? p.toName : p.fromName) || 'Belirtilmemiş'
      m[n] ||= { count: 0, total: 0 }
      m[n].count++
      m[n].total += +(tab === 'satis' ? p.toPrice : p.fromPrice) || 0
    }
    return Object.entries(m).sort((a, b) => b[1].count - a[1].count)
  }, [rows, tab])

  const years = [...new Set(pigeons.flatMap((p) => [p.toDate, p.fromDate]).filter(Boolean).map((d) => d.slice(0, 4)))].sort().reverse()

  return (
    <div className="page">
      <div className="page-head">
        <PageTitle icon={ArrowLeftRight} title="Alım – Satım" subtitle="Nereden geldi, kime gitti" />
        <button
          className="btn ghost small"
          onClick={() =>
            exportCSV(
              rows.map((p) =>
                tab === 'satis'
                  ? { 'Halka No': p.ring, Ad: p.name, Durum: STATUS[p.status], Kime: p.toName, Telefon: p.toPhone, Şehir: p.toCity, Tarih: fmtDate(p.toDate), Fiyat: p.toPrice }
                  : { 'Halka No': p.ring, Ad: p.name, Köken: ORIGIN[p.origin], Kimden: p.fromName, Telefon: p.fromPhone, Şehir: p.fromCity, Tarih: fmtDate(p.fromDate), Fiyat: p.fromPrice },
              ),
              `kuru-${tab === 'satis' ? 'satislar' : 'alislar'}-${today()}.csv`,
            )
          }
        >
          Excel
        </button>
      </div>
      <div className="stats">
        <Stat label="Satış geliri" value={money(totals.sold)} />
        <Stat label="Alış gideri" value={money(totals.bought)} />
        <Stat label="Fark" value={money(totals.sold - totals.bought)} tone={totals.sold - totals.bought < 0 ? 'warn' : ''} />
      </div>
      <Tabs value={tab} onChange={setTab} tabs={{ satis: `Kime gitti (${sales.length})`, alis: `Nereden geldi (${buys.length})` }} />
      <div className="toolbar">
        <SearchBox value={q} onChange={setQ} placeholder="Kişi, telefon, halka no…" />
        <select value={year} onChange={(e) => setYear(e.target.value)}>
          <option value="">Tüm yıllar</option>
          {[...new Set([today().slice(0, 4), ...years])].map((y) => (
            <option key={y}>{y}</option>
          ))}
        </select>
      </div>
      {people.length > 1 && (
        <div className="card">
          <h3>{tab === 'satis' ? 'Müşteriler' : 'Tedarikçiler'}</h3>
          <div className="chips">
            {people.map(([n, v]) => (
              <button key={n} className="chip" onClick={() => setQ(n === 'Belirtilmemiş' ? '' : n)}>
                {n} · {v.count} kuş {v.total ? `· ${money(v.total)}` : ''}
              </button>
            ))}
          </div>
        </div>
      )}
      {rows.length === 0 ? (
        <Empty icon={Handshake} title="Kayıt yok">
          Güvercin kartında "Durum" alanını "Satıldı" yaparak veya köken bilgisini girerek kayıt oluşturun.
        </Empty>
      ) : (
        <div className="card-list">
          {rows.map((p) => (
            <button key={p.id} className="pigeon-card" onClick={() => go(`kus/${p.id}`)}>
              <div className="avatar">{tab === 'satis' ? <ArrowUpRight size={22} /> : <ArrowDownLeft size={22} />}</div>
              <div className="pc-body">
                <strong>
                  {p.ring} {p.name && `· ${p.name}`}
                </strong>
                <div className="pc-meta">
                  {tab === 'satis' ? p.toName : p.fromName} {(tab === 'satis' ? p.toPhone : p.fromPhone) && `· ${tab === 'satis' ? p.toPhone : p.fromPhone}`}{' '}
                  {(tab === 'satis' ? p.toCity : p.fromCity) && `· ${tab === 'satis' ? p.toCity : p.fromCity}`}
                </div>
                <div className="pc-meta">{fmtDate(tab === 'satis' ? p.toDate : p.fromDate)}</div>
              </div>
              <div className="pc-side">
                <Badge tone="info">{tab === 'satis' ? STATUS[p.status] : ORIGIN[p.origin]}</Badge>
                <span className="small">{money(tab === 'satis' ? p.toPrice : p.fromPrice)}</span>
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
