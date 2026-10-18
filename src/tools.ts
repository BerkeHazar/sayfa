import { PDFDocument, degrees } from "pdf-lib";
import JSZip from "jszip";
import { catalog } from "./catalog";
import { fmtBytes } from "./lib/format";
import type { OptValue, Stat, Tool, ToolInput, ToolOutput } from "./catalog";
import {
  A4,
  MM,
  PdfError,
  baseName,
  dataUrlToBytes,
  ink,
  loadTextFont,
  parseRanges,
  standardFont,
  toEmbeddableImage,
  visualToPage,
  winAnsiSafe,
} from "./lib/pdf";

const s = (o: Record<string, OptValue>, k: string) => String(o[k] ?? "");
const n = (o: Record<string, OptValue>, k: string) => Number(o[k] ?? 0);
const b = (o: Record<string, OptValue>, k: string) => Boolean(o[k]);

const POS_LABEL: Record<string, string> = {
  "sol-ust": "Sol üst",
  "sag-ust": "Sağ üst",
  orta: "Orta",
  "sol-alt": "Sol alt",
  "sag-alt": "Sağ alt",
};

const outFile = (name: string, blob: Blob, stats: Stat[], note?: string): ToolOutput => ({
  kind: "file",
  name,
  blob,
  stats,
  note,
});

const totalPages = (docs: PDFDocument[]) =>
  docs.reduce((sum, d) => sum + d.getPageCount(), 0);

const pdfBlob = (bytes: Uint8Array) =>
  new Blob([bytes as BlobPart], { type: "application/pdf" });

async function zipOf(files: { name: string; blob: Blob }[]): Promise<Blob> {
  const zip = new JSZip();
  files.forEach((f) => zip.file(f.name, f.blob));
  return zip.generateAsync({ type: "blob" });
}

type Impl = (input: ToolInput) => Promise<ToolOutput>;

const impl: Record<string, Impl> = {
  /* ---------------------------------------------------------------- */
  async birlestir({ files, docs, step }) {
    if (files.length < 2) throw new PdfError("Birleştirmek için en az iki PDF seç.");
    const out = await PDFDocument.create();
    let count = 0;
    for (let i = 0; i < docs.length; i++) {
      step(`Dosya ${i + 1}/${docs.length} ekleniyor`);
      const pages = await out.copyPages(docs[i], docs[i].getPageIndices());
      pages.forEach((p) => out.addPage(p));
      count += pages.length;
    }
    step("Yazılıyor");
    const bytes = await out.save();
    return outFile("birlestirilmis.pdf", pdfBlob(bytes), [
      { label: "Dosya", value: String(files.length) },
      { label: "Sayfa", value: String(count) },
      { label: "Boyut", value: fmtBytes(bytes.byteLength) },
    ], "Sayfa sırası, listedeki dosya sırasıdır. Yukarı/aşağı oklarıyla değiştirebilirsin.");
  },

  /* ---------------------------------------------------------------- */
  async bol({ files, docs, opts, step }) {
    const doc = docs[0];
    const total = doc.getPageCount();
    const mode = s(opts, "mod");
    const groups: number[][] = [];

    if (mode === "tek") {
      for (let i = 0; i < total; i++) groups.push([i]);
    } else {
      for (const raw of s(opts, "aralik").split(",")) {
        const pages = parseRanges(raw, total);
        if (pages.length) groups.push(pages);
      }
    }
    if (groups.length === 0) throw new PdfError("Geçerli bir aralık yaz — örneğin 1-3, 5");

    step("Sayfalar ayrılıyor");
    const base = baseName(files[0].name);
    const parts: { name: string; blob: Blob }[] = [];

    for (let i = 0; i < groups.length; i++) {
      const out = await PDFDocument.create();
      const copied = await out.copyPages(doc, groups[i]);
      copied.forEach((p) => out.addPage(p));
      parts.push({
        name: `${base}-${String(i + 1).padStart(2, "0")}.pdf`,
        blob: pdfBlob(await out.save()),
      });
    }

    if (parts.length === 1) {
      return outFile(parts[0].name, parts[0].blob, [
        { label: "Parça", value: "1" },
        { label: "Sayfa", value: String(groups[0].length) },
      ]);
    }

    step("ZIP hazırlanıyor");
    const zipBlob = await zipOf(parts);
    return outFile(`${base}-bolunmus.zip`, zipBlob, [
      { label: "Parça", value: String(parts.length) },
      { label: "Toplam sayfa", value: String(total) },
      { label: "ZIP", value: `${(zipBlob.size / 1024).toFixed(0)} KB` },
    ], "Her parça kendi PDF'i. Arşivi açıp tek tek kullanabilirsin.");
  },

  /* ---------------------------------------------------------------- */
  async dondur({ files, docs, opts, selected, step }) {
    const doc = docs[0];
    const delta = n(opts, "aci");
    const pages = doc.getPages();
    const targets = selected.size ? pages.filter((_, i) => selected.has(i)) : pages;
    if (!targets.length) throw new PdfError("Döndürülecek sayfa seçilmedi.");

    step(`${targets.length} sayfa çevriliyor`);
    for (const page of targets) {
      page.setRotation(degrees((page.getRotation().angle + delta) % 360));
    }
    return outFile(`${baseName(files[0].name)}-donduruldu.pdf`, pdfBlob(await doc.save()), [
      { label: "Sayfa", value: `${targets.length} / ${pages.length}` },
      { label: "Açı", value: `${delta}°` },
    ]);
  },

  /* ---------------------------------------------------------------- */
  async sil({ files, docs, opts, selected, step }) {
    const doc = docs[0];
    const total = doc.getPageCount();
    const kill = new Set<number>([...selected, ...parseRanges(s(opts, "aralik"), total)]);
    if (kill.size === 0) throw new PdfError("Silmek için en az bir sayfa işaretle.");
    if (kill.size >= total) throw new PdfError("Tüm sayfaları silemezsin — en az biri kalmalı.");

    step(`${kill.size} sayfa çıkarılıyor`);
    const out = await PDFDocument.create();
    const keep = doc.getPageIndices().filter((i) => !kill.has(i));
    const copied = await out.copyPages(doc, keep);
    copied.forEach((p) => out.addPage(p));
    return outFile(`${baseName(files[0].name)}-temiz.pdf`, pdfBlob(await out.save()), [
      { label: "Silinen", value: String(kill.size) },
      { label: "Kalan", value: String(keep.length) },
    ]);
  },

  /* ---------------------------------------------------------------- */
  async sirala({ files, docs, order, step }) {
    const doc = docs[0];
    const total = doc.getPageCount();
    const seq = order.length === total ? order : doc.getPageIndices();
    step("Sayfalar yeniden diziliyor");
    const out = await PDFDocument.create();
    const copied = await out.copyPages(doc, seq);
    copied.forEach((p) => out.addPage(p));
    const changed = seq.some((v, i) => v !== i);
    return outFile(`${baseName(files[0].name)}-sirali.pdf`, pdfBlob(await out.save()), [
      { label: "Sayfa", value: String(total) },
      { label: "Sıra", value: changed ? "değişti" : "aynı" },
    ]);
  },

  /* ---------------------------------------------------------------- */
  async filigran({ files, docs, opts, step }) {
    const text = s(opts, "metin").trim();
    if (!text) throw new PdfError("Filigran metni boş olamaz.");
    const pct = n(opts, "boyut");
    const opacity = n(opts, "saydam") / 100;
    const angle = n(opts, "aci");
    const rad = (angle * Math.PI) / 180;
    const cos = Math.abs(Math.cos(rad));
    const sin = Math.abs(Math.sin(rad));

    const blobs: { name: string; blob: Blob }[] = [];
    for (let i = 0; i < docs.length; i++) {
      step(`Dosya ${i + 1}/${docs.length}`);
      const doc = docs[i];
      const custom = await loadTextFont(doc);
      const font = custom ?? (await standardFont(doc));
      const label = custom ? text : winAnsiSafe(text);

      for (const page of doc.getPages()) {
        const { width, height } = page.getSize();

        // Önce sayfaya sığan en büyük boyut bulunur, sonra yüzdeyle ölçeklenir.
        // Böylece kaydırıcı her değerde gerçekten bir şey değiştirir ve metin
        // hiçbir zaman sayfadan taşmaz. A4'te de A0'da da oran aynı kalır.
        const span = cos * width + sin * height;
        const unit = font.widthOfTextAtSize(label, 100);
        let maxSize = (span / unit) * 100;

        // Döndürülmüş sınır kutusu iki geçişte oturur (kutu, boyutla doğrusal büyür).
        for (let pass = 0; pass < 2; pass++) {
          const tw = font.widthOfTextAtSize(label, maxSize);
          const th = font.heightAtSize(maxSize);
          const fit = Math.min(
            1,
            (width * 0.94) / (cos * tw + sin * th),
            (height * 0.94) / (sin * tw + cos * th),
          );
          maxSize *= fit;
        }

        const size = Math.max(6, maxSize * (pct / 100));
        const tw = font.widthOfTextAtSize(label, size);
        const th = font.heightAtSize(size);
        page.drawText(label, {
          x: width / 2 - (tw / 2) * Math.cos(rad) + (th / 2) * Math.sin(rad),
          y: height / 2 - (tw / 2) * Math.sin(rad) - (th / 2) * Math.cos(rad),
          size,
          font,
          color: ink("#14120E"),
          opacity,
          rotate: degrees(angle),
        });
      }
      blobs.push({
        name: `${baseName(files[i].name)}-filigran.pdf`,
        blob: pdfBlob(await doc.save()),
      });
    }

    if (blobs.length === 1) {
      return outFile(blobs[0].name, blobs[0].blob, [
        { label: "Sayfa", value: String(totalPages(docs)) },
        { label: "Metin", value: text },
        { label: "Saydamlık", value: `${n(opts, "saydam")}%` },
      ]);
    }

    return outFile(`${docs.length} dosya - filigran.zip`, await zipOf(blobs), [
      { label: "Dosya", value: String(blobs.length) },
      { label: "Metin", value: text },
    ]);
  },

  /* ---------------------------------------------------------------- */
  async numara({ files, docs, opts, step }) {
    const fmt = s(opts, "bicim");
    const pos = s(opts, "konum");
    const size = n(opts, "boyut");
    const skipWanted = b(opts, "kapak");
    const blobs: { name: string; blob: Blob }[] = [];

    for (let i = 0; i < docs.length; i++) {
      step(`Dosya ${i + 1}/${docs.length}`);
      const doc = docs[i];
      const font = (await loadTextFont(doc)) ?? (await standardFont(doc));
      const pages = doc.getPages();
      const total = pages.length;
      // Tek sayfalık belgede "kapağı atla" bir şey ifade etmez; sessizce
      // numarasız bırakmak yerine yok sayılır.
      const skip = skipWanted && total > 1;

      pages.forEach((page, idx) => {
        if (skip && idx === 0) return;
        const no = n(opts, "baslangic") + idx - (skip ? 1 : 0);
        const label =
          fmt === "n/toplam"
            ? `${no} / ${total}`
            : fmt === "sayfa-n"
              ? `Sayfa ${no}`
              : fmt === "n-nokta"
                ? `— ${no} —`
                : `${no}`;

        const { width, height } = page.getSize();
        const tw = font.widthOfTextAtSize(label, size);
        const margin = Math.max(18, Math.min(48, Math.min(width, height) * 0.057));

        // Sayfa /Rotate ile döndürülmüşse görünen çerçeve farklıdır: numara
        // görsel olarak doğru köşeye ve dik gelecek şekilde yerleştirilir.
        const rot = ((page.getRotation().angle % 360) + 360) % 360;
        const swap = rot === 90 || rot === 270;
        const vw = swap ? height : width;
        const vh = swap ? width : height;

        const vx = pos.endsWith("orta") ? vw / 2 - tw / 2 : vw - margin - tw;
        const vy = pos.startsWith("alt") ? margin : vh - margin - size;

        const { x, y } = visualToPage(rot, width, height, vx, vy);

        page.drawText(label, {
          x,
          y,
          size,
          font,
          color: ink("#3B372E"),
          opacity: 0.85,
          rotate: degrees(rot),
        });
      });

      blobs.push({
        name: `${baseName(files[i].name)}-numarali.pdf`,
        blob: pdfBlob(await doc.save()),
      });
    }

    if (blobs.length === 1) {
      return outFile(blobs[0].name, blobs[0].blob, [
        { label: "Sayfa", value: String(totalPages(docs)) },
        { label: "Biçim", value: fmt },
        { label: "Başlangıç", value: String(n(opts, "baslangic")) },
      ]);
    }
    return outFile(`${docs.length} dosya - numarali.zip`, await zipOf(blobs), [
      { label: "Dosya", value: String(blobs.length) },
    ]);
  },

  /* ---------------------------------------------------------------- */
  async gorsel({ files, opts, step }) {
    const doc = await PDFDocument.create();
    const margin = n(opts, "kenar") * MM;
    const mode = s(opts, "sayfa");

    for (let i = 0; i < files.length; i++) {
      step(`Görsel ${i + 1}/${files.length}`);
      const { bytes, kind } = await toEmbeddableImage(files[i]);
      const img = kind === "jpg" ? await doc.embedJpg(bytes) : await doc.embedPng(bytes);

      let pw: number, ph: number;
      if (mode === "gorsel") {
        pw = img.width;
        ph = img.height;
      } else if (mode === "a4-yatay") {
        pw = A4.h;
        ph = A4.w;
      } else {
        pw = A4.w;
        ph = A4.h;
      }

      const page = doc.addPage([pw, ph]);
      const scale = Math.min((pw - margin * 2) / img.width, (ph - margin * 2) / img.height);
      const w = img.width * scale;
      const h = img.height * scale;
      page.drawImage(img, { x: (pw - w) / 2, y: (ph - h) / 2, width: w, height: h });
    }

    step("Yazılıyor");
    const bytes = await doc.save();
    return outFile("gorseller.pdf", pdfBlob(bytes), [
      { label: "Görsel", value: String(files.length) },
      { label: "Sayfa", value: String(files.length) },
      { label: "Boyut", value: fmtBytes(bytes.byteLength) },
    ]);
  },

  /* ---------------------------------------------------------------- */
  async meta({ files, docs, opts, step }) {
    const doc = docs[0];
    step("Künye yazılıyor");
    if (b(opts, "temizle")) {
      doc.setTitle("");
      doc.setAuthor("");
      doc.setSubject("");
      doc.setKeywords([]);
      doc.setCreator("sayfa");
      doc.setProducer("sayfa");
    }
    if (s(opts, "baslik")) doc.setTitle(s(opts, "baslik"));
    if (s(opts, "yazar")) doc.setAuthor(s(opts, "yazar"));
    if (s(opts, "konu")) doc.setSubject(s(opts, "konu"));
    if (s(opts, "etiket")) {
      doc.setKeywords(
        s(opts, "etiket")
          .split(",")
          .map((t) => t.trim())
          .filter(Boolean),
      );
    }

    return outFile(`${baseName(files[0].name)}-meta.pdf`, pdfBlob(await doc.save()), [
      { label: "Başlık", value: doc.getTitle() || "—" },
      { label: "Yazar", value: doc.getAuthor() || "—" },
    ]);
  },

  /* ---------------------------------------------------------------- */
  async bilgi({ files, docs, step }) {
    const doc = docs[0];
    step("Okunuyor");
    const pages = doc.getPages();
    const first = pages[0]?.getSize() ?? { width: 0, height: 0 };
    const mm = (v: number) => Math.round(v / MM);

    return {
      kind: "report",
      stats: [
        { label: "Dosya", value: files[0].name },
        { label: "Sayfa", value: String(pages.length) },
        { label: "Ölçü", value: `${mm(first.width)} × ${mm(first.height)} mm` },
        { label: "Başlık", value: doc.getTitle() || "—" },
        { label: "Yazar", value: doc.getAuthor() || "—" },
        { label: "Üretici", value: doc.getProducer() || "—" },
        { label: "Oluşturan", value: doc.getCreator() || "—" },
        { label: "Etiketler", value: doc.getKeywords() || "—" },
      ],
      note: "Hiçbir şey değiştirilmedi. Dosya hâlâ senin diskinde, olduğu gibi.",
    };
  },

  /* ---------------------------------------------------------------- */
  /* ---------------------------------------------------------------- */
  /* CropBox ile kenar kırpma (içerik silinmez, görünür alan daralır).  */
  async kirp({ files, docs, opts, selected, step }) {
    const doc = docs[0];
    const pages = doc.getPages();
    const targets = selected.size ? pages.filter((_, i) => selected.has(i)) : pages;

    const top = n(opts, "ust") * MM;
    const bottom = n(opts, "alt") * MM;
    const left = n(opts, "sol") * MM;
    const right = n(opts, "sag") * MM;
    if (!top && !bottom && !left && !right) {
      throw new PdfError("En az bir kenara 0'dan büyük bir değer ver.");
    }

    step(`${targets.length} sayfa kırpılıyor`);
    let size = { w: 0, h: 0 };
    for (const page of targets) {
      const box = page.getMediaBox();
      const w = Math.max(20, box.width - left - right);
      const h = Math.max(20, box.height - top - bottom);
      page.setCropBox(box.x + left, box.y + bottom, w, h);
      size = { w, h };
    }

    return outFile(`${baseName(files[0].name)}-kirpilmis.pdf`, pdfBlob(await doc.save()), [
      { label: "Sayfa", value: String(targets.length) },
      {
        label: "Yeni ölçü",
        value: `${Math.round(size.w / MM)} × ${Math.round(size.h / MM)} mm`,
      },
    ], "Kırpma yalnızca görünür alanı daraltır; sayfa içeriği silinmez.");
  },

  /* ---------------------------------------------------------------- */
  /* Görsel damga — imza ile aynı yerleşim mantığı, oransal boyut.      */
  async damga({ files, docs, opts, step }) {
    const dataUrl = String(opts.gorsel ?? "");
    if (!dataUrl.startsWith("data:image/")) throw new PdfError("Önce bir görsel seç.");
    if (!/^data:image\/(png|jpeg)/.test(dataUrl)) {
      throw new PdfError("Damga için PNG ya da JPG kullan.");
    }

    const bytes = dataUrlToBytes(dataUrl);
    const isPng = dataUrl.startsWith("data:image/png");
    const ratio = n(opts, "genislik") / 100;
    const opacity = n(opts, "saydam") / 100;
    const margin = n(opts, "kenar") * MM;
    const pos = s(opts, "konum");

    const blobs: { name: string; blob: Blob }[] = [];
    for (let i = 0; i < docs.length; i++) {
      step(`Dosya ${i + 1}/${docs.length}`);
      const doc = docs[i];
      const image = isPng ? await doc.embedPng(bytes) : await doc.embedJpg(bytes);

      for (const page of doc.getPages()) {
        const { width, height } = page.getSize();
        const rot = ((page.getRotation().angle % 360) + 360) % 360;
        const swap = rot === 90 || rot === 270;
        const vw = swap ? height : width;
        const vh = swap ? width : height;

        const w = Math.min(vw - margin * 2, vw * ratio);
        const h = w * (image.height / image.width);

        let vx = margin;
        let vy = margin;
        if (pos === "orta") {
          vx = (vw - w) / 2;
          vy = (vh - h) / 2;
        } else {
          if (pos.startsWith("sag")) vx = vw - margin - w;
          if (pos.endsWith("ust")) vy = vh - margin - h;
        }

        const { x, y } = visualToPage(rot, width, height, vx, vy);
        page.drawImage(image, { x, y, width: w, height: h, opacity, rotate: degrees(rot) });
      }

      blobs.push({
        name: `${baseName(files[i].name)}-damgali.pdf`,
        blob: pdfBlob(await doc.save()),
      });
    }

    const stats: Stat[] = [
      { label: "Dosya", value: String(blobs.length) },
      { label: "Sayfa", value: String(totalPages(docs)) },
      { label: "Genişlik", value: `${n(opts, "genislik")}%` },
    ];
    if (blobs.length === 1) return outFile(blobs[0].name, blobs[0].blob, stats);
    return outFile(`${docs.length} dosya - damgali.zip`, await zipOf(blobs), stats);
  },

  async sikistir({ files, docs, opts, step }) {
    const mode = s(opts, "mod");
    const metaClean = b(opts, "metaTemizle");

    if (mode === "goruntu") {
      const preset =
        {
          kucuk: { scale: 1.2, quality: 0.55 },
          dengeli: { scale: 1.7, quality: 0.72 },
          yuksek: { scale: 2.4, quality: 0.86 },
        }[s(opts, "kalite")] ?? { scale: 1.7, quality: 0.72 };

      const { openDoc, pageToBlob } = await import("./lib/render");
      const blobs: { name: string; blob: Blob }[] = [];
      let before = 0;
      let after = 0;

      for (let f = 0; f < files.length; f++) {
        step(`Dosya ${f + 1}/${files.length} açılıyor`);
        const bytes = new Uint8Array(await files[f].arrayBuffer());
        const { doc: src, destroy } = await openDoc(bytes);
        try {
          const out = await PDFDocument.create();
          for (let i = 1; i <= src.numPages; i++) {
            step(`Dosya ${f + 1}/${files.length} · sayfa ${i}/${src.numPages}`);
            const view = (await src.getPage(i)).getViewport({ scale: 1 });
            const jpeg = await pageToBlob(src, i, preset.scale, "jpeg", preset.quality);
            const img = await out.embedJpg(new Uint8Array(await jpeg.arrayBuffer()));
            const page = out.addPage([view.width, view.height]);
            page.drawImage(img, { x: 0, y: 0, width: view.width, height: view.height });
          }
          if (metaClean) {
            out.setProducer("sayfa");
            out.setCreator("sayfa");
          }
          const outBytes = await out.save({ useObjectStreams: true });
          before += files[f].size;
          after += outBytes.byteLength;
          blobs.push({
            name: `${baseName(files[f].name)}-sikistirilmis.pdf`,
            blob: pdfBlob(outBytes),
          });
        } finally {
          await destroy();
        }
      }

      const saved = before - after;
      const pct = before ? Math.round((saved / before) * 100) : 0;
      const stats: Stat[] = [
        { label: "Önce", value: fmtBytes(before) },
        { label: "Sonra", value: fmtBytes(after) },
        { label: "Fark", value: saved > 0 ? `−${pct}%` : "küçülmedi" },
      ];
      const note =
        saved > 0
          ? "Metin katmanı kaldırıldı: bu dosyada artık arama ve kopyalama çalışmaz. " +
            "Taranmış belgelerde kazanç büyük olur."
          : "Bu dosya küçülmedi, büyüdü — vektörel bir belge olabilir. " +
            "Yapı yöntemini dene; hem küçültür hem metin katmanı korunur.";

      if (blobs.length === 1) return outFile(blobs[0].name, blobs[0].blob, stats, note);
      return outFile(`${docs.length} dosya - sikistirilmis.zip`, await zipOf(blobs), stats, note);
    }

    /* --- yapı modu: kayıpsız, küçük kazanç --- */
    const blobs: { name: string; blob: Blob }[] = [];
    let before = 0;
    let after = 0;

    for (let i = 0; i < docs.length; i++) {
      step(`Dosya ${i + 1}/${docs.length}`);
      const doc = docs[i];
      if (metaClean) {
        doc.setProducer("sayfa");
        doc.setCreator("sayfa");
      }
      const bytes = await doc.save({ useObjectStreams: true, addDefaultPage: false });
      before += files[i].size;
      after += bytes.byteLength;
      blobs.push({
        name: `${baseName(files[i].name)}-sikistirilmis.pdf`,
        blob: pdfBlob(bytes),
      });
    }

    const saved = before - after;
    const pct = before ? Math.round((saved / before) * 100) : 0;
    const stats: Stat[] = [
      { label: "Önce", value: fmtBytes(before) },
      { label: "Sonra", value: fmtBytes(after) },
      { label: "Fark", value: saved > 0 ? `−${pct}%` : "değişmedi" },
    ];

    if (blobs.length === 1) return outFile(blobs[0].name, blobs[0].blob, stats);
    return outFile(`${docs.length} dosya - sikistirilmis.zip`, await zipOf(blobs), stats);
  },

  /* ---------------------------------------------------------------- */
  /* Canvas 2D + Pointer Events ile çizilen imza, pdf-lib ile gömülür.  */
  async imza({ files, docs, opts, selected, step }) {
    const dataUrl = String(opts.imza ?? "");
    if (!dataUrl.startsWith("data:image/")) {
      throw new PdfError("Önce imzanı çiz — kutu boş.");
    }

    step("İmza gömülüyor");
    const png = dataUrlToBytes(dataUrl);
    const doc = docs[0];
    const image = await doc.embedPng(png);
    const pageIndex = selected.size ? Math.min(...selected) : 0;
    const page = doc.getPages()[pageIndex];
    if (!page) throw new PdfError("İmzalanacak sayfa bulunamadı.");

    const { width, height } = page.getSize();
    const w = n(opts, "genislik") * MM;
    const h = w * (image.height / image.width);
    const m = n(opts, "kenar") * MM;
    const pos = s(opts, "konum");

    const rot = ((page.getRotation().angle % 360) + 360) % 360;
    const swap = rot === 90 || rot === 270;
    const vw = swap ? height : width;
    const vh = swap ? width : height;

    let vx = m;
    let vy = m;
    if (pos === "orta") {
      vx = (vw - w) / 2;
      vy = (vh - h) / 2;
    } else {
      if (pos.startsWith("sag")) vx = vw - m - w;
      if (pos.endsWith("ust")) vy = vh - m - h;
    }

    const { x, y } = visualToPage(rot, width, height, vx, vy);
    page.drawImage(image, { x, y, width: w, height: h, rotate: degrees(rot) });
    const bytes = await doc.save();
    return outFile(
      `${baseName(files[0].name)}-imzali.pdf`,
      pdfBlob(bytes),
      [
        { label: "Sayfa", value: String(pageIndex + 1) },
        { label: "Genişlik", value: `${n(opts, "genislik")} mm` },
        { label: "Konum", value: POS_LABEL[pos] ?? pos },
      ],
      "İmza sayfanın içeriğine gömüldü, ayrı bir katman değil.",
    );
  },

  /* ---------------------------------------------------------------- */
  /* pdf.js: her sayfa ayrı görsele.                                    */
  async resim({ files, opts, step }) {
    step("Çizim motoru hazırlanıyor");
    const { openDoc, pageToBlob } = await import("./lib/render");
    const bytes = new Uint8Array(await files[0].arrayBuffer());
    const { doc, destroy } = await openDoc(bytes);

    try {
      const total = doc.numPages;
      const range = s(opts, "aralik").trim();
      const list = range
        ? parseRanges(range, total)
        : Array.from({ length: total }, (_, i) => i);
      if (!list.length) throw new PdfError("Geçerli bir sayfa aralığı yaz.");

      const format = (s(opts, "format") === "jpeg" ? "jpeg" : "png") as "png" | "jpeg";
      const scale = Number(s(opts, "olcek")) || 2;
      const ext = format === "jpeg" ? "jpg" : "png";
      const base = baseName(files[0].name);
      const out: { name: string; blob: Blob }[] = [];

      for (let i = 0; i < list.length; i++) {
        step(`Sayfa ${i + 1}/${list.length} çiziliyor`);
        const blob = await pageToBlob(doc, list[i] + 1, scale, format);
        out.push({
          name: `${base}-${String(list[i] + 1).padStart(2, "0")}.${ext}`,
          blob,
        });
      }

      const stats: Stat[] = [
        { label: "Sayfa", value: String(out.length) },
        { label: "Biçim", value: ext.toUpperCase() },
        { label: "Ölçek", value: `${scale}×` },
      ];

      if (out.length === 1) return outFile(out[0].name, out[0].blob, stats);
      step("ZIP hazırlanıyor");
      return outFile(`${base}-gorseller.zip`, await zipOf(out), stats);
    } finally {
      await destroy();
    }
  },

  /* ---------------------------------------------------------------- */
  /* pdf.js: metin katmanı.                                             */
  async metin({ files, opts, step }) {
    step("Metin motoru hazırlanıyor");
    const { openDoc, extractText } = await import("./lib/render");
    const bytes = new Uint8Array(await files[0].arrayBuffer());
    const { doc, destroy } = await openDoc(bytes);

    try {
      const total = doc.numPages;
      const range = s(opts, "aralik").trim();
      const pages = range ? parseRanges(range, total).map((i) => i + 1) : undefined;
      if (range && !pages?.length) throw new PdfError("Geçerli bir sayfa aralığı yaz.");

      const { text, emptyPages } = await extractText(doc, {
        separator: b(opts, "ayirici"),
        pages,
        onPage: (n, t) => step(`Sayfa ${n}/${t} okunuyor`),
      });

      if (!text.trim()) {
        throw new PdfError(
          "Bu PDF'te metin katmanı yok. Taranmış belgelerde metin görüntüdür, kopyalanamaz.",
        );
      }

      const blob = new Blob([text], { type: "text/plain;charset=utf-8" });
      const words = text.split(/\s+/).filter(Boolean).length;
      return outFile(
        `${baseName(files[0].name)}.txt`,
        blob,
        [
          { label: "Sayfa", value: String(pages?.length ?? total) },
          { label: "Kelime", value: String(words) },
          { label: "Karakter", value: String(text.length) },
        ],
        emptyPages.length
          ? `${emptyPages.length} sayfada metin katmanı yok (${emptyPages.slice(0, 4).join(", ")}${emptyPages.length > 4 ? "…" : ""}).`
          : undefined,
      );
    } finally {
      await destroy();
    }
  },
};

export const tools: Tool[] = catalog.map((meta) => {
  const run = impl[meta.id];
  if (!run) throw new Error(`Araç uygulaması eksik: ${meta.id}`);
  return { ...meta, run };
});

export const toolById = (id: string): Tool | undefined => tools.find((t) => t.id === id);
