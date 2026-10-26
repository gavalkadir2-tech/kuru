import { useState } from 'react'
import { supabase } from './lib/supabase'

export default function Auth({ onSkip }) {
  const [mode, setMode] = useState('login')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [err, setErr] = useState('')
  const [info, setInfo] = useState('')
  const [loading, setLoading] = useState(false)

  const submit = async (e) => {
    e.preventDefault()
    setErr('')
    setInfo('')
    if (!email.trim() || password.length < 6) return setErr('E-posta ve en az 6 karakterli şifre girin.')
    setLoading(true)
    try {
      if (mode === 'login') {
        const { error } = await supabase.auth.signInWithPassword({ email: email.trim(), password })
        if (error) throw error
      } else {
        const { data, error } = await supabase.auth.signUp({ email: email.trim(), password })
        if (error) throw error
        if (!data.session) setInfo('Kayıt oluşturuldu. E-postanıza gelen bağlantıyla hesabı onaylayıp giriş yapın.')
      }
    } catch (ex) {
      const m = ex.message || ''
      setErr(
        /Invalid login/i.test(m) ? 'E-posta veya şifre hatalı.' : /fetch|network/i.test(m) ? 'Sunucuya ulaşılamadı. İnternet yoksa çevrimdışı devam edebilirsiniz.' : m,
      )
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="auth">
      <form className="auth-card" onSubmit={submit}>
        <img src="/icon.svg" alt="" width="72" height="72" />
        <h1>Kuru</h1>
        <p className="muted">Samet Kuru güvercin takip ve bakım programı</p>
        <input type="email" autoComplete="email" placeholder="E-posta" value={email} onChange={(e) => setEmail(e.target.value)} />
        <input
          type="password"
          autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
          placeholder="Şifre"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
        />
        {err && <div className="alert error">{err}</div>}
        {info && <div className="alert info">{info}</div>}
        <button className="btn primary block" disabled={loading}>
          {loading ? 'Bekleyin…' : mode === 'login' ? 'Giriş yap' : 'Hesap oluştur'}
        </button>
        <button type="button" className="btn ghost block" onClick={() => setMode(mode === 'login' ? 'signup' : 'login')}>
          {mode === 'login' ? 'Hesabınız yok mu? Kayıt olun' : 'Hesabınız var mı? Giriş yapın'}
        </button>
        <button type="button" className="link" onClick={onSkip}>
          Giriş yapmadan çevrimdışı devam et
        </button>
      </form>
    </div>
  )
}
