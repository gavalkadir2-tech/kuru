# Kuru — Güvercin Takip ve Bakım Programı

Samet Kuru için geliştirilmiş güvercin takip programı. Telefonda uygulama gibi (ana ekrana eklenebilir, internetsiz de çalışır) ve bilgisayarda tarayıcıdan kullanılır. Veriler hesapla giriş yapılan tüm cihazlarda senkronize olur.

## Özellikler

| Modül | İçerik |
|---|---|
| **Güvercinler** | Ayak seri numarası (halka no) ile kayıt, mükerrer halka kontrolü, ad, cinsiyet, ırk, renk, doğum tarihi, kafes, fotoğraf, özellikler |
| **Soy ağacı** | Anne–baba bağlantısı (kayıtlı kuştan veya dışarıdan halka no ile), 4 kuşak soy ağacı, yavrular listesi, yazdırma |
| **Nereden geldi / Kime satıldı** | Köken (üretim, alış, hediye, takas), kimden-telefon-şehir-fiyat; satış/hediye kime, tarih, fiyat; ölüm/kayıp kaydı. Alım-Satım sayfasında yıllık gelir-gider ve müşteri/tedarikçi özeti |
| **Üretim** | Çift eşleştirme (akrabalık uyarısı ile), yumurtlama kayıtları; çıkış (18 gün), ışık kontrolü, halkalama ve ayırma tarihleri otomatik hesaplanır; çıkan yavru tek tuşla anne-babası dolu şekilde kaydedilir; çift başına verim |
| **Sağlık & İlaçlama** | Aşı, kür, tedavi, parazit, vitamin kayıtları; tüm sürüye veya seçili kuşlara; tekrar tarihleri ana sayfada hatırlatılır; maliyet |
| **Hastalık tahmini** | 32 belirtiden seçim → 14 yaygın güvercin hastalığı için olasılık, aciliyet, tedavi ve korunma (internetsiz çalışır). Yapay zeka ile fotoğraf destekli detaylı analiz |
| **Bakım yöntemi** | Günlük/haftalık/dönemsel bakım rehberi, aşı takvimi, üreme ve karantina kuralları. Yapay zeka ile sürüye özel 4-6 haftalık bakım planı |
| **Yemleme & Rasyon** | Döneme göre (bakım, kış, üreme, tüy değişimi, uçuş, yavru) elinizdeki yemlerden protein/yağ hedefli rasyon hesaplama, günlük/haftalık miktar; yapay zeka önerisi; yemleme günlüğü |
| **AI Asistan** | Bakım, hastalık, ilaç, beslenme soruları için sohbet; sürü özeti otomatik eklenir, fotoğraf gönderilebilir |
| **Diğer** | Excel (CSV) dışa aktarma, JSON yedek alma/geri yükleme, karanlık mod, çevrimdışı çalışma |

## Mimari

- **Önyüz:** React 18 + Vite 6, PWA (`vite-plugin-pwa`). Tüm veriler önce cihazda (localStorage) tutulur, böylece internet yokken de çalışır.
- **Bulut:** Supabase. Tek tablo (`kuru_records`), satır düzeyi güvenlik ile her kullanıcı yalnızca kendi verisini görür. İnternet gelince otomatik senkron (son yazan kazanır).
- **Yapay zeka:** Supabase Edge Function (`kuru-ai`) üzerinden Claude API. API anahtarı yalnızca sunucuda durur, telefona inmez. Yalnızca giriş yapmış kullanıcılar kullanabilir.

Supabase ayarlanmazsa uygulama **yerel modda** çalışır: tüm özellikler (yapay zeka hariç) tek cihazda kullanılabilir.

## Kurulum

### 1. Yerelde çalıştırma

```bash
npm install
npm run dev        # http://localhost:5173
npm run build      # dist/ klasörüne üretim çıktısı
```

### 2. Supabase (senkron + giriş)

1. [supabase.com](https://supabase.com) üzerinde yeni proje açın.
2. **SQL Editor** → `supabase/schema.sql` içeriğini yapıştırıp çalıştırın.
3. **Project Settings → API** sayfasından URL ve `anon` anahtarını alın, proje kökünde `.env` oluşturun:
   ```
   VITE_SUPABASE_URL=https://xxxx.supabase.co
   VITE_SUPABASE_ANON_KEY=eyJ...
   ```
4. **Authentication → Providers → Email** açık olsun. Tek kullanıcı kullanacaksa hesabı oluşturduktan sonra "Allow new users to sign up" kapatılabilir.

### 3. Yapay zeka (Edge Function)

[Anthropic Console](https://console.anthropic.com) üzerinden API anahtarı alın, sonra:

```bash
npx supabase login
npx supabase link --project-ref <proje-ref>
npx supabase secrets set ANTHROPIC_API_KEY=sk-ant-...
npx supabase functions deploy kuru-ai
```

Varsayılan model `claude-opus-5-5`'tir. Değiştirmek için: `npx supabase secrets set KURU_AI_MODEL=<model-id>`.

### 4. Yayınlama (internetten erişim)

`dist/` klasörü herhangi bir statik barındırmaya konabilir (Vercel, Netlify, Cloudflare Pages). Vercel/Netlify'da:
- Build komutu: `npm run build`, çıktı klasörü: `dist`
- Ortam değişkenleri: `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`

### 5. Telefona kurma

Yayınlanan adresi telefonda açın:
- **Android (Chrome):** menü → *Ana ekrana ekle / Uygulamayı yükle*
- **iPhone (Safari):** paylaş → *Ana Ekrana Ekle*

## Klasör yapısı

```
src/
  App.jsx, Auth.jsx          Menü, sayfa yönlendirme, giriş
  lib/store.js               Çevrimdışı veri deposu + Supabase senkronu
  lib/constants.js           Irklar, belirtiler, hastalıklar, ilaçlar, yemler, bakım rehberi
  lib/localAi.js             İnternetsiz hastalık tahmini ve rasyon hesaplayıcı
  lib/pedigree.js            Soy ağacı ve akrabalık kontrolü
  lib/ai.js                  Edge Function çağrısı
  pages/                     Ana sayfa, Güvercinler, Detay, Üretim, Sağlık, Yemleme, Asistan, Alım-Satım, Ayarlar
supabase/
  schema.sql                 Veritabanı tablosu ve güvenlik kuralları
  functions/kuru-ai/         Yapay zeka uç noktası
```

> Sağlık ve ilaç bilgileri genel rehber niteliğindedir. Kesin teşhis ve ilaç dozu için veteriner hekime danışın.
