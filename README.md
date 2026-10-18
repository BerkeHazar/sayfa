# sayfa

**PDF araçları. Tarayıcında çalışır, dosyan cihazından çıkmaz.**

16 araç, tek sayfa uygulama, sıfır sunucu. Dosya tarayıcının belleğine girer, işlem orada
biter, indirme orada başlar. Sekmeyi kapatınca iz kalmaz.

> Depo: [github.com/BerkeHazar/sayfa](https://github.com/BerkeHazar/sayfa) — eski tek
> dosyalık yapının yerine geçen sürüm;
> ürün baştan, iLovePDF'in netliği ama bambaşka bir karakterle kuruldu.

---

## Araçlar

| # | Araç | Ne yapar |
|---|------|----------|
| 01 | Birleştir | Birden fazla PDF'i sırayla tek dosyada toplar |
| 02 | Böl | Aralıklara ayırır ya da her sayfayı ayrı dosya yapar (ZIP) |
| 03 | Döndür | Seçili sayfaları 90° / 180° / 270° çevirir |
| 04 | Sayfa sil | İşaretlenen sayfaları çıkarır |
| 05 | Sırala | Sayfaları sürükle-bırak ya da ok tuşlarıyla yeniden dizer |
| 06 | Filigran | Tüm sayfalara çapraz, saydam metin basar |
| 07 | Numaralandır | Konum, biçim ve başlangıç seçilebilir sayfa numarası |
| 08 | İmza | Çizilen imzayı seçilen sayfaya, seçilen köşeye gömer |
| 09 | Kırp | Kenarlardan mm cinsinden boşluk atar (CropBox) |
| 10 | Damga | PNG/JPG logo damgası basar |
| 11 | Görsel → PDF | JPG/PNG/WebP'yi A4 ya da kendi boyutunda PDF yapar |
| 12 | PDF → Görsel | Her sayfayı PNG/JPG olarak çıkarır (pdf.js) |
| 13 | PDF → Metin | Metin katmanını .txt olarak çıkarır (pdf.js) |
| 14 | Meta düzenle | Başlık, yazar, konu, etiket — ya da tamamen temizle |
| 15 | PDF bilgi | Sayfa sayısı, ölçü ve künyeyi okur (dosyayı değiştirmez) |
| 16 | Sıkıştır | İki yöntem: yapı (kayıpsız) ya da görüntü (küçük ama metinsiz) |

Aydınlık ve karanlık tema var; karanlık mod "negatif baskı" olarak kurgulandı, ters
çevirme değil. Tercih `localStorage`'da tutulur, ilk ziyarette sistem tercihi geçerlidir.

## Hangi iş, hangi motor

Tek kütüphaneye her şeyi yaptırmak yerine iş, doğru araca verildi:

| İş | Araç | Neden |
|----|------|-------|
| Yapısal düzenleme (birleştir, böl, döndür, sil, sırala) | **pdf-lib** | Sayfa ağacını okuyup yeniden yazar; render gerekmez, çok hızlı |
| Filigran, numara, imza | **pdf-lib** + **@pdf-lib/fontkit** | Vektör metin ve görsel gömme; Türkçe karakter için font gömer |
| Sayfa küçük görselleri, PDF→Görsel, PDF→Metin | **pdf.js 6** (Mozilla) | Gerçek render ve metin katmanı; kendi worker'ında çalışır |
| İmza çizimi | **Canvas 2D + Pointer Events** | Basınç duyarlı çizgi, `getCoalescedEvents()` ile akıcı iz |
| Kırpma | **pdf-lib CropBox** | Görünür alanı daraltır; içerik silinmez, geri alınabilir |
| Damga | **pdf-lib** görsel gömme | PNG/JPG sayfaya gömülür, saydamlık destekli |
| Sıkıştırma (görüntü) | **pdf.js → JPEG → pdf-lib** | Sayfayı rasterleştirip yeniden paketler; metin katmanı kalkar |
| Çoklu çıktı | **JSZip** | Böl/çıkar sonuçlarını tek arşivde paketler |
| Kaydetme | **File System Access API** (varsa) | İndirilenler klasöründe kopya bırakmadan doğrudan diske yazar |
| Tema | CSS değişkenleri + `<head>` betiği | İlk boyamadan önce uygulanır, beyaz flaş yok |

Hiçbir aşamada ağa dosya çıkmaz.

---

## Mimari

```
index.html              tek giriş, hash tabanlı yönlendirme (GitHub Pages'te 404 yok)
src/
  catalog.ts            araçların hafif tanımı — pdf-lib'e dokunmaz
  tools.ts              ağır motor: 11 aracın uygulaması (dinamik yüklenir)
  workspace.ts          araç ekranı: aşama + ayar rayı
  landing.ts            açılış sayfası + dosya seçici
  motion.ts             görünürlük, geçişler, dış istek sayacı
  icons.ts              20×20 ızgarada elde çizilmiş 17 ikon
  theme.ts              aydınlık/gece teması, kalıcı tercih
  lib/pdf.ts            pdf-lib sarmalayıcı: yükleme, aralık ayrıştırma, font, indirme
  lib/render.ts         pdf.js katmanı: küçük görsel, sayfa→görsel, metin çıkarma
  styles/               tokens · base · landing · workspace
public/fonts/           PDF'e gömülen TTF (çalışma anında, yalnızca gerektiğinde)
src/fonts/              self-host woff2 (variable, latin + latin-ext)
```

**Neden katmanlı?** `pdf-lib` + `fontkit` ~1 MB, `pdf.js` ~437 KB (+ kendi worker'ı).
Açılış sayfası bu yüklerin hiçbirini görmez: `catalog.ts` yalnızca başlık/açıklama taşır,
motorlar `import()` ile araç açılınca iner. Kullanıcı bir araç satırına dokunduğunda
pdf-lib önden indirilir (hover prefetch); pdf.js yalnızca sayfa çizen araçlarda devreye girer.

**Neden hash yönlendirme?** GitHub Pages statik sunucudur; `/arac/bol` gibi yollar 404 verir.
`#/arac/bol` hiç sunucuya gitmez — derin bağlantı çalışır, ek yapılandırma gerekmez.

### Ölçülen bütçe (gzip)

| Parça | gzip | Ne zaman iner |
|-------|------|----------------|
| İlk yükleme (JS + CSS) | ~18 KB | her zaman |
| Yazı tipleri (6 × woff2, variable) | ~190 KB | ilk boyama |
| pdf-lib + fontkit | ~508 KB | ilk araç açılışında |
| pdf.js | ~131 KB | sayfa çizilen ilk araçta |
| pdf.js worker | 2,2 MB (sıkıştırılmamış) | aynı anda, ayrı thread'de |
| JSZip | ~30 KB | çoklu çıktı gerektiğinde |

---

## Geliştirme

```bash
npm install
npm run dev        # http://localhost:5173
npm run typecheck  # tsc --noEmit
npm run build      # dist/
npm run preview    # derlenmiş hâli 4173'te dener
```

Gereksinim: Node 22+.

---

## Yayın (GitHub Pages + Actions)

Depo hazır; tek yapılacak:

1. **Settings → Pages → Build and deployment → Source: `GitHub Actions`**
2. `main` dalına push.

`.github/workflows/deploy.yml` tip denetimi + derleme yapar, `dist/` klasörünü Pages
artefaktı olarak yükler ve yayınlar. `concurrency: pages` sayesinde aynı anda tek yayın
çalışır; üst üste push'lar sıraya girer, birbirini ezmez.

`ci.yml` ise PR'larda ve `main` dışı dallarda tip denetimi + derleme yapar ve iki şeyi
denetler: **ilk yükleme 90 KB'ı (gzip) aşamaz** ve **hiçbir PDF motoru (pdf-lib, pdf.js,
worker) `index.html` içinde önceden yüklenmiş olamaz**. Böylece "hızlı" iddiası bir CI kuralına bağlanır, iyi niyete
değil.

`base: "./"` olduğu için site hem `kullanici.github.io/repo/` altında, hem özel alan adında,
hem de `file://` ile açıldığında çalışır.

---

## Gizlilik

- Dosya hiçbir uç noktaya gönderilmez; `fetch`/`XHR`/`sendBeacon` sarmalanmıştır ve
  **kendi kaynağımız dışına** çıkan her istek arayüzdeki sayaçta görünür.
- Çerez yok, analytics yok, localStorage yok.
- PDF'e gömülen yazı tipi bile yerelden (`public/fonts`) gelir.
- Görsel → PDF aracı EXIF konum verisini dosyaya taşımaz.

İddia kanıtlanabilir olsun diye: sayfayı aç, DevTools → Ağ, bir dosya işle. Sayaç 0 kalır.

---

## Tasarım

Kararların gerekçesi `DESIGN.md`'de: eksen, jetonlar, tipografi, hareket kuralları ve
uygulanan anti-AI-slop denetim listesi.

## Simgeler ve paylaşım

Tek kaynak `public/favicon.svg`. Diğer bütün simgeler ondan üretildi — ayrı ayrı
çizilmedi, böylece marka her boyutta aynı kalıyor.

| Dosya | Boyut | Nerede kullanılıyor |
|-------|-------|---------------------|
| `favicon.svg` | vektör | Chrome, Edge, Firefox sekmesi — gece temasında kendi rengini çevirir |
| `favicon.ico` | 16 / 32 / 48 | Eski tarayıcılar, Windows kısayolu |
| `favicon-16/32/48.png` | raster | ICO'nun içindeki çerçeveler, raster yedek |
| `apple-touch-icon.png` | 180 | iOS ana ekran (saydamlık yok, köşeleri sistem yuvarlıyor) |
| `icon-192/512.png` | 192, 512 | `site.webmanifest` — kurulabilir uygulama |
| `icon-maskable-512.png` | 512 | Android uyarlanabilir simge, %28 güvenli alan |
| `og.png` | 1200 × 630 | Paylaşım kartı (X, Slack, WhatsApp, LinkedIn) |

Geometri 32 birimlik ızgaraya oturuyor: 16px'te 1 birim = 0.5px, yani çizgiler tam
piksel satırına düşüyor ve bulanıklaşmıyor. Sekme çubuğu rengi iki `theme-color`
etiketiyle aydınlık/gece ayrı ayrı veriliyor.

> `og:image` mutlak adres ister: `index.html` içinde
> `https://berkehazar.github.io/sayfa/og.png` yazılı. Özel alan adına geçersen bu iki
> satırı güncelle, yoksa paylaşım kartı boş çıkar.

## Lisans

MIT — © 2026 Berke Hazar.

pdf-lib (MIT) · pdf.js (Apache-2.0) · JSZip (MIT) · @pdf-lib/fontkit (MIT) ·
Bricolage Grotesque, Instrument Sans, JetBrains Mono (SIL OFL 1.1).
