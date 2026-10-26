import { useState } from 'react'
import { Check } from 'lucide-react'
import { apply, describe } from '../lib/voice'

// Yapay zekanın önerdiği kayıtlar: kullanıcı tek tek veya topluca onaylar
export default function ActionCards({ actions, title }) {
  const [done, setDone] = useState({})
  if (!actions?.length) return null
  const applyOne = (i) => {
    try {
      apply(actions[i])
      setDone((d) => ({ ...d, [i]: 'ok' }))
    } catch (e) {
      setDone((d) => ({ ...d, [i]: 'Hata: ' + e.message }))
    }
  }
  const pending = actions.map((a, i) => i).filter((i) => !done[i] && !describe(actions[i]).error)
  return (
    <div className="voice-actions">
      {title && <strong className="small">{title}</strong>}
      {actions.map((a, i) => {
        // Kaydedilen kartta yeniden doğrulama yapılmaz (ör. "çift zaten var" uyarısı çıkmasın)
        const d = done[i] === 'ok' ? { text: describe(a).text } : describe(a)
        return (
          <div key={i} className={'card voice-action' + (d.error ? ' bad' : '')}>
            <span>{d.text}</span>
            {a.summary && a.summary !== d.text && <span className="tiny muted">{a.summary}</span>}
            {d.error && <span className="small danger-text">{d.error} — kaydedilemez</span>}
            {done[i] === 'ok' ? (
              <span className="small ok-text">
                <Check size={14} /> Kaydedildi
              </span>
            ) : done[i] ? (
              <span className="small danger-text">{done[i]}</span>
            ) : (
              !d.error && (
                <button className="btn small" onClick={() => applyOne(i)}>
                  Kaydet
                </button>
              )
            )}
          </div>
        )
      })}
      {pending.length > 1 && (
        <button className="btn primary block" onClick={() => pending.forEach(applyOne)}>
          Tümünü kaydet ({pending.length})
        </button>
      )}
    </div>
  )
}

// Yanıttaki ```kuru-actions {...}``` bloğunu ayıklar
export function splitActions(text = '') {
  const m = text.match(/```kuru-actions\s*([\s\S]*?)```/)
  if (!m) return { text, actions: [] }
  let actions = []
  try {
    const data = JSON.parse(m[1])
    actions = (Array.isArray(data) ? data : data.actions || []).filter((a) => a && a.type)
  } catch {}
  return { text: text.replace(m[0], '').trim(), actions }
}
