import { useEffect, useRef, useState } from 'react'
import { compressImage, markdown, pigeonLabel } from '../lib/format'
import { useCollection } from '../lib/store'

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

export function Stat({ label, value, sub, tone, onClick }) {
  return (
    <button className={'stat ' + (tone || '')} onClick={onClick} disabled={!onClick}>
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
  return window.confirm(`"${label}" silinsin mi? Bu işlem geri alınamaz.`)
}
