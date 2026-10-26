import { useState } from 'react'
import { HEALTH_TYPES, ORIGIN, SEX, STATUS } from '../lib/constants'
import { ageText, fmtDate, money, pigeonLabel } from '../lib/format'
import { offspring } from '../lib/pedigree'
import { get, remove, useCollection, useRecord } from '../lib/store'
import { Badge, Empty, Gallery, Tabs, confirmDel } from '../components/ui'
import { PhotoImg, deletePhoto } from '../lib/photos'
import { PigeonForm, STATUS_TONE, parentLabel } from './Pigeons'
import { HealthForm } from './Health'

function PedNode({ id, text, gen, maxGen, go, role }) {
  const p = id ? get('pigeons', id) : null
  const box = (
    <div className={'ped-box' + (p ? ' linked' : text ? '' : ' empty')} onClick={() => p && gen > 1 && go(`kus/${p.id}`)}>
      <span className="ped-role">{role}</span>
      {p ? (
        <>
          <strong>{p.ring}</strong>
          <span>{[p.name, p.color, p.breed].filter(Boolean).join(' · ') || '—'}</span>
        </>
      ) : (
        <span>{text || 'Bilinmiyor'}</span>
      )}
    </div>
  )
  if (gen >= maxGen) return <div className="ped-branch">{box}</div>
  return (
    <div className="ped-branch">
      {box}
      <div className="ped-parents">
        <PedNode id={p?.fatherId} text={p?.fatherText} gen={gen + 1} maxGen={maxGen} go={go} role="Baba" />
        <PedNode id={p?.motherId} text={p?.motherText} gen={gen + 1} maxGen={maxGen} go={go} role="Anne" />
      </div>
    </div>
  )
}

export function Pedigree({ id, go, maxGen = 4 }) {
  return (
    <div className="pedigree">
      <PedNode id={id} gen={1} maxGen={maxGen} go={go} role="Kuş" />
    </div>
  )
}

export default function PigeonDetail({ id, go }) {
  const p = useRecord('pigeons', id)
  const health = useCollection('health')
  const pairs = useCollection('pairs')
  const clutches = useCollection('clutches')
  useCollection('pigeons')
  const [tab, setTab] = useState('soy')
  const [edit, setEdit] = useState(false)
  const [addHealth, setAddHealth] = useState(false)

  if (!p)
    return (
      <div className="page">
        <Empty title="Kayıt bulunamadı" />
        <button className="btn" onClick={() => go('kuslar')}>
          Güvercinlere dön
        </button>
      </div>
    )

  const kids = offspring(p.id)
  const myHealth = health.filter((h) => h.pigeonIds?.includes(p.id) || h.scope === 'all')
  const myPairs = pairs.filter((x) => x.maleId === p.id || x.femaleId === p.id)

  const del = () => {
    if (!confirmDel(pigeonLabel(p))) return
    remove('pigeons', p.id)
    ;(p.photos || []).forEach((ph) => deletePhoto(ph.id))
    go('kuslar')
  }

  return (
    <div className="page">
      <div className="page-head">
        <button className="btn ghost small" onClick={() => go('kuslar')}>
          ← Geri
        </button>
        <div className="row gap-s no-print">
          <button className="btn small" onClick={() => go(`belge/${p.id}`)}>
            📜 Soy kütüğü
          </button>
          <button className="btn small" onClick={() => go(`etiket/${p.id}`)}>
            🏷️ Etiket
          </button>
          <button className="btn small" onClick={() => setEdit(true)}>
            Düzenle
          </button>
          <button className="btn small danger" onClick={del}>
            Sil
          </button>
        </div>
      </div>

      <div className="detail-head card">
        <PhotoImg id={p.photos?.[0]?.id} className="detail-photo" fallback={<div className="avatar big">{p.sex === 'D' ? '♀' : p.sex === 'E' ? '♂' : '🕊️'}</div>} />
        <div>
          <h1>{p.ring}</h1>
          {p.name && <p className="lead">{p.name}</p>}
          <div className="row gap-s wrap">
            <Badge tone={STATUS_TONE[p.status]}>{STATUS[p.status]}</Badge>
            <Badge>{SEX[p.sex]}</Badge>
            {p.breed && <Badge>{p.breed}</Badge>}
            {p.color && <Badge>{p.color}</Badge>}
          </div>
        </div>
      </div>

      <div className="info-grid card">
        <div>
          <span>Doğum</span>
          {fmtDate(p.birthDate)} ({ageText(p.birthDate)})
        </div>
        <div>
          <span>Kafes</span>
          {p.loft || '—'}
        </div>
        <div>
          <span>Baba</span>
          {parentLabel(p, 'father')}
        </div>
        <div>
          <span>Anne</span>
          {parentLabel(p, 'mother')}
        </div>
        <div>
          <span>Köken</span>
          {ORIGIN[p.origin] || '—'}
          {p.fromName && ` · ${p.fromName}`}
        </div>
        {p.origin !== 'uretim' && (
          <div>
            <span>Geliş</span>
            {fmtDate(p.fromDate)} {p.fromPrice !== '' && p.fromPrice != null && `· ${money(p.fromPrice)}`}
            {p.fromPhone && ` · ${p.fromPhone}`}
          </div>
        )}
        {['satildi', 'verildi'].includes(p.status) && (
          <div>
            <span>{p.status === 'satildi' ? 'Satıldı' : 'Verildi'}</span>
            {p.toName} · {fmtDate(p.toDate)} {p.status === 'satildi' && `· ${money(p.toPrice)}`}
            {p.toPhone && ` · ${p.toPhone}`} {p.toCity && ` · ${p.toCity}`}
          </div>
        )}
        {['oldu', 'kayip'].includes(p.status) && (
          <div>
            <span>{STATUS[p.status]}</span>
            {fmtDate(p.toDate)} {p.lossReason && `· ${p.lossReason}`}
          </div>
        )}
        {p.traits && (
          <div className="full">
            <span>Özellikler</span>
            {p.traits}
          </div>
        )}
        {p.notes && (
          <div className="full">
            <span>Notlar</span>
            {p.notes}
          </div>
        )}
      </div>

      {p.photos?.length > 1 && (
        <div className="card">
          <Gallery photos={p.photos} />
        </div>
      )}

      <Tabs
        value={tab}
        onChange={setTab}
        tabs={{ soy: 'Soy Ağacı', yavru: `Yavrular (${kids.length})`, saglik: `Sağlık (${myHealth.length})`, uretim: `Üretim (${myPairs.length})` }}
      />

      {tab === 'soy' && (
        <div className="card scroll-x">
          <Pedigree id={p.id} go={go} />
        </div>
      )}

      {tab === 'yavru' &&
        (kids.length ? (
          <div className="card-list">
            {kids.map((k) => (
              <button key={k.id} className="pigeon-card" onClick={() => go(`kus/${k.id}`)}>
                <div className="avatar">{k.sex === 'D' ? '♀' : k.sex === 'E' ? '♂' : '🕊️'}</div>
                <div className="pc-body">
                  <strong>{pigeonLabel(k)}</strong>
                  <div className="pc-meta">
                    {fmtDate(k.birthDate)} · {k.color || '—'}
                  </div>
                </div>
                <Badge tone={STATUS_TONE[k.status]}>{STATUS[k.status]}</Badge>
              </button>
            ))}
          </div>
        ) : (
          <Empty title="Kayıtlı yavru yok" />
        ))}

      {tab === 'saglik' && (
        <>
          <button className="btn small primary no-print" onClick={() => setAddHealth(true)}>
            + Sağlık kaydı
          </button>
          {myHealth.length ? (
            <div className="timeline">
              {myHealth
                .slice()
                .sort((a, b) => (b.date || '').localeCompare(a.date || ''))
                .map((h) => (
                  <div key={h.id} className="tl-item">
                    <span className="tl-date">{fmtDate(h.date)}</span>
                    <div>
                      <strong>{h.medicine || h.diagnosis || HEALTH_TYPES[h.type]}</strong>
                      <div className="small muted">
                        {HEALTH_TYPES[h.type]} {h.scope === 'all' && '· Tüm sürü'} {h.dose && `· ${h.dose}`}
                      </div>
                      {h.notes && <div className="small">{h.notes}</div>}
                    </div>
                  </div>
                ))}
            </div>
          ) : (
            <Empty icon="💊" title="Sağlık kaydı yok" />
          )}
        </>
      )}

      {tab === 'uretim' &&
        (myPairs.length ? (
          <div className="card-list">
            {myPairs.map((pr) => {
              const mate = get('pigeons', pr.maleId === p.id ? pr.femaleId : pr.maleId)
              const cl = clutches.filter((c) => c.pairId === pr.id)
              const hatched = cl.reduce((s, c) => s + (+c.hatched || 0), 0)
              return (
                <button key={pr.id} className="pigeon-card" onClick={() => go('uretim')}>
                  <div className="avatar">💞</div>
                  <div className="pc-body">
                    <strong>Eşi: {pigeonLabel(mate)}</strong>
                    <div className="pc-meta">
                      {fmtDate(pr.startDate)} · {cl.length} kuluçka · {hatched} yavru
                    </div>
                  </div>
                  <Badge tone={pr.active !== false ? 'ok' : 'neutral'}>{pr.active !== false ? 'Aktif' : 'Ayrıldı'}</Badge>
                </button>
              )
            })}
          </div>
        ) : (
          <Empty icon="🥚" title="Eşleştirme kaydı yok" />
        ))}

      {edit && <PigeonForm initial={p} onClose={() => setEdit(false)} />}
      {addHealth && <HealthForm initial={{ scope: 'some', pigeonIds: [p.id] }} onClose={() => setAddHealth(false)} />}
    </div>
  )
}
