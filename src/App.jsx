import { useEffect, useState } from 'react'
import Auth from './Auth'
import { VoiceFab } from './components/VoiceEntry'
import { ArrowLeftRight, Bird, Egg, HeartPulse, LayoutDashboard, Menu, Package, Settings as SettingsIcon, Sparkles, Trophy, Users, Wallet, Wheat } from 'lucide-react'
import { getSettings, list, save, saveSettings, setSyncUser, useAutoSync, useSyncState } from './lib/store'
import { migratePeople } from './lib/people'
import { resolveLoft, useIsHelper } from './lib/members'
import { migrateLegacyPhotos } from './lib/photos'
import { supabase } from './lib/supabase'
import Assistant from './pages/Assistant'
import Breeding from './pages/Breeding'
import Certificate, { SharedPedigree } from './pages/Certificate'
import Dashboard from './pages/Dashboard'
import Feeding from './pages/Feeding'
import Flights from './pages/Flights'
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
  { id: 'ana', icon: LayoutDashboard, label: 'Ana Sayfa', group: '' },
  { id: 'kuslar', icon: Bird, label: 'Güvercinler', group: 'Kümes' },
  { id: 'uretim', icon: Egg, label: 'Üretim', group: 'Kümes' },
  { id: 'ucus', icon: Trophy, label: 'Uçuş & Oyun', group: 'Kümes' },
  { id: 'saglik', icon: HeartPulse, label: 'Sağlık', group: 'Bakım' },
  { id: 'yem', icon: Wheat, label: 'Yemleme', group: 'Bakım' },
  { id: 'stok', icon: Package, label: 'Stok', group: 'Bakım' },
  { id: 'alimsatim', icon: ArrowLeftRight, label: 'Alım-Satım', group: 'Ticaret' },
  { id: 'kisiler', icon: Users, label: 'Kişiler', group: 'Ticaret' },
  { id: 'defter', icon: Wallet, label: 'Gelir-Gider', group: 'Ticaret' },
  { id: 'asistan', icon: Sparkles, label: 'AI Asistan', group: 'Akıllı' },
  { id: 'ayarlar', icon: SettingsIcon, label: 'Ayarlar', group: 'Sistem' },
]
// Telefonda alt çubukta görünenler
const MOBILE_NAV = ['ana', 'kuslar', 'uretim', 'saglik', 'asistan']
// Yardımcı hesabının göremediği sayfalar (satış, fiyat ve kişisel bilgiler)
const HELPER_HIDDEN = ['alimsatim', 'defter', 'kisiler', 'kisi']

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
    const user = session?.user
    if (!user) return setSyncUser(null)
    let alive = true
    resolveLoft(user).then(({ ownerId, role }) => alive && setSyncUser(user, ownerId, role))
    return () => {
      alive = false
    }
  }, [session?.user?.id])
  const helper = useIsHelper()

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

  const [routePage, param] = route.split('/')
  const page = helper && HELPER_HIDDEN.includes(routePage) ? 'ana' : routePage
  const navItems = helper ? NAV.filter((n) => !HELPER_HIDDEN.includes(n.id)) : NAV
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
    case 'ucus':
      content = <Flights go={go} />
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

  const link = (n, cls) => {
    const Icon = n.icon
    return (
      <a key={n.id} href={'#/' + n.id} className={cls + (active === n.id ? ' active' : '')} onClick={() => setMenu(false)} aria-current={active === n.id ? 'page' : undefined}>
        <Icon className="nav-icon" size={cls === 'bottom-link' ? 22 : 18} strokeWidth={active === n.id ? 2.4 : 2} />
        <span className="nav-label">{n.label}</span>
      </a>
    )
  }
  const groups = [...new Set(navItems.map((n) => n.group))]
  const current = NAV.find((n) => n.id === active)

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
        <nav>
          {groups.map((g) => (
            <div key={g || 'genel'} className="nav-group">
              {g && <span className="nav-group-label">{g}</span>}
              {navItems.filter((n) => n.group === g).map((n) => link(n, 'side-link'))}
            </div>
          ))}
        </nav>
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
          <Menu size={22} />
        </button>
        <strong>{current?.label || 'Kuru'}</strong>
        <SyncDot />
      </header>
      <main>{content}</main>
      {!['asistan', 'belge', 'etiket'].includes(page) && <VoiceFab />}
      <nav className="bottom-nav no-print">{navItems.filter((n) => MOBILE_NAV.includes(n.id)).map((n) => link(n, 'bottom-link'))}</nav>
    </div>
  )
}
