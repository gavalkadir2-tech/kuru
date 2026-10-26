import { Camera, Check, Info, Sparkles } from 'lucide-react'
import { useMemo, useRef, useState } from 'react'
import { askAI } from '../lib/ai'
import {
  AK_TYPES,
  ALMOND_OPTIONS,
  CARRIER_OPTIONS,
  COLOR_OPTIONS,
  DEFAULT_PHENO,
  GRIZZLE_OPTIONS,
  INDIGO_OPTIONS,
  MALE_ONLY_CARRIERS,
  PATTERN_OPTIONS,
  WHITE_OPTIONS,
  phenoOfBird,
  simulate,
} from '../lib/colorSim'
import { compressImage } from '../lib/format'
import { getPhoto } from '../lib/photos'
import { get, save, useCollection } from '../lib/store'
import { cloudEnabled } from '../lib/supabase'
import { ErrorText, Field, Mars, PigeonSelect, Select, Venus } from '../components/ui'

const NO_PATTERN = ['kara', 'boz', 'reskirmizi', 'ressari', 'ak']

// Yapay zekanın döndürdüğü değerleri yalnızca izin verilen seçeneklerle sınırlar
function cleanAiPheno(raw) {
  const pickKey = (v, opts, def) => (v && Object.prototype.hasOwnProperty.call(opts, v) ? v : def)
  return {
    color: pickKey(raw.color, COLOR_OPTIONS, 'gok'),
    pattern: pickKey(raw.pattern, PATTERN_OPTIONS, 'bilinmiyor'),
    white: pickKey(raw.white, WHITE_OPTIONS, 'yok'),
    grizzle: pickKey(raw.grizzle, GRIZZLE_OPTIONS, 'yok'),
    almond: pickKey(raw.almond, ALMOND_OPTIONS, 'yok'),
    indigo: pickKey(raw.indigo, INDIGO_OPTIONS, 'yok'),
  }
}

// Renk bilgisinin nereden geldiğini açıklar
function sourceText(p) {
  if (p.colorGenetics) return 'Kuşa kaydedilmiş renk bilgisi kullanıldı.'
  if (p.genotype) return 'Kuşa kaydedilmiş genotip kullanıldı.'
  if (phenoOfBird(p)) return `Kayıtlı renk yazısından dolduruldu: "${p.color}". Kontrol edin.`
  return 'Kuşun renk bilgisi tanınamadı; aşağıdan seçin veya fotoğraftan tanıtın.'
}

export function PhenoForm({ sex, value, onChange }) {
  const set = (k) => (v) => onChange({ ...value, [k]: v })
  const toggleCarrier = (k) => onChange({ ...value, carriers: value.carriers?.includes(k) ? value.carriers.filter((x) => x !== k) : [...(value.carriers || []), k] })
  const carrierOpts = Object.entries(CARRIER_OPTIONS).filter(([k]) => sex === 'E' || !MALE_ONLY_CARRIERS.includes(k))
  return (
    <>
      <div className="form-grid">
        <Field label="Görünür renk">
          <Select value={value.color} onChange={set('color')} options={COLOR_OPTIONS} placeholder="—" />
        </Field>
        {value.color === 'ak' ? (
          <Field label="Ak türü">
            <Select value={value.akType || 'bilinmiyor'} onChange={set('akType')} options={AK_TYPES} placeholder="—" />
          </Field>
        ) : (
          <Field label="Desen">
            <Select
              value={NO_PATTERN.includes(value.color) ? 'bilinmiyor' : value.pattern}
              onChange={set('pattern')}
              options={PATTERN_OPTIONS}
              placeholder="—"
              disabled={NO_PATTERN.includes(value.color)}
            />
          </Field>
        )}
        <Field label="Beyazlık / alaca" hint={value.white === 'karabas' ? 'Renk olarak baş rengini seçin' : ''}>
          <Select value={value.white} onChange={set('white')} options={WHITE_OPTIONS} placeholder="—" />
        </Field>
        <Field label="Kırçıl">
          <Select value={value.grizzle} onChange={set('grizzle')} options={GRIZZLE_OPTIONS} placeholder="—" />
        </Field>
        <Field label="Badem">
          <Select value={value.almond} onChange={set('almond')} options={ALMOND_OPTIONS} placeholder="—" />
        </Field>
        <Field label="İndigo">
          <Select value={value.indigo} onChange={set('indigo')} options={INDIGO_OPTIONS} placeholder="—" />
        </Field>
      </div>
      <details className="carriers">
        <summary>Bilinen taşıyıcılıklar {value.carriers?.length ? `(${value.carriers.length})` : ''}</summary>
        <p className="tiny muted">
          Görünmeyen ama taşıdığını bildiğiniz özellikleri işaretleyin (örneğin yavrularında çıktıysa). İşaretlenmeyenler için yaygın olasılıklar kullanılır.
          {sex === 'D' && ' Dişiler gök, kahve ve seyreltmeyi gizli taşıyamaz; ne görünüyorsa odur.'}
        </p>
        <div className="chips">
          {carrierOpts.map(([k, v]) => (
            <button key={k} type="button" className={'chip' + (value.carriers?.includes(k) ? ' on' : '')} onClick={() => toggleCarrier(k)}>
              {v}
            </button>
          ))}
        </div>
      </details>
    </>
  )
}

function ParentCard({ title, icon: Icon, sex, birdId, setBirdId, pheno, setPheno }) {
  useCollection('pigeons')
  const bird = birdId ? get('pigeons', birdId) : null
  const [source, setSource] = useState(() => (bird ? sourceText(bird) : ''))
  const [saved, setSaved] = useState(false)
  const [ai, setAi] = useState(null)
  const [aiErr, setAiErr] = useState('')
  const [loading, setLoading] = useState(false)
  const fileRef = useRef()

  const chooseBird = (id) => {
    setBirdId(id)
    setSaved(false)
    setAi(null)
    const p = id && get('pigeons', id)
    const ph = phenoOfBird(p)
    if (ph) setPheno(ph)
    setSource(p ? sourceText(p) : '')
  }

  const identify = async (dataUrl) => {
    setLoading(true)
    setAiErr('')
    setAi(null)
    try {
      const raw = await askAI('color', { image: dataUrl })
      const m = raw.match(/\{[\s\S]*\}/)
      const data = JSON.parse(m ? m[0] : raw)
      setPheno({ ...pheno, ...cleanAiPheno(data) })
      setAi({ explanation: data.explanation, confidence: +data.confidence || null, image: dataUrl })
      setSaved(false)
    } catch (e) {
      setAiErr(e instanceof SyntaxError ? 'Fotoğraf yorumlanamadı; daha net bir fotoğraf deneyin.' : e.message)
    } finally {
      setLoading(false)
    }
  }
  const fromBirdPhoto = async () => {
    const url = await getPhoto(bird.photos[0].id)
    if (!url) return setAiErr('Kuşun fotoğrafı bu cihazda bulunamadı.')
    identify(url)
  }
  const fromFile = async (e) => {
    const f = e.target.files?.[0]
    e.target.value = ''
    if (f) identify(await compressImage(f, 1024, 0.8))
  }

  return (
    <div className="card">
      <h3>
        <Icon size={18} /> {title}
      </h3>
      <Field label="Kayıtlı kuş (isteğe bağlı)">
        <PigeonSelect value={birdId} onChange={chooseBird} sex={sex} includeInactive={false} placeholder="— Seçilmedi —" />
      </Field>
      {source && <p className="tiny muted">{source}</p>}
      {cloudEnabled && (
        <div className="row gap-s wrap">
          {bird?.photos?.length > 0 && (
            <button type="button" className="btn small" onClick={fromBirdPhoto} disabled={loading}>
              <Sparkles size={14} /> Kuşun fotoğrafından tanı
            </button>
          )}
          <button type="button" className="btn small" onClick={() => fileRef.current.click()} disabled={loading}>
            <Camera size={14} /> {loading ? 'İnceleniyor…' : 'Fotoğraftan tanı'}
          </button>
          <input ref={fileRef} type="file" accept="image/*" capture="environment" hidden onChange={fromFile} />
        </div>
      )}
      <ErrorText>{aiErr}</ErrorText>
      {ai && (
        <div className="alert info small ai-photo">
          {ai.image && <img src={ai.image} alt="" />}
          <div>
            <strong>Fotoğraftan tanındı{ai.confidence ? ` (güven %${Math.round(ai.confidence * 100)})` : ''}</strong>
            {ai.explanation && <div>{ai.explanation}</div>}
            <div className="tiny">Aşağıdaki seçimleri kontrol edip gerekirse düzeltin.</div>
          </div>
        </div>
      )}
      <PhenoForm
        sex={sex}
        value={pheno}
        onChange={(v) => {
          setPheno(v)
          setSaved(false)
        }}
      />
      {bird && (
        <button
          className="btn small"
          onClick={() => {
            save('pigeons', { ...bird, colorGenetics: pheno })
            setSaved(true)
          }}
        >
          {saved ? (
            <>
              <Check size={14} /> Kuşa kaydedildi
            </>
          ) : (
            'Renk bilgisini kuşa kaydet'
          )}
        </button>
      )}
    </div>
  )
}

export default function ColorGenetics({ initialMale = '', initialFemale = '' }) {
  const [maleId, setMaleId] = useState(initialMale)
  const [femaleId, setFemaleId] = useState(initialFemale)
  const [m, setM] = useState(() => phenoOfBird(get('pigeons', initialMale)) || { ...DEFAULT_PHENO })
  const [f, setF] = useState(() => phenoOfBird(get('pigeons', initialFemale)) || { ...DEFAULT_PHENO, color: 'kirmizi' })
  const [detail, setDetail] = useState(false)
  const result = useMemo(() => simulate(m, f, { detail }), [m, f, detail])
  const shown = detail ? 30 : 12

  return (
    <>
      <p className="small muted">
        Ebeveynlerin görünür rengini seçin, kayıtlı kuşu seçerek otomatik doldurun veya fotoğrafını yapay zekaya tanıtın. Görünmeyen taşıyıcılıklar için yaygın olasılıklar
        hesaba katılır; bildiğiniz taşıyıcılıkları işaretlerseniz tahmin kesinleşir.
      </p>
      <div className="grid-2">
        <ParentCard title="Baba" icon={Mars} sex="E" birdId={maleId} setBirdId={setMaleId} pheno={m} setPheno={setM} />
        <ParentCard title="Anne" icon={Venus} sex="D" birdId={femaleId} setBirdId={setFemaleId} pheno={f} setPheno={setF} />
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
            ['E', 'Erkek yavrular', Mars],
            ['D', 'Dişi yavrular', Venus],
          ].map(([sex, title, SIcon]) => (
            <div key={sex}>
              <h4 className="gen-title inline-icon">
                <SIcon size={15} /> {title}
              </h4>
              {result[sex].slice(0, shown).map((r) => (
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
              {result[sex].length > shown && <p className="tiny muted">+ {result[sex].length - shown} düşük olasılıklı renk daha</p>}
            </div>
          ))}
        </div>
        <p className="tiny muted inline-icon">
          <Info size={12} /> Yaklaşık sonuçtur: 20.000 sanal yavru üzerinden hesaplanır. Alacalık ve karabaş gibi beyazlık desenleri çok genli olduğu için gerçek oranlar hattan hatta
          değişebilir; opal, reduced gibi değiştirici genler dahil değildir.
        </p>
      </div>
    </>
  )
}
