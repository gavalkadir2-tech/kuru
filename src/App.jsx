import { useEffect, useState } from 'react'
import Auth from './Auth'
import { VoiceFab } from './components/VoiceEntry'
import { getSettings, list, save, saveSettings, setSyncUser, useAutoSync, useSyncState } from './lib/store'
import { migratePeople } from './lib/people'
import { migrateLegacyPhotos } from './lib/photos'
import { supabase } from './lib/supabase'
import Assistant from './pages/Assistant'
import Breeding from './pages/Breeding'
import Certificate, { SharedPedigree } from './pages/Certificate'
import Dashboard from './pages/Dashboard'
import Feeding from './pages/Feeding'
import Labels from './pages/Labels'
import Ledger from './pages/Ledger'
import Health from './pages/Health'
import PigeonDetail from './pages/PigeonDetail'
import People, { PersonDetail } from './pages/People'
import Pigeons from './pages/Pigeons'
import Settings from './pages/Settings'
import Stock from './pages/Stock'
import Trade from './pages/Trade'

const NAV = [
  { id: 'ana', icon: '🏠', label: 'Ana Sayfa' },
  { id: 'kuslar', icon: '🕊️', label: 'Güvercinler' },
  { id: 'uretim', icon: '🥚', label: 'Üretim' },
  { id: 'saglik', icon: '🩺', label: 'Sağlık' },
  { id: 'yem', icon: '🌾', label: 'Yemleme' },
  { id: 'asistan', icon: '🤖', label: 'AI Asistan' },
  { id: 'stok', icon: '📦', label: 'Stok' },
  { id: 'alimsatim', icon: '🤝', label: 'Alım-Satım' },
  { id: 'kisiler', icon: '👥', label: 'Kişiler' },
  { id: 'defter', icon: '📒', label: 'Gelir-Gider' },
  { id: 'ayarlar', icon: '⚙️', label: 'Ayarlar' },
]
// Telefonda alt çubukta görünenler
const MOBILE_NAV = ['ana', 'kuslar', 'uretim', 'saglik', 'asistan']

function useRoute() {
  const read = () => window.location.hash.replace(/^#\/?/, '') || 'ana'
  const [route, setRoute] = useState(read)
  useEffect(() => {
    const on = () => {
      setRoute(read())
      window.scrollTo(0, 0)
    }
    window.addEventListener('hashchange', on)
    return () => window.removeEventListener('hashchange', on)
  }, [])
  return [route, (r) => (window.location.hash = '/' + r)]
}

function SyncDot() {
  const s = useSyncState()
  const [online, setOnline] = useState(navigator.onLine)
  useEffect(() => {
    const on = () => setOnline(navigator.onLine)
    window.addEventListener('online', on)
    window.addEventListener('offline', on)
    return () => {
      window.removeEventListener('online', on)
      window.removeEventListener('offline', on)
    }
  }, [])
  if (!supabase) return <span className="sync-dot local" title="Yerel mod" />
  const tone = !online ? 'offline' : s.status === 'error' ? 'error' : s.status === 'syncing' ? 'syncing' : s.user ? 'ok' : 'local'
  const title = { offline: 'Çevrimdışı', error: 'Senkron hatası', syncing: 'Senkronize ediliyor', ok: 'Bulutla senkron', local: 'Giriş yapılmadı' }[tone]
  return <span className={'sync-dot ' + tone} title={title} />
}

export default function App() {
  const [route, go] = useRoute()
  const [session, setSession] = useState(undefined)
  const [skipAuth, setSkipAuth] = useState(() => sessionStorage.getItem('kuru:skipAuth') === '1')
  const [menu, setMenu] = useState(false)
  useAutoSync()

  useEffect(() => {
    migrateLegacyPhotos(list, save)
    migratePeople(getSettings, saveSettings)
  }, [])

  useEffect(() => {
    if (!supabase) return setSession(null)
    supabase.auth.getSession().then(({ data }) => setSession(data.session))
    const { data } = supabase.auth.onAuthStateChange((_e, s) => setSession(s))
    return () => data.subscription.unsubscribe()
  }, [])

  useEffect(() => {
    setSyncUser(session?.user || null)
  }, [session?.user?.id])

  // Paylaşılan soy kütüğü bağlantısı giriş gerektirmez
  if (route.startsWith('soy/')) return <SharedPedigree code={route.slice(4)} />

  if (supabase && session === undefined) return <div className="splash">🕊️</div>
  if (supabase && !session && !skipAuth)
    return (
      <Auth
        onSkip={() => {
          sessionStorage.setItem('kuru:skipAuth', '1')
          setSkipAuth(true)
        }}
      />
    )

  const [page, param] = route.split('/')
  const active = ['kus', 'belge', 'etiket'].includes(page) ? 'kuslar' : page === 'kisi' ? 'kisiler' : page
  let content
  switch (page) {
    case 'kuslar':
      content = <Pigeons go={go} />
      break
    case 'kus':
      content = <PigeonDetail id={param} go={go} />
      break
    case 'belge':
      content = <Certificate id={param} go={go} />
      break
    case 'etiket':
      content = <Labels ids={param} go={go} />
      break
    case 'uretim':
      content = <Breeding go={go} />
      break
    case 'saglik':
      content = <Health go={go} />
      break
    case 'yem':
      content = <Feeding go={go} />
      break
    case 'asistan':
      content = <Assistant />
      break
    case 'stok':
      content = <Stock />
      break
    case 'kisiler':
      content = <People go={go} />
      break
    case 'kisi':
      content = <PersonDetail id={param} go={go} />
      break
    case 'defter':
      content = <Ledger go={go} />
      break
    case 'alimsatim':
      content = <Trade go={go} />
      break
    case 'ayarlar':
      content = <Settings />
      break
    default:
      content = <Dashboard go={go} />
  }

  const nav = (items, cls) =>
    items.map((n) => (
      <a
        key={n.id}
        href={'#/' + n.id}
        className={cls + (active === n.id ? ' active' : '')}
        onClick={() => setMenu(false)}
      >
        <span className="nav-icon">{n.icon}</span>
        <span className="nav-label">{n.label}</span>
      </a>
    ))

  return (
    <div className="app">
      <aside className={'sidebar no-print' + (menu ? ' open' : '')}>
        <div className="brand">
          <img src="/icon.svg" alt="" width="36" height="36" />
          <div>
            <strong>Kuru</strong>
            <span>Güvercin Takip</span>
          </div>
          <SyncDot />
        </div>
        <nav>{nav(NAV, 'side-link')}</nav>
        {supabase && !session && (
          <button
            className="btn small block"
            onClick={() => {
              sessionStorage.removeItem('kuru:skipAuth')
              setSkipAuth(false)
            }}
          >
            Giriş yap / Senkronla
          </button>
        )}
      </aside>
      {menu && <div className="scrim no-print" onClick={() => setMenu(false)} />}
      <header className="topbar no-print">
        <button className="icon-btn" onClick={() => setMenu(true)} aria-label="Menü">
          ☰
        </button>
        <strong>Kuru</strong>
        <SyncDot />
      </header>
      <main>{content}</main>
      {!['asistan', 'belge', 'etiket'].includes(page) && <VoiceFab />}
      <nav className="bottom-nav no-print">{nav(NAV.filter((n) => MOBILE_NAV.includes(n.id)), 'bottom-link')}</nav>
    </div>
  )
}
