// Kuru yapay zeka uç noktası (Supabase Edge Function).
// Anthropic API anahtarı yalnızca burada, sunucu tarafında tutulur:
//   supabase secrets set ANTHROPIC_API_KEY=sk-ant-...
// İsteğe bağlı: KURU_AI_MODEL (varsayılan claude-opus-5-5)
import Anthropic from 'npm:@anthropic-ai/sdk'
import { createClient } from 'npm:@supabase/supabase-js@2'

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

const MODEL = Deno.env.get('KURU_AI_MODEL') || 'claude-opus-5-5'
const client = new Anthropic({ apiKey: Deno.env.get('ANTHROPIC_API_KEY') })

const SYSTEM = `Sen "Kuru" adlı güvercin takip programının uzman asistanısın. Kullanıcı Türkiye'de güvercin yetiştiren Samet Kuru ve onun güvercinliği.
Uzmanlık alanların: güvercin sağlığı ve hastalıkları, ilaçlama ve aşı takvimleri, bakım yöntemleri, yemleme ve rasyon hazırlama, üretim (eşleştirme, kuluçka, yavru bakımı), soy/ırk ıslahı. Türk güvercin ırklarını (taklacı, dolapçı, makaracı, kelebek, hünkari, mardin, şebap, posta vb.) bilirsin.
Kurallar:
- Her zaman Türkçe, sade ve pratik yaz. Başlıklar ve madde işaretleriyle düzenli markdown kullan; gereksiz uzatma.
- İlaç önerirken etken madde adını ver, marka zorunlu değil. Antibiyotik ve reçeteli ilaçlarda doz ve kullanım için veteriner hekim onayı gerektiğini belirt; kesin doz uydurma, ürün etiketine yönlendir.
- Bulaşıcı hastalık şüphesinde hasta kuşun ayrılmasını ve hijyeni öne çıkar. Acil durumları açıkça "ACİL" diye işaretle.
- Yalnızca güvercinlik, kuş bakımı ve ilgili konularda yardım et.`

type Body = {
  task: 'chat' | 'diagnose' | 'ration' | 'care'
  messages?: { role: 'user' | 'assistant'; content: string; image?: string }[]
  summary?: string
  date?: string
  symptoms?: string[]
  notes?: string
  image?: string
  pigeon?: Record<string, string> | null
  recentHealth?: string[]
  localGuess?: string[]
  period?: string
  count?: number
  grains?: string[]
  target?: { protein: number; fat: number; gramPerBird: number }
  localMix?: string[]
  season?: string
  goal?: string
}

function imageBlock(dataUrl?: string) {
  const m = dataUrl?.match(/^data:(image\/(?:jpeg|png|webp|gif));base64,(.+)$/)
  if (!m) return null
  return { type: 'image', source: { type: 'base64', media_type: m[1], data: m[2] } }
}

function userContent(text: string, image?: string) {
  const img = imageBlock(image)
  return img ? [img, { type: 'text', text }] : text
}

function buildMessages(b: Body) {
  switch (b.task) {
    case 'diagnose': {
      const text = [
        'Aşağıdaki bilgilere göre olası hastalıkları tahmin et.',
        `Belirtiler: ${b.symptoms?.join(', ') || 'seçilmedi'}`,
        b.notes ? `Açıklama: ${b.notes}` : '',
        b.pigeon ? `Kuş: ${JSON.stringify(b.pigeon)}` : 'Kuş: belirtilmedi / sürü geneli',
        b.recentHealth?.length ? `Son sağlık kayıtları: ${b.recentHealth.join('; ')}` : '',
        b.localGuess?.length ? `Programın kural tabanlı ön tahmini: ${b.localGuess.join(', ')}` : '',
        b.image ? 'Ekte kuşun veya dışkının fotoğrafı var; görsel bulguları da değerlendir.' : '',
        '',
        'Yanıt biçimi:',
        '1. En olası 3 hastalık, her biri için yaklaşık olasılık (%), neden bu tahmin.',
        '2. Aciliyet durumu ve hemen yapılacaklar (izolasyon, su, ısı vb.).',
        '3. Tedavi önerisi (etken madde, süre; doz için veteriner/etiket notu).',
        '4. Ayırıcı teşhis için neye bakılmalı (dışkı testi, boğaz kontrolü vb.).',
        '5. Sürünün geri kalanı için önlemler.',
      ]
        .filter(Boolean)
        .join('\n')
      return [{ role: 'user', content: userContent(text, b.image) }]
    }
    case 'ration': {
      const text = [
        `${b.count} güvercin için "${b.period}" dönemine uygun yem rasyonu hazırla.`,
        `Elimdeki yemler: ${b.grains?.join(', ')}`,
        b.target ? `Hedef: ham protein ~%${b.target.protein}, yağ ~%${b.target.fat}, kuş başı ~${b.target.gramPerBird} g/gün.` : '',
        b.localMix?.length ? `Programın hesapladığı karışım: ${b.localMix.join(', ')}. Bunu değerlendir, gerekiyorsa düzelt.` : '',
        '',
        'Yanıt: önce yüzde ve günlük gram tablosu (markdown tablo), sonra yaklaşık protein/yağ değeri, ardından dönem için ek takviyeler (grit, mineral, vitamin, yağ), yemleme saatleri ve dikkat edilmesi gerekenler. Elimde olmayan ama eklenmesi faydalı yemleri ayrıca belirt.',
      ]
        .filter(Boolean)
        .join('\n')
      return [{ role: 'user', content: text }]
    }
    case 'care': {
      const text = [
        `Bugünün tarihi: ${b.date}. Güvercinliğim için önümüzdeki 4-6 haftalık bakım planı hazırla.`,
        b.season ? `Dönem: ${b.season}` : 'Dönemi tarihe ve mevsime göre sen belirle.',
        b.goal ? `Hedefim: ${b.goal}` : '',
        `Sürü özeti:\n${b.summary || 'bilgi yok'}`,
        '',
        'Plan hafta hafta olsun: ilaçlama/aşı/kür, yemleme değişiklikleri, temizlik-dezenfeksiyon, banyo, üreme/uçuş işleri. Son kayıtlara bakarak geciken veya tekrarlanması gereken uygulamaları belirt.',
      ]
        .filter(Boolean)
        .join('\n')
      return [{ role: 'user', content: text }]
    }
    default: {
      const msgs = (b.messages || []).slice(-12).filter((m) => m.content?.trim())
      if (!msgs.length || msgs[msgs.length - 1].role !== 'user') throw new Error('Soru boş')
      return msgs.map((m, i) => {
        const isLast = i === msgs.length - 1
        const text = isLast && b.summary ? `${m.content}\n\n[Güvercinlik özeti — ${b.date}]\n${b.summary}` : m.content
        return { role: m.role, content: m.role === 'user' ? userContent(text, m.image) : text }
      })
    }
  }
}

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { ...cors, 'Content-Type': 'application/json' } })
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors })
  if (req.method !== 'POST') return json({ error: 'Yalnızca POST' }, 405)

  // Yalnızca giriş yapmış kullanıcılar kullanabilsin
  const auth = req.headers.get('Authorization') || ''
  const supa = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_ANON_KEY')!, {
    global: { headers: { Authorization: auth } },
  })
  const { data: userData } = await supa.auth.getUser()
  if (!userData?.user) return json({ error: 'Oturum geçersiz, tekrar giriş yapın.' }, 401)

  if (!Deno.env.get('ANTHROPIC_API_KEY')) return json({ error: 'Sunucuda ANTHROPIC_API_KEY tanımlı değil.' }, 500)

  let body: Body
  try {
    body = await req.json()
  } catch {
    return json({ error: 'Geçersiz istek' }, 400)
  }

  try {
    const params = {
      model: MODEL,
      max_tokens: 8000,
      system: SYSTEM,
      thinking: { type: 'adaptive' },
      output_config: { effort: body.task === 'chat' ? 'low' : 'medium' },
      messages: buildMessages(body),
      // Güvenlik sınıflandırıcısı reddederse uygun modele otomatik geç
      betas: ['server-side-fallback-2026-07-01'],
      fallbacks: 'default',
    }
    // deno-lint-ignore no-explicit-any
    const res: any = await client.beta.messages.create(params as any)
    if (res.stop_reason === 'refusal') {
      return json({ error: 'Yapay zeka bu isteği yanıtlayamadı. Soruyu farklı ifade etmeyi deneyin.' }, 422)
    }
    const text = res.content
      .filter((b: { type: string }) => b.type === 'text')
      .map((b: { text: string }) => b.text)
      .join('\n')
      .trim()
    if (!text) return json({ error: 'Boş yanıt alındı, tekrar deneyin.' }, 502)
    return json({ text, truncated: res.stop_reason === 'max_tokens' })
  } catch (e) {
    console.error(e)
    if (e instanceof Anthropic.RateLimitError) return json({ error: 'Çok fazla istek; biraz sonra tekrar deneyin.' }, 429)
    if (e instanceof Anthropic.AuthenticationError) return json({ error: 'Yapay zeka API anahtarı geçersiz.' }, 500)
    if (e instanceof Anthropic.BadRequestError) return json({ error: 'İstek reddedildi: ' + e.message }, 400)
    if (e instanceof Anthropic.APIConnectionError) return json({ error: 'Yapay zeka servisine ulaşılamadı.' }, 503)
    if (e instanceof Anthropic.APIError) return json({ error: 'Yapay zeka hatası: ' + e.message }, 502)
    return json({ error: (e as Error).message || 'Bilinmeyen hata' }, 500)
  }
})
