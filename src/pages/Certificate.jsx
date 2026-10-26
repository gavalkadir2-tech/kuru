import QRCode from 'qrcode'
import { useEffect, useState } from 'react'
import { SEX } from '../lib/constants'
import { fmtDate } from '../lib/format'
import { PhotoImg } from '../lib/photos'
import { decodeShare, pedigreeTree, shareUrl } from '../lib/share'
import { useRecord, useSettings } from '../lib/store'
import { Empty } from '../components/ui'

function Box({ node, role }) {
  if (!node) {
    return (
      <div className="ped-box empty">
        <span className="ped-role">{role}</span>
        <span>Bilinmiyor</span>
      </div>
    )
  }
  return (
    <div className="ped-box">
      <span className="ped-role">{role}</span>
      <strong>{node.ring}</strong>
      {!node.external && <span>{[node.name, node.color, node.breed].filter(Boolean).join(' · ') || '—'}</span>}
      {node.traits && <span className="ped-traits">{node.traits}</span>}
    </div>
  )
}

// Veri tabanlı soy ağacı (kayıtlı kuştan ya da paylaşım bağlantısından)
export function PedTree({ node, gen = 1, maxGen = 4, role = 'Kuş' }) {
  if (gen >= maxGen) return <div className="ped-branch">{<Box node={node} role={role} />}</div>
  return (
    <div className="ped-branch">
      <Box node={node} role={role} />
      <div className="ped-parents">
        <PedTree node={node?.father} gen={gen + 1} maxGen={maxGen} role="Baba" />
        <PedTree node={node?.mother} gen={gen + 1} maxGen={maxGen} role="Anne" />
      </div>
    </div>
  )
}

function useQr(text) {
  const [src, setSrc] = useState('')
  useEffect(() => {
    if (!text) return
    QRCode.toDataURL(text, { errorCorrectionLevel: 'L', margin: 1, width: 300 }).then(setSrc).catch(() => setSrc(''))
  }, [text])
  return src
}

function CertificateBody({ tree, loftName, owner, date, qr, photoId }) {
  return (
    <div className="certificate">
      <header className="cert-head">
        <img src="/icon.svg" alt="" width="56" height="56" />
        <div>
          <h1>Soy Kütüğü Belgesi</h1>
          <p>{loftName}</p>
        </div>
        {qr && <img className="cert-qr" src={qr} alt="Soy kütüğü QR kodu" />}
      </header>
      <section className="cert-bird">
        {photoId && <PhotoImg id={photoId} className="cert-photo" />}
        <div className="cert-fields">
          <div>
            <span>Halka No</span>
            <strong>{tree.ring}</strong>
          </div>
          <div>
            <span>Adı</span>
            {tree.name || '—'}
          </div>
          <div>
            <span>Cinsiyet</span>
            {SEX[tree.sex] || '—'}
          </div>
          <div>
            <span>Irk</span>
            {tree.breed || '—'}
          </div>
          <div>
            <span>Renk</span>
            {tree.color || '—'}
          </div>
          <div>
            <span>Doğum</span>
            {fmtDate(tree.birthDate)}
          </div>
          {tree.traits && (
            <div className="wide">
              <span>Özellikler</span>
              {tree.traits}
            </div>
          )}
        </div>
      </section>
      <section className="pedigree cert-tree">
        <PedTree node={tree} />
      </section>
      <footer className="cert-foot">
        <div>
          <span>Yetiştirici</span>
          <strong>{owner}</strong>
        </div>
        <div>
          <span>Tarih</span>
          {fmtDate(date)}
        </div>
        <div className="sign">
          <span>İmza</span>
        </div>
      </footer>
    </div>
  )
}

export default function Certificate({ id, go }) {
  const p = useRecord('pigeons', id)
  const settings = useSettings()
  const [url, setUrl] = useState('')
  const [msg, setMsg] = useState('')
  useEffect(() => {
    if (p) shareUrl(p.id).then(setUrl)
  }, [p?.id, p?.updated_at])
  const qr = useQr(url)

  if (!p) return <Empty title="Kayıt bulunamadı" />
  const share = async () => {
    try {
      if (navigator.share) await navigator.share({ title: `${p.ring} soy kütüğü`, text: `${settings.loftName} — ${p.ring} soy kütüğü`, url })
      else {
        await navigator.clipboard.writeText(url)
        setMsg('Bağlantı kopyalandı.')
      }
    } catch {}
  }
  return (
    <div className="page">
      <div className="page-head no-print">
        <button className="btn ghost small" onClick={() => go(`kus/${p.id}`)}>
          ← Geri
        </button>
        <div className="row gap-s wrap">
          <button className="btn small" onClick={share} disabled={!url}>
            Bağlantıyı paylaş
          </button>
          <button className="btn small primary" onClick={() => window.print()}>
            Yazdır / PDF
          </button>
        </div>
      </div>
      {msg && <div className="alert info no-print">{msg}</div>}
      <p className="small muted no-print">
        PDF için "Yazdır / PDF" deyip yazıcı olarak "PDF olarak kaydet"i seçin. QR kod okutulunca soy kütüğü giriş gerektirmeden açılır.
      </p>
      <CertificateBody tree={pedigreeTree(p.id)} loftName={settings.loftName} owner={settings.owner} date={new Date().toISOString().slice(0, 10)} qr={qr} photoId={p.photos?.[0]?.id} />
    </div>
  )
}

// Giriş gerektirmeyen, paylaşım bağlantısıyla açılan sayfa
export function SharedPedigree({ code }) {
  const [data, setData] = useState(null)
  const [err, setErr] = useState('')
  useEffect(() => {
    decodeShare(code)
      .then(setData)
      .catch(() => setErr('Bağlantı bozuk veya eksik.'))
  }, [code])
  const qr = useQr(location.href)
  if (err) return <div className="shared"><Empty title={err} /></div>
  if (!data) return <div className="splash">🕊️</div>
  return (
    <div className="shared">
      <div className="row between no-print">
        <span className="small muted">Kuru güvercin takip programı ile oluşturuldu</span>
        <button className="btn small" onClick={() => window.print()}>
          Yazdır / PDF
        </button>
      </div>
      <CertificateBody tree={data.tree} loftName={data.loftName} owner={data.owner} date={data.date} qr={qr} />
    </div>
  )
}
