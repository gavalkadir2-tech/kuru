// Görünüm: tema (otomatik / açık / koyu) ve vurgu rengi — yalnızca bu cihaz
export const ACCENTS = {
  petrol: { label: 'Petrol', light: '#1f4e5f', dark: '#4fa3bf' },
  lacivert: { label: 'Lacivert', light: '#1e3a8a', dark: '#7aa2f7' },
  zumrut: { label: 'Zümrüt', light: '#14532d', dark: '#4ade80' },
  bordo: { label: 'Bordo', light: '#7f1d1d', dark: '#f87171' },
  kahve: { label: 'Kahve', light: '#5b3a1e', dark: '#d6a46a' },
  mor: { label: 'Mor', light: '#4c1d95', dark: '#a78bfa' },
}
export const THEMES = { auto: 'Cihaza göre', light: 'Açık', dark: 'Koyu' }
export const DENSITIES = { rahat: 'Rahat', sik: 'Sıkışık' }

export function applyTheme({ theme = 'auto', accent = 'petrol', density = 'rahat', fontScale = 1 } = {}) {
  const root = document.documentElement
  if (theme === 'auto') delete root.dataset.theme
  else root.dataset.theme = theme
  const a = ACCENTS[accent] || ACCENTS.petrol
  root.style.setProperty('--accent-light', a.light)
  root.style.setProperty('--accent-dark', a.dark)
  root.dataset.density = density
  root.style.fontSize = `${Math.round(15 * (+fontScale || 1))}px`
  const dark = theme === 'dark' || (theme === 'auto' && window.matchMedia('(prefers-color-scheme: dark)').matches)
  document.querySelector('meta[name=theme-color]')?.setAttribute('content', dark ? '#11181b' : a.light)
}
