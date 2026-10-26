import { ChevronLeft } from 'lucide-react'
import QRCode from 'qrcode'
import { useEffect, useState } from 'react'
import { SEX } from '../lib/constants'
import { fmtDate } from '../lib/format'
import { get, useCollection, useSettings } from '../lib/store'
import { Empty, Select } from '../components/ui'

const SIZES = { kucuk: 'Küçük (50×30 mm)', orta: 'Orta (70×40 mm)', buyuk: 'Büyük (90×55 mm)' }

function Label({ p, size, loftName }) {
  const [qr, setQr] = useState('')
  useEffect(() => {
    // QR okutulunca uygulamada bu kuşun kartı açılır
    QRCode.toDataURL(`${location.origin}/#/kus/${p.id}`, { errorCorrectionLevel: 'M', margin: 0, width: 220 }).then(setQr)
  }, [p.id])
  return (
    <div className={'label ' + size}>
      {qr && <img src={qr} alt="" />}
      <div>
        <strong>{p.ring}</strong>
        {p.name && <span className="label-name">{p.name}</span>}
        <span>
          {SEX[p.sex]?.[0] || ''} · {[p.breed, p.color].filter(Boolean).join(' · ')}
        </span>
        {size !== 'kucuk' && <span>Doğum: {fmtDate(p.birthDate)}</span>}
        {size === 'buyuk' && p.loft && <span>Kafes: {p.loft}</span>}
        {size !== 'kucuk' && <span className="label-loft">{loftName}</span>}
      </div>
    </div>
  )
}

export default function Labels({ ids, go }) {
  useCollection('pigeons')
  const settings = useSettings()
  const [size, setSize] = useState('orta')
  const [copies, setCopies] = useState(1)
  const birds = (ids || '')
    .split(',')
    .map((id) => get('pigeons', id))
    .filter(Boolean)
  if (!birds.length) return <Empty title="Etiket için kuş seçilmedi">Güvercinler listesinde "Seç" ile kuşları işaretleyin veya kuş sayfasından "Etiket" deyin.</Empty>
  const all = birds.flatMap((p) => Array.from({ length: Math.max(1, +copies || 1) }, () => p))
  return (
    <div className="page">
      <div className="page-head no-print">
        <button className="btn ghost small" onClick={() => history.back()}>
          <ChevronLeft size={16} /> Geri
        </button>
        <button className="btn primary small" onClick={() => window.print()}>
          Yazdır
        </button>
      </div>
      <div className="toolbar no-print">
        <Select value={size} onChange={setSize} options={SIZES} placeholder="Boyut" />
        <label className="row gap-s">
          <span className="small">Kopya</span>
          <input type="number" min="1" max="20" value={copies} onChange={(e) => setCopies(e.target.value)} style={{ width: 80 }} />
        </label>
      </div>
      <p className="small muted no-print">
        {birds.length} kuş, {all.length} etiket. Etiketi telefon kamerasıyla okutunca kuşun kartı açılır. A4 yapışkanlı etiket kağıdına veya normal kağıda basıp kesebilirsiniz.
      </p>
      <div className="labels">
        {all.map((p, i) => (
          <Label key={i} p={p} size={size} loftName={settings.loftName} />
        ))}
      </div>
    </div>
  )
}
