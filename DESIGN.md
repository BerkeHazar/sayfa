# sayfa — tasarım notları

Bu dosya "neden böyle görünüyor" sorusunun cevabı. Kararlar zevk meselesi değil; her biri
bir kısıta ya da bir denetime bağlı.

---

## 1. Tez

**Matbaa kâğıdı + iş emri formu.**

iLovePDF'in netliğini alıyoruz: kırmızı sinyal, beyaz zemin, aracın ne yaptığını bir bakışta
söyleyen liste. Ama iLovePDF'in "yumuşak SaaS" derisini almıyoruz — yuvarlak köşeler, bol
gölge, dostane illüstrasyon.

sayfa bir **matbaa işliği** gibi davranıyor:

- Kâğıt sıcak ve hafif kirli (`#F4F0E8`), saf beyaz değil.
- Mürekkep tek: sinyal kırmızısı `#E23A22` (iLovePDF'in `#E5322D`'sine komşu ama daha sıcak,
  turuncuya kaçan bir kırmızı).
- Çizgiler hairline; köşeler 2–3px. Gölge neredeyse yok, olan da kâğıdın altına düşen gölge.
- Her bölümün bir **yapısal nesnesi** var: iş emri tablosu, numaralı adım blokları,
  sayaç levhası. Sadece düzyazıdan oluşan bölüm yok.
- Tek bir **taşan levha** var: gizlilik bölümü. Sayfada başka koyu blok yok, o yüzden
  ağırlığı taşıyor.

## 2. Tipografi

| Rol | Yazı tipi | Neden |
|-----|-----------|-------|
| Display | **Bricolage Grotesque** (variable, opsz 12–96) | Geometrik ama gözü yoran bir grotesk değil; büyük puntoda karakterli, küçükte sakin. Inter değil — bu bilinçli. |
| Metin / arayüz | **Instrument Sans** | Nötr, ekran için çizilmiş, Türkçe diakritikleri temiz |
| Etiket / sayı | **JetBrains Mono** | Teknik künye dili: `01`, `GİRDİ · PDF`, `11 ARAÇ` |

Kurallar:

- Başlıklar **küçük harf**. `pdf işleri / tek sayfada / biter.` Cümle başı büyük harfi
  display'de kullanmıyoruz; bu, tabela değil, baskı dili.
- Display'de `letter-spacing: -0.045em`, `line-height: 0.9`. Sıkı ve oturmuş.
- İtalik başlık yok. (Bu bir zevk değil, bir denetim maddesi.)
- Türkçe karakterler için `latin-ext` alt kümesi self-host edildi. woff2 dosyaları
  `src/fonts/` içinde; hiçbir font CDN'den gelmiyor.

## 3. Renk

```
kâğıt      #F4F0E8   yüzey
kâğıt-2    #FBF9F4   kart
mürekkep   #14120E   metin
çizgi      #D6CEBF   hairline
sinyal     #E23A22   yalnızca eylem + vurgu
```

Tek sinyal rengi kuralı: sayfada kırmızı, ya bir eylemi ya bir vurguyu işaretler. Süs için
kullanılmaz. İkinci bir marka rengi yok; hiyerarşi kırmızıyla değil, **mürekkep tonlarıyla**
kuruluyor (`--ink-90/70/45/25`).

### Gece

Karanlık mod bir "ters çevirme" değil, **negatif baskı**: kâğıt siyaha değil is mürekkebine
dönüyor (`#12100C`), metin kâğıt rengine (`#F3EEE4`). Sinyal kırmızı bir ton açılıyor
(`#FF5C3D`) çünkü koyu zeminde aynı kırmızı kontrastını yitiriyor; üstündeki metin de
beyazdan koyu mürekkebe dönüyor (`--on-ember`).

Levha (`--plate-bg`) her iki temada da sayfanın en koyu yüzeyi olarak kalıyor; gece
temasında tam ters çevrilip göz almasın diye sadece bir ton yükseliyor. Kâğıt greni
gecede `multiply` yerine `screen` ile karışıyor.

Tema `<head>` içindeki 8 satırlık bir betikle ilk boyamadan **önce** uygulanır — karanlık
modda beyaz flaş yok. Tercih `localStorage`'da tutulur; ilk ziyarette sistem tercihi
(`prefers-color-scheme`) geçerlidir.

## 3.5. İkon dili

Tek ızgara, tek kontur: **20×20 viewBox, 1.4px çizgi, kare uçlar**. 30 ikon var; her biri
elde çizildi, hiçbiri ikon kütüphanesinden gelmiyor. Sebep: hazır setlerin yuvarlak uçları
ve 2px konturu bu sayfanın hairline dilini bozuyor.

İkonlar süs değil, işaret: araç satırlarında (16), adımlarda (3), tema düğmesinde (2),
boş durumda ve sonuç panelinde. Satır ikonları kendi ızgara kolonunda durur — numaranın
yanına sıkıştırılmaz.

### Uygulama simgesi

Sekme simgesi ayrı bir ızgara: **32×32 viewBox**. Sebep ölçülebilir: 16px'te 1 birim
0.5px'e düşüyor, yani çizgileri tam piksel satırına oturtmak mümkün. İlk sürümde 2px
kontur ve 6px'lik kırmızı kare vardı; 16px'te ikisi de bulanık bir lekeye dönüşüyordu.

Küçük boyutta hairline dili işe yaramaz, o yüzden simge **dolu** çiziliyor: mürekkep
sayfa, kırmızı kıvrık köşe, iki kâğıt rengi satır. Kâğıt zemin sayesinde aydınlık ve koyu
sekme çubuğunda kontrast aynı kalıyor; gece temasında simge kendi kendine negatif baskıya
dönüyor (zemin is mürekkebi, sayfa kâğıt).

Tek kaynak `public/favicon.svg`. ICO, apple-touch, maskable ve paylaşım kartı ondan
üretildi — ayrı ayrı çizilse marka boyutlar arasında kayardı.

## 4. Hareket

Kaynak: GSAP'in resmî AI skill'lerindeki ilkeler (transform-only, tek easing ailesi,
stagger, `prefers-reduced-motion`, temizlik). **Kütüphaneyi almadık** — 1 MB'lık PDF
motoru zaten var, üstüne 70 KB animasyon kütüphanesi koymak bu sayfanın sakinliğine aykırı.
İlkeler CSS + ~80 satır JS ile uygulandı.

| Durum | Süre | Eğri |
|-------|------|------|
| Basış / renk | 160 ms | `cubic-bezier(.65,0,.35,1)` |
| Görünürlük | 560 ms | `cubic-bezier(.16,1,.3,1)` |
| Satır taşması | 260 ms | aynı |

- Sadece `transform` ve `opacity`. Layout tetikleyen özellik animasyonu yok.
- Parallax yok, sürekli dönen hiçbir şey yok.
- `prefers-reduced-motion: reduce` açıksa tüm süreler 0.001 ms'ye düşer, görünürlük
  animasyonu tamamen atlanır.
- Görünüm geçişleri `document.startViewTransition` ile; desteklemeyen tarayıcıda anında.

İmza hareketi: **iş emri satırının soldan kırmızıyla dolması.** 260 ms, metin ters renge
döner, ok sağa kayar. Tek bir yerde, tek bir hareket — sayfanın geri kalanı sessiz.

## 4.5. Duyarlılık

Üç kırılım var, her biri bir şeyi çözüyor:

| Genişlik | Ne değişiyor | Neden |
|----------|--------------|-------|
| ≤ 1080px | Kahraman tek kolona iner, levha alt alta | İki kolon 900px'in altında sıkışıyor |
| ≤ 960px | Çalışma alanı tek kolona iner, ayar rayı alta geçer | Aşama + 372px ray 960'ın altında okunmuyor |
| ≤ 620px | Üst bar kompaktlaşır, dokunma hedefleri büyür | Telefon |

Mobil kararları:

- **Dokunma hedefleri ≥ 36px.** `mini-btn` ve `icon-btn` mobilde büyür; "tümü / hiçbiri"
  gibi metin düğmeleri çerçeve kazanır ki düğme oldukları anlaşılsın.
- **Başlık çubuğu sadeleşir.** Geri bağlantısında yalnızca ok kalır (yazı gizlenir,
  `aria-label` durur), sayaç etiketi kalkar.
- **Eylem çubuğu yapışkan.** Ayar rayının altındaki ana düğme ekranın altında kalır;
  alanların altına 6rem boşluk konur ki son alan düğmenin altında kalmasın.
- **Sayfa kartları 124 → 94px.** 390px'te üç kart yan yana sığar, küçük görsel hâlâ okunur.
- **Yatay taşma yok.** 320px'e kadar test edildi (`scrollWidth === innerWidth`).
- **Adımlar ayrık bloklar.** Sütunlar arasında dikey çizgi yok; her adım kendi
  `numara — çizgi — ikon` satırını taşıyor. Böylece üç adım tablo gibi bitişik değil,
  ayrı ayrı okunuyor. Mobilde de aynı mantık, aralarında 2.25rem boşluk.

## 5. Anti-AI-slop denetimi

Aşağıdaki liste, araştırılan skill'lerin ortak çekirdeğinden çıkarıldı ve bu sayfaya
uygulandı. Her madde bir "hayır" ile başlıyor.

| # | Denetim | Durum |
|---|---------|-------|
| 1 | Mor/mavi gradyan, cam efekti (glassmorphism) | Yok |
| 2 | Ortalanmış kahraman + iki buton + ekran görüntüsü | Yok — asimetrik iki kolon |
| 3 | Üç özellik kartı | Yok — 14 satırlık iş emri tablosu |
| 4 | Emoji ikon seti | Yok — 20×20 ızgarada elle çizilmiş 16 ikon, 1.4px kontur, kare uçlar |
| 5 | Varsayılan 16–24px yuvarlak köşe | Yok — 2–3px |
| 6 | Inter / Roboto / sistem fontu ile başlık | Yok |
| 7 | Sadece düzyazıdan oluşan bölüm | Yok |
| 8 | Birden fazla koyu blok | Yok — tek levha |
| 9 | Süs olarak kullanılan marka rengi | Yok — kırmızı yalnızca eylem |
| 10 | Uydurma sosyal kanıt ("10.000 ekip kullanıyor") | Yok |
| 11 | Abartılı kopya ("süper hızlı", "zahmetsiz") | Yok — sınırlar yazılı: "garanti değil", "görsel sıkıştırmaz" |
| 12 | Süs için hareket (parallax, sürekli animasyon) | Yok |
| 13 | Gizli yükleme / belirsiz veri akışı | Yok — dış istek sayacı canlı |
| 14 | **Aynı iddiayı sayfada beş kez tekrarlamak** | Düzeltildi: üst bardaki rozet, hero altındaki not ve üçlü "yok" listesi kaldırıldı. İddia tek yerde: levha. |
| 15 | Ölçülmemiş iddia ("ortalama 1–3 saniye") | Kaldırıldı — ölçmediğim sayıyı yazmıyorum |

## 6. Kaynaklar

Araştırılan skill'ler ve bu projede ne işe yaradıkları.

### Anti-AI-slop / tasarım

1. **Nutlope/hallmark** — *anti-AI-slop design skill*. 57 maddelik "slop test", 21 makro
   yapı, 21 tema. Buradan alınanlar: yapıyı temadan **önce** seçmek; "section-object law"
   (düzyazı bölümü başarısızdır); "plate law" (sayfada tek taşan levha); Grid temasının
   açık 12 kolonlu hairline ızgarası; tek sinyal mürekkebi; hareketin sıfıra yakın
   olabileceğinin meşruiyeti.
2. **anthropics/claude-code → `frontend-design`** — cesur estetik yön, ayırt edici tipografi
   ve palet, bağlama duyarlı animasyon. "Cesur" burada gösteriş değil, **kararlılık**:
   tek bir eksen seçip sonuna kadar gitmek.
3. **jiji262/claude-design-skill** — taşınabilir tasarım skill'i; `design-principles.md`
   içindeki anti-slop ve zanaat kuralları, çıktı biçimi disiplini.
4. **awesome-skills/refine-web-design** — *bounded, evidence-based review*. Her eleştiri
   ölçülebilir bir kanıta bağlanır. Bu projede tip denetimi + varlık bütçesi CI'a bağlandı;
   estetik iddiası da ölçülebilir hâle geldi.
5. **awesome-skills/design-artifact** — cilalı, etkileşimli HTML artefaktı üretme disiplini;
   responsive prototip doğrulaması (1440 / 390 genişliklerinde gerçek tarayıcı testi).
6. **awesome-skills/mobile-app-design** — erişilebilirlik ve platform alışkanlıkları:
   dokunma hedefi boyutu, `aria-pressed`, odak halkası, `prefers-reduced-motion`.

### Tasarım / animasyon

7. **greensock/gsap-skills** — resmî GSAP AI skill'leri (`gsap-core`, `gsap-timeline`,
   `gsap-scrolltrigger`, `gsap-performance`). İlkeler alındı, kütüphane alınmadı.
8. **motion-design-skill** — renderer'dan bağımsız genel hareket ilkeleri: tek easing
   ailesi, kısa süreler, amaçlı stagger, hareketin bilgi taşıması.
9. **claudedesignskills** — 27 eklenti, 5 bundle. Buradan alınan: her yetenek tek bir işe
   baksın (bizde de `catalog` / `tools` / `workspace` ayrımı aynı mantık).

## 7. Motor seçimi

Tek kütüphaneye her şeyi yaptırmak, bir noktadan sonra o kütüphaneye yapamayacağı işi
yaptırmaya dönüşüyor. Bu yüzden iş bölündü:

| İş | Motor | Neden o |
|----|-------|---------|
| Yapısal düzenleme (birleştir, böl, döndür, sil, sırala) | **pdf-lib** | Sayfa ağacını okuyup yazıyor; çizim yapmadığı için hızlı ve bellekte küçük |
| Filigran, numara, imza | **pdf-lib + fontkit** | Vektör metin ve görsel gömme; Türkçe için yazı tipi gömülüyor |
| Küçük görsel, PDF→Görsel, PDF→Metin | **pdf.js 6** | Gerçek rasterleştirme ve metin katmanı; pdf-lib bunların hiçbirini yapamaz |
| İmza çizimi | **Canvas 2D + Pointer Events** | Basınç ve `getCoalescedEvents()` ile akıcı iz; kütüphane gereksiz |
| Kırpma | **pdf-lib CropBox** | Kutu daraltmak yeterli; içeriğe dokunmadan geri alınabilir |
| Damga | **pdf-lib** görsel gömme | Logo sayfaya gömülür, saydamlık destekli |
| Sıkıştırma (görüntü) | **pdf.js → JPEG → pdf-lib** | Tek yol rasterleştirmek; bedeli metin katmanı |
| Çoklu çıktı | **JSZip** | Tarayıcıda arşiv |
| Kaydetme | **File System Access API** | Varsa doğrudan diske, yoksa klasik indirme |

Bunun bedeli: pdf.js kendi worker'ını da getiriyor (2,2 MB, sıkıştırılmamış). Bu yüzden
pdf.js yalnızca sayfa çizen üç araçta `import()` ile iniyor; açılış sayfası onu hiç görmüyor.
Küçük görseller bir kez çizilip JPEG data URL olarak önbelleğe alınıyor — sayfa seçmek
yeniden çizim tetiklemiyor, sadece önbellekten boyuyor. Görünmeyen kartlar
`IntersectionObserver` ile kuyruğa alınmıyor bile.

## 8. Bilerek yapılmayanlar

- **Gradyan ve illüstrasyon.** Kâğıt metaforu illüstrasyon istemiyor; görsel dil yalnızca
  çizgi, tipografi ve tek sinyal rengi üzerinden kuruluyor.
- **GSAP / Framer Motion.** Gerekçe §4'te.
- **OCR.** Taranmış PDF'i aranabilir yapmak tesseract.js + dil paketi demek: 10 MB'tan
  fazla indirme ve değişken doğruluk. "Sıkıntısız" hedefiyle çelişiyor; PDF→Metin aracı
  bunun yerine sınırını açıkça yazıyor.
- **"Sihirli" tek tuş.** Her aracın ne yaptığı ayar panelinde yazılı; sürpriz yok.
- **16 araç.** 11 araç var, hepsi gerçekten çalışıyor. Yarısı çalışan 16 araç yerine
  tamamı çalışan 11.

---

## 9. Debug turunda bulunan ve düzeltilen hatalar

Tam geçiş (16 araç × uç durumlar × 320/390/768/1024/1440 × iki tema) sonucunda
çıkan gerçek hatalar:

| # | Hata | Neden | Düzeltme |
|---|------|-------|----------|
| 1 | Mobilde **Sırala kullanılamıyordu** | HTML5 sürükle-bırak dokunmatikte çalışmaz, tıklamanın da karşılığı yoktu | Dokun → seç, sonra `←` `→` düğmeleri. Kenarda düğme devre dışı |
| 2 | Mobilde **birleştirme sırası değiştirilemiyordu** | Ok düğmeleri `< 620px`'te gizlenmişti | 4 kolonlu ızgara + 36px hedef |
| 3 | **Bellek sızıntısı (dinleyici)** | Her açılış sayfası kurulumunda `window`'a yeni `scroll` dinleyicisi ekleniyordu | Tek dinleyici, yenisi eklenmeden önce eskisi kaldırılıyor |
| 4 | **Bellek sızıntısı (pdf.js)** | Araçtan çıkınca worker ve belge kapanmıyordu | `lifecycle.ts` → `onDispose` / `disposeAll` |
| 5 | **İmza ve damga yanlış köşeye düşüyordu** | `/Rotate` yok sayılıyordu | Ortak `visualToPage()` ters eşlemesi + `rotate: degrees(rot)` |
| 6 | Sıralamada **iki numara** vardı | Konum etiketi + orijinal sayfa numarası üst üste biniyordu | Konum etiketi kaldırıldı; sıra zaten mekânsal |
| 7 | Modal açılınca **kırmızı odak halkası** | İlk öğeye programatik odak | Panel odaklanıyor, halka yok; Escape'te odak bırakma alanına dönüyor |
| 8 | Araç sayısı metinlerde **sabit** yazılıydı | "16" üç yerde kopyalanmıştı | `catalog.length` |
| 9 | Sonuç panelinde **odak taşınmıyordu** | Ekran okuyucu sonucu atlıyordu | `h2` odaklanıyor |
| 10 | **Sıkıştır ikonu** okunmuyordu | Köşe okları 24px'te dağılıyordu | Kutu + içe bakan iki ok |
| 11 | Numaralandırma notu **yanlıştı** | Davranış değişti, metin kaldı | "Döndürülmüş sayfalarda numara dik durur" |

Yanlış alarm sayılanlar: filigranda "kaybolan boşluk" (metin çıkarımı boşluğun yerinde
olduğunu gösterdi), tam sayfa ekran görüntüsünde "görünmeyen" satırlar (kaydırma
animasyonu ekran görüntüsünde tetiklenmiyor).
