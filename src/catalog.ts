/**
 * Katalog — araçların hafif tanımı.
 * Bu dosya pdf-lib'e de pdf.js'e de dokunmaz; açılış sayfası yalnızca buradan
 * beslenir, böylece ~2,5 MB'lık PDF motorları ilk boyamayı beklemez.
 */

export type OptValue = string | number | boolean;

export interface Opt {
  id: string;
  kind: "text" | "number" | "select" | "segment" | "toggle" | "range" | "pad" | "image";
  label: string;
  hint?: string;
  hintLabel?: string;
  value: OptValue;
  placeholder?: string;
  options?: { value: string; label: string }[];
  min?: number;
  max?: number;
  step?: number;
  suffix?: string;
}

export interface Stat {
  label: string;
  value: string;
}

export interface ToolOutput {
  kind: "file" | "report";
  name?: string;
  blob?: Blob;
  stats: Stat[];
  note?: string;
}

export interface ToolInput {
  files: File[];
  docs: import("pdf-lib").PDFDocument[];
  opts: Record<string, OptValue>;
  order: number[];
  /** Seçili sayfa indeksleri (0 tabanlı). Boşsa "tümü" anlamına gelir. */
  selected: Set<number>;
  step: (label: string) => void;
}

export interface ToolMeta {
  id: string;
  num: string;
  title: string;
  desc: string;
  long: string;
  accept: "pdf" | "image";
  multi: boolean;
  pages: "none" | "select" | "reorder";
  /** Sayfa kartlarında gerçek küçük görsel çizilsin mi (pdf.js). */
  thumbs?: boolean;
  opts: Opt[];
  action: string;
  note: string;
}

export interface Tool extends ToolMeta {
  run: (input: ToolInput) => Promise<ToolOutput>;
}

export const catalog: ToolMeta[] = [
  {
    id: "birlestir",
    num: "01",
    title: "Birleştir",
    desc: "Birden fazla PDF'i istediğin sırayla tek dosyada topla.",
    long: "Dosyaları sıraya diz, tek PDF olarak indir. Sayfa sırası listedeki sıradır.",
    accept: "pdf",
    multi: true,
    pages: "none",
    opts: [],
    action: "Birleştir",
    note: "En az iki dosya gerekir.",
  },
  {
    id: "bol",
    num: "02",
    title: "Böl",
    desc: "Her sayfayı ayrı dosya yap ya da aralıklara ayır.",
    long: "Tek PDF'i parçalara ayır. Birden fazla parça çıkarsa hepsi tek ZIP'te iner.",
    accept: "pdf",
    multi: false,
    pages: "none",
    opts: [
      {
        id: "mod",
        kind: "segment",
        label: "Bölme biçimi",
        value: "aralik",
        options: [
          { value: "aralik", label: "Aralıklarla" },
          { value: "tek", label: "Her sayfa ayrı" },
        ],
      },
      {
        id: "aralik",
        kind: "text",
        label: "Aralıklar",
        value: "1-2, 3-5",
        placeholder: "1-2, 3-5, 8",
        hint: "Virgülle ayır. Her aralık ayrı bir PDF olur.",
        hintLabel: "örn. 1-2, 3-5",
      },
    ],
    action: "Böl",
    note: "Çıktı birden fazlaysa ZIP olarak iner.",
  },
  {
    id: "dondur",
    num: "03",
    title: "Döndür",
    desc: "Sayfaları 90°, 180° veya 270° çevir.",
    long: "Taranmış belgelerde yan duran sayfaları düzelt. Sadece seçtiğin sayfaları çevir.",
    accept: "pdf",
    multi: false,
    pages: "select",
    thumbs: true,
    opts: [
      {
        id: "aci",
        kind: "segment",
        label: "Açı",
        value: "90",
        options: [
          { value: "90", label: "90° sağ" },
          { value: "180", label: "180°" },
          { value: "270", label: "90° sol" },
        ],
      },
    ],
    action: "Döndür",
    note: "Sayfa seçmezsen tüm belge döner.",
  },
  {
    id: "sil",
    num: "04",
    title: "Sayfa sil",
    desc: "İstemediğin sayfaları işaretle, belgeden çıkar.",
    long: "İşaretlediğin sayfalar atılır, kalanlar sırasını korur. Aralık da yazabilirsin.",
    accept: "pdf",
    multi: false,
    pages: "select",
    thumbs: true,
    opts: [
      {
        id: "aralik",
        kind: "text",
        label: "Ek aralık",
        value: "",
        placeholder: "4, 7-9",
        hint: "İşaretlemenin yanı sıra aralık yazarak da sayfa silebilirsin.",
        hintLabel: "isteğe bağlı",
      },
    ],
    action: "Sayfaları sil",
    note: "En az bir sayfa kalmalı.",
  },
  {
    id: "sirala",
    num: "05",
    title: "Sırala",
    desc: "Sayfaları sürükle, yeni sırayla kaydet.",
    long: "Kapak sayfasını öne al, ekleri sona taşı. Sürükle-bırak ya da ok tuşları.",
    accept: "pdf",
    multi: false,
    pages: "reorder",
    thumbs: true,
    opts: [],
    action: "Yeni sırayla kaydet",
    note: "Sürükle ya da sayfaya odaklanıp ← → tuşlarını kullan.",
  },
  {
    id: "filigran",
    num: "06",
    title: "Filigran",
    desc: "Her sayfaya çapraz, saydam metin bas.",
    long: "Taslak, gizli, kopya… Ne yazarsan tüm sayfalara aynı açıyla basılır.",
    accept: "pdf",
    multi: true,
    pages: "none",
    opts: [
      { id: "metin", kind: "text", label: "Metin", value: "TASLAK", placeholder: "TASLAK" },
      {
        id: "boyut",
        kind: "range",
        label: "Boyut",
        value: 90,
        min: 30,
        max: 100,
        step: 5,
        suffix: "%",
        hint: "%100 = sayfaya sığan en büyük boyut. Her sayfa boyutunda aynı oranda durur.",
      },
      {
        id: "saydam",
        kind: "range",
        label: "Saydamlık",
        value: 14,
        min: 4,
        max: 60,
        step: 1,
        suffix: "%",
      },
      {
        id: "aci",
        kind: "segment",
        label: "Açı",
        value: "45",
        options: [
          { value: "45", label: "45°" },
          { value: "0", label: "Düz" },
          { value: "-45", label: "−45°" },
        ],
      },
    ],
    action: "Filigran bas",
    note: "Metin boşsa araç çalışmaz.",
  },
  {
    id: "numara",
    num: "07",
    title: "Numaralandır",
    desc: "Sayfa numarası ekle — başlangıç ve konum senin.",
    long: "Alt orta, alt sağ ya da üst. İstersen ilk sayfayı atla; numara kapaktan sonra başlasın.",
    accept: "pdf",
    multi: true,
    pages: "none",
    opts: [
      {
        id: "konum",
        kind: "select",
        label: "Konum",
        value: "alt-orta",
        options: [
          { value: "alt-orta", label: "Alt · orta" },
          { value: "alt-sag", label: "Alt · sağ" },
          { value: "ust-orta", label: "Üst · orta" },
          { value: "ust-sag", label: "Üst · sağ" },
        ],
      },
      {
        id: "bicim",
        kind: "select",
        label: "Biçim",
        value: "n",
        options: [
          { value: "n", label: "1" },
          { value: "n/toplam", label: "1 / 12" },
          { value: "sayfa-n", label: "Sayfa 1" },
          { value: "n-nokta", label: "— 1 —" },
        ],
      },
      { id: "baslangic", kind: "number", label: "Başlangıç", value: 1, min: 0, max: 9999, step: 1 },
      { id: "boyut", kind: "range", label: "Punto", value: 10, min: 6, max: 24, step: 1 },
      { id: "kapak", kind: "toggle", label: "İlk sayfayı atla", value: true },
    ],
    action: "Numaralandır",
    note: "Döndürülmüş sayfalarda numara dik ve doğru köşede durur.",
  },
  {
    id: "imza",
    num: "08",
    title: "İmza",
    desc: "İmzanı çiz, seçtiğin sayfaya yerleştir.",
    long: "Parmağınla ya da fareyle çiz. Basınç destekleyen kalemlerde çizgi kalınlığı da değişir.",
    accept: "pdf",
    multi: false,
    pages: "select",
    thumbs: true,
    opts: [
      {
        id: "imza",
        kind: "pad",
        label: "İmza",
        value: "",
        hintLabel: "çiz",
      },
      {
        id: "konum",
        kind: "select",
        label: "Konum",
        value: "sag-alt",
        options: [
          { value: "sol-ust", label: "Sol üst" },
          { value: "sag-ust", label: "Sağ üst" },
          { value: "orta", label: "Orta" },
          { value: "sol-alt", label: "Sol alt" },
          { value: "sag-alt", label: "Sağ alt" },
        ],
      },
      {
        id: "genislik",
        kind: "range",
        label: "Genişlik",
        value: 55,
        min: 20,
        max: 120,
        step: 2,
        suffix: "mm",
      },
      { id: "kenar", kind: "range", label: "Kenar", value: 16, min: 0, max: 40, step: 2, suffix: "mm" },
    ],
    action: "İmzala",
    note: "Sayfa seçmezsen ilk sayfaya basılır.",
  },
  {
    id: "kirp",
    num: "09",
    title: "Kırp",
    desc: "Kenarlardan boşluk at, sayfayı daralt.",
    long: "Taramalarda kalan siyah kenarı ya da geniş boşluğu kes. İçerik silinmez; yalnızca görünen alan daralır.",
    accept: "pdf",
    multi: false,
    pages: "select",
    thumbs: true,
    opts: [
      { id: "ust", kind: "range", label: "Üst", value: 0, min: 0, max: 60, step: 1, suffix: "mm" },
      { id: "alt", kind: "range", label: "Alt", value: 0, min: 0, max: 60, step: 1, suffix: "mm" },
      { id: "sol", kind: "range", label: "Sol", value: 0, min: 0, max: 60, step: 1, suffix: "mm" },
      { id: "sag", kind: "range", label: "Sağ", value: 0, min: 0, max: 60, step: 1, suffix: "mm" },
    ],
    action: "Kırp",
    note: "0 mm = dokunma. Sayfa seçmezsen tüm sayfalar kırpılır.",
  },
  {
    id: "damga",
    num: "10",
    title: "Damga",
    desc: "Logo ya da görsel damgası bas.",
    long: "PNG veya JPG'yi sayfaya damga olarak yerleştir. Şeffaf zeminli PNG en iyi sonucu verir.",
    accept: "pdf",
    multi: true,
    pages: "none",
    opts: [
      {
        id: "gorsel",
        kind: "image",
        label: "Görsel",
        value: "",
        hintLabel: "png · jpg",
      },
      {
        id: "konum",
        kind: "select",
        label: "Konum",
        value: "sag-alt",
        options: [
          { value: "sol-ust", label: "Sol üst" },
          { value: "sag-ust", label: "Sağ üst" },
          { value: "orta", label: "Orta" },
          { value: "sol-alt", label: "Sol alt" },
          { value: "sag-alt", label: "Sağ alt" },
        ],
      },
      {
        id: "genislik",
        kind: "range",
        label: "Genişlik",
        value: 28,
        min: 6,
        max: 100,
        step: 2,
        suffix: "%",
        hint: "Sayfa genişliğinin yüzdesi.",
      },
      {
        id: "saydam",
        kind: "range",
        label: "Saydamlık",
        value: 100,
        min: 10,
        max: 100,
        step: 5,
        suffix: "%",
      },
      { id: "kenar", kind: "range", label: "Kenar", value: 14, min: 0, max: 40, step: 2, suffix: "mm" },
    ],
    action: "Damgala",
    note: "Damga sayfa içeriğine gömülür, sonradan ayrı katman olarak seçilemez.",
  },
  {
    id: "gorsel",
    num: "11",
    title: "Görsel → PDF",
    desc: "JPG, PNG, WebP'yi tek PDF'e çevir.",
    long: "Fotoğrafları sırayla sayfalara yerleştir. EXIF konum verisi dosyaya taşınmaz.",
    accept: "image",
    multi: true,
    pages: "none",
    opts: [
      {
        id: "sayfa",
        kind: "select",
        label: "Sayfa boyutu",
        value: "a4",
        options: [
          { value: "a4", label: "A4 (dikey)" },
          { value: "a4-yatay", label: "A4 (yatay)" },
          { value: "gorsel", label: "Görselin kendi boyutu" },
        ],
      },
      {
        id: "kenar",
        kind: "range",
        label: "Kenar boşluğu",
        value: 18,
        min: 0,
        max: 60,
        step: 2,
        suffix: "mm",
      },
    ],
    action: "PDF yap",
    note: "Görselin en-boy oranı korunur, kırpılmaz.",
  },
  {
    id: "resim",
    num: "12",
    title: "PDF → Görsel",
    desc: "Sayfaları PNG ya da JPG olarak çıkar.",
    long: "Her sayfa ayrı görsel olur. Birden fazla sayfa çıkarsa ZIP iner. Çizimler pdf.js ile üretilir.",
    accept: "pdf",
    multi: false,
    pages: "none",
    opts: [
      {
        id: "format",
        kind: "segment",
        label: "Biçim",
        value: "png",
        options: [
          { value: "png", label: "PNG" },
          { value: "jpeg", label: "JPG" },
        ],
      },
      {
        id: "olcek",
        kind: "select",
        label: "Çözünürlük",
        value: "2",
        options: [
          { value: "1", label: "1× · 72 DPI" },
          { value: "2", label: "2× · 144 DPI" },
          { value: "3", label: "3× · 216 DPI" },
        ],
      },
      {
        id: "aralik",
        kind: "text",
        label: "Sayfalar",
        value: "",
        placeholder: "boş = tümü",
        hint: "Aralık yazabilirsin: 1-3, 7",
        hintLabel: "isteğe bağlı",
      },
    ],
    action: "Görselleri çıkar",
    note: "Büyük dosyalarda 3× yavaşlar; ilk sayfalar hemen iner.",
  },
  {
    id: "metin",
    num: "13",
    title: "PDF → Metin",
    desc: "Metin katmanını .txt olarak çıkar.",
    long: "Kopyalanabilir metni olan PDF'lerde çalışır. Taranmış belgede metin katmanı yoktur.",
    accept: "pdf",
    multi: false,
    pages: "none",
    opts: [
      { id: "ayirici", kind: "toggle", label: "Sayfa ayırıcı ekle", value: true },
      {
        id: "aralik",
        kind: "text",
        label: "Sayfalar",
        value: "",
        placeholder: "boş = tümü",
        hintLabel: "isteğe bağlı",
      },
    ],
    action: "Metni çıkar",
    note: "Taranmış PDF'te çıktı boş çıkar — bu bir hata değil, sınır.",
  },
  {
    id: "meta",
    num: "14",
    title: "Meta düzenle",
    desc: "Başlık, yazar, konu ve etiketleri değiştir.",
    long: "Belgenin künyesini düzelt ya da tamamen temizle. Kimin, ne zaman yazdığı görünmesin.",
    accept: "pdf",
    multi: false,
    pages: "none",
    opts: [
      { id: "baslik", kind: "text", label: "Başlık", value: "", placeholder: "Belge adı" },
      { id: "yazar", kind: "text", label: "Yazar", value: "", placeholder: "Ad Soyad" },
      { id: "konu", kind: "text", label: "Konu", value: "", placeholder: "Kısa açıklama" },
      { id: "etiket", kind: "text", label: "Etiketler", value: "", placeholder: "sözleşme, 2026" },
      { id: "temizle", kind: "toggle", label: "Önce tüm meta verileri temizle", value: false },
    ],
    action: "Kaydet",
    note: "Boş bıraktığın alanlar olduğu gibi kalır.",
  },
  {
    id: "bilgi",
    num: "15",
    title: "PDF bilgi",
    desc: "Sayfa sayısı, ölçü ve künyeyi oku.",
    long: "Dosyayı değiştirmeden içine bak: kaç sayfa, hangi ölçüde, kim üretmiş.",
    accept: "pdf",
    multi: false,
    pages: "none",
    opts: [],
    action: "İncele",
    note: "Bu araç dosyayı değiştirmez.",
  },
  {
    id: "sikistir",
    num: "16",
    title: "Sıkıştır",
    desc: "Dosyayı küçült — iki yöntemle.",
    long: "Yapıyı sadeleştirmek kayıpsızdır ama az kazandırır. Görüntüye çevirmek çok küçültür, karşılığında metin katmanını siler.",
    accept: "pdf",
    multi: true,
    pages: "none",
    opts: [
      {
        id: "mod",
        kind: "segment",
        label: "Yöntem",
        value: "yapi",
        options: [
          { value: "yapi", label: "Yapı" },
          { value: "goruntu", label: "Görüntü" },
        ],
      },
      {
        id: "kalite",
        kind: "segment",
        label: "Kalite · görüntü modu",
        value: "dengeli",
        options: [
          { value: "kucuk", label: "En küçük" },
          { value: "dengeli", label: "Dengeli" },
          { value: "yuksek", label: "Yüksek" },
        ],
      },
      { id: "metaTemizle", kind: "toggle", label: "Meta verileri de temizle", value: true },
    ],
    action: "Sıkıştır",
    note: "Görüntü modunda metin katmanı kalkar: arama ve kopyalama çalışmaz.",
  },
];
