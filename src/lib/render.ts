/**
 * pdf.js katmanı — Mozilla'nın render motoru.
 *
 * pdf-lib yapısal işler için (sayfa kopyalama, döndürme, gömme) doğru araç;
 * ama sayfa *görüntülemek*, *metin okumak* ve *görsele çevirmek* için yanlış araç.
 * O üç iş burada, ayrı bir motorla ve ayrı bir worker'da yapılıyor.
 *
 * Not: `getDocument` verilen TypedArray'in sahipliğini alır (buffer'ı worker'a
 * transfer eder). Bu yüzden her zaman kopya geçiyoruz.
 */
import * as pdfjs from "pdfjs-dist";
import workerUrl from "pdfjs-dist/build/pdf.worker.mjs?url";
import type { PDFDocumentProxy } from "pdfjs-dist";

pdfjs.GlobalWorkerOptions.workerSrc = workerUrl;

export type RenderDoc = PDFDocumentProxy;

const MAX_DPR = 2;

export interface OpenedDoc {
  doc: RenderDoc;
  /** Worker'ı da kapatır; iş bitince mutlaka çağrılmalı. */
  destroy: () => Promise<void>;
}

export async function openDoc(bytes: Uint8Array): Promise<OpenedDoc> {
  const task = pdfjs.getDocument({ data: bytes.slice() });
  const doc = await task.promise;
  return { doc, destroy: () => task.destroy() };
}

/** Bir sayfayı hedef piksel genişliğinde tuvale çizer. */
async function paintPage(
  doc: RenderDoc,
  pageNumber: number,
  targetWidth: number,
): Promise<HTMLCanvasElement> {
  const page = await doc.getPage(pageNumber);
  const base = page.getViewport({ scale: 1 });
  const scale = Math.max(0.05, targetWidth / base.width);
  const viewport = page.getViewport({ scale });

  const canvas = document.createElement("canvas");
  canvas.width = Math.max(1, Math.floor(viewport.width));
  canvas.height = Math.max(1, Math.floor(viewport.height));

  await page.render({ canvas, viewport }).promise;
  page.cleanup();
  return canvas;
}

/** Küçük görsel için JPEG data URL üretir (bellekte tutulur, yeniden çizilmez). */
export async function pageThumb(
  doc: RenderDoc,
  pageNumber: number,
  width = 220,
): Promise<string> {
  const canvas = await paintPage(doc, pageNumber, width);
  const url = canvas.toDataURL("image/jpeg", 0.72);
  canvas.width = 0;
  canvas.height = 0;
  return url;
}

export type ImageFormat = "png" | "jpeg";

/** Sayfayı tam çözünürlükte görsele çevirir. */
export async function pageToBlob(
  doc: RenderDoc,
  pageNumber: number,
  scale: number,
  format: ImageFormat,
  quality = 0.9,
): Promise<Blob> {
  const page = await doc.getPage(pageNumber);
  const viewport = page.getViewport({ scale });
  const dpr = Math.min(window.devicePixelRatio || 1, MAX_DPR);

  const canvas = document.createElement("canvas");
  canvas.width = Math.max(1, Math.floor(viewport.width * dpr));
  canvas.height = Math.max(1, Math.floor(viewport.height * dpr));

  await page.render({
    canvas,
    viewport,
    transform: dpr === 1 ? undefined : [dpr, 0, 0, dpr, 0, 0],
  }).promise;
  page.cleanup();

  const blob = await new Promise<Blob | null>((resolve) =>
    canvas.toBlob(resolve, `image/${format}`, format === "jpeg" ? quality : undefined),
  );
  canvas.width = 0;
  canvas.height = 0;
  if (!blob) throw new Error("Sayfa görsele çevrilemedi.");
  return blob;
}

/**
 * Metin katmanını çıkarır. Satır sonları `hasEOL` ile, sayfa sonları
 * istenirse ayırıcı ile işaretlenir.
 */
export async function extractText(
  doc: RenderDoc,
  opts: { separator: boolean; pages?: number[]; onPage?: (page: number, total: number) => void },
): Promise<{ text: string; emptyPages: number[] }> {
  const parts: string[] = [];
  const emptyPages: number[] = [];
  const list = opts.pages?.length ? opts.pages : Array.from({ length: doc.numPages }, (_, i) => i + 1);

  for (const n of list) {
    opts.onPage?.(n, list.length);
    const page = await doc.getPage(n);
    const content = await page.getTextContent();

    let pageText = "";
    for (const item of content.items) {
      if (!("str" in item)) continue;
      pageText += item.str;
      if (item.hasEOL) pageText += "\n";
    }
    page.cleanup();

    const clean = pageText
      .replace(/[ \t]+/g, " ")
      .replace(/ *\n */g, "\n")
      .replace(/\n{3,}/g, "\n\n")
      .trim();

    if (!clean) emptyPages.push(n);
    parts.push(opts.separator ? `— sayfa ${n} —\n${clean}` : clean);
  }

  return { text: parts.join("\n\n"), emptyPages };
}
