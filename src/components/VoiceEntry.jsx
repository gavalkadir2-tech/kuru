import { useEffect, useRef, useState } from 'react'
import { apply, describe, parseSpeech, speechSupported, startListening } from '../lib/voice'
import { cloudEnabled } from '../lib/supabase'
import { ErrorText, Modal } from './ui'

const EXAMPLES = [
  '3 numaralı yuvada bugün ilk yumurta var',
  'Dün tüm sürüye kanker kürü verdim, 5 gün sonra tekrar',
  'Yıldız 1 saat 40 dakika uçtu, puanı 8',
  'Bugün 2 kilo mısır verdim',
  '3 numaralı yuvanın yumurtalarını 7 numaralı bakıcıya verdim',
  '1001 numaralı kuşu Ali ustaya 2000 liraya sattım',
]

export function VoiceModal({ onClose }) {
  const [text, setText] = useState('')
  const [listening, setListening] = useState(false)
  const [loading, setLoading] = useState(false)
  const [err, setErr] = useState('')
  const [actions, setActions] = useState(null)
  const [done, setDone] = useState({})
  const stopRef = useRef(null)

  useEffect(() => () => stopRef.current?.(), [])

  const listen = () => {
    if (listening) return stopRef.current?.()
    setErr('')
    setListening(true)
    stopRef.current = startListening({
      onText: setText,
      onEnd: () => setListening(false),
      onError: (m) => {
        setErr(m)
        setListening(false)
      },
    })
  }

  const analyze = async () => {
    stopRef.current?.()
    if (!text.trim()) return setErr('Önce konuşun veya yazın.')
    setLoading(true)
    setErr('')
    setDone({})
    try {
      const acts = await parseSpeech(text)
      if (!acts.length) setErr('Kaydedilecek bir bilgi bulunamadı.')
      setActions(acts)
    } catch (e) {
      setErr(e.message)
    } finally {
      setLoading(false)
    }
  }

  const applyOne = (i) => {
    try {
      apply(actions[i])
      setDone((d) => ({ ...d, [i]: 'ok' }))
    } catch (e) {
      setDone((d) => ({ ...d, [i]: 'Hata: ' + e.message }))
    }
  }
  const applyAll = () => actions.forEach((a, i) => !done[i] && !describe(a).error && applyOne(i))

  return (
    <Modal title="🎤 Sesle kayıt" onClose={onClose}>
      {!cloudEnabled && <div className="alert warn">Sesle kayıt yapay zeka kullandığı için bulut bağlantısı ve giriş gerektirir.</div>}
      <div className="voice">
        {speechSupported() ? (
          <button className={'mic' + (listening ? ' on' : '')} onClick={listen} aria-label={listening ? 'Dinlemeyi durdur' : 'Konuşmaya başla'}>
            {listening ? '■' : '🎤'}
          </button>
        ) : (
          <p className="small muted">Bu tarayıcı sesi doğrudan tanımıyor; klavyedeki mikrofon tuşuyla yazdırabilirsiniz.</p>
        )}
        <p className="small muted center">{listening ? 'Dinliyorum… bitince ■ düğmesine basın' : 'Mikrofona basıp söyleyin veya yazın'}</p>
        <textarea rows={3} value={text} onChange={(e) => setText(e.target.value)} placeholder={EXAMPLES[0]} />
        <button className="btn primary block" onClick={analyze} disabled={loading || !cloudEnabled}>
          {loading ? 'Anlaşılıyor…' : 'Kayıtlara dönüştür'}
        </button>
        <ErrorText>{err}</ErrorText>
        {!actions && (
          <div className="tiny muted">
            Örnekler:
            <ul>
              {EXAMPLES.map((e) => (
                <li key={e}>{e}</li>
              ))}
            </ul>
          </div>
        )}
        {actions?.length > 0 && (
          <div className="voice-actions">
            {actions.map((a, i) => {
              const d = describe(a)
              return (
                <div key={i} className={'card voice-action' + (d.error ? ' bad' : '')}>
                  <span>{d.text}</span>
                  {d.error && <span className="small danger-text">{d.error} — kaydedilemez</span>}
                  {done[i] === 'ok' ? (
                    <span className="small ok-text">✓ Kaydedildi</span>
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
            {actions.some((a, i) => !done[i] && !describe(a).error) && (
              <button className="btn primary block" onClick={applyAll}>
                Tümünü kaydet
              </button>
            )}
          </div>
        )}
      </div>
    </Modal>
  )
}

export function VoiceFab() {
  const [open, setOpen] = useState(false)
  return (
    <>
      <button className="fab no-print" onClick={() => setOpen(true)} aria-label="Sesle kayıt">
        🎤
      </button>
      {open && <VoiceModal onClose={() => setOpen(false)} />}
    </>
  )
}
