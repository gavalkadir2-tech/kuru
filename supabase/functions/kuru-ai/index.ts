// Kuru yapay zeka uç noktası (Supabase Edge Function).
// API anahtarları yalnızca burada, sunucu tarafında tutulur (Edge Functions → Secrets).
// Hangi anahtar tanımlıysa o sağlayıcı kullanılır:
//   GEMINI_API_KEY    → Google Gemini (ücretsiz kotası var). İsteğe bağlı: GEMINI_MODEL (varsayılan gemini-flash-latest)
//   ANTHROPIC_API_KEY → Claude (ücretli). İsteğe bağlı: KURU_AI_MODEL (varsayılan claude-opus-5-5)
// İkisi de tanımlıysa Gemini önceliklidir.
import Anthropic from 'npm:@anthropic-ai/sdk'
import { createClient } from 'npm:@supabase/supabase-js@2'

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

const GEMINI_KEY = Deno.env.get('GEMINI_API_KEY')
const GEMINI_MODEL = Deno.env.get('GEMINI_MODEL') || 'gemini-flash-latest'
const ANTHROPIC_KEY = Deno.env.get('ANTHROPIC_API_KEY')
const MODEL = Deno.env.get('KURU_AI_MODEL') || 'claude-opus-5-5'
const client = ANTHROPIC_KEY ? new Anthropic({ apiKey: ANTHROPIC_KEY }) : null

const SYSTEM = `Sen "Kuru" adlı güvercin takip programının uzman asistanısın. Kullanıcı Türkiye'de güvercin yetiştiren Samet Kuru ve onun güvercinliği.
Uzmanlık alanların: güvercin sağlığı ve hastalıkları, ilaçlama ve aşı takvimleri, bakım yöntemleri, yemleme ve rasyon hazırlama, üretim (eşleştirme, kuluçka, yavru bakımı), soy/ırk ıslahı. Türk güvercin ırklarını (taklacı, dolapçı, makaracı, kelebek, hünkari, mardin, şebap, posta vb.) bilirsin.
Kurallar:
- Her zaman Türkçe, sade ve pratik yaz. Başlıklar ve madde işaretleriyle düzenli markdown kullan; gereksiz uzatma.
- İlaç önerirken etken madde adını ver, marka zorunlu değil. Antibiyotik ve reçeteli ilaçlarda doz ve kullanım için veteriner hekim onayı gerektiğini belirt; kesin doz uydurma, ürün etiketine yönlendir.
- Bulaşıcı hastalık şüphesinde hasta kuşun ayrılmasını ve hijyeni öne çıkar. Acil durumları açıkça "ACİL" diye işaretle.
- Yalnızca güvercinlik, kuş bakımı ve ilgili konularda yardım et.`

// Programın kaydedebildiği işlemler (sesle kayıt, sohbet ve danışman ortak kullanır)
const ACTIONS_DOC = [
  'Kullanılabilecek eylemler:',
  '{"type":"egg","pairId":"","eggNo":1,"date":""} — yumurtlama (eggNo 1 veya 2)',
  '{"type":"hatch","pairId":"","count":2,"date":""} — yavru çıkışı',
  '{"type":"foster","pairId":"","fosterPairId":"","eggs":2,"date":""} — yumurtaların bakıcı çifte aktarılması (pairId gerçek anne-baba, fosterPairId bakıcı)',
  '{"type":"pair","maleId":"","femaleId":"","pairType":"","nest":"","date":""} — yeni eşleştirme',
  '{"type":"health","medicine":"","dose":"","diagnosis":"","scope":"all","pigeonIds":[],"date":"","nextDate":"","stockItemId":"","stockQty":0} — ilaç/aşı/tedavi (scope "all" tüm sürü, "some" seçili kuşlar)',
  '{"type":"feeding","feed":"","amountGram":0,"date":"","rationId":"","stockItemId":""} — yemleme',
  '{"type":"weight","pigeonId":"","gram":0,"date":""} — tartı',
  '{"type":"flight","pigeonIds":[],"durationMin":0,"score":0,"date":"","notes":""} — uçuş/oyun (score 1-10)',
  '{"type":"status","pigeonId":"","status":"satildi|verildi|oldu|kayip","toName":"","toPrice":0,"date":""} — kuş durumu değişikliği',
  '{"type":"stock_buy","stockItemId":"","qty":0,"cost":0,"date":""} — stok alımı',
  '{"type":"expense","amount":0,"category":"","note":"","date":""} veya aynı alanlarla {"type":"income"} — diğer gelir/gider',
  '{"type":"note","text":""} — hatırlatma/not',
].join('\n')

type Body = {
  task: 'chat' | 'diagnose' | 'ration' | 'care' | 'parse' | 'brief' | 'bird' | 'advisor'
  text?: string
  // deno-lint-ignore no-explicit-any
  context?: Record<string, any>
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
    case 'parse': {
      const text = [
        'Güvercin yetiştiricisinin sesle söylediği notu programa girilecek kayıtlara dönüştür.',
        `Bugünün tarihi: ${b.date}. "dün", "bugün", "geçen salı" gibi ifadeleri bu tarihe göre YYYY-AA-GG biçimine çevir.`,
        'Kuşları, çiftleri, stok kalemlerini ve rasyonları aşağıdaki listelerdeki id değerleriyle eşleştir (halka numarasının son rakamları, kuş adı veya yuva numarasıyla söylenmiş olabilir). Eşleşme yoksa id alanını boş bırak.',
        '',
        `Program verisi (JSON):\n${JSON.stringify(b.context || {})}`,
        '',
        `Söylenen not: «${b.text || ''}»`,
        '',
        'YALNIZCA şu biçimde geçerli JSON döndür, başka metin yazma: {"actions":[ ... ]}',
        ACTIONS_DOC,
        'Her eyleme kısa Türkçe açıklama için "summary" alanı ekle. Emin olmadığın bilgiyi uydurma.',
      ].join('\n')
      return [{ role: 'user', content: text }]
    }
    case 'brief': {
      const text = [
        `Bugün ${b.date}. Aşağıda güvercinliğin güncel verisi var. Yetiştiriciye bugün için kısa bir günlük özet hazırla.`,
        `Program verisi (JSON):\n${JSON.stringify(b.context || {})}`,
        '',
        'Biçim (en fazla 12 satır, sade):',
        '### Bugün yapılacaklar — tarihi bugün olan ya da geciken işler (çıkış, ışık kontrolü, halkalama, ayırma, ilaç tekrarı), hangi yuvada olduğuyla',
        '### Dikkat — sağlıkta, stokta, kuluçkada (gecikmiş çıkış, düşük döllülük) veya tartıda gördüğün riskler',
        '### Öneri — mevsime ve verilere göre 1-3 somut öneri',
        'Veride olmayan bir şeyi varmış gibi yazma. Yapılacak bir şey yoksa bunu kısaca söyle.',
      ].join('\n')
      return [{ role: 'user', content: text }]
    }
    case 'bird': {
      const text = [
        'Aşağıdaki güvercinin tüm kayıtlarını değerlendir. Soy ağacı, yavruları, üretim, sağlık, tartı ve uçuş verileri dahil.',
        `Veri (JSON):\n${JSON.stringify(b.context || {})}`,
        b.goal ? `Yetiştiricinin sorusu / hedefi: ${b.goal}` : '',
        '',
        'Biçim:',
        '### Genel değerlendirme — 2-3 cümle',
        '### Güçlü yönler ve zayıf yönler — maddeler, verilere dayanarak',
        '### Damızlık değeri — soy, yavru başarısı ve akrabalık açısından; kimlerle eşleşmesi uygun olur',
        '### Sağlık ve bakım — riskler ve öneriler (tartı eğilimi, geçmiş tedaviler)',
        '### Öneriler — somut 3-5 madde',
        'Verisi olmayan konularda "kayıt yok" de; tahminini tahmin olarak belirt.',
      ]
        .filter(Boolean)
        .join('\n')
      return [{ role: 'user', content: text }]
    }
    case 'advisor': {
      const text = [
        'Sen bir güvercin ıslah danışmanısın. Aşağıdaki güvercinlik verisine göre eşleştirme planı hazırla.',
        `Yetiştiricinin hedefi: ${b.goal || 'sağlıklı, verimli ve iyi uçan yavrular'}`,
        b.text ? `Ek koşullar: ${b.text}` : '',
        `Program verisi (JSON). candidatePairs: akrabalığı en düşükten sıralı olası erkek×dişi kombinasyonları (offspringCoi = yavrunun akrabalık yüzdesi):\n${JSON.stringify(b.context || {})}`,
        '',
        'Kurallar: her kuş yalnızca bir çiftte olsun; zaten aktif çiftte olan kuşları ayrıca belirt; yavru akrabalığı %6,25 üstü olan eşleşmeleri ancak bilinçli hat yetiştirme için öner ve gerekçe ver; uçuş puanı, ırk, renk ve yaşı dikkate al.',
        'Biçim:',
        '### Önerilen çiftler — tablo: Erkek | Dişi | Yavru akrabalığı | Neden',
        '### Kaçınılması gerekenler',
        '### Sezon takvimi ve hazırlık — kür/aşı, besleme, eşleştirme sırası',
        '',
        'Yanıtın sonuna önerdiğin çiftleri şu blokla ekle (yalnızca listede id değeri olan kuşlar):',
        '```kuru-actions',
        '{"actions":[{"type":"pair","maleId":"","femaleId":"","pairType":"","nest":"","summary":"kısa gerekçe"}]}',
        '```',
      ]
        .filter(Boolean)
        .join('\n')
      return [{ role: 'user', content: text }]
    }
    default: {
      const msgs = (b.messages || []).slice(-12).filter((m) => m.content?.trim())
      if (!msgs.length || msgs[msgs.length - 1].role !== 'user') throw new Error('Soru boş')
      // Program verisi ilk kullanıcı mesajına eklenir; son mesajda kayıt önerme kuralları hatırlatılır
      const ctx = b.context
        ? `[Güvercinliğin güncel verisi — ${b.date}]\n${JSON.stringify(b.context)}\n\n` +
          'Sorulara bu veriye dayanarak, kuşları halka numarasıyla anarak cevap ver. ' +
          'Kullanıcı bir şeyin kaydedilmesini isterse veya konuşmadan kaydedilmesi gereken açık bir işlem çıkarsa, yanıtının sonuna şu bloğu ekle (id değerlerini veriden al, emin değilsen ekleme):\n' +
          '```kuru-actions\n{"actions":[ ... ]}\n```\n' +
          ACTIONS_DOC
        : b.summary
          ? `[Güvercinlik özeti — ${b.date}]\n${b.summary}`
          : ''
      return msgs.map((m, i) => {
        const text = i === msgs.length - 1 && ctx ? `${m.content}\n\n${ctx}` : m.content
        return { role: m.role, content: m.role === 'user' ? userContent(text, m.image) : text }
      })
    }
  }
}

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { ...cors, 'Content-Type': 'application/json' } })
}

// deno-lint-ignore no-explicit-any
type Msg = { role: string; content: any }

async function callClaude(messages: Msg[], task: Body['task']) {
  const params = {
    model: MODEL,
    max_tokens: 8000,
    system: SYSTEM,
    thinking: { type: 'adaptive' },
    // Hızlı işler düşük, analiz gerektirenler yüksek düşünme düzeyiyle
    output_config: { effort: task === 'parse' || task === 'brief' ? 'low' : task === 'advisor' || task === 'bird' ? 'high' : 'medium' },
    messages,
    // Güvenlik sınıflandırıcısı reddederse uygun modele otomatik geç
    betas: ['server-side-fallback-2026-07-01'],
    fallbacks: 'default',
  }
  // deno-lint-ignore no-explicit-any
  const res: any = await client!.beta.messages.create(params as any)
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
}

// Gemini REST API (generateContent). Mesajlar Claude biçiminden çevrilir.
async function callGemini(messages: Msg[], jsonOut = false) {
  const toParts = (content: unknown) =>
    typeof content === 'string'
      ? [{ text: content }]
      : (content as { type: string; text?: string; source?: { media_type: string; data: string } }[]).map((b) =>
          b.type === 'image' ? { inlineData: { mimeType: b.source!.media_type, data: b.source!.data } } : { text: b.text || '' },
        )
  const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-goog-api-key': GEMINI_KEY! },
    body: JSON.stringify({
      systemInstruction: { parts: [{ text: SYSTEM }] },
      contents: messages.map((m) => ({ role: m.role === 'assistant' ? 'model' : 'user', parts: toParts(m.content) })),
      generationConfig: { maxOutputTokens: 8000, ...(jsonOut ? { responseMimeType: 'application/json' } : {}) },
    }),
  })
  // deno-lint-ignore no-explicit-any
  const data: any = await res.json().catch(() => ({}))
  if (!res.ok) {
    const msg = data?.error?.message || res.statusText
    if (res.status === 429) return json({ error: 'Ücretsiz yapay zeka kotası doldu; bir süre sonra tekrar deneyin.' }, 429)
    if (res.status === 400 && /API key/i.test(msg)) return json({ error: 'Gemini API anahtarı geçersiz.' }, 500)
    if (res.status === 404) return json({ error: `Gemini modeli bulunamadı (${GEMINI_MODEL}). GEMINI_MODEL ayarını kontrol edin.` }, 500)
    return json({ error: 'Yapay zeka hatası: ' + msg }, 502)
  }
  if (data.promptFeedback?.blockReason) {
    return json({ error: 'Yapay zeka bu isteği yanıtlayamadı. Soruyu farklı ifade etmeyi deneyin.' }, 422)
  }
  const cand = data.candidates?.[0]
  const text = (cand?.content?.parts || [])
    .filter((p: { text?: string; thought?: boolean }) => p.text && !p.thought)
    .map((p: { text: string }) => p.text)
    .join('')
    .trim()
  if (!text) return json({ error: 'Boş yanıt alındı, tekrar deneyin.' }, 502)
  return json({ text, truncated: cand?.finishReason === 'MAX_TOKENS' })
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

  if (!GEMINI_KEY && !client) return json({ error: 'Sunucuda GEMINI_API_KEY veya ANTHROPIC_API_KEY tanımlı değil.' }, 500)

  let body: Body
  try {
    body = await req.json()
  } catch {
    return json({ error: 'Geçersiz istek' }, 400)
  }

  try {
    const messages = buildMessages(body)
    return GEMINI_KEY ? await callGemini(messages, body.task === 'parse') : await callClaude(messages, body.task)
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
