import { PDFDocument, StandardFonts, rgb } from "pdf-lib";
import type { PDFFont } from "pdf-lib";
import fontkit from "@pdf-lib/fontkit";

export class PdfError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "PdfError";
  }
}

/** PDF'i RAM'e alır. Şifreli dosyada anlaşılır bir hata verir. */
export async function loadPdf(file: File): Promise<PDFDocument> {
  const bytes = new Uint8Array(await file.arrayBuffer());
  try {
    return await PDFDocument.load(bytes, { updateMetadata: false });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "";
    if (/encrypt/i.test(msg)) {
      throw new PdfError(
        `"${file.name}" şifreli. Önce şifreyi kaldırman gerekiyor — bu araç şifre çözmez.`,
      );
    }
    throw new PdfError(`"${file.name}" okunamadı. Bozuk ya da PDF olmayan bir dosya olabilir.`);
  }
}

/**
 * "1-3, 5, 8" gibi aralıkları 0 tabanlı sayfa indekslerine çevirir.
 * Geçersiz parçalar sessizce atlanır; sonuç sıralı ve tekildir.
 */
export function parseRanges(input: string, total: number): number[] {
  const out = new Set<number>();
  for (const raw of input.split(/[,;\s]+/)) {
    const part = raw.trim();
    if (!part) continue;

    const range = part.match(/^(\d+)\s*[-–]\s*(\d+)$/);
    if (range) {
      let a = Number(range[1]);
      let b = Number(range[2]);
      if (a > b) [a, b] = [b, a];
      for (let i = a; i <= b; i++) if (i >= 1 && i <= total) out.add(i - 1);
      continue;
    }

    const single = Number(part);
    if (Number.isInteger(single) && single >= 1 && single <= total) out.add(single - 1);
  }
  return [...out].sort((a, b) => a - b);
}

/** Aralık metnini insan diliyle özetler: "3 sayfa seçildi" */
export function describeRanges(input: string, total: number): string {
  const pages = parseRanges(input, total);
  if (pages.length === 0) return "geçerli sayfa yok";
  if (pages.length === total) return "tüm sayfalar";
  return `${pages.length} sayfa`;
}

let fontCache: ArrayBuffer | null | undefined;

/**
 * Türkçe karakterleri (ş, ğ, İ, ı) taşıyabilen gömülü yazı tipi.
 * Yüklenemezse null döner; çağıran taraf Helvetica'ya düşer.
 */
export async function loadTextFont(doc: PDFDocument): Promise<PDFFont | null> {
  if (fontCache === undefined) {
    try {
      const res = await fetch("./fonts/InstrumentSans-Regular.ttf");
      fontCache = res.ok ? await res.arrayBuffer() : null;
    } catch {
      fontCache = null;
    }
  }
  if (!fontCache) return null;

  try {
    doc.registerFontkit(fontkit);
    return await doc.embedFont(fontCache, { subset: true });
  } catch {
    return null;
  }
}

/** WinAnsi'da olmayan Türkçe harfleri sadeleştirir (yedek yol). */
export function winAnsiSafe(text: string): string {
  const map: Record<string, string> = {
    ş: "s", Ş: "S", ğ: "g", Ğ: "G", ı: "i", İ: "I",
    ç: "c", Ç: "C", ö: "o", Ö: "O", ü: "u", Ü: "U",
    â: "a", Â: "A", î: "i", Î: "I", û: "u", Û: "U",
  };
  return text.replace(/[şŞğĞıİçÇöÖüÜâÂîÎûÛ]/g, (c) => map[c] ?? c);
}

export async function standardFont(doc: PDFDocument): Promise<PDFFont> {
  return doc.embedFont(StandardFonts.Helvetica);
}

export const ink = (hex: string) => {
  const v = hex.replace("#", "");
  return rgb(
    parseInt(v.slice(0, 2), 16) / 255,
    parseInt(v.slice(2, 4), 16) / 255,
    parseInt(v.slice(4, 6), 16) / 255,
  );
};

export function download(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 4000);
}

/** data:image/png;base64,... → bayt dizisi */
export function dataUrlToBytes(dataUrl: string): Uint8Array {
  const base64 = dataUrl.slice(dataUrl.indexOf(",") + 1);
  const binary = atob(base64);
  const out = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) out[i] = binary.charCodeAt(i);
  return out;
}

export function baseName(name: string): string {
  return name.replace(/\.[^.]+$/, "");
}

/** JPEG/PNG dışındaki görselleri (webp, avif, gif…) PNG'ye çevirir. */
export async function toEmbeddableImage(
  file: File,
): Promise<{ bytes: Uint8Array; kind: "png" | "jpg" }> {
  const type = file.type;
  const bytes = new Uint8Array(await file.arrayBuffer());
  if (type === "image/jpeg" || /\.jpe?g$/i.test(file.name)) return { bytes, kind: "jpg" };
  if (type === "image/png" || /\.png$/i.test(file.name)) return { bytes, kind: "png" };

  const bitmap = await createImageBitmap(file);
  const canvas = document.createElement("canvas");
  canvas.width = bitmap.width;
  canvas.height = bitmap.height;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new PdfError(`"${file.name}" dönüştürülemedi.`);
  ctx.drawImage(bitmap, 0, 0);
  bitmap.close();
  const blob = await new Promise<Blob | null>((resolve) =>
    canvas.toBlob(resolve, "image/png"),
  );
  if (!blob) throw new PdfError(`"${file.name}" dönüştürülemedi.`);
  return { bytes: new Uint8Array(await blob.arrayBuffer()), kind: "png" };
}

/**
 * Görünen (ekrandaki) bir noktayı sayfa koordinatına çevirir.
 * /Rotate ile döndürülmüş sayfalarda içerik görsel olarak döner; bir öğeyi
 * "görsel olarak sol alt" köşeye koymak için bu ters eşleme gerekir.
 */
export function visualToPage(
  rot: number,
  width: number,
  height: number,
  vx: number,
  vy: number,
): { x: number; y: number } {
  if (rot === 90) return { x: width - vy, y: vx };
  if (rot === 180) return { x: width - vx, y: height - vy };
  if (rot === 270) return { x: vy, y: height - vx };
  return { x: vx, y: vy };
}

export const A4 = { w: 595.28, h: 841.89 };
export const MM = 2.834645669;
