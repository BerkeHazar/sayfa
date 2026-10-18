/**
 * Çizgi ikon seti — 20×20 ızgara, 1.4px kontur, kare uçlar.
 * Tek dosyada tutulur ki çizim dili tutarlı kalsın.
 */

const wrap = (body: string, size = 20, cls = "ticket__icon") =>
  `<svg class="${cls}" width="${size}" height="${size}" viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linecap="square" stroke-linejoin="miter" aria-hidden="true">${body}</svg>`;

export const icons: Record<string, string> = {
  /* --- araçlar --- */
  merge: wrap(
    `<rect x="3.2" y="4" width="5.6" height="12"/><rect x="11.2" y="4" width="5.6" height="12"/><path d="M9.4 10h1.2"/>`,
  ),
  split: wrap(
    `<rect x="4.6" y="3" width="10.8" height="14"/><path d="M10 3v14" stroke-dasharray="2 2"/>`,
  ),
  rotate: wrap(`<path d="M4.6 11.2A5.6 5.6 0 1 0 6.4 6.1"/><path d="M4.2 3.4v3.2h3.2"/>`),
  remove: wrap(
    `<rect x="4.2" y="3" width="11.6" height="14"/><path d="M7.8 8.2l4.4 4.4M12.2 8.2l-4.4 4.4"/>`,
  ),
  organize: wrap(
    `<rect x="3.4" y="3.4" width="5.4" height="5.4"/><rect x="11.2" y="3.4" width="5.4" height="5.4"/><rect x="3.4" y="11.2" width="5.4" height="5.4"/><rect x="11.2" y="11.2" width="5.4" height="5.4"/>`,
  ),
  watermark: wrap(
    `<rect x="3.4" y="3.4" width="13.2" height="13.2"/><path d="M6 14L14 6M8.6 14.6L15 8.2"/>`,
  ),
  number: wrap(`<path d="M7.4 3.6L6 16.4M13.4 3.6L12 16.4M3.6 7.6h13M3 12.6h13"/>`),
  images: wrap(
    `<rect x="2.8" y="4.4" width="14.4" height="11.2"/><circle cx="7" cy="8" r="1.2"/><path d="M3 13.2l4-4 3.4 3.4 2.6-2.6 4 4"/>`,
  ),
  meta: wrap(`<path d="M3.4 3.4h6.2l7 7-6.2 6.2-7-7z"/><circle cx="7" cy="7" r="1.1"/>`),
  info: wrap(`<circle cx="10" cy="10" r="7"/><path d="M10 9v5M10 6.4v.2"/>`),
  compress: wrap(
    `<rect x="3.2" y="3.2" width="13.6" height="13.6"/><path d="M6.4 10h7.2"/><path d="M8.8 7.4L6.4 10l2.4 2.6"/><path d="M11.2 7.4L13.6 10l-2.4 2.6"/>`,
  ),

  imza: wrap(
    `<path d="M3.6 16.4l1.3-4.5 8.7-8.7 3.2 3.2-8.7 8.7z"/><path d="M11.2 5.6l3.2 3.2"/><path d="M3.6 16.4l4.4-1.2"/>`,
  ),
  resim: wrap(
    `<path d="M4.6 2.6h7.2l4 4v10.8H4.6z"/><path d="M11.6 2.6v4h4"/><circle cx="8.4" cy="10.2" r="1.1"/><path d="M5.6 15.4l2.8-2.8 2 2 1.4-1.4 1.8 1.8"/>`,
  ),
  metin: wrap(
    `<path d="M4.6 2.6h7.2l4 4v10.8H4.6z"/><path d="M11.6 2.6v4h4"/><path d="M7 9.4h6M7 12h6M7 14.6h3.6"/>`,
  ),

  kirp: wrap(
    `<path d="M6.4 2.4v13.2h13.2"/><path d="M2.4 6.4h13.2v13.2" stroke-dasharray="2 2"/>`,
  ),
  damga: wrap(
    `<path d="M6.4 13.4h7.2v3.2H6.4z"/><path d="M7.6 13.4V9.2a2.4 2.4 0 014.8 0v4.2"/><path d="M4 18.6h12"/>`,
  ),

  /* --- adımlar --- */
  trayDown: wrap(
    `<path d="M10 2.6v8.2M6.2 7.4L10 11.2l3.8-3.8"/><path d="M2.8 12.4v3.4a1.4 1.4 0 001.4 1.4h11.6a1.4 1.4 0 001.4-1.4v-3.4"/>`,
  ),
  sliders: wrap(
    `<path d="M3 5.6h9M15 5.6h2M3 14.4h2M8 14.4h9"/><circle cx="13.2" cy="5.6" r="1.8"/><circle cx="6.2" cy="14.4" r="1.8"/>`,
  ),

  /* --- arayüz --- */
  close: wrap(`<path d="M5 5l10 10M15 5L5 15"/>`, 16),
  check: wrap(`<path d="M4 10.4l3.6 3.6L16 5.4"/>`, 16),
  checkBig: wrap(
    `<circle cx="10" cy="10" r="7.4"/><path d="M6.6 10.2l2.4 2.4 4.6-4.8"/>`,
    18,
    "result__icon",
  ),
  trash: wrap(`<path d="M4 6h12M8 6V4h4v2M6 6l.8 10h6.4L14 6"/>`, 16),
  up: wrap(`<path d="M10 15V5M5.6 9.4L10 5l4.4 4.4"/>`, 16),
  down: wrap(`<path d="M10 5v10M5.6 10.6L10 15l4.4-4.4"/>`, 16),
  plus: wrap(`<path d="M10 4v12M4 10h12"/>`, 16),
  download: wrap(`<path d="M10 3.4v9M6 8.8l4 4 4-4M4 16.2h12"/>`, 18),
  lock: wrap(
    `<rect x="4.4" y="8.6" width="11.2" height="8"/><path d="M7 8.6V6.4a3 3 0 016 0v2.2"/>`,
    14,
  ),
  arrowLeft: wrap(`<path d="M16 10H4M8.6 5.4L4 10l4.6 4.6"/>`, 16),
  reverse: wrap(`<path d="M4 7h9.5l-2.6-2.6M16 13H6.5l2.6 2.6"/>`, 16),
  sun: wrap(
    `<circle cx="10" cy="10" r="3.4"/><path d="M10 1.8v2M10 16.2v2M1.8 10h2M16.2 10h2M4.2 4.2l1.4 1.4M14.4 14.4l1.4 1.4M15.8 4.2l-1.4 1.4M5.6 14.4l-1.4 1.4"/>`,
    18,
    "theme-btn__icon",
  ),
  moon: wrap(
    `<path d="M16.2 12.4A6.8 6.8 0 017.6 3.8 7 7 0 1016.2 12.4z"/>`,
    18,
    "theme-btn__icon",
  ),
  filePlus: wrap(
    `<path d="M4.4 2.6h7.2l4 4v10.8H4.4z"/><path d="M11.6 2.6v4h4"/><path d="M10 10v4.4M7.8 12.2h4.4"/>`,
    26,
    "stage__icon",
  ),
};

/**
 * GitHub işareti — marka logosu olduğu için dolu çizilir.
 * Diğer ikonlar 1.4px konturla çiziliyor; logo o dile sokulunca tanınmıyor.
 */
export const githubMark = `<svg class="theme-btn__icon" width="17" height="17" viewBox="0 0 16 16" fill="currentColor" aria-hidden="true"><path d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82.64-.18 1.32-.27 2-.27.68 0 1.36.09 2 .27 1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.013 8.013 0 0016 8c0-4.42-3.58-8-8-8z"/></svg>`;

/** Marka işareti: kıvrık köşeli kâğıt + sinyal noktası. */
export const brandMark = `<svg class="brand__mark" viewBox="0 0 22 26" fill="none" aria-hidden="true">
  <path d="M1 1h13.4L21 7.6V25H1z" stroke="currentColor" stroke-width="1.6"/>
  <path d="M14.4 1v6.6H21" stroke="currentColor" stroke-width="1.6"/>
  <path d="M5 12h9M5 16h9M5 20h5" stroke="currentColor" stroke-width="1.4" opacity=".45"/>
  <rect x="15.6" y="17.4" width="5" height="5" fill="#E23A22"/>
</svg>`;
