import { Camera, SendHorizontal, Sparkles } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { askAI } from '../lib/ai'
import { today } from '../lib/format'
import { flockContext } from '../lib/aiContext'
import ActionCards, { splitActions } from '../components/ActionCards'
import { cloudEnabled } from '../lib/supabase'
import { ErrorText, Markdown, PageTitle, PhotoInput } from '../components/ui'

const KEY = 'kuru:chat:v1'
const SUGGESTIONS = [
  'Bugün ne yapmam gerekiyor?',
  'En iyi uçan kuşlarım hangileri, hangi hattan geliyorlar?',
  'Son 3 ayın sağlık kayıtlarına göre eksik kalan kür veya aşı var mı?',
  'Üreme dönemine nasıl hazırlanmalıyım?',
  'Yavrularda yeşil ishal var, ne yapmalıyım?',
  'Tüy değişiminde nasıl beslemeliyim?',
  'Taklacılar için uçuş öncesi bakım nasıl olmalı?',
  'Kümes dezenfeksiyonu için ne kullanmalıyım?',
]

function loadChat() {
  try {
    return JSON.parse(localStorage.getItem(KEY)) || []
  } catch {
    return []
  }
}

export default function Assistant() {
  const [msgs, setMsgs] = useState(loadChat)
  const [input, setInput] = useState('')
  const [photo, setPhoto] = useState('')
  const [showPhoto, setShowPhoto] = useState(false)
  const [loading, setLoading] = useState(false)
  const [err, setErr] = useState('')
  const endRef = useRef()

  useEffect(() => {
    try {
      // Fotoğraflar yer kaplamasın diye kaydetmeden çıkarılır
      localStorage.setItem(KEY, JSON.stringify(msgs.slice(-30).map(({ image, ...m }) => m)))
    } catch {}
    endRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [msgs])

  const send = async (text = input) => {
    const content = text.trim()
    if (!content || loading) return
    const next = [...msgs, { role: 'user', content, image: photo || undefined }]
    setMsgs(next)
    setInput('')
    setPhoto('')
    setShowPhoto(false)
    setLoading(true)
    setErr('')
    try {
      const reply = await askAI('chat', { messages: next.slice(-12).map(({ actions, ...m }) => m), context: flockContext(), date: today() })
      const { text: content, actions } = splitActions(reply)
      setMsgs((m) => [...m, { role: 'assistant', content, actions: actions.length ? actions : undefined }])
    } catch (e) {
      setErr(e.message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="page chat-page">
      <div className="page-head">
        <PageTitle icon={Sparkles} title="AI Asistan" subtitle="Bakım, sağlık, beslenme ve üretim soruları" />
        {msgs.length > 0 && (
          <button className="btn ghost small" onClick={() => window.confirm('Sohbet geçmişi silinsin mi?') && setMsgs([])}>
            Temizle
          </button>
        )}
      </div>
      {!cloudEnabled && (
        <div className="alert warn">
          Yapay zeka asistanı için Supabase bağlantısı ve giriş gerekir. Kurulum için Ayarlar sayfasına bakın. Hastalık tahmini ve rasyon hesaplama çevrimdışı da çalışır.
        </div>
      )}
      <div className="chat">
        {msgs.length === 0 && (
          <div className="card">
            <p>
              Asistan kayıtlarınızın tamamını bilir: kuşlar, soy, çiftler, kuluçkalar, sağlık, stok, uçuş ve tartılar. Sorularınızı kuş adı veya halka numarasıyla sorabilir,
              "kaydet" diyerek işlem de yaptırabilirsiniz; önerdiği kayıtlar onayınızla kaydedilir.
            </p>
            <div className="chips">
              {SUGGESTIONS.map((s) => (
                <button key={s} className="chip" onClick={() => send(s)} disabled={!cloudEnabled}>
                  {s}
                </button>
              ))}
            </div>
          </div>
        )}
        {msgs.map((m, i) => (
          <div key={i} className={'bubble ' + m.role}>
            {m.image && <img src={m.image} alt="" />}
            {m.role === 'assistant' ? <Markdown text={m.content} /> : <p>{m.content}</p>}
            {m.actions && <ActionCards actions={m.actions} title="Önerilen kayıtlar" />}
          </div>
        ))}
        {loading && <div className="bubble assistant typing">Yazıyor…</div>}
        <ErrorText>{err}</ErrorText>
        <div ref={endRef} />
      </div>
      {showPhoto && (
        <div className="card">
          <PhotoInput value={photo} onChange={setPhoto} />
        </div>
      )}
      <form
        className="composer"
        onSubmit={(e) => {
          e.preventDefault()
          send()
        }}
      >
        <button type="button" className="icon-btn" onClick={() => setShowPhoto((v) => !v)} aria-label="Fotoğraf ekle">
          <Camera size={20} />
        </button>
        <textarea
          rows={1}
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
              e.preventDefault()
              send()
            }
          }}
          placeholder="Sorunuzu yazın…"
          disabled={!cloudEnabled}
        />
        <button className="btn primary" disabled={loading || !input.trim() || !cloudEnabled} aria-label="Gönder">
          <SendHorizontal size={18} />
        </button>
      </form>
    </div>
  )
}
