import { Users } from 'lucide-react'
import { useEffect, useState } from 'react'
import { addMember, listMembers, removeMember, useIsHelper } from '../lib/members'
import { useSyncState } from '../lib/store'
import { cloudEnabled } from '../lib/supabase'

export default function MembersCard() {
  const sync = useSyncState()
  const helper = useIsHelper()
  const [members, setMembers] = useState([])
  const [email, setEmail] = useState('')
  const [msg, setMsg] = useState('')
  const [busy, setBusy] = useState(false)
  const load = () => listMembers().then(setMembers).catch((e) => setMsg('Hata: ' + e.message))

  useEffect(() => {
    if (sync.user && !helper) load()
  }, [sync.user?.id, helper])

  if (!cloudEnabled) return null
  if (helper)
    return (
      <div className="card">
        <h3>
          <Users size={18} /> Yardımcı hesabı
        </h3>
        <p className="small">Bu hesap başka bir güvercinliğin yardımcısıdır. Kayıt ekleyip düzenleyebilirsiniz; silme, satış fiyatları ve gelir-gider sayfaları kapalıdır.</p>
      </div>
    )
  if (!sync.user) return null

  const run = async (fn, ok) => {
    setBusy(true)
    setMsg('')
    try {
      await fn()
      setMsg(ok)
      await load()
    } catch (e) {
      setMsg('Hata: ' + e.message)
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="card">
      <h3>
        <Users size={18} /> Yardımcılar
      </h3>
      <p className="small muted">
        Kümese bakan birine sınırlı erişim verin. Yardımcı, eklediğiniz e-postayla hesap açıp giriş yapınca güvercinliğinizi görür ve kayıt girebilir; kayıt silemez,
        satış fiyatlarını, kişileri ve gelir-gideri göremez.
      </p>
      <form
        className="row gap-s wrap"
        onSubmit={(e) => {
          e.preventDefault()
          run(async () => {
            await addMember(email)
            setEmail('')
          }, 'Yardımcı eklendi. Bu e-postayla hesap açması (veya Supabase panelinden sizin açmanız) gerekiyor.')
        }}
      >
        <input type="email" className="grow" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="yardimci@ornek.com" />
        <button className="btn primary" disabled={busy}>
          Ekle
        </button>
      </form>
      {members.map((m) => (
        <div key={m.member_email} className="row between list-row small">
          <span>{m.member_email}</span>
          <button
            className="btn tiny ghost danger-text"
            disabled={busy}
            onClick={() => window.confirm(`${m.member_email} yardımcılıktan çıkarılsın mı?`) && run(() => removeMember(m.member_email), 'Yardımcı çıkarıldı.')}
          >
            Çıkar
          </button>
        </div>
      ))}
      {msg && <div className={'alert ' + (msg.startsWith('Hata') ? 'error' : 'info')}>{msg}</div>}
    </div>
  )
}
