import { useEffect, useRef, useState } from 'react'
import { parseSpeech, speechSupported, startListening } from '../lib/voice'
import ActionCards from './ActionCards'
import { cloudEnabled } from '../lib/supabase'
import { ErrorText, Modal } from './ui'
import { Mic } from 'lucide-react'

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
        {actions?.length > 0 && <ActionCards key={text} actions={actions} />}
      </div>
    </Modal>
  )
}

export function VoiceFab() {
  const [open, setOpen] = useState(false)
  return (
    <>
      <button className="fab no-print" onClick={() => setOpen(true)} aria-label="Sesle kayıt" title="Sesle kayıt">
        <Mic size={24} />
      </button>
      {open && <VoiceModal onClose={() => setOpen(false)} />}
    </>
  )
}
