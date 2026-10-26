export const today = () => new Date().toISOString().slice(0, 10)

export function addDays(dateStr, n) {
  if (!dateStr) return ''
  const d = new Date(dateStr + 'T12:00:00')
  d.setDate(d.getDate() + n)
  return d.toISOString().slice(0, 10)
}

export function daysBetween(a, b) {
  if (!a || !b) return null
  return Math.round((new Date(b + 'T12:00:00') - new Date(a + 'T12:00:00')) / 86400000)
}

export function fmtDate(d) {
  if (!d) return '—'
  const [y, m, day] = d.slice(0, 10).split('-')
  return `${day}.${m}.${y}`
}

export function ageText(birth) {
  if (!birth) return '—'
  const days = daysBetween(birth, today())
  if (days < 0) return '—'
  if (days < 60) return `${days} gün`
  if (days < 730) return `${Math.floor(days / 30)} ay`
  const y = Math.floor(days / 365)
  const m = Math.floor((days % 365) / 30)
  return m ? `${y} yıl ${m} ay` : `${y} yıl`
}

export function money(v) {
  if (v === '' || v == null || isNaN(+v)) return '—'
  return (+v).toLocaleString('tr-TR', { maximumFractionDigits: 2 }) + ' ₺'
}

// "12,5" gibi virgüllü girişleri de kabul et
export function num(v) {
  if (v === '' || v == null) return ''
  const n = parseFloat(String(v).replace(',', '.'))
  return isNaN(n) ? '' : n
}

export function pigeonLabel(p) {
  if (!p) return '—'
  return [p.ring, p.name].filter(Boolean).join(' · ') || 'İsimsiz'
}

export function compressImage(file, max = 640, quality = 0.72) {
  return new Promise((resolve, reject) => {
    const img = new Image()
    const url = URL.createObjectURL(file)
    img.onload = () => {
      const scale = Math.min(1, max / Math.max(img.width, img.height))
      const c = document.createElement('canvas')
      c.width = Math.round(img.width * scale)
      c.height = Math.round(img.height * scale)
      c.getContext('2d').drawImage(img, 0, 0, c.width, c.height)
      URL.revokeObjectURL(url)
      resolve(c.toDataURL('image/jpeg', quality))
    }
    img.onerror = () => reject(new Error('Görsel okunamadı'))
    img.src = url
  })
}

export function download(filename, content, type = 'application/json') {
  const blob = content instanceof Blob ? content : new Blob([content], { type })
  const a = document.createElement('a')
  a.href = URL.createObjectURL(blob)
  a.download = filename
  document.body.appendChild(a)
  a.click()
  a.remove()
  setTimeout(() => URL.revokeObjectURL(a.href), 1000)
}

// Excel'in Türkçe karakterleri doğru açması için BOM + noktalı virgül
export function exportCSV(rows, filename) {
  if (!rows.length) return alert('Dışa aktarılacak kayıt yok.')
  const headers = Object.keys(rows[0])
  const esc = (v) => {
    const s = v == null ? '' : String(v)
    return /[;"\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s
  }
  const csv = [headers.join(';'), ...rows.map((r) => headers.map((h) => esc(r[h])).join(';'))].join('\n')
  download(filename, '﻿' + csv, 'text/csv;charset=utf-8')
}

// Yapay zeka yanıtları için küçük, güvenli markdown çevirici
export function markdown(src = '') {
  const esc = (s) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
  const inline = (s) => esc(s).replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>').replace(/(^|[^*])\*([^*]+)\*/g, '$1<em>$2</em>')
  const out = []
  let list = null
  const close = () => {
    if (list) out.push(`</${list}>`)
    list = null
  }
  for (const raw of src.split('\n')) {
    const line = raw.trimEnd()
    let m
    if ((m = line.match(/^(#{1,4})\s+(.*)/))) {
      close()
      const lvl = Math.min(4, m[1].length + 2)
      out.push(`<h${lvl}>${inline(m[2])}</h${lvl}>`)
    } else if ((m = line.match(/^\s*[-*•]\s+(.*)/))) {
      if (list !== 'ul') {
        close()
        out.push('<ul>')
        list = 'ul'
      }
      out.push(`<li>${inline(m[1])}</li>`)
    } else if ((m = line.match(/^\s*\d+[.)]\s+(.*)/))) {
      if (list !== 'ol') {
        close()
        out.push('<ol>')
        list = 'ol'
      }
      out.push(`<li>${inline(m[1])}</li>`)
    } else if (/^\|.*\|$/.test(line)) {
      close()
      if (/^\|[\s:|-]+\|$/.test(line)) continue
      const cells = line.slice(1, -1).split('|').map((c) => `<td>${inline(c.trim())}</td>`)
      const prev = out[out.length - 1]
      if (prev && prev.endsWith('</tr></table>')) out[out.length - 1] = prev.replace(/<\/table>$/, `<tr>${cells.join('')}</tr></table>`)
      else out.push(`<table><tr>${cells.join('')}</tr></table>`)
    } else if (!line.trim()) {
      close()
    } else {
      close()
      out.push(`<p>${inline(line)}</p>`)
    }
  }
  close()
  return out.join('')
}
