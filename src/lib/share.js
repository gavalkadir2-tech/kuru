// Soy kütüğü paylaşım bağlantısı.
// Kuşun 4 kuşaklık soy bilgisi sıkıştırılıp bağlantının içine gömülür; açmak için
// giriş veya sunucu gerekmez, alıcı yalnızca bu bilgiyi görür.
import { get, getSettings } from './store'

const FIELDS = { ring: 'r', name: 'n', color: 'c', breed: 'b', sex: 's', birthDate: 'd', traits: 't' }

// Kayıtlı kuştan iç içe soy ağacı düğümü üretir
export function pedigreeTree(id, maxGen = 4, gen = 1, text) {
  const p = id ? get('pigeons', id) : null
  if (!p) return text ? { ring: text, external: true } : null
  const node = {}
  for (const k of Object.keys(FIELDS)) if (p[k]) node[k] = gen === 1 || k !== 'traits' ? p[k] : String(p[k]).slice(0, 60)
  if (gen < maxGen) {
    node.father = pedigreeTree(p.fatherId, maxGen, gen + 1, p.fatherText)
    node.mother = pedigreeTree(p.motherId, maxGen, gen + 1, p.motherText)
  }
  return node
}

function pack(node) {
  if (!node) return 0
  const o = {}
  for (const [k, short] of Object.entries(FIELDS)) if (node[k]) o[short] = node[k]
  if (node.father || node.mother) o.p = [pack(node.father), pack(node.mother)]
  return o
}
function unpack(o) {
  if (!o) return null
  const node = {}
  for (const [k, short] of Object.entries(FIELDS)) if (o[short]) node[k] = o[short]
  if (o.p) {
    node.father = unpack(o.p[0])
    node.mother = unpack(o.p[1])
  }
  return node
}

function toB64u(bytes) {
  let s = ''
  for (const b of bytes) s += String.fromCharCode(b)
  return btoa(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}
function fromB64u(s) {
  const bin = atob(s.replace(/-/g, '+').replace(/_/g, '/') + '==='.slice((s.length + 3) % 4))
  return Uint8Array.from(bin, (c) => c.charCodeAt(0))
}
async function streamBytes(bytes, transform) {
  const stream = new Blob([bytes]).stream().pipeThrough(transform)
  return new Uint8Array(await new Response(stream).arrayBuffer())
}

export async function encodeShare(id) {
  const s = getSettings()
  const payload = { v: 1, l: s.loftName, o: s.owner, at: new Date().toISOString().slice(0, 10), k: pack(pedigreeTree(id)) }
  const bytes = new TextEncoder().encode(JSON.stringify(payload))
  return toB64u(await streamBytes(bytes, new CompressionStream('deflate-raw')))
}

export async function decodeShare(code) {
  const bytes = await streamBytes(fromB64u(code), new DecompressionStream('deflate-raw'))
  const p = JSON.parse(new TextDecoder().decode(bytes))
  return { loftName: p.l, owner: p.o, date: p.at, tree: unpack(p.k) }
}

export async function shareUrl(id) {
  return `${location.origin}/#/soy/${await encodeShare(id)}`
}
