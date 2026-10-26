import { ArrowLeftRight, Bird, CalendarClock, Egg, HeartPulse, NotebookPen, Package, Sparkles, Stethoscope, Wheat, X } from 'lucide-react'
import { daysBetween, fmtDate, money, today } from '../lib/format'
import { get, remove, useCollection, useSettings } from '../lib/store'
import { Badge, Stat, confirmDel } from '../components/ui'
import { fmtQty, stockLevels } from '../lib/stock'
import { useIsHelper } from '../lib/members'
import { clutchDates, clutchStatus, pairLabel } from './Breeding'
import { AiBrief } from '../components/AiPanels'

function greeting() {
  const h = new Date().getHours()
  return h < 6 ? 'İyi geceler' : h < 12 ? 'Günaydın' : h < 18 ? 'İyi günler' : 'İyi akşamlar'
}

export default function Dashboard({ go }) {
  const settings = useSettings()
  const pigeons = useCollection('pigeons')
  const pairs = useCollection('pairs')
  const clutches = useCollection('clutches')
  const health = useCollection('health')
  const notes = useCollection('notes')
  const helper = useIsHelper()
  useCollection('stockMoves')
  useCollection('stock')
  const lowStock = stockLevels().filter((l) => l.low)
  const t = today()
  const year = t.slice(0, 4)

  const active = pigeons.filter((p) => p.status === 'aktif')
  const activeClutches = clutches.filter((c) => !c.closed && !c.failed)
  const sales = pigeons.filter((p) => p.status === 'satildi' && (p.toDate || '').startsWith(year))
  const born = pigeons.filter((p) => p.origin === 'uretim' && (p.birthDate || '').startsWith(year))

  // Yaklaşan olaylar: çıkış, halkalama, ayırma, ilaç tekrarları
  const events = []
  for (const c of activeClutches) {
    const d = clutchDates(c)
    // Yumurtalar bakıcıdaysa kontrol edilecek yer bakıcının yuvasıdır
    const label = pairLabel(get('pairs', c.pairId)) + (c.fosterPairId ? ` → bakıcıda: ${pairLabel(get('pairs', c.fosterPairId))}` : '')
    if (!c.hatchDate && d.expectedHatch) events.push({ date: d.expectedHatch, icon: Egg, text: `Çıkış bekleniyor · ${label}`, to: 'uretim' })
    if (!c.hatchDate && d.candleDate && d.candleDate >= t) events.push({ date: d.candleDate, icon: CalendarClock, text: `Yumurta ışık kontrolü · ${label}`, to: 'uretim' })
    if (c.hatchDate) {
      const ringed = pigeons.filter((p) => p.clutchId === c.id).length
      if (ringed < (+c.hatched || 0)) events.push({ date: d.ringDate, icon: Bird, text: `Halkalama · ${label}`, to: 'uretim' })
      if (d.weanDate >= t) events.push({ date: d.weanDate, icon: Bird, text: `Yavru ayırma · ${label}`, to: 'uretim' })
    }
  }
  for (const h of health) {
    if (h.nextDate) events.push({ date: h.nextDate, icon: HeartPulse, text: `${h.medicine || h.diagnosis} tekrarı`, to: 'saglik' })
  }
  const upcoming = events
    .filter((e) => daysBetween(t, e.date) >= -3 && daysBetween(t, e.date) <= 21)
    .sort((a, b) => a.date.localeCompare(b.date))

  const lastHealth = health.slice().sort((a, b) => (b.date || '').localeCompare(a.date || ''))[0]
  const daysSinceHealth = lastHealth ? daysBetween(lastHealth.date, t) : null

  return (
    <div className="page">
      <div className="hero">
        <div>
          <p className="hero-date">
            {greeting()} · {new Date().toLocaleDateString('tr-TR', { weekday: 'long', day: 'numeric', month: 'long' })}
          </p>
          <h1>{settings.loftName}</h1>
          <p className="hero-sub">
            {active.length} aktif güvercin · {activeClutches.length} kuluçka · {upcoming.filter((e) => e.date === t).length} bugünkü iş
          </p>
        </div>
        <button className="btn primary" onClick={() => go('kuslar')}>
          <Bird size={18} /> Güvercinler
        </button>
      </div>

      <div className="stats">
 <Stat icon={Bird} label="Aktif güvercin" value={active.length} sub={`♂ ${active.filter((p) => p.sex === 'E').length} · ♀ ${active.filter((p) => p.sex === 'D').length}`} onClick={() => go('kuslar')} />
        <Stat icon={Egg} label="Aktif çift" value={pairs.filter((p) => p.active !== false).length} onClick={() => go('uretim')} />
        <Stat icon={CalendarClock} label="Kuluçka / yavrulu" value={activeClutches.length} onClick={() => go('uretim')} />
        <Stat icon={Sparkles} label={`${year} üretim`} value={born.length} sub="yavru" onClick={() => go('kuslar')} />
        {!helper && <Stat icon={ArrowLeftRight} label={`${year} satış`} value={sales.length} sub={money(sales.reduce((s, p) => s + (+p.toPrice || 0), 0))} onClick={() => go('alimsatim')} />}
        <Stat
          icon={HeartPulse}
          label="Son ilaçlama"
          value={daysSinceHealth == null ? '—' : `${daysSinceHealth} gün`}
          sub={lastHealth ? lastHealth.medicine || lastHealth.diagnosis : 'Kayıt yok'}
          tone={daysSinceHealth > 75 ? 'warn' : ''}
          onClick={() => go('saglik')}
        />
      </div>

      {lowStock.length > 0 && (
        <button className="alert warn link-row" onClick={() => go('stok')}>
          <Package size={16} /> Stok azaldı: {lowStock.map((l) => `${l.item.name} (${fmtQty(l.qty)} ${l.item.unit})`).join(', ')}
        </button>
      )}

      <AiBrief />

      <div className="grid-2">
        <div className="card">
          <h3>
            <CalendarClock size={18} /> Yaklaşan işler <span className="muted small">· 3 hafta</span>
          </h3>
          {upcoming.length === 0 && <p className="muted small">Yaklaşan bir iş yok.</p>}
          {upcoming.map((e, i) => {
            const d = daysBetween(t, e.date)
            return (
              <button key={i} className="list-row row between link-row" onClick={() => go(e.to)}>
                <span className="event">
                  <e.icon size={16} className="event-icon" /> {e.text}
                </span>
                <Badge tone={d < 0 ? 'danger' : d <= 2 ? 'warn' : 'info'}>{d === 0 ? 'Bugün' : d < 0 ? `${-d} gün geçti` : `${d} gün`}</Badge>
              </button>
            )
          })}
        </div>
        <div className="card">
          <h3>
            <Egg size={18} /> Kuluçkadakiler
          </h3>
          {activeClutches.length === 0 && <p className="muted small">Aktif kuluçka yok.</p>}
          {activeClutches.slice(0, 8).map((c) => {
            const st = clutchStatus(c)
            return (
              <button key={c.id} className="list-row row between link-row" onClick={() => go('uretim')}>
                <span>{pairLabel(get('pairs', c.pairId))}</span>
                <Badge tone={st.tone}>{st.text}</Badge>
              </button>
            )
          })}
        </div>
      </div>

      {notes.length > 0 && (
        <div className="card">
          <h3>
            <NotebookPen size={18} /> Notlar
          </h3>
          {notes.slice(0, 6).map((n) => (
            <div key={n.id} className="row between list-row small">
              <span>
                <span className="muted">{fmtDate(n.date)} · </span>
                {n.text}
              </span>
              <button className="icon-btn sm danger-text" onClick={() => confirmDel('Not') && remove('notes', n.id)} aria-label="Notu sil">
                <X size={16} />
              </button>
            </div>
          ))}
        </div>
      )}

      <div className="quick">
        <button className="quick-btn" onClick={() => go('saglik')}>
          <Stethoscope size={22} />
          <span>Hastalık tahmini</span>
        </button>
        <button className="quick-btn" onClick={() => go('yem')}>
          <Wheat size={22} />
          <span>Rasyon oluştur</span>
        </button>
        <button className="quick-btn" onClick={() => go('asistan')}>
          <Sparkles size={22} />
          <span>AI asistan</span>
        </button>
        {!helper && (
          <button className="quick-btn" onClick={() => go('alimsatim')}>
            <ArrowLeftRight size={22} />
            <span>Alım-satım</span>
          </button>
        )}
      </div>

      {active.length === 0 && (
        <div className="card">
          <h3>Hoş geldiniz</h3>
          <p>Başlamak için güvercinlerinizi halka numaralarıyla ekleyin, ardından çiftleri oluşturup yumurtlama kayıtlarını girin.</p>
        </div>
      )}
    </div>
  )
}
