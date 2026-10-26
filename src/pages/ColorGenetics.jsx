import { useMemo, useState } from 'react'
import { FEMALE_BASE, FEMALE_DILUTE, MALE_BASE, MALE_DILUTE, PATTERN, RECRED, SPREAD, predict } from '../lib/genetics'
import { get, save, useCollection } from '../lib/store'
import { Field, PigeonSelect } from '../components/ui'

const DEFAULT_M = { base: '+/+', dilute: 'D/D', pattern: '+/+', spread: '+/+', recred: '+/+' }
const DEFAULT_F = { base: '+', dilute: 'D', pattern: '+/+', spread: '+/+', recred: '+/+' }

function Opt({ label, value, onChange, options }) {
  return (
    <Field label={label}>
      <select value={value} onChange={(e) => onChange(e.target.value)}>
        {options.map(([k, v]) => (
          <option key={k} value={k}>
            {v}
          </option>
        ))}
      </select>
    </Field>
  )
}

function ParentCard({ title, sex, bird, setBird, g, setG }) {
  const male = sex === 'E'
  const set = (k) => (v) => setG({ ...g, [k]: v })
  const [saved, setSaved] = useState(false)
  return (
    <div className="card">
      <h3>{title}</h3>
      <Field label="Kayıtlı kuş (isteğe bağlı)">
        <PigeonSelect
          value={bird}
          onChange={(id) => {
            setBird(id)
            setSaved(false)
            const p = id && get('pigeons', id)
            if (p?.genotype) setG({ ...(male ? DEFAULT_M : DEFAULT_F), ...p.genotype })
          }}
          sex={sex}
          includeInactive={false}
          placeholder="— Seçilmedi —"
        />
      </Field>
      <div className="form-grid">
        <Opt label="Temel renk" value={g.base} onChange={set('base')} options={male ? MALE_BASE : FEMALE_BASE} />
        <Opt label="Seyreltme" value={g.dilute} onChange={set('dilute')} options={male ? MALE_DILUTE : FEMALE_DILUTE} />
        <Opt label="Desen" value={g.pattern} onChange={set('pattern')} options={PATTERN} />
        <Opt label="Yayılma (kara/düz renk)" value={g.spread} onChange={set('spread')} options={SPREAD} />
        <Opt label="Resesif kırmızı" value={g.recred} onChange={set('recred')} options={RECRED} />
      </div>
      {bird && (
        <button
          className="btn small"
          onClick={() => {
            save('pigeons', { ...get('pigeons', bird), genotype: g })
            setSaved(true)
          }}
        >
          {saved ? '✓ Kuşa kaydedildi' : 'Bu genotipi kuşa kaydet'}
        </button>
      )}
    </div>
  )
}

export default function ColorGenetics({ initialMale = '', initialFemale = '' }) {
  useCollection('pigeons')
  const [maleId, setMaleId] = useState(initialMale)
  const [femaleId, setFemaleId] = useState(initialFemale)
  const [m, setM] = useState(() => ({ ...DEFAULT_M, ...(get('pigeons', initialMale)?.genotype || {}) }))
  const [f, setF] = useState(() => ({ ...DEFAULT_F, ...(get('pigeons', initialFemale)?.genotype || {}) }))
  const [detail, setDetail] = useState(false)
  const result = useMemo(() => predict(m, f), [m, f])

  // Ana görünüm: aynı görünen renkler birleştirilir; ayrıntıda taşıyıcılık da gösterilir
  const merged = (sex) => {
    const map = new Map()
    for (const r of result.filter((x) => x.sex === sex)) {
      const key = detail ? `${r.name}|${r.carriers.join(', ')}` : r.name
      map.set(key, { name: r.name, carriers: detail ? r.carriers : [], p: (map.get(key)?.p || 0) + r.p })
    }
    return [...map.values()].sort((a, b) => b.p - a.p)
  }

  return (
    <>
      <p className="small muted">
        Ebeveynlerin bilinen veya tahmin edilen genotipini seçin. Erkekler bir rengi görünmeden taşıyabilir; dişiler cinsiyete bağlı renkleri (temel renk ve seyreltme) taşıyamaz,
        ne görünüyorsa odur.
      </p>
      <div className="grid-2">
        <ParentCard title="♂ Baba" sex="E" bird={maleId} setBird={setMaleId} g={m} setG={setM} />
        <ParentCard title="♀ Anne" sex="D" bird={femaleId} setBird={setFemaleId} g={f} setG={setF} />
      </div>
      <div className="card">
        <div className="row between wrap gap-s">
          <h3>Beklenen yavru renkleri</h3>
          <label className="check small">
            <input type="checkbox" checked={detail} onChange={(e) => setDetail(e.target.checked)} /> Taşıyıcılığı göster
          </label>
        </div>
        <div className="grid-2">
          {[
            ['E', '♂ Erkek yavrular'],
            ['D', '♀ Dişi yavrular'],
          ].map(([sex, title]) => (
            <div key={sex}>
              <h4 className="gen-title">{title}</h4>
              {merged(sex).map((r) => (
                <div key={r.name + r.carriers.join()} className="gen-row">
                  <div className="row between gap-s">
                    <span>
                      {r.name}
                      {r.carriers.length > 0 && <span className="tiny muted"> · {r.carriers.join(', ')}</span>}
                    </span>
                    <strong className="nowrap">%{(Math.round(r.p * 1000) / 10).toLocaleString('tr-TR')}</strong>
                  </div>
                  <div className="bar">
                    <span style={{ width: `${r.p * 100}%` }} />
                  </div>
                </div>
              ))}
            </div>
          ))}
        </div>
        <p className="tiny muted">
          Yaklaşık sonuçtur: temel renk ve seyreltme genlerinin birbirine bağlılığı ile grizzle, opal, almond, indigo gibi değiştirici genler hesaba katılmaz. Kırmızı kuşlarda
          desen çoğu zaman belirgin görünmez.
        </p>
      </div>
    </>
  )
}
