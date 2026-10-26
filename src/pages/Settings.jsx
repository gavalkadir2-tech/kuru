import { Fragment, useRef, useState } from 'react'
import { Cloud, Database, Download, Settings2, Upload } from 'lucide-react'
import { LIST_DEFS, TIMING_DEFS, saveTimings, useTimings } from '../lib/config'
import { download, fmtDate, today } from '../lib/format'
import { COLLECTIONS, exportBackup, importBackup, list, pendingCount, saveSettings, syncNow, useSettings, useSyncState } from '../lib/store'
import { cloudEnabled, supabase } from '../lib/supabase'
import { ACCENTS, DENSITIES, THEMES, applyTheme } from '../lib/theme'
import { Field, PageHeader, Tabs } from '../components/ui'
import ListEditor from '../components/ListEditor'
import NotificationsCard from '../components/NotificationsCard'
import MembersCard from '../components/MembersCard'

const NAMES = {
  pigeons: 'Güvercin',
  pairs: 'Çift',
  clutches: 'Kuluçka',
  health: 'Sağlık',
  feedings: 'Yemleme',
  rations: 'Rasyon',
  notes: 'Not',
  stock: 'Stok kalemi',
  stockMoves: 'Stok hareketi',
  ledger: 'Gelir/gider',
  people: 'Kişi',
  accounts: 'Cari hareket',
  flights: 'Uçuş',
  weights: 'Tartı',
  config: 'Ayar',
}

function General() {
  const settings = useSettings()
  const timings = useTimings()
  const [f, setF] = useState({ loftName: settings.loftName, owner: settings.owner, ringPrefix: settings.ringPrefix })
  const [t, setT] = useState(timings)
  const [msg, setMsg] = useState('')
  return (
    <>
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
        <button
          className="btn primary"
          onClick={() => {
            saveSettings(f)
            setMsg('Güvercinlik bilgileri kaydedildi; diğer cihazlara da eşitlenir.')
          }}
        >
          Kaydet
        </button>
      </div>
      <div className="card">
        <h3>Üretim süreleri</h3>
        <p className="small muted">Kuluçka takvimi, ana sayfa hatırlatmaları ve bildirimler bu sürelere göre hesaplanır.</p>
        <div className="form-grid">
          {Object.entries(TIMING_DEFS).map(([k, d]) => (
            <Field key={k} label={d.label} hint={`${d.hint} · varsayılan ${d.def}`}>
              <input type="number" min={d.min} max={d.max} value={t[k]} onChange={(e) => setT({ ...t, [k]: e.target.value })} />
            </Field>
          ))}
        </div>
        <button
          className="btn primary"
          onClick={() => {
            for (const [k, d] of Object.entries(TIMING_DEFS)) {
              if (!(+t[k] >= d.min && +t[k] <= d.max)) return setMsg(`Hata: ${d.label} ${d.min}-${d.max} arasında olmalı.`)
            }
            saveTimings(Object.fromEntries(Object.entries(t).map(([k, v]) => [k, +v])))
            setMsg('Üretim süreleri kaydedildi.')
          }}
        >
          Süreleri kaydet
        </button>
      </div>
      {msg && <div className={'alert ' + (msg.startsWith('Hata') ? 'error' : 'info')}>{msg}</div>}
    </>
  )
}

function Lists() {
  return (
    <div className="card">
      <h3>Listeler</h3>
      <p className="small muted">
        Formlarda çıkan seçenekleri kendinize göre düzenleyin: ekleyin, adını değiştirin (öğeye dokunun), sıralayın veya çıkarın. Listeden çıkarmak, eski kayıtlardaki değeri silmez.
      </p>
      <div className="list-editors">
        {Object.keys(LIST_DEFS).map((k) => (
          <ListEditor key={k} listKey={k} />
        ))}
      </div>
    </div>
  )
}

function Appearance() {
  const settings = useSettings()
  const cur = { theme: settings.theme || 'auto', accent: settings.accent || 'petrol', density: settings.density || 'rahat', fontScale: settings.fontScale || 1 }
  const set = (patch) => {
    const next = { ...cur, ...patch }
    saveSettings(next)
    applyTheme(next)
  }
  return (
    <div className="card">
      <h3>Görünüm</h3>
      <Field label="Tema">
        <div className="seg">
          {Object.entries(THEMES).map(([k, v]) => (
            <button key={k} className={cur.theme === k ? 'on' : ''} onClick={() => set({ theme: k })}>
              {v}
            </button>
          ))}
        </div>
      </Field>
      <Field label="Vurgu rengi">
        <div className="swatches">
          {Object.entries(ACCENTS).map(([k, a]) => (
            <button key={k} className={'swatch' + (cur.accent === k ? ' on' : '')} onClick={() => set({ accent: k })} title={a.label} aria-label={a.label}>
              <span style={{ background: a.light }} />
              <small>{a.label}</small>
            </button>
          ))}
        </div>
      </Field>
      <Field label="Yazı boyutu">
        <div className="seg">
          {[
            [0.93, 'Küçük'],
            [1, 'Normal'],
            [1.1, 'Büyük'],
          ].map(([v, l]) => (
            <button key={v} className={+cur.fontScale === v ? 'on' : ''} onClick={() => set({ fontScale: v })}>
              {l}
            </button>
          ))}
        </div>
      </Field>
      <Field label="Yerleşim">
        <div className="seg">
          {Object.entries(DENSITIES).map(([k, v]) => (
            <button key={k} className={cur.density === k ? 'on' : ''} onClick={() => set({ density: k })}>
              {v}
            </button>
          ))}
        </div>
      </Field>
      <p className="tiny muted">Görünüm ayarları yalnızca bu cihaz için geçerlidir.</p>
    </div>
  )
}

function Account() {
  const settings = useSettings()
  const sync = useSyncState()
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
    <>
      <div className="card">
        <h3>
          <Cloud size={18} /> Bulut eşitlemesi
        </h3>
        {cloudEnabled ? (
          <>
            <div className="kv">
              <span>Hesap</span>
              <strong>{sync.user?.email || 'Giriş yapılmadı'}</strong>
              <span>Rol</span>
              <strong>{sync.role === 'yardimci' ? 'Yardımcı' : 'Sahip'}</strong>
              <span>Durum</span>
              <strong>{{ idle: 'Bekliyor', syncing: 'Eşitleniyor…', ok: 'Güncel', error: 'Hata', offline: 'Çevrimdışı' }[sync.status]}</strong>
              <span>Son eşitleme</span>
              <strong>{sync.lastSync ? new Date(sync.lastSync).toLocaleString('tr-TR') : '—'}</strong>
              <span>Bekleyen değişiklik</span>
              <strong>{pendingCount()}</strong>
            </div>
            {sync.error && <div className="alert error">{sync.error}</div>}
            <div className="row gap-s wrap">
              <button className="btn" onClick={syncNow} disabled={!sync.user}>
                Şimdi eşitle
              </button>
              {sync.user && (
                <button className="btn ghost" onClick={() => supabase.auth.signOut()}>
                  Çıkış yap
                </button>
              )}
            </div>
          </>
        ) : (
          <p className="small">Yerel mod: veriler yalnızca bu cihazda. Cihazlar arası eşitleme ve yapay zeka için Supabase ayarlarını yapın (README).</p>
        )}
      </div>

      <MembersCard />

      <div className="card">
        <h3>
          <Database size={18} /> Yedekleme
        </h3>
        <div className="kv">
          {COLLECTIONS.filter((c) => list(c).length).map((c) => (
            <Fragment key={c}>
              <span>{NAMES[c] || c}</span>
              <strong>{list(c).length}</strong>
            </Fragment>
          ))}
        </div>
        <div className="row gap-s wrap">
          <button
            className="btn"
            onClick={() => {
              download(`kuru-yedek-${today()}.json`, JSON.stringify(exportBackup()))
              saveSettings({ lastBackup: today() })
            }}
          >
            <Download size={16} /> Yedek indir
          </button>
          <button className="btn" onClick={() => fileRef.current.click()}>
            <Upload size={16} /> Yedekten geri yükle
          </button>
          <input ref={fileRef} type="file" accept="application/json,.json" hidden onChange={restore} />
        </div>
        <p className="tiny muted">Son yedek: {fmtDate(settings.lastBackup)}. Fotoğraflar yedek dosyasına dahil değildir; bulutta saklanır.</p>
        {msg && <div className={'alert ' + (msg.startsWith('Hata') ? 'error' : 'info')}>{msg}</div>}
      </div>
    </>
  )
}

export default function Settings() {
  const settings = useSettings()
  const [tab, setTab] = useState('genel')
  return (
    <div className="page">
      <PageHeader icon={Settings2} title="Ayarlar" subtitle={settings.loftName} />
      <Tabs
        value={tab}
        onChange={setTab}
        tabs={{ genel: 'Genel', listeler: 'Listeler', gorunum: 'Görünüm', bildirim: 'Bildirimler', hesap: 'Hesap & Yedek' }}
      />
      {tab === 'genel' && <General />}
      {tab === 'listeler' && <Lists />}
      {tab === 'gorunum' && <Appearance />}
      {tab === 'bildirim' && <NotificationsCard />}
      {tab === 'hesap' && <Account />}
      <p className="tiny muted center">Kuru v2.0 · {settings.owner}</p>
    </div>
  )
}
