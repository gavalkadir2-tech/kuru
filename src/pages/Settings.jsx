import { useRef, useState } from 'react'
import { download, fmtDate, today } from '../lib/format'
import { COLLECTIONS, exportBackup, importBackup, list, pendingCount, saveSettings, syncNow, useSettings, useSyncState } from '../lib/store'
import { cloudEnabled, supabase } from '../lib/supabase'
import { Field } from '../components/ui'

const NAMES = { pigeons: 'Güvercin', pairs: 'Çift', clutches: 'Kuluçka', health: 'Sağlık', feedings: 'Yemleme', rations: 'Rasyon', notes: 'Not' }

export default function Settings() {
  const settings = useSettings()
  const sync = useSyncState()
  const [f, setF] = useState(settings)
  const fileRef = useRef()
  const [msg, setMsg] = useState('')

  const restore = async (e) => {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (!file) return
    try {
      importBackup(JSON.parse(await file.text()))
      setMsg('Yedek geri yüklendi. Mevcut kayıtlarla birleştirildi.')
    } catch (ex) {
      setMsg('Hata: ' + ex.message)
    }
  }

  return (
    <div className="page">
      <div className="page-head">
        <h1>Ayarlar</h1>
      </div>

      <div className="card">
        <h3>Güvercinlik</h3>
        <div className="form-grid">
          <Field label="Güvercinlik adı">
            <input value={f.loftName} onChange={(e) => setF({ ...f, loftName: e.target.value })} />
          </Field>
          <Field label="Sahibi">
            <input value={f.owner} onChange={(e) => setF({ ...f, owner: e.target.value })} />
          </Field>
          <Field label="Halka ön eki" hint="Yeni kayıtta örnek olarak gösterilir">
            <input value={f.ringPrefix} onChange={(e) => setF({ ...f, ringPrefix: e.target.value.toUpperCase() })} />
          </Field>
        </div>
        <button className="btn primary" onClick={() => (saveSettings(f), setMsg('Ayarlar kaydedildi.'))}>
          Kaydet
        </button>
      </div>

      <div className="card">
        <h3>Bulut senkronu</h3>
        {cloudEnabled ? (
          <>
            <p className="small">
              Hesap: <strong>{sync.user?.email || 'Giriş yapılmadı'}</strong>
            </p>
            <p className="small">
              Durum:{' '}
              {{ idle: 'Bekliyor', syncing: 'Senkronize ediliyor…', ok: 'Güncel', error: 'Hata', offline: 'Çevrimdışı' }[sync.status]}
              {sync.lastSync && ` · Son: ${new Date(sync.lastSync).toLocaleString('tr-TR')}`} · Bekleyen değişiklik: {pendingCount()}
            </p>
            {sync.error && <div className="alert error">{sync.error}</div>}
            <div className="row gap-s wrap">
              <button className="btn" onClick={syncNow} disabled={!sync.user}>
                Şimdi senkronize et
              </button>
              {sync.user && (
                <button className="btn ghost" onClick={() => supabase.auth.signOut()}>
                  Çıkış yap
                </button>
              )}
            </div>
            <p className="tiny muted">Veriler önce telefonda saklanır; internet geldiğinde otomatik olarak buluta gönderilir. Aynı hesapla giriş yapılan tüm cihazlarda görünür.</p>
          </>
        ) : (
          <p className="small">
            Yerel mod: veriler yalnızca bu cihazda saklanıyor. Telefon ve bilgisayar arasında senkron ve yapay zeka için Supabase ayarlarını yapın (README dosyasına bakın).
          </p>
        )}
      </div>

      <div className="card">
        <h3>Yedekleme</h3>
        <p className="small">{COLLECTIONS.map((c) => `${NAMES[c]}: ${list(c).length}`).join(' · ')}</p>
        <div className="row gap-s wrap">
          <button
            className="btn"
            onClick={() => {
              download(`kuru-yedek-${today()}.json`, JSON.stringify(exportBackup()))
              saveSettings({ lastBackup: today() })
            }}
          >
            Yedek indir
          </button>
          <button className="btn" onClick={() => fileRef.current.click()}>
            Yedekten geri yükle
          </button>
          <input ref={fileRef} type="file" accept="application/json,.json" hidden onChange={restore} />
        </div>
        <p className="tiny muted">Yedeği düzenli olarak indirip güvenli bir yerde saklayın. Son yedek tarihi: {fmtDate(settings.lastBackup)}</p>
      </div>

      {msg && <div className="alert info">{msg}</div>}
      <p className="tiny muted center">Kuru v1.0 · {settings.owner}</p>
    </div>
  )
}
