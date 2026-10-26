import { daysBetween, fmtDate, money, today } from '../lib/format'
import { get, useCollection, useSettings } from '../lib/store'
import { Badge, Stat } from '../components/ui'
import { clutchDates, clutchStatus, pairLabel } from './Breeding'

export default function Dashboard({ go }) {
  const settings = useSettings()
  const pigeons = useCollection('pigeons')
  const pairs = useCollection('pairs')
  const clutches = useCollection('clutches')
  const health = useCollection('health')
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
    const label = pairLabel(get('pairs', c.pairId))
    if (!c.hatchDate && d.expectedHatch) events.push({ date: d.expectedHatch, icon: '🐣', text: `Çıkış bekleniyor · ${label}`, to: 'uretim' })
    if (!c.hatchDate && d.candleDate && d.candleDate >= t) events.push({ date: d.candleDate, icon: '🔦', text: `Yumurta ışık kontrolü · ${label}`, to: 'uretim' })
    if (c.hatchDate) {
      const ringed = pigeons.filter((p) => p.clutchId === c.id).length
      if (ringed < (+c.hatched || 0)) events.push({ date: d.ringDate, icon: '💍', text: `Halkalama · ${label}`, to: 'uretim' })
      if (d.weanDate >= t) events.push({ date: d.weanDate, icon: '🕊️', text: `Yavru ayırma · ${label}`, to: 'uretim' })
    }
  }
  for (const h of health) {
    if (h.nextDate) events.push({ date: h.nextDate, icon: '💊', text: `${h.medicine || h.diagnosis} tekrarı`, to: 'saglik' })
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
          <p className="muted small">{fmtDate(t)}</p>
          <h1>{settings.loftName}</h1>
        </div>
        <button className="btn primary" onClick={() => go('kuslar')}>
          Güvercinler →
        </button>
      </div>

      <div className="stats">
        <Stat label="Aktif güvercin" value={active.length} sub={`♂ ${active.filter((p) => p.sex === 'E').length} · ♀ ${active.filter((p) => p.sex === 'D').length}`} onClick={() => go('kuslar')} />
        <Stat label="Aktif çift" value={pairs.filter((p) => p.active !== false).length} onClick={() => go('uretim')} />
        <Stat label="Kuluçka / yavrulu" value={activeClutches.length} onClick={() => go('uretim')} />
        <Stat label={`${year} üretim`} value={born.length} sub="yavru" onClick={() => go('kuslar')} />
        <Stat label={`${year} satış`} value={sales.length} sub={money(sales.reduce((s, p) => s + (+p.toPrice || 0), 0))} onClick={() => go('alimsatim')} />
        <Stat
          label="Son ilaçlama"
          value={daysSinceHealth == null ? '—' : `${daysSinceHealth} gün`}
          sub={lastHealth ? lastHealth.medicine || lastHealth.diagnosis : 'Kayıt yok'}
          tone={daysSinceHealth > 75 ? 'warn' : ''}
          onClick={() => go('saglik')}
        />
      </div>

      <div className="grid-2">
        <div className="card">
          <h3>Yaklaşan işler (3 hafta)</h3>
          {upcoming.length === 0 && <p className="muted small">Yaklaşan bir iş yok.</p>}
          {upcoming.map((e, i) => {
            const d = daysBetween(t, e.date)
            return (
              <button key={i} className="list-row row between link-row" onClick={() => go(e.to)}>
                <span>
                  {e.icon} {e.text}
                </span>
                <Badge tone={d < 0 ? 'danger' : d <= 2 ? 'warn' : 'info'}>{d === 0 ? 'Bugün' : d < 0 ? `${-d} gün geçti` : `${d} gün`}</Badge>
              </button>
            )
          })}
        </div>
        <div className="card">
          <h3>Kuluçkadakiler</h3>
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

      <div className="quick">
        <button className="quick-btn" onClick={() => go('saglik')}>
          🩺<span>Hastalık tahmini</span>
        </button>
        <button className="quick-btn" onClick={() => go('yem')}>
          🌾<span>Rasyon oluştur</span>
        </button>
        <button className="quick-btn" onClick={() => go('asistan')}>
          🤖<span>AI asistan</span>
        </button>
        <button className="quick-btn" onClick={() => go('alimsatim')}>
          🤝<span>Alım-satım</span>
        </button>
      </div>

      {active.length === 0 && (
        <div className="card">
          <h3>Hoş geldiniz 👋</h3>
          <p>Başlamak için güvercinlerinizi halka numaralarıyla ekleyin, ardından çiftleri oluşturup yumurtlama kayıtlarını girin.</p>
        </div>
      )}
    </div>
  )
}
