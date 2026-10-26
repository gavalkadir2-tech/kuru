import { useEffect, useRef, useState } from 'react'
import { compressImage, markdown, pigeonLabel } from '../lib/format'
import { isHelper, useCollection } from '../lib/store'
import { PHOTO_LABELS, PhotoImg, deletePhoto, putPhoto } from '../lib/photos'

export function Modal({ title, onClose, children, footer, wide }) {
  useEffect(() => {
    const onKey = (e) => e.key === 'Escape' && onClose()
    window.addEventListener('keydown', onKey)
    document.body.classList.add('modal-open')
    return () => {
      window.removeEventListener('keydown', onKey)
      document.body.classList.remove('modal-open')
    }
  }, [onClose])
  return (
    <div className="modal-backdrop" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className={'modal' + (wide ? ' wide' : '')} role="dialog" aria-label={title}>
        <div className="modal-head">
          <h2>{title}</h2>
          <button className="icon-btn" onClick={onClose} aria-label="Kapat">
            ✕
          </button>
        </div>
        <div className="modal-body">{children}</div>
        {footer && <div className="modal-foot">{footer}</div>}
      </div>
    </div>
  )
}

export function Field({ label, children, hint, full }) {
  return (
    <label className={'field' + (full ? ' full' : '')}>
      <span className="field-label">{label}</span>
      {children}
      {hint && <span className="field-hint">{hint}</span>}
    </label>
  )
}

export function Select({ value, onChange, options, placeholder = 'Seçiniz', ...rest }) {
  const entries = Array.isArray(options) ? options.map((o) => (typeof o === 'string' ? [o, o] : o)) : Object.entries(options)
  return (
    <select value={value ?? ''} onChange={(e) => onChange(e.target.value)} {...rest}>
      <option value="">{placeholder}</option>
      {entries.map(([k, v]) => (
        <option key={k} value={k}>
          {v}
        </option>
      ))}
    </select>
  )
}

export function PigeonSelect({ value, onChange, sex, exclude, placeholder = 'Kuş seçin', includeInactive = true }) {
  const pigeons = useCollection('pigeons')
  const opts = pigeons
    .filter((p) => (!sex || p.sex === sex) && p.id !== exclude && (includeInactive || p.status === 'aktif'))
    .sort((a, b) => (a.ring || '').localeCompare(b.ring || ''))
  return (
    <select value={value || ''} onChange={(e) => onChange(e.target.value)}>
      <option value="">{placeholder}</option>
      {opts.map((p) => (
        <option key={p.id} value={p.id}>
          {pigeonLabel(p)}
          {p.status !== 'aktif' ? ' (pasif)' : ''}
        </option>
      ))}
    </select>
  )
}

export function Empty({ icon = '🕊️', title, children }) {
  return (
    <div className="empty">
      <div className="empty-icon">{icon}</div>
      <strong>{title}</strong>
      {children && <p>{children}</p>}
    </div>
  )
}

export function Badge({ tone = 'neutral', children }) {
  return <span className={`badge ${tone}`}>{children}</span>
}

export function Tabs({ value, onChange, tabs }) {
  return (
    <div className="tabs" role="tablist">
      {Object.entries(tabs).map(([k, v]) => (
        <button key={k} role="tab" aria-selected={value === k} className={value === k ? 'active' : ''} onClick={() => onChange(k)}>
          {v}
        </button>
      ))}
    </div>
  )
}

export function Markdown({ text }) {
  return <div className="md" dangerouslySetInnerHTML={{ __html: markdown(text) }} />
}

export function PhotoInput({ value, onChange, label = 'Fotoğraf' }) {
  const ref = useRef()
  const [err, setErr] = useState('')
  const pick = async (e) => {
    const f = e.target.files?.[0]
    e.target.value = ''
    if (!f) return
    try {
      setErr('')
      onChange(await compressImage(f))
    } catch (ex) {
      setErr(ex.message)
    }
  }
  return (
    <div className="photo-input">
      {value ? (
        <img src={value} alt="" />
      ) : (
        <div className="photo-ph" onClick={() => ref.current.click()}>
          📷
        </div>
      )}
      <div className="row gap-s">
        <button type="button" className="btn small" onClick={() => ref.current.click()}>
          {value ? 'Değiştir' : label + ' ekle'}
        </button>
        {value && (
          <button type="button" className="btn small ghost" onClick={() => onChange('')}>
            Kaldır
          </button>
        )}
      </div>
      {err && <span className="error-text">{err}</span>}
      <input ref={ref} type="file" accept="image/*" capture="environment" hidden onChange={pick} />
    </div>
  )
}

export function Stat({ label, value, sub, tone, onClick, icon: Icon }) {
  return (
    <button className={'stat ' + (tone || '')} onClick={onClick} disabled={!onClick}>
      {Icon && (
        <span className="stat-icon">
          <Icon size={16} />
        </span>
      )}
      <span className="stat-value">{value}</span>
      <span className="stat-label">{label}</span>
      {sub && <span className="stat-sub">{sub}</span>}
    </button>
  )
}

export function SearchBox({ value, onChange, placeholder = 'Ara…' }) {
  return (
    <div className="search">
      <span aria-hidden>🔍</span>
      <input type="search" value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} />
    </div>
  )
}

export function ErrorText({ children }) {
  if (!children) return null
  return <div className="alert error">{children}</div>
}

export function confirmDel(label) {
  if (isHelper()) {
    window.alert('Yardımcı hesabı kayıt silemez. Silinmesi gereken kaydı güvercinlik sahibine bildirin.')
    return false
  }
  return window.confirm(`"${label}" silinsin mi? Bu işlem geri alınamaz.`)
}

// Kuş başına çoklu fotoğraf. value: [{ id?, dataUrl?, label }] — yeni eklenenlerde yalnızca dataUrl vardır.
export function PhotosEditor({ value, onChange }) {
  const ref = useRef()
  const [err, setErr] = useState('')
  const add = async (e) => {
    const files = [...(e.target.files || [])]
    e.target.value = ''
    if (!files.length) return
    try {
      setErr('')
      const added = []
      for (const f of files.slice(0, 8)) added.push({ dataUrl: await compressImage(f, 1024, 0.78), label: value.length + added.length ? 'Diğer' : 'Genel' })
      onChange([...value, ...added])
    } catch (ex) {
      setErr(ex.message)
    }
  }
  const update = (i, patch) => onChange(value.map((p, j) => (j === i ? { ...p, ...patch } : p)))
  const removeAt = (i) => onChange(value.filter((_, j) => j !== i))
  const makeMain = (i) => onChange([value[i], ...value.filter((_, j) => j !== i)])
  return (
    <div className="photos-editor">
      <div className="photo-strip">
        {value.map((ph, i) => (
          <div key={ph.id || i} className="photo-tile">
            {ph.dataUrl ? <img src={ph.dataUrl} alt="" /> : <PhotoImg id={ph.id} fallback={<div className="photo-ph">⏳</div>} />}
            <select value={ph.label} onChange={(e) => update(i, { label: e.target.value })}>
              {PHOTO_LABELS.map((l) => (
                <option key={l}>{l}</option>
              ))}
            </select>
            <div className="row gap-s">
              {i > 0 && (
                <button type="button" className="btn tiny ghost" onClick={() => makeMain(i)} title="Ana fotoğraf yap">
                  ★
                </button>
              )}
              <button type="button" className="btn tiny ghost danger-text" onClick={() => removeAt(i)} title="Kaldır">
                ✕
              </button>
            </div>
          </div>
        ))}
        <button type="button" className="photo-ph add" onClick={() => ref.current.click()}>
          📷<span>Ekle</span>
        </button>
      </div>
      {err && <span className="error-text">{err}</span>}
      <input ref={ref} type="file" accept="image/*" multiple hidden onChange={add} />
    </div>
  )
}

// Kaydetmeden önce yeni fotoğrafları depoya yazar, kaldırılanları siler
export async function persistPhotos(next, prev = []) {
  const out = []
  for (const ph of next) {
    if (ph.id) out.push({ id: ph.id, label: ph.label })
    else if (ph.dataUrl) out.push({ id: await putPhoto(ph.dataUrl), label: ph.label })
  }
  const keep = new Set(out.map((p) => p.id))
  prev.filter((p) => !keep.has(p.id)).forEach((p) => deletePhoto(p.id))
  return out
}

export function Gallery({ photos }) {
  const [open, setOpen] = useState(null)
  if (!photos?.length) return null
  return (
    <>
      <div className="photo-strip">
        {photos.map((ph, i) => (
          <button key={ph.id} className="photo-tile view" onClick={() => setOpen(i)}>
            <PhotoImg id={ph.id} fallback={<div className="photo-ph">⏳</div>} />
            <span className="tiny muted">{ph.label}</span>
          </button>
        ))}
      </div>
      {open != null && (
        <div className="lightbox" onClick={() => setOpen(null)}>
          <PhotoImg id={photos[open].id} />
          <span>{photos[open].label}</span>
        </div>
      )}
    </>
  )
}

// Sayfa başlığı: ikon, başlık, alt başlık ve sağda eylemler
export function PageHeader({ icon: Icon, title, subtitle, children }) {
  return (
    <div className="page-head">
      <div className="page-title">
        {Icon && (
          <span className="page-icon">
            <Icon size={20} />
          </span>
        )}
        <div>
          <h1>{title}</h1>
          {subtitle && <p className="page-sub">{subtitle}</p>}
        </div>
      </div>
      {children && <div className="row gap-s wrap">{children}</div>}
    </div>
  )
}

// Mevcut .page-head içinde kullanılan başlık bloğu
export function PageTitle({ icon: Icon, title, subtitle }) {
  return (
    <div className="page-title">
      {Icon && (
        <span className="page-icon">
          <Icon size={20} />
        </span>
      )}
      <div>
        <h1>{title}</h1>
        {subtitle && <p className="page-sub">{subtitle}</p>}
      </div>
    </div>
  )
}
