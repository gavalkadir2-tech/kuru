import { useState } from 'react'
import { RefreshCw, Sparkles } from 'lucide-react'
import { askAI } from '../lib/ai'
import { birdContext, flockContext, matingContext } from '../lib/aiContext'
import { today } from '../lib/format'
import { cloudEnabled } from '../lib/supabase'
import ActionCards, { splitActions } from './ActionCards'
import { ErrorText, Field, Markdown } from './ui'

function cacheGet(key) {
  try {
    return JSON.parse(localStorage.getItem(key))
  } catch {
    return null
  }
}
function cacheSet(key, value) {
  try {
    localStorage.setItem(key, JSON.stringify(value))
  } catch {}
}

function useAiTask(cacheKey) {
  const [res, setRes] = useState(() => (cacheKey ? cacheGet(cacheKey) : null))
  const [loading, setLoading] = useState(false)
  const [err, setErr] = useState('')
  const run = async (task, payload) => {
    setLoading(true)
    setErr('')
    try {
      const text = await askAI(task, { date: today(), ...payload })
      const value = { ...splitActions(text), at: new Date().toISOString() }
      setRes(value)
      if (cacheKey) cacheSet(cacheKey, value)
    } catch (e) {
      setErr(e.message)
    } finally {
      setLoading(false)
    }
  }
  return { res, loading, err, run }
}

const Stamp = ({ at }) => (at ? <span className="tiny muted">{new Date(at).toLocaleString('tr-TR', { dateStyle: 'short', timeStyle: 'short' })}</span> : null)

// Ana sayfa: günün özeti (günde bir kez oluşturulur, istenirse yenilenir)
export function AiBrief() {
  const { res, loading, err, run } = useAiTask(`kuru:brief:${today()}`)
  if (!cloudEnabled) return null
  return (
    <div className="card ai-card">
      <div className="row between wrap gap-s">
        <h3>
          <Sparkles size={18} /> Günün özeti
        </h3>
        <button className="btn small" onClick={() => run('brief', { context: flockContext() })} disabled={loading}>
          {res ? <RefreshCw size={14} /> : <Sparkles size={14} />} {loading ? 'Hazırlanıyor…' : res ? 'Yenile' : 'Oluştur'}
        </button>
      </div>
      {!res && !loading && <p className="small muted">Yapay zeka kayıtlarınıza bakıp bugünün işlerini, riskleri ve önerileri özetler.</p>}
      <ErrorText>{err}</ErrorText>
      {res && (
        <>
          <Markdown text={res.text} />
          <Stamp at={res.at} />
        </>
      )}
    </div>
  )
}

// Kuş sayfası: kuşun tüm verisine dayanan değerlendirme
export function BirdAI({ pigeonId }) {
  const { res, loading, err, run } = useAiTask(`kuru:birdai:${pigeonId}`)
  const [goal, setGoal] = useState('')
  if (!cloudEnabled) return <div className="alert warn">Yapay zeka değerlendirmesi için bulut bağlantısı ve giriş gerekir.</div>
  return (
    <div className="card ai-card">
      <h3>
        <Sparkles size={18} /> Yapay zeka değerlendirmesi
      </h3>
      <p className="small muted">Soy ağacı, yavruları, üretim, sağlık, tartı ve uçuş kayıtları birlikte değerlendirilir.</p>
      <Field label="Özel soru (isteğe bağlı)">
        <input value={goal} onChange={(e) => setGoal(e.target.value)} placeholder="Örn: Damızlıkta tutmalı mıyım? Kimle eşleştirmeliyim?" />
      </Field>
      <button className="btn primary" onClick={() => run('bird', { context: birdContext(pigeonId), goal })} disabled={loading}>
        {loading ? 'Değerlendiriliyor…' : res ? 'Yeniden değerlendir' : 'Değerlendir'}
      </button>
      <ErrorText>{err}</ErrorText>
      {res && (
        <>
          <Markdown text={res.text} />
          <Stamp at={res.at} />
        </>
      )}
    </div>
  )
}

// Üretim: sezon eşleştirme planı ve önerilen çiftleri tek tuşla oluşturma
export function MatingAdvisor() {
  const { res, loading, err, run } = useAiTask('kuru:advisor')
  const [goal, setGoal] = useState('')
  const [extra, setExtra] = useState('')
  if (!cloudEnabled) return <div className="alert warn">Eşleştirme danışmanı için bulut bağlantısı ve giriş gerekir.</div>
  return (
    <>
      <div className="card ai-card">
        <h3>
          <Sparkles size={18} /> Eşleştirme danışmanı
        </h3>
        <p className="small muted">
          Tüm aktif kuşlarınızın soyu, akrabalık katsayıları, renkleri, ırkları ve uçuş performansı incelenerek sezon için eşleştirme planı hazırlanır. Önerilen çiftleri
          onaylayarak tek tuşla oluşturabilirsiniz.
        </p>
        <div className="form-grid">
          <Field label="Hedefiniz">
            <input value={goal} onChange={(e) => setGoal(e.target.value)} placeholder="Örn: uzun uçan taklacı hattı, kırmızı renk, yüksek verim" />
          </Field>
          <Field label="Ek koşullar">
            <input value={extra} onChange={(e) => setExtra(e.target.value)} placeholder="Örn: en fazla 6 çift, TR-1001'i mutlaka kullan" />
          </Field>
        </div>
        <button className="btn primary" onClick={() => run('advisor', { context: matingContext(), goal, text: extra })} disabled={loading}>
          {loading ? 'Plan hazırlanıyor…' : 'Plan hazırla'}
        </button>
        <ErrorText>{err}</ErrorText>
      </div>
      {res && (
        <div className="card ai-card">
          <Markdown text={res.text} />
          <Stamp at={res.at} />
          <ActionCards key={res.at} actions={res.actions} title="Önerilen çiftler" />
        </div>
      )}
    </>
  )
}
