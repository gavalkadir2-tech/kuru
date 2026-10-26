// Kişiler (müşteri / tedarikçi) ve cari hesap hareketleri
import { list, remove, save } from './store'

export const PERSON_TYPES = { musteri: 'Müşteri', tedarikci: 'Satıcı / Tedarikçi', ikisi: 'Müşteri ve satıcı', diger: 'Diğer' }
// Pozitif bakiye: kişi bize borçlu. Negatif: biz ona borçluyuz.
export const ACCOUNT_KINDS = {
  borc: { label: 'Veresiye satış / Borç verdik', sign: 1 },
  tahsilat: { label: 'Tahsilat (bize ödedi)', sign: -1 },
  alacak: { label: 'Veresiye alış / Borçlandık', sign: -1 },
  odeme: { label: 'Ödeme (biz ödedik)', sign: 1 },
}

const norm = (s) => (s || '').trim().toLocaleLowerCase('tr')

export function findPerson(name) {
  const n = norm(name)
  return n ? list('people').find((p) => norm(p.name) === n) : null
}

// Kuş kaydındaki kişi adı yeni ise kişi listesine ekler
export function ensurePerson(name, extra = {}) {
  if (!norm(name)) return null
  const existing = findPerson(name)
  if (existing) {
    const patch = {}
    for (const [k, v] of Object.entries(extra)) if (v && !existing[k]) patch[k] = v
    return Object.keys(patch).length ? save('people', { ...existing, ...patch }) : existing
  }
  return save('people', { name: name.trim(), type: 'diger', phone: '', city: '', notes: '', ...extra })
}

export function personBirds(person, pigeons = list('pigeons')) {
  const n = norm(person.name)
  return {
    sold: pigeons.filter((p) => ['satildi', 'verildi'].includes(p.status) && norm(p.toName) === n),
    bought: pigeons.filter((p) => p.origin && p.origin !== 'uretim' && norm(p.fromName) === n),
  }
}

export function balanceOf(personId, accounts = list('accounts')) {
  return accounts.filter((a) => a.personId === personId).reduce((t, a) => t + (ACCOUNT_KINDS[a.kind]?.sign || 0) * (+a.amount || 0), 0)
}

// Kuş satışındaki "veresiye" işaretini cari hesaba yansıtır
export function syncCreditSale(pigeon) {
  const existing = list('accounts').find((a) => a.refId === pigeon.id)
  const want = pigeon.status === 'satildi' && pigeon.onCredit && +pigeon.toPrice > 0 && pigeon.toName
  if (!want) {
    if (existing) remove('accounts', existing.id)
    return
  }
  const person = ensurePerson(pigeon.toName)
  save('accounts', {
    ...(existing || {}),
    refId: pigeon.id,
    personId: person.id,
    kind: 'borc',
    amount: +pigeon.toPrice,
    date: pigeon.toDate,
    note: `${pigeon.ring} veresiye satış`,
  })
}

export function phoneLinks(phone) {
  const digits = (phone || '').replace(/\D/g, '')
  if (!digits) return null
  const intl = digits.startsWith('90') ? digits : digits.startsWith('0') ? '9' + digits : '90' + digits
  return { tel: `tel:${phone.replace(/\s/g, '')}`, wa: `https://wa.me/${intl}` }
}

// Önceki sürümlerde kuş kayıtlarına yazılmış kişileri listeye bir kez aktarır
export function migratePeople(getSettings, saveSettings) {
  if (getSettings().peopleMigrated) return
  for (const p of list('pigeons')) {
    if (p.origin && p.origin !== 'uretim' && p.fromName) ensurePerson(p.fromName, { phone: p.fromPhone, city: p.fromCity, type: 'tedarikci' })
    if (['satildi', 'verildi'].includes(p.status) && p.toName) ensurePerson(p.toName, { phone: p.toPhone, city: p.toCity, type: 'musteri' })
  }
  saveSettings({ peopleMigrated: true })
}

// Kuş kaydı kaydedildikten sonra: kişi listesi ve veresiye cari kaydı
export function afterPigeonSave(rec) {
  if (rec.origin && rec.origin !== 'uretim' && rec.fromName) ensurePerson(rec.fromName, { phone: rec.fromPhone, city: rec.fromCity, type: 'tedarikci' })
  if (['satildi', 'verildi'].includes(rec.status) && rec.toName) ensurePerson(rec.toName, { phone: rec.toPhone, city: rec.toCity, type: 'musteri' })
  syncCreditSale(rec)
}
