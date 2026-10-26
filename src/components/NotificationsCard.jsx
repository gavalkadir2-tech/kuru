import { useEffect, useState } from 'react'
import { currentSubscription, disablePush, enablePush, generateVapidKeys, needsInstallForPush, pushConfigured, pushSupported, sendTestPush } from '../lib/push'
import { getSettings, saveSettings, useSyncState } from '../lib/store'
import { cloudEnabled } from '../lib/supabase'
import { Field } from './ui'

export default function NotificationsCard() {
  const sync = useSyncState()
  const [subscribed, setSubscribed] = useState(false)
  const [hour, setHour] = useState(getSettings().notifyHour ?? 8)
  const [busy, setBusy] = useState(false)
  const [msg, setMsg] = useState('')
  const [keys, setKeys] = useState(null)

  useEffect(() => {
    currentSubscription().then((s) => setSubscribed(!!s)).catch(() => {})
  }, [])

  const run = async (fn, ok) => {
    setBusy(true)
    setMsg('')
    try {
      await fn()
      setMsg(ok)
    } catch (e) {
      setMsg('Hata: ' + (e.message || e))
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="card">
      <h3>🔔 Bildirimler</h3>
      <p className="small muted">
        Her gün seçtiğiniz saatte o günün işleri (çıkış, ışık kontrolü, halkalama, yavru ayırma, ilaç tekrarı) telefonunuza bildirim olarak gelir. Uygulama kapalıyken de çalışır.
      </p>
      {!cloudEnabled ? (
        <p className="small">Bildirimler için bulut bağlantısı gerekir.</p>
      ) : !pushConfigured ? (
        <>
          <div className="alert warn">Bildirim anahtarı ayarlı değil. Kurulum için aşağıdaki düğmeyle anahtar üretin.</div>
          <button className="btn small" onClick={async () => setKeys(await generateVapidKeys())}>
            Bildirim anahtarı üret
          </button>
          {keys && (
            <div className="keys">
              <p className="small">
                <strong>Vercel</strong> ortam değişkeni <code>VITE_VAPID_PUBLIC_KEY</code> ve <strong>Supabase secret</strong> <code>VAPID_PUBLIC_KEY</code>:
              </p>
              <textarea readOnly rows={2} value={keys.publicKey} onFocus={(e) => e.target.select()} />
              <p className="small">
                Yalnızca <strong>Supabase secret</strong> <code>VAPID_PRIVATE_KEY</code> (kimseyle paylaşmayın):
              </p>
              <textarea readOnly rows={1} value={keys.privateKey} onFocus={(e) => e.target.select()} />
            </div>
          )}
        </>
      ) : !pushSupported() ? (
        <p className="small">Bu tarayıcı bildirimleri desteklemiyor.</p>
      ) : (
        <>
          {needsInstallForPush() && (
            <div className="alert info">iPhone’da bildirim için önce Safari → Paylaş → Ana Ekrana Ekle ile uygulamayı kurun ve ana ekrandaki simgeden açın.</div>
          )}
          <div className="row gap-s wrap">
            <Field label="Bildirim saati">
              <select value={hour} onChange={(e) => setHour(+e.target.value)}>
                {Array.from({ length: 18 }, (_, i) => i + 5).map((h) => (
                  <option key={h} value={h}>
                    {String(h).padStart(2, '0')}:00
                  </option>
                ))}
              </select>
            </Field>
          </div>
          <div className="row gap-s wrap">
            <button
              className="btn primary"
              disabled={busy || !sync.user}
              onClick={() =>
                run(async () => {
                  await enablePush(hour)
                  saveSettings({ notifyHour: hour })
                  setSubscribed(true)
                }, `Bildirimler açık. Her gün ${String(hour).padStart(2, '0')}:00'da gelecek.`)
              }
            >
              {subscribed ? 'Saati kaydet' : 'Bildirimleri aç'}
            </button>
            {subscribed && (
              <>
                <button className="btn" disabled={busy} onClick={() => run(sendTestPush, 'Test bildirimi gönderildi; birkaç saniye içinde gelmeli.')}>
                  Test bildirimi
                </button>
                <button
                  className="btn ghost"
                  disabled={busy}
                  onClick={() =>
                    run(async () => {
                      await disablePush()
                      setSubscribed(false)
                    }, 'Bildirimler kapatıldı.')
                  }
                >
                  Kapat
                </button>
              </>
            )}
          </div>
          {!sync.user && <p className="small muted">Bildirimler için giriş yapın.</p>}
        </>
      )}
      {msg && <div className={'alert ' + (msg.startsWith('Hata') ? 'error' : 'info')}>{msg}</div>}
    </div>
  )
}
