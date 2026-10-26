// Kuru — alan bilgisi: ırklar, renkler, hastalıklar, yemler, bakım rehberi.
// Buradaki tedavi bilgileri genel rehber niteliğindedir; ilaç ve doz için veteriner hekime danışılmalıdır.

export const SEX = { E: 'Erkek', D: 'Dişi', B: 'Belirsiz' }

export const STATUS = {
  aktif: 'Aktif',
  satildi: 'Satıldı',
  verildi: 'Hediye/Takas edildi',
  oldu: 'Öldü',
  kayip: 'Kayıp',
}

export const ORIGIN = {
  uretim: 'Kendi üretimim',
  alis: 'Satın alındı',
  hediye: 'Hediye geldi',
  takas: 'Takas',
  bulundu: 'Bulundu / Sahiplenildi',
}

export const BREEDS = [
  'Taklacı',
  'Dolapçı',
  'Makaracı',
  'Kelebek',
  'Hünkari',
  'Bursa Oynarı',
  'Mardin',
  'Şebap',
  'Posta (Yarış)',
  'Paçalı',
  'Kuşkonmaz',
  'Sakallı',
  'Bango',
  'Kumru',
  'Gümüş Tepeli',
  'Melez',
  'Diğer',
]

export const COLORS = [
  'Ak',
  'Kara',
  'Kırmızı',
  'Sarı',
  'Gök çubuklu',
  'Gök pullu',
  'Gümüşi',
  'Boz',
  'Kahverengi',
  'Haki',
  'Resesif kırmızı',
  'Resesif sarı',
  'Karabaş',
  'Sarıbaş',
  'Kızılbaş',
  'Gökbaş',
  'Kara alaca',
  'Kırmızı alaca',
  'Sarı alaca',
  'Çil',
  'Kırçıl',
  'Badem',
  'İndigo',
  'Pullu',
  'Süt kiri',
  'Diğer',
]

export const HEALTH_TYPES = {
  asi: 'Aşı',
  ilac: 'İlaçlama / Kür',
  tedavi: 'Hastalık tedavisi',
  parazit: 'İç/Dış parazit',
  vitamin: 'Vitamin / Destek',
  kontrol: 'Kontrol / Muayene',
}

// Sık kullanılan ilaç/ürün etken maddeleri (marka bağımsız).
export const MEDICINES = [
  { name: 'Paramikso (PMV-1) aşısı', type: 'asi', note: 'Yılda 1 kez; yavrulara 5-6. haftada' },
  { name: 'Güvercin çiçeği aşısı', type: 'asi', note: 'Riskli bölgelerde, yavrulara 6-8. haftada' },
  { name: 'Salmonella aşısı', type: 'asi', note: 'Üreme öncesi, 2 doz 3 hafta arayla' },
  { name: 'Ronidazol / Karnidazol (Kanker)', type: 'ilac', note: 'Trikomoniaz kürü, genelde 5-7 gün' },
  { name: 'Metronidazol (Kanker)', type: 'ilac', note: 'Trikomoniaz' },
  { name: 'Toltrazuril (Koksidiyoz)', type: 'ilac', note: '2 gün, suya' },
  { name: 'Amprolium (Koksidiyoz)', type: 'ilac', note: '5-7 gün, suya' },
  { name: 'Doksisiklin (Solunum/Ornitoz)', type: 'tedavi', note: 'Veteriner önerisiyle' },
  { name: 'Tilosin (Solunum/Mikoplazma)', type: 'tedavi', note: 'Veteriner önerisiyle' },
  { name: 'Enrofloksasin (Salmonella/E.coli)', type: 'tedavi', note: 'Yalnızca veteriner reçetesiyle' },
  { name: 'Trimetoprim-Sülfa', type: 'tedavi', note: 'Veteriner önerisiyle' },
  { name: 'Levamizol (Solucan)', type: 'parazit', note: 'Tek doz, 2-3 ayda bir' },
  { name: 'Fenbendazol (Solucan)', type: 'parazit', note: '3 gün' },
  { name: 'Moksidektin (İç-dış parazit)', type: 'parazit', note: 'Ense damla' },
  { name: 'Permetrin sprey (Bit/Akar)', type: 'parazit', note: 'Kümes ve kuş, 10 gün arayla 2 kez' },
  { name: 'Nistatin (Pamukçuk)', type: 'tedavi', note: 'Mantar enfeksiyonu' },
  { name: 'Elektrolit + B vitamini', type: 'vitamin', note: 'Stres, ishal, ilaç sonrası' },
  { name: 'AD3E vitamini', type: 'vitamin', note: 'Üreme öncesi, tüy dökümü' },
  { name: 'Kalsiyum + D3', type: 'vitamin', note: 'Yumurtlama dönemi' },
  { name: 'Probiyotik', type: 'vitamin', note: 'Antibiyotik sonrası 3-5 gün' },
  { name: 'Elma sirkesi', type: 'vitamin', note: 'Haftada 1 gün, 1 litre suya 1 yemek kaşığı' },
]

// ---------- Belirtiler ----------
export const SYMPTOMS = {
  ishal_sulu: 'Sulu ishal',
  ishal_yesil: 'Yeşil / sümüksü dışkı',
  ishal_kanli: 'Kanlı veya koyu dışkı',
  kusma: 'Kusma',
  kursak_dolu: 'Kursak boşalmıyor / ekşi koku',
  istahsiz: 'İştahsızlık',
  kilo_kaybi: 'Kilo kaybı / göğüs kemiği belirgin',
  tuy_kabarik: 'Tüyler kabarık, durgun',
  tuy_mat: 'Tüylerde matlık, bozulma',
  boyun_burulma: 'Boyun burulması (tortikolis)',
  titreme: 'Titreme / denge kaybı',
  felc: 'Kanat veya bacak felci',
  cok_su: 'Aşırı su içme',
  bogaz_plak: 'Boğazda sarı peynirimsi plak',
  agiz_beyaz: 'Ağızda beyaz kaplama',
  yutkunma: 'Yutkunma güçlüğü / ağzı açık nefes',
  hirilti: 'Hırıltı, hışırtılı solunum',
  aksirma: 'Aksırma / burun akıntısı',
  burun_mumu: 'Burun mumu kirli, gri',
  goz_akinti: 'Göz akıntısı / göz kapağı şiş',
  tek_goz: 'Tek gözde şişlik',
  eklem_sislik: 'Eklem / kanat dirseği şişliği',
  kanat_dusuk: 'Kanat düşüklüğü',
  sigil: 'Gaga/göz çevresinde sigil, kabuk',
  kasinti: 'Kaşınma, tüylerde delikler',
  gece_huzursuz: 'Gece huzursuzluk',
  yavru_olum: 'Yavru ölümü / gelişme geriliği',
  yumurta_bozuk: 'Döllenmeyen / ölü embriyolu yumurta',
  ince_kabuk: 'İnce veya kabuksuz yumurta',
  yumurtlayamama: 'Dişi ıkınıyor, yumurtlayamıyor',
  performans: 'Uçuş performansı düştü',
  ani_olum: 'Ani ölümler',
}

// ---------- Hastalıklar (yerel tahmin motoru için) ----------
// w: belirtinin hastalık için ağırlığı (1-3). age: daha sık görüldüğü yaş grubu.
export const DISEASES = [
  {
    id: 'pmv',
    name: 'Paramiksovirüs (PMV-1)',
    contagious: true,
    urgency: 'yuksek',
    signs: { boyun_burulma: 3, titreme: 3, felc: 2, ishal_sulu: 2, ishal_yesil: 1, cok_su: 2, istahsiz: 1 },
    treatment:
      'Viral hastalıktır, kesin ilacı yoktur. Hasta kuşları hemen ayırın. Suya elektrolit ve B vitamini verin, yemi elle besleyin. İkincil enfeksiyonlar için veteriner önerisiyle antibiyotik kullanılabilir. İyileşme 4-8 hafta sürebilir.',
    prevention: 'Tüm sürü yılda bir PMV-1 aşısı; yavrular 5-6. haftada aşılanmalı.',
  },
  {
    id: 'salmonella',
    name: 'Salmonelloz (Paratifo)',
    contagious: true,
    urgency: 'yuksek',
    signs: { eklem_sislik: 3, kanat_dusuk: 2, ishal_yesil: 2, kilo_kaybi: 2, yavru_olum: 2, yumurta_bozuk: 3, felc: 1, tuy_kabarik: 1 },
    treatment:
      'Dışkı/laboratuvar testi ile teşhis önerilir. Veteriner reçetesiyle antibiyotik (ör. enrofloksasin veya trimetoprim-sülfa) 10-14 gün. Ardından probiyotik. Taşıyıcı kuşlar için sürü taraması.',
    prevention: 'Üreme öncesi aşı, temiz su/yemlik, kemirgenlerden koruma.',
  },
  {
    id: 'trikomoniaz',
    name: 'Trikomoniaz (Kanker / Sarı)',
    contagious: true,
    urgency: 'orta',
    signs: { bogaz_plak: 3, yutkunma: 2, kilo_kaybi: 1, istahsiz: 1, yavru_olum: 2, cok_su: 1, ishal_sulu: 1 },
    treatment:
      'Ronidazol, karnidazol veya metronidazol ile 5-7 günlük kür (veteriner dozu). Tüm sürüye uygulanması önerilir. Plakları zorla koparmayın.',
    prevention: 'Üreme öncesi ve yarış/uçuş sezonu öncesi kür; suluk günlük temizlik.',
  },
  {
    id: 'koksidiyoz',
    name: 'Koksidiyoz',
    contagious: true,
    urgency: 'orta',
    signs: { ishal_sulu: 2, ishal_kanli: 3, kilo_kaybi: 2, tuy_kabarik: 2, performans: 2, cok_su: 1, istahsiz: 1 },
    treatment: 'Toltrazuril (2 gün) veya amprolium (5-7 gün) suya. Altlığı kuru tutun, dışkıyı sık temizleyin. Ardından vitamin desteği.',
    prevention: 'Kuru ve temiz zemin, nemli altlıktan kaçınma, periyodik dışkı kontrolü.',
  },
  {
    id: 'ornitoz',
    name: 'Ornitoz / Klamidyoz (Tek göz)',
    contagious: true,
    urgency: 'orta',
    signs: { tek_goz: 3, goz_akinti: 3, aksirma: 2, hirilti: 1, burun_mumu: 2, tuy_kabarik: 1, performans: 1 },
    treatment: 'Veteriner önerisiyle doksisiklin 10-21 gün. Kür süresince kalsiyum/mineral grit vermeyin (ilacın emilimini azaltır). İnsanlara da bulaşabilir; hijyene dikkat.',
    prevention: 'İyi havalandırma, kalabalıktan kaçınma, toz kontrolü.',
  },
  {
    id: 'solunum',
    name: 'Solunum Yolu Kompleksi (Mikoplazma)',
    contagious: true,
    urgency: 'orta',
    signs: { hirilti: 3, aksirma: 2, burun_mumu: 2, yutkunma: 1, goz_akinti: 1, performans: 2 },
    treatment: 'Veteriner önerisiyle tilosin veya doksisiklin. Kümesi havalandırın, nem ve amonyak kokusunu azaltın.',
    prevention: 'Havalandırma, toz ve nem kontrolü, yeni kuşları karantina.',
  },
  {
    id: 'cicek',
    name: 'Güvercin Çiçeği (Pox)',
    contagious: true,
    urgency: 'orta',
    signs: { sigil: 3, yutkunma: 1, goz_akinti: 1, agiz_beyaz: 1, istahsiz: 1 },
    treatment: 'Viral; kabuklar 3-4 haftada kendiliğinden düşer. Yaraları iyotlu antiseptikle silin, ikincil enfeksiyona karşı vitamin. Hasta kuşları ayırın.',
    prevention: 'Sivrisinek kontrolü, riskli bölgelerde aşı.',
  },
  {
    id: 'kandida',
    name: 'Kandidiyaz (Pamukçuk)',
    contagious: false,
    urgency: 'dusuk',
    signs: { agiz_beyaz: 3, kursak_dolu: 2, kusma: 1, istahsiz: 1, yavru_olum: 1 },
    treatment: 'Nistatin (veteriner dozu). Uzun antibiyotik kullanımından sonra sık görülür; probiyotik ve elma sirkesi destek olur.',
    prevention: 'Gereksiz antibiyotikten kaçınma, küflü yem vermeme.',
  },
  {
    id: 'solucan',
    name: 'İç Parazit (Solucan)',
    contagious: true,
    urgency: 'dusuk',
    signs: { kilo_kaybi: 3, tuy_mat: 2, ishal_sulu: 1, performans: 2, tuy_kabarik: 1 },
    treatment: 'Levamizol, fenbendazol veya moksidektin ile tüm sürüye kür; 10-14 gün sonra tekrar.',
    prevention: '2-3 ayda bir rutin solucan kürü, dışkı kontrolü.',
  },
  {
    id: 'dis_parazit',
    name: 'Dış Parazit (Bit, Akar)',
    contagious: true,
    urgency: 'dusuk',
    signs: { kasinti: 3, gece_huzursuz: 3, tuy_mat: 2, performans: 1, yavru_olum: 1 },
    treatment: 'Kuşlara ve kümese permetrin bazlı sprey veya moksidektin damla; 10 gün sonra tekrar. Yuvaları ve çatlakları temizleyin.',
    prevention: 'Haftalık banyo, kümes çatlaklarının kapatılması.',
  },
  {
    id: 'genc_guvercin',
    name: 'Genç Güvercin Hastalığı (Adeno/Sirkovirüs/E.coli)',
    contagious: true,
    urgency: 'yuksek',
    signs: { kusma: 3, ishal_sulu: 2, kursak_dolu: 2, kilo_kaybi: 2, istahsiz: 2, tuy_kabarik: 1, ani_olum: 2 },
    treatment: 'Destek tedavisi: elektrolit, probiyotik, hafif yem. İkincil bakteriyel enfeksiyon için veteriner önerisiyle antibiyotik. Hasta yavruları ayırın.',
    prevention: 'Yavru sürüsünü kalabalık tutmama, stres azaltma, hijyen.',
  },
  {
    id: 'kursak',
    name: 'Kursak Ekşimesi / Tıkanması',
    contagious: false,
    urgency: 'orta',
    signs: { kursak_dolu: 3, kusma: 2, istahsiz: 1, cok_su: 1 },
    treatment: 'Yemi 24 saat kesin, ılık su ve elektrolit verin. Kursağı nazikçe masaj yapın. Kandida/kanker eşlik edebilir; düzelmezse veterinere.',
    prevention: 'Küflü veya fazla ıslak yem vermeme, grit bulundurma.',
  },
  {
    id: 'yumurta_baglama',
    name: 'Yumurta Bağlama',
    contagious: false,
    urgency: 'yuksek',
    signs: { yumurtlayamama: 3, tuy_kabarik: 1, ince_kabuk: 1, istahsiz: 1 },
    treatment: 'Dişiyi sıcak (28-30°C) ve sakin bir yere alın, kalsiyum + D3 verin. Kloaka çevresine birkaç damla zeytinyağı. 24 saatte çıkmazsa acil veteriner.',
    prevention: 'Üreme öncesi kalsiyum, D3 ve grit; çok genç dişileri eşleştirmeme.',
  },
  {
    id: 'kalsiyum',
    name: 'Kalsiyum / Vitamin Eksikliği',
    contagious: false,
    urgency: 'dusuk',
    signs: { ince_kabuk: 3, felc: 1, yumurta_bozuk: 1, tuy_mat: 1 },
    treatment: 'Kalsiyum + D3, mineral grit ve AD3E vitamini. Güneş ışığı alan alan sağlayın.',
    prevention: 'Sürekli grit/mineral, üreme öncesi vitamin.',
  },
]

export const URGENCY = { yuksek: 'Acil', orta: 'Orta', dusuk: 'Düşük' }

// ---------- Yemler (yaklaşık besin değerleri, %) ----------
export const GRAINS = [
  { id: 'misir', name: 'Mısır', p: 9, f: 4, c: 70 },
  { id: 'bugday', name: 'Buğday', p: 12, f: 2, c: 69 },
  { id: 'arpa', name: 'Arpa', p: 11, f: 2, c: 65 },
  { id: 'dari', name: 'Darı', p: 11, f: 4, c: 64 },
  { id: 'sorgum', name: 'Süpürge darısı (Sorgum)', p: 11, f: 3, c: 70 },
  { id: 'celtik', name: 'Çeltik', p: 7, f: 2, c: 70 },
  { id: 'yulaf', name: 'Yulaf', p: 11, f: 5, c: 60 },
  { id: 'bezelye', name: 'Bezelye', p: 22, f: 1.5, c: 55 },
  { id: 'fig', name: 'Fiğ', p: 26, f: 1, c: 54 },
  { id: 'mercimek', name: 'Mercimek', p: 24, f: 1, c: 55 },
  { id: 'bakla', name: 'Bakla', p: 25, f: 1.5, c: 54 },
  { id: 'soya', name: 'Kavrulmuş soya', p: 36, f: 18, c: 30 },
  { id: 'kenevir', name: 'Kenevir tohumu', p: 22, f: 30, c: 20 },
  { id: 'aycicegi', name: 'Ayçiçeği (küçük)', p: 16, f: 40, c: 20 },
  { id: 'keten', name: 'Keten tohumu', p: 20, f: 35, c: 25 },
  { id: 'aspir', name: 'Aspir', p: 16, f: 35, c: 30 },
]

// Döneme göre hedef değerler ve günlük kuş başı yem (gram)
export const PERIODS = {
  bakim: { name: 'Bakım / Dinlenme', p: 12, f: 3.5, gram: 30, note: 'Hafif, karbonhidrat ağırlıklı karışım. Fazla kilo aldırmayın.' },
  kis: { name: 'Kış', p: 12, f: 4.5, gram: 33, note: 'Soğukta enerji ihtiyacı artar; yağlı tohumları biraz artırın.' },
  ureme: { name: 'Üreme / Yavru besleme', p: 17, f: 5, gram: 45, note: 'Baklagil oranını artırın; yavrulu çiftlere serbest yem verin. Grit ve kalsiyum şart.' },
  tuy: { name: 'Tüy değişimi', p: 16, f: 5.5, gram: 35, note: 'Protein ve yağlı tohum artırılır; kükürtlü aminoasit için baklagil önemli.' },
  ucus: { name: 'Uçuş / Yarış sezonu', p: 13.5, f: 6, gram: 32, note: 'Uçuştan 1-2 gün önce karbonhidrat ve yağ artırılır, baklagil azaltılır.' },
  yavru: { name: 'Sütten kesilmiş yavru', p: 15, f: 4.5, gram: 35, note: 'Küçük taneli yemler, sürekli temiz su.' },
}

// ---------- Bakım rehberi ----------
export const CARE_GUIDE = [
  {
    title: 'Günlük',
    items: [
      'Suyu her gün değiştirin, suluğu fırçalayın.',
      'Yemi ölçülü verin; 20-30 dakikada bitmeyen yemi kaldırın.',
      'Dışkıları gözle kontrol edin (renk, kıvam).',
      'Kuşların duruşunu, tüy kabarıklığını ve iştahını gözlemleyin.',
    ],
  },
  {
    title: 'Haftalık',
    items: [
      'Kümes zeminini ve tünekleri kazıyarak temizleyin.',
      'Mevsime uygun 1-2 kez banyo suyu koyun.',
      'Haftada 1 gün suya elma sirkesi (1 litreye 1 yemek kaşığı).',
      'Grit/mineral kabını tazeleyin.',
    ],
  },
  {
    title: 'Aylık / Dönemsel',
    items: [
      'Her 2-3 ayda bir solucan kürü.',
      'Üreme ve uçuş sezonu öncesi kanker (trikomoniaz) kürü.',
      'Dış parazit kontrolü; gerekirse kümes ve kuş ilaçlaması.',
      'Yuvaları ve yumurtalıkları dezenfekte edin.',
    ],
  },
  {
    title: 'Yıllık Aşı Takvimi',
    items: [
      'PMV-1 (Paramikso): tüm sürü yılda 1 kez, üreme öncesi; yavrular 5-6. haftada.',
      'Güvercin çiçeği: riskli bölgelerde yavrulara 6-8. haftada.',
      'Salmonella: üreme öncesi 3 hafta arayla 2 doz.',
      'Aşıdan 1 hafta önce solucan kürü, aşı sonrası vitamin desteği.',
    ],
  },
  {
    title: 'Üreme Dönemi',
    items: [
      'Eşleştirmeden 2-3 hafta önce kür ve aşıları tamamlayın.',
      'İlk yumurta eşleşmeden 8-12 gün sonra, ikincisi 44-48 saat sonra gelir.',
      'Kuluçka süresi ortalama 17-18 gündür.',
      'Yavrular 5-7. günde halkalanır (ayak serisi takılır).',
      'Yavrular 25-30. günde anneden ayrılabilir.',
    ],
  },
  {
    title: 'Karantina',
    items: [
      'Yeni gelen kuşları en az 2-3 hafta ayrı tutun.',
      'Bu sürede solucan, kanker ve dış parazit kürü uygulayın.',
      'Aşı durumunu öğrenin, bilinmiyorsa aşılayın.',
    ],
  },
]

export const INCUBATION_DAYS = 18
export const RING_DAY = 6
export const WEAN_DAY = 28
