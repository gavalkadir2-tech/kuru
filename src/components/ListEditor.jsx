import { useState } from 'react'
import { LIST_DEFS, resetList, saveList, useList } from '../lib/config'
import { list } from '../lib/store'
import { ChevronDown, ChevronUp, Plus, RotateCcw, X } from 'lucide-react'

// Bir listenin kaç kayıtta kullanıldığını bulmak için alan eşlemesi
const USAGE = {
  breeds: ['pigeons', 'breed'],
  colors: ['pigeons', 'color'],
  eyeColors: ['pigeons', 'eyeColor'],
  groups: ['pigeons', 'group'],
  lofts: ['pigeons', 'loft'],
  pairTypes: ['pairs', 'type'],
  medicines: ['health', 'medicine'],
  incomeCats: ['ledger', 'category'],
  expenseCats: ['ledger', 'category'],
  weather: ['flights', 'weather'],
}

function usageCount(key, value) {
  const [col, field] = USAGE[key] || []
  return col ? list(col).filter((r) => r[field] === value).length : 0
}

export default function ListEditor({ listKey }) {
  const def = LIST_DEFS[listKey]
  const items = useList(listKey)
  const [open, setOpen] = useState(false)
  const [text, setText] = useState('')
  const [editing, setEditing] = useState(null)
  const [draft, setDraft] = useState('')

  const add = (e) => {
    e.preventDefault()
    const parts = text.split(/[,;\n]/).map((x) => x.trim()).filter(Boolean)
    if (!parts.length) return
    saveList(listKey, [...items, ...parts])
    setText('')
  }
  const move = (i, d) => {
    const next = items.slice()
    ;[next[i], next[i + d]] = [next[i + d], next[i]]
    saveList(listKey, next)
  }
  const removeAt = (i) => {
    const n = usageCount(listKey, items[i])
    if (n && !window.confirm(`"${items[i]}" ${n} kayıtta kullanılıyor. Listeden çıkarılsın mı? (Kayıtlardaki değer silinmez.)`)) return
    saveList(listKey, items.filter((_, j) => j !== i))
  }
  const rename = (i) => {
    const v = draft.trim()
    setEditing(null)
    if (!v || v === items[i]) return
    saveList(listKey, items.map((x, j) => (j === i ? v : x)))
  }

  return (
    <div className="list-editor">
      <button className="list-editor-head" onClick={() => setOpen(!open)} aria-expanded={open}>
        <div>
          <strong>{def.label}</strong>
          <span className="tiny muted">
            {items.length} öğe · {def.hint}
          </span>
        </div>
        {open ? <ChevronUp size={18} /> : <ChevronDown size={18} />}
      </button>
      {open && (
        <div className="list-editor-body">
          {items.length === 0 && <p className="small muted">Liste boş.</p>}
          <ul className="list-items">
            {items.map((x, i) => (
              <li key={x + i}>
                {editing === i ? (
                  <input
                    autoFocus
                    value={draft}
                    onChange={(e) => setDraft(e.target.value)}
                    onBlur={() => rename(i)}
                    onKeyDown={(e) => e.key === 'Enter' && rename(i)}
                  />
                ) : (
                  <button
                    className="list-item-name"
                    title="Adını değiştirmek için dokunun"
                    onClick={() => {
                      setEditing(i)
                      setDraft(x)
                    }}
                  >
                    {x}
                  </button>
                )}
                <span className="row">
                  <button className="icon-btn sm" disabled={i === 0} onClick={() => move(i, -1)} aria-label="Yukarı">
                    <ChevronUp size={16} />
                  </button>
                  <button className="icon-btn sm" disabled={i === items.length - 1} onClick={() => move(i, 1)} aria-label="Aşağı">
                    <ChevronDown size={16} />
                  </button>
                  <button className="icon-btn sm danger-text" onClick={() => removeAt(i)} aria-label="Sil">
                    <X size={16} />
                  </button>
                </span>
              </li>
            ))}
          </ul>
          <form className="row gap-s" onSubmit={add}>
            <input className="grow" value={text} onChange={(e) => setText(e.target.value)} placeholder="Yeni öğe (virgülle birden fazla)" />
            <button className="btn primary small">
              <Plus size={16} /> Ekle
            </button>
          </form>
          <button className="btn ghost small" onClick={() => window.confirm('Liste varsayılan haline dönsün mü?') && resetList(listKey)}>
            <RotateCcw size={14} /> Varsayılana dön
          </button>
        </div>
      )}
    </div>
  )
}
