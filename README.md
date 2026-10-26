# Kuru — Güvercin Takip ve Bakım Programı

Samet Kuru için geliştirilmiş güvercin takip programı. Telefonda uygulama gibi (ana ekrana eklenebilir, internetsiz de çalışır) ve bilgisayarda tarayıcıdan kullanılır. Veriler hesapla giriş yapılan tüm cihazlarda senkronize olur.

## Özellikler

| Modül | İçerik |
|---|---|
| **Güvercinler** | Ayak seri numarası (halka no) ile kayıt, mükerrer halka kontrolü, ad, cinsiyet, ırk, renk, doğum tarihi, kafes, etiketli çoklu fotoğraf, özellikler. Toplu seçimle ilaç, uçuş, durum/kafes değişikliği, etiket ve Excel |
| **Soy ağacı & soy kütüğü** | Anne–baba bağlantısı (kayıtlı kuştan veya dışarıdan halka no ile), 4 kuşak soy ağacı, yavrular. Tek A4 sayfalık soy kütüğü belgesi (PDF) ve QR kodlu, giriş gerektirmeyen paylaşım bağlantısı |
| **QR etiket** | Kafes/kuş için üç boyutta yazdırılabilir etiket; okutunca kuşun kartı açılır |
| **Nereden geldi / Kime satıldı** | Köken (üretim, alış, hediye, takas), kimden-telefon-şehir-fiyat; satış/hediye kime, tarih, fiyat; ölüm/kayıp kaydı. Alım-Satım sayfasında yıllık özet |
| **Kişiler & cari** | Müşteri ve satıcı listesi (kuş kayıtlarından otomatik), telefon/WhatsApp, aldığı/sattığı kuşlar, veresiye satış ve tahsilatla bakiye |
| **Gelir – Gider** | Kuş satış/alış, stok alımı, sağlık ve yem maliyetleri otomatik; elle gelir/gider; aylık özet, kategori dağılımı, yıllık kâr-zarar |
| **Üretim** | Çift eşleştirme, yumurtlama kayıtları; çıkış (18 gün), ışık kontrolü, halkalama ve ayırma tarihleri otomatik; çıkan yavru tek tuşla kaydedilir. Yumurtaların bakıcı çifte aktarılması (hangi çiftin yavrusuna hangi bakıcının baktığı; hatırlatmalar bakıcının yuvasını gösterir). Akrabalık katsayısı (Wright), en uygun eş önerisi, çift karnesi (döllülük, çıkım, yavru uçuş puanı, satış), renk genetiği tahmini |
| **Uçuş & Oyun** | Uçuş süresi, 1-10 oyun puanı, takla sayısı, hava; kuş sıralaması, baba/anne hatlarının yavru ortalamaları |
| **Gelişim** | Tartı kayıtları ve yaşa göre ağırlık grafiği |
| **Stok** | Yem, ilaç, vitamin, malzeme; alım/kullanım/sayım; yemleme ve ilaç kayıtlarından otomatik düşme; azalma uyarısı |
| **Bildirimler** | Her gün seçilen saatte telefona o günün işleri (çıkış, halkalama, ayırma, ilaç tekrarı, azalan stok) |
| **Sesle kayıt** | "3 numaralı yuvada bugün ilk yumurta var" gibi söylenenler yapay zekayla kayda dönüşür, onaylanınca kaydedilir |
| **Ayarlanabilir listeler** | Renkler, ırklar, göz renkleri, kuş grupları, bölmeler, eşleştirme türleri, ilaçlar, gelir/gider kategorileri, hava durumları ve kuluçka/halkalama/ayırma süreleri Ayarlar'dan düzenlenir; tüm cihazlara eşitlenir |
| **Görünüm** | Açık/koyu/otomatik tema, 6 vurgu rengi, yazı boyutu ve sıkışık yerleşim seçeneği |
| **Yapay zeka** | Tüm kayıtları bilen asistan (sohbetten kayıt önerir, onayla kaydedilir), ana sayfada günün özeti, kuş değerlendirmesi (soy, yavru, sağlık, tartı, uçuş), sezon eşleştirme danışmanı (önerilen çiftler tek tuşla oluşturulur), hastalık tahmini, bakım planı, rasyon önerisi, sesle kayıt |
| **Yardımcı hesabı** | Kümese bakan kişiye sınırlı erişim: kayıt girer/düzenler; silemez, fiyat ve gelir-gider göremez |
| **Sağlık & İlaçlama** | Aşı, kür, tedavi, parazit, vitamin kayıtları; tüm sürüye veya seçili kuşlara; tekrar tarihleri ana sayfada hatırlatılır; maliyet |
| **Hastalık tahmini** | 32 belirtiden seçim → 14 yaygın güvercin hastalığı için olasılık, aciliyet, tedavi ve korunma (internetsiz çalışır). Yapay zeka ile fotoğraf destekli detaylı analiz |
| **Bakım yöntemi** | Günlük/haftalık/dönemsel bakım rehberi, aşı takvimi, üreme ve karantina kuralları. Yapay zeka ile sürüye özel 4-6 haftalık bakım planı |
| **Yemleme & Rasyon** | Döneme göre (bakım, kış, üreme, tüy değişimi, uçuş, yavru) elinizdeki yemlerden protein/yağ hedefli rasyon hesaplama, günlük/haftalık miktar; yapay zeka önerisi; yemleme günlüğü |
| **AI Asistan** | Bakım, hastalık, ilaç, beslenme soruları için sohbet; sürü özeti otomatik eklenir, fotoğraf gönderilebilir |
| **Diğer** | Excel (CSV) dışa aktarma, JSON yedek alma/geri yükleme, karanlık mod, çevrimdışı çalışma |

## Mimari

- **Önyüz:** React 18 + Vite 6, PWA (`vite-plugin-pwa`). Tüm veriler önce cihazda tutulur (kayıtlar localStorage'da, fotoğraflar IndexedDB'de), böylece internet yokken de çalışır.
- **Bulut:** Supabase. Kayıtlar tek tabloda (`kuru_records`), fotoğraflar Storage'da (`kuru-photos`). Satır düzeyi güvenlik: herkes yalnızca kendi güvercinliğini, yardımcılar yalnızca bağlı oldukları güvercinliği görür. İnternet gelince otomatik senkron (son yazan kazanır).
- **Bildirimler:** `kuru-notify` Edge Function'ı saatlik zamanlanmış görevle çalışır, Web Push (VAPID) ile gönderir.
- **Yapay zeka:** Supabase Edge Function (`kuru-ai`) üzerinden **Google Gemini** (ücretsiz kota) veya **Claude** (ücretli). Hangi anahtar tanımlıysa o kullanılır. API anahtarı yalnızca sunucuda durur, telefona inmez. Yalnızca giriş yapmış kullanıcılar kullanabilir.

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
2. **SQL Editor** → `supabase/schema.sql` içeriğini yapıştırıp çalıştırın. Dosya tekrar çalıştırılabilir; yeni sürüm geldiğinde aynı şekilde yeniden çalıştırın, verileriniz silinmez.
3. **Project Settings → API** sayfasından URL ve `anon` anahtarını alın, proje kökünde `.env` oluşturun:
   ```
   VITE_SUPABASE_URL=https://xxxx.supabase.co
   VITE_SUPABASE_ANON_KEY=eyJ...
   ```
4. **Authentication → Providers → Email** açık olsun. Tek kullanıcı kullanacaksa hesabı oluşturduktan sonra "Allow new users to sign up" kapatılabilir.
5. **Yardımcı eklemek için:** uygulamada **Ayarlar → Yardımcılar** bölümüne yardımcının e-postasını yazın. Yeni kayıt kapalıysa yardımcının hesabını Supabase'de **Authentication → Users → Add user** ile siz açın.

### 3. Yapay zeka (Edge Function)

**Ücretsiz seçenek — Google Gemini:**
1. https://aistudio.google.com/apikey adresinde Google hesabıyla **Create API key** deyin.
2. Supabase → **Edge Functions → Secrets** → `GEMINI_API_KEY` adıyla ekleyin.
3. **Edge Functions → Deploy a new function → Via Editor**, adı `kuru-ai`, içeriği `supabase/functions/kuru-ai/index.ts`.

Ücretsiz kotada dakika/gün başına istek sınırı vardır ve Google ücretsiz kullanımda gönderilen verileri ürünlerini geliştirmek için kullanabilir. Varsayılan model `gemini-flash-latest`'tir; değiştirmek için `GEMINI_MODEL` secret'ı eklenir.

**Ücretli seçenek — Claude:** `GEMINI_API_KEY` yerine `ANTHROPIC_API_KEY` ekleyin ([Anthropic Console](https://console.anthropic.com)). Varsayılan model `claude-opus-5-5`, değiştirmek için `KURU_AI_MODEL`. İki anahtar da varsa Gemini kullanılır.

Komut satırıyla yüklemek isterseniz:

```bash
npx supabase login
npx supabase link --project-ref <proje-ref>
npx supabase secrets set GEMINI_API_KEY=...
npx supabase functions deploy kuru-ai
```

### 4. Bildirimler (isteğe bağlı)

1. Uygulamada **Ayarlar → Bildirimler → Bildirim anahtarı üret** deyin. Çıkan iki anahtarı kopyalayın.
2. Supabase → **Edge Functions → Secrets**: `VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY` ve kendi belirlediğiniz rastgele bir parola olarak `CRON_SECRET` ekleyin.
3. `supabase/functions/kuru-notify/index.ts` dosyasını `kuru-notify` adıyla yükleyin ve bu fonksiyonda **Enforce JWT Verification**'ı **kapatın** (zamanlanmış görev oturum bilgisi göndermez; fonksiyon kendi parolasıyla doğrular).
4. **Database → Extensions**: `pg_cron` ve `pg_net`'i açın; `supabase/notify-cron.sql` içindeki `PROJE_REF` ve `CRON_PAROLA` yerlerini doldurup SQL Editor'de çalıştırın.
5. Vercel'e `VITE_VAPID_PUBLIC_KEY` ortam değişkenini ekleyip yeniden yayınlayın; ardından telefonda **Ayarlar → Bildirimleri aç → Test bildirimi**.

iPhone'da bildirimler yalnızca ana ekrana eklenmiş uygulamada (iOS 16.4+) çalışır.

### 5. Yayınlama (internetten erişim)

`dist/` klasörü herhangi bir statik barındırmaya konabilir (Vercel, Netlify, Cloudflare Pages). Vercel/Netlify'da:
- Build komutu: `npm run build`, çıktı klasörü: `dist`
- Ortam değişkenleri: `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY` (bildirimler için `VITE_VAPID_PUBLIC_KEY`)

### 6. Telefona kurma

Yayınlanan adresi telefonda açın:
- **Android (Chrome):** menü → *Ana ekrana ekle / Uygulamayı yükle*
- **iPhone (Safari):** paylaş → *Ana Ekrana Ekle*

## Klasör yapısı

```
src/
  App.jsx, Auth.jsx          Menü, sayfa yönlendirme, giriş
  lib/store.js               Çevrimdışı veri deposu + Supabase senkronu
  lib/photos.jsx             Fotoğraf deposu (IndexedDB + Storage)
  lib/constants.js           Irklar, belirtiler, hastalıklar, ilaçlar, yemler, bakım rehberi
  lib/localAi.js             İnternetsiz hastalık tahmini ve rasyon hesaplayıcı
  lib/pedigree.js            Soy ağacı, akrabalık katsayısı, eş önerisi
  lib/genetics.js            Renk genetiği hesaplayıcı
  lib/share.js               Soy kütüğü paylaşım bağlantısı
  lib/stock.js, people.js    Stok ve kişi/cari yardımcıları
  lib/voice.js               Sesle kayıt
  lib/push.js, members.js    Bildirim aboneliği, yardımcı hesapları
  lib/ai.js                  Edge Function çağrısı
  pages/                     Sayfalar
supabase/
  schema.sql                 Tablolar, güvenlik kuralları, Storage
  notify-cron.sql            Günlük bildirim zamanlaması
  functions/kuru-ai/         Yapay zeka uç noktası
  functions/kuru-notify/     Bildirim gönderici
```

> Sağlık ve ilaç bilgileri genel rehber niteliğindedir. Kesin teşhis ve ilaç dozu için veteriner hekime danışın.
