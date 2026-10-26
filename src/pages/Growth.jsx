import { useEffect, useRef, useState } from 'react'
import { daysBetween, fmtDate, num, today } from '../lib/format'
import { get, remove, save, useCollection } from '../lib/store'
import { Empty, ErrorText, confirmDel } from '../components/ui'

const H = 240
const PAD = { l: 48, r: 16, t: 16, b: 34 }

function niceStep(range, target = 5) {
  const raw = range / target
  const mag = 10 ** Math.floor(Math.log10(raw || 1))
  return [1, 2, 5, 10].map((m) => m * mag).find((s) => s >= raw) || mag * 10
}

// Tek seri çizgi grafik: x = yaş (gün) ya da tarih, y = ağırlık (g)
function GrowthChart({ points, byAge }) {
  const ref = useRef()
  const wrap = useRef()
  const [hover, setHover] = useState(null)
  // Çizim alanı gerçek piksel genişliğinde: yazılar telefonda küçülmez
  const [W, setW] = useState(640)
  useEffect(() => {
    const ro = new ResizeObserver(([e]) => setW(Math.max(260, Math.round(e.contentRect.width))))
    ro.observe(wrap.current)
    return () => ro.disconnect()
  }, [])
  const xs = points.map((p) => p.x)
  const ys = points.map((p) => p.y)
  const xMin = Math.min(...xs)
  const xMax = Math.max(...xs) === xMin ? xMin + 1 : Math.max(...xs)
  const yStep = niceStep(Math.max(...ys) - Math.min(0, ...ys))
  const yMax = Math.ceil(Math.max(...ys) / yStep) * yStep || yStep
  const sx = (x) => PAD.l + ((x - xMin) / (xMax - xMin)) * (W - PAD.l - PAD.r)
  const sy = (y) => H - PAD.b - (y / yMax) * (H - PAD.t - PAD.b)
  const yTicks = []
  for (let y = 0; y <= yMax; y += yStep) yTicks.push(y)
  const xStep = niceStep(xMax - xMin, W < 420 ? 4 : 6)
  const xTicks = []
  for (let x = Math.ceil(xMin / xStep) * xStep; x <= xMax; x += xStep) xTicks.push(x)
  const xLabel = (x) => (byAge ? `${x}. gün` : fmtDate(new Date(x * 86400000).toISOString().slice(0, 10)).slice(0, 5))
  const path = points.map((p, i) => `${i ? 'L' : 'M'}${sx(p.x).toFixed(1)},${sy(p.y).toFixed(1)}`).join(' ')

  const onMove = (e) => {
    const box = ref.current.getBoundingClientRect()
    const x = ((e.clientX - box.left) / box.width) * W
    let best = 0
    points.forEach((p, i) => Math.abs(sx(p.x) - x) < Math.abs(sx(points[best].x) - x) && (best = i))
    setHover(best)
  }
  const h = hover != null ? points[hover] : null

  return (
    <div className="chart" ref={wrap}>
      <svg
        ref={ref}
        viewBox={`0 0 ${W} ${H}`}
        role="img"
        aria-label="Ağırlık gelişim grafiği"
        onPointerMove={onMove}
        onPointerLeave={() => setHover(null)}
      >
        {yTicks.map((y) => (
          <g key={y}>
            <line x1={PAD.l} x2={W - PAD.r} y1={sy(y)} y2={sy(y)} className="grid" />
            <text x={PAD.l - 8} y={sy(y)} className="tick" textAnchor="end" dominantBaseline="middle">
              {y}
            </text>
          </g>
        ))}
        {xTicks.map((x) => (
          <text key={x} x={sx(x)} y={H - PAD.b + 18} className="tick" textAnchor="middle">
            {xLabel(x)}
          </text>
        ))}
        <path d={`${path} L${sx(points[points.length - 1].x)},${sy(0)} L${sx(points[0].x)},${sy(0)} Z`} className="area" />
        <path d={path} className="line" />
        {h && <line x1={sx(h.x)} x2={sx(h.x)} y1={PAD.t} y2={H - PAD.b} className="crosshair" />}
        {points.map((p, i) => (
          <circle key={i} cx={sx(p.x)} cy={sy(p.y)} r={hover === i ? 6 : 4} className="dot" />
        ))}
        {/* Son değer doğrudan etiketlenir */}
        <text x={sx(points[points.length - 1].x)} y={sy(points[points.length - 1].y) - 12} className="end-label" textAnchor="end">
          {points[points.length - 1].y} g
        </text>
      </svg>
      {h && (
        <div
          className={'chart-tip' + (sy(h.y) < H / 2 ? ' below' : '')}
          style={{ left: Math.min(W - 70, Math.max(70, sx(h.x))), top: sy(h.y) }}
        >
          <strong>{h.y} g</strong>
          <span>
            {fmtDate(h.date)}
            {h.age != null && ` · ${h.age}. gün`}
          </span>
        </div>
      )}
    </div>
  )
}

export default function Growth({ pigeonId }) {
  const weights = useCollection('weights')
  const p = get('pigeons', pigeonId)
  const [date, setDate] = useState(today())
  const [gram, setGram] = useState('')
  const [err, setErr] = useState('')
  const rows = weights.filter((w) => w.pigeonId === pigeonId).sort((a, b) => (a.date || '').localeCompare(b.date || ''))
  const byAge = !!p?.birthDate
  const points = rows.map((w) => ({
    date: w.date,
    y: +w.gram,
    age: byAge ? daysBetween(p.birthDate, w.date) : null,
    x: byAge ? daysBetween(p.birthDate, w.date) : Math.round(new Date(w.date + 'T12:00:00Z').getTime() / 86400000),
  }))

  const add = (e) => {
    e.preventDefault()
    const g = num(gram)
    if (!g || g <= 0 || g > 1500) return setErr('Geçerli bir ağırlık (gram) girin.')
    if (byAge && date < p.birthDate) return setErr('Tartı tarihi doğumdan önce olamaz.')
    setErr('')
    save('weights', { pigeonId, date, gram: g })
    setGram('')
  }

  const first = rows[0]
  const last = rows[rows.length - 1]
  return (
    <>
      <form className="card row gap-s wrap no-print" onSubmit={add}>
        <input type="date" value={date} onChange={(e) => setDate(e.target.value)} style={{ maxWidth: 170 }} />
        <input inputMode="decimal" placeholder="Ağırlık (g)" value={gram} onChange={(e) => setGram(e.target.value)} style={{ maxWidth: 140 }} />
        <button className="btn primary">Tartı ekle</button>
        <ErrorText>{err}</ErrorText>
      </form>
      {rows.length === 0 ? (
        <Empty icon="⚖️" title="Tartı kaydı yok">
          Yavruları belirli aralıklarla tartarak gelişimini izleyin. Sesle de ekleyebilirsiniz: "Yıldız bugün 320 gram".
        </Empty>
      ) : (
        <>
          <div className="card">
            <h3>Ağırlık (g) — {byAge ? 'yaşa göre' : 'tarihe göre'}</h3>
            {rows.length > 1 && (
              <p className="small muted">
                {first.gram} g → {last.gram} g ({+last.gram - +first.gram >= 0 ? '+' : ''}
                {+last.gram - +first.gram} g, {daysBetween(first.date, last.date)} günde)
              </p>
            )}
            {rows.length > 1 ? <GrowthChart points={points} byAge={byAge} /> : <p className="small muted">Grafik için en az iki tartı gerekli.</p>}
          </div>
          <div className="card table-wrap">
            <table className="table">
              <thead>
                <tr>
                  <th>Tarih</th>
                  {byAge && <th>Yaş</th>}
                  <th>Ağırlık</th>
                  <th>Değişim</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {rows
                  .slice()
                  .reverse()
                  .map((w, i, arr) => {
                    const prev = arr[i + 1]
                    const diff = prev ? +w.gram - +prev.gram : null
                    return (
                      <tr key={w.id}>
                        <td>{fmtDate(w.date)}</td>
                        {byAge && <td>{daysBetween(p.birthDate, w.date)}. gün</td>}
                        <td>{w.gram} g</td>
                        <td className={diff < 0 ? 'danger-text' : ''}>{diff == null ? '—' : `${diff > 0 ? '+' : ''}${diff} g`}</td>
                        <td>
                          <button className="btn tiny ghost danger-text" onClick={() => confirmDel(`${fmtDate(w.date)} tartısı`) && remove('weights', w.id)}>
                            ✕
                          </button>
                        </td>
                      </tr>
                    )
                  })}
              </tbody>
            </table>
          </div>
        </>
      )}
    </>
  )
}
