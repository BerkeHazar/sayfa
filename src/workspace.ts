import type { PDFDocument } from "pdf-lib";
import { githubMark, icons } from "./icons";
import { onDispose } from "./lifecycle";
import { fmtBytes } from "./lib/format";
import { PdfError, download, loadPdf } from "./lib/pdf";
import { announce, toast } from "./motion";
import type { Opt, OptValue, Tool, ToolOutput } from "./catalog";
import { syncTheme } from "./theme";

const esc = (s: string): string =>
  s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

const isPdf = (f: File) => f.type === "application/pdf" || /\.pdf$/i.test(f.name);
const isImage = (f: File) => f.type.startsWith("image/") || /\.(png|jpe?g|webp|avif|gif)$/i.test(f.name);

interface State {
  files: File[];
  docs: PDFDocument[];
  selected: Set<number>;
  order: number[];
  opts: Record<string, OptValue>;
  result: ToolOutput | null;
  busy: boolean;
  loading: boolean;
  step: string;
  /** Sıralama modunda seçili sayfanın konumu (dokunmatik için). */
  picked: number | null;
}

export function renderWorkspace(root: HTMLElement, tool: Tool, incoming: File[]): void {
  const state: State = {
    files: [],
    docs: [],
    selected: new Set(),
    order: [],
    opts: Object.fromEntries(tool.opts.map((o) => [o.id, o.value])),
    result: null,
    busy: false,
    loading: false,
    step: "hazırlanıyor",
    picked: null,
  };

  root.innerHTML = `
    <div class="ws">
      <header class="ws__bar">
        <a class="ws__back" href="#/" aria-label="Araçlara dön">${icons.arrowLeft}<span>araçlar</span></a>
        <div class="ws__id">
          <span class="mono">${tool.num}</span>
          <h1>${tool.title}</h1>
        </div>
        <div class="ws__bar-right">
          <span class="ws__count mono" id="wscount"></span>
          <button class="ws__reset" type="button" id="wsreset">sıfırla</button>
          <a class="icon-btn theme-btn" href="https://github.com/BerkeHazar/sayfa"
            target="_blank" rel="noopener" title="github.com/BerkeHazar/sayfa"
            aria-label="GitHub deposu — yeni sekmede açılır">${githubMark}</a>
          <button class="icon-btn theme-btn" type="button" data-theme-toggle
            aria-label="Karanlık moda geç"></button>
        </div>
      </header>

      <div class="ws__body">
        <section class="ws__stage" id="stage" aria-label="Dosyalar" tabindex="-1"></section>

        <aside class="ws__rail">
          <div class="rail__head">
            <h2>${tool.opts.length ? "ayarlar" : "işlem"}</h2>
            ${tool.opts.length ? `<span class="mono" id="optnote">${tool.opts.length} alan</span>` : ""}
          </div>
          <div class="rail__fields" id="fields">
            <p class="rail__intro">${tool.long}</p>
            ${tool.opts.map(fieldHtml).join("")}
          </div>
          <div class="rail__foot">
            <button class="btn btn--primary btn--block" type="button" id="run">
              ${tool.action} <span class="btn__arrow" aria-hidden="true">→</span>
            </button>
            <p class="rail__note mono">${tool.note}</p>
          </div>
        </aside>
      </div>
    </div>
  `;

  syncTheme();

  const stage = root.querySelector<HTMLElement>("#stage")!;
  const fields = root.querySelector<HTMLElement>("#fields")!;
  const runBtn = root.querySelector<HTMLButtonElement>("#run")!;
  const countEl = root.querySelector<HTMLElement>("#wscount")!;
  const resetBtn = root.querySelector<HTMLButtonElement>("#wsreset")!;

  /* ---------------- ayarlar ---------------- */

  const setOpt = (id: string, value: OptValue) => {
    state.opts[id] = value;
  };

  fields.addEventListener("input", (event) => {
    const el = event.target as HTMLInputElement;
    const id = el.dataset.opt;
    if (!id) return;
    const opt = tool.opts.find((o) => o.id === id);
    if (!opt) return;
    if (opt.kind === "toggle") setOpt(id, el.checked);
    else if (opt.kind === "number" || opt.kind === "range") setOpt(id, Number(el.value));
    else setOpt(id, el.value);

    if (opt.kind === "range") {
      const readout = fields.querySelector<HTMLElement>(`[data-val-for="${id}"]`);
      if (readout) readout.textContent = `${el.value}${opt.suffix ?? ""}`;
    }
  });

  fields.addEventListener("change", (event) => {
    const el = event.target as HTMLInputElement;
    if (el.type === "checkbox" && el.dataset.opt) setOpt(el.dataset.opt, el.checked);
  });

  fields.addEventListener("click", (event) => {
    const btn = (event.target as HTMLElement).closest<HTMLButtonElement>("[data-seg]");
    if (!btn) return;
    const id = btn.dataset.seg!;
    const value = btn.dataset.val!;
    setOpt(id, value);
    fields
      .querySelectorAll<HTMLButtonElement>(`[data-seg="${id}"]`)
      .forEach((b) => b.classList.toggle("is-on", b.dataset.val === value));
  });

  /* ---------------- dosya işlemleri ---------------- */

  const padOpts = tool.opts.filter((o) => o.kind === "pad");
  const imageOpts = tool.opts.filter((o) => o.kind === "image");

  const updateChrome = () => {
    countEl.textContent = state.files.length
      ? `${state.files.length} dosya`
      : tool.accept === "pdf"
        ? "pdf bekleniyor"
        : "görsel bekleniyor";
    const minFiles = tool.id === "birlestir" ? 2 : 1;
    const ready =
      padOpts.every((o) => String(state.opts[o.id] ?? "").startsWith("data:image/")) &&
      imageOpts.every((o) => String(state.opts[o.id] ?? "").startsWith("data:image/"));
    runBtn.disabled = state.files.length < minFiles || state.busy || !ready;
  };

  /* ---------------- sayfa küçük görselleri (pdf.js) ---------------- */

  let thumbDoc: import("./lib/render").RenderDoc | null = null;
  let thumbDestroy: (() => Promise<void>) | null = null;
  let thumbCache = new Map<number, string>();
  let thumbQueue: number[] = [];
  let thumbGen = 0;
  let thumbBusy = false;
  let thumbIO: IntersectionObserver | null = null;

  const resetThumbs = () => {
    thumbGen++;
    thumbQueue = [];
    thumbIO?.disconnect();
    thumbIO = null;
    if (thumbDestroy) void thumbDestroy();
    thumbDestroy = null;
    thumbDoc = null;
    thumbCache.clear();
  };

  const ensureThumbDoc = async () => {
    if (thumbDoc) return thumbDoc;
    const { openDoc } = await import("./lib/render");
    const bytes = new Uint8Array(await state.files[0].arrayBuffer());
    const opened = await openDoc(bytes);
    thumbDoc = opened.doc;
    thumbDestroy = opened.destroy;
    return thumbDoc;
  };

  const pumpThumbs = async (gen: number): Promise<void> => {
    if (thumbBusy) return;
    thumbBusy = true;
    try {
      const { pageThumb } = await import("./lib/render");
      const doc = await ensureThumbDoc();
      while (thumbQueue.length) {
        if (gen !== thumbGen) break;
        const idx = thumbQueue.shift();
        if (idx === undefined) break;
        try {
          const url = await pageThumb(doc, idx + 1, 220);
          thumbCache.set(idx, url);
          const holder = stage.querySelector<HTMLElement>(
            `.page[data-page="${idx}"] .page__thumb`,
          );
          if (holder) {
            holder.style.backgroundImage = `url("${url}")`;
            holder.classList.add("is-ready");
          }
        } catch {
          /* tek sayfa çizilemezse numaralı kart kalır */
        }
      }
    } catch {
      /* pdf.js yüklenemezse araç çalışmaya devam eder, kartlar numaralı kalır */
    }
    thumbBusy = false;
  };

  function setupThumbs(): void {
    if (!tool.thumbs || !state.files.length) return;
    const cards = Array.from(stage.querySelectorAll<HTMLElement>(".page[data-page]"));
    if (!cards.length) return;

    for (const card of cards) {
      const cached = thumbCache.get(Number(card.dataset.page));
      const holder = card.querySelector<HTMLElement>(".page__thumb");
      if (!cached || !holder) continue;
      holder.style.backgroundImage = `url("${cached}")`;
      holder.classList.add("is-ready");
    }

    thumbIO?.disconnect();
    const gen = thumbGen;
    thumbIO = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (!entry.isIntersecting) continue;
          thumbIO?.unobserve(entry.target);
          const idx = Number((entry.target as HTMLElement).dataset.page);
          if (!thumbCache.has(idx) && !thumbQueue.includes(idx)) thumbQueue.push(idx);
        }
        void pumpThumbs(gen);
      },
      { rootMargin: "400px 0px" },
    );
    for (const card of cards) {
      if (!thumbCache.has(Number(card.dataset.page))) thumbIO.observe(card);
    }
  }

  /* ---------------- görsel seçici (damga) ---------------- */

  function setupImagePicker(): void {
    const pick = fields.querySelector<HTMLElement>("[data-imgpick]");
    const input = fields.querySelector<HTMLInputElement>("[data-imgpick-input]");
    if (!pick || !input) return;
    const id = pick.dataset.imgpick ?? "";
    const img = pick.querySelector<HTMLImageElement>(".imgpick__prev");
    const empty = pick.querySelector<HTMLElement>(".imgpick__empty");
    const clear = pick.querySelector<HTMLButtonElement>("[data-imgpick-clear]");

    const paint = (url: string) => {
      if (!img || !empty || !clear) return;
      if (url) {
        img.src = url;
        img.hidden = false;
        empty.hidden = true;
        clear.hidden = false;
        pick.classList.add("is-set");
      } else {
        img.removeAttribute("src");
        img.hidden = true;
        empty.hidden = false;
        clear.hidden = true;
        pick.classList.remove("is-set");
      }
    };

    pick.addEventListener("click", (event) => {
      if ((event.target as HTMLElement).closest("[data-imgpick-clear]")) return;
      input.click();
    });

    input.addEventListener("change", () => {
      const file = input.files?.[0];
      if (!file) return;
      if (file.size > 4 * 1024 * 1024) {
        toast("Görsel 4 MB'tan büyük — daha küçüğünü dene.", "warn");
        input.value = "";
        return;
      }
      const reader = new FileReader();
      reader.onload = () => {
        const url = String(reader.result ?? "");
        state.opts[id] = url;
        paint(url);
        updateChrome();
      };
      reader.readAsDataURL(file);
    });

    clear?.addEventListener("click", (event) => {
      event.stopPropagation();
      state.opts[id] = "";
      input.value = "";
      paint("");
      updateChrome();
    });
  }

  /* ---------------- imza tahtası (Canvas 2D + Pointer Events) ---------------- */

  function setupPad(): void {
    const pad = fields.querySelector<HTMLElement>("[data-pad]");
    const canvas = pad?.querySelector<HTMLCanvasElement>(".pad__canvas");
    const clearBtn = fields.querySelector<HTMLButtonElement>("[data-pad-clear]");
    if (!pad || !canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const rect = pad.getBoundingClientRect();
    canvas.width = Math.max(1, Math.round(rect.width * dpr));
    canvas.height = Math.max(1, Math.round(rect.height * dpr));
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    ctx.strokeStyle = "#14120E";

    let drawing = false;
    let dirty = false;
    let last: { x: number; y: number } | null = null;

    const at = (e: PointerEvent) => {
      const box = canvas.getBoundingClientRect();
      return {
        x: e.clientX - box.left,
        y: e.clientY - box.top,
        p: e.pressure > 0 ? e.pressure : 0.5,
      };
    };

    const stroke = (a: { x: number; y: number }, b: { x: number; y: number }, p: number) => {
      ctx.beginPath();
      ctx.lineWidth = 1.1 + p * 2.6;
      ctx.moveTo(a.x, a.y);
      ctx.lineTo(b.x, b.y);
      ctx.stroke();
    };

    canvas.addEventListener("pointerdown", (e) => {
      e.preventDefault();
      canvas.setPointerCapture(e.pointerId);
      drawing = true;
      const p = at(e);
      stroke({ x: p.x - 0.01, y: p.y - 0.01 }, p, p.p);
      last = p;
    });

    canvas.addEventListener("pointermove", (e) => {
      if (!drawing) return;
      e.preventDefault();
      const points =
        typeof e.getCoalescedEvents === "function" ? e.getCoalescedEvents() : [e];
      for (const raw of points) {
        const p = at(raw as PointerEvent);
        if (last) stroke(last, p, p.p);
        last = p;
      }
      dirty = true;
      pad.classList.add("is-dirty");
    });

    const finish = () => {
      if (!drawing) return;
      drawing = false;
      last = null;
      if (!dirty) return;
      const url = trimmedPng(canvas, ctx);
      if (!url) return;
      state.opts.imza = url;
      pad.classList.add("is-signed");
      updateChrome();
    };
    canvas.addEventListener("pointerup", finish);
    canvas.addEventListener("pointercancel", finish);
    canvas.addEventListener("pointerleave", finish);

    clearBtn?.addEventListener("click", () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      dirty = false;
      state.opts.imza = "";
      pad.classList.remove("is-dirty", "is-signed");
      updateChrome();
    });
  }

  const ensureDocs = async (): Promise<PDFDocument[]> => {
    if (state.docs.length) return state.docs;
    state.docs = await Promise.all(state.files.map((f) => loadPdf(f)));
    return state.docs;
  };

  const refresh = async () => {
    if (tool.pages !== "none" && state.files.length) {
      state.loading = true;
      renderStage();
      try {
        const docs = await ensureDocs();
        if (!state.order.length) state.order = docs[0].getPageIndices();
      } catch (err) {
        toast(err instanceof PdfError ? err.message : "Dosya okunamadı.", "warn");
        state.files = [];
        state.docs = [];
      }
      state.loading = false;
    }
    updateChrome();
    renderStage();
  };

  const addFiles = (incomingFiles: File[]) => {
    const accept = tool.accept === "pdf" ? isPdf : isImage;
    const valid = incomingFiles.filter(accept);
    if (!valid.length) {
      toast(tool.accept === "pdf" ? "Bu araç PDF bekliyor." : "Bu araç görsel bekliyor.", "warn");
      return;
    }
    if (valid.length !== incomingFiles.length) {
      toast("Bu araca uymayan dosyalar atlandı.", "warn");
    }
    state.files = tool.multi ? [...state.files, ...valid] : valid.slice(0, 1);
    state.docs = [];
    state.selected.clear();
    state.order = [];
    state.result = null;
    resetThumbs();
    void refresh();
  };

  const reset = () => {
    state.files = [];
    state.docs = [];
    state.selected.clear();
    state.order = [];
    state.result = null;
    resetThumbs();
    updateChrome();
    renderStage();
  };

  /* ---------------- çalıştırma ---------------- */

  const run = async () => {
    state.busy = true;
    state.result = null;
    state.step = "hazırlanıyor";
    updateChrome();
    renderStage();

    try {
      const docs = tool.accept === "pdf" ? await ensureDocs() : [];
      const result = await tool.run({
        files: state.files,
        docs,
        opts: state.opts,
        order: state.order,
        selected: state.selected,
        step: (label) => {
          state.step = label;
          const el = stage.querySelector<HTMLElement>("#busyLabel");
          if (el) el.textContent = label;
        },
      });
      state.result = result;
      announce(result.kind === "file" ? "İşlem tamamlandı, dosya hazır." : "Belge okundu.");
    } catch (err) {
      const message =
        err instanceof PdfError
          ? err.message
          : err instanceof Error
            ? err.message
            : "Beklenmeyen bir hata oldu.";
      toast(message, "warn");
      state.result = null;
    }

    state.busy = false;
    updateChrome();
    renderStage();
  };

  /* ---------------- sahne ---------------- */

  function renderStage(): void {
    if (state.result) {
      stage.innerHTML = resultHtml(state.result);
      bindResult(state.result);
      return;
    }
    if (state.busy) {
      stage.innerHTML = `
        <div class="busy">
          <p class="busy__label" id="busyLabel">${esc(state.step)}</p>
          <div class="busy__track"><div class="busy__bar"></div></div>
          <p class="mono">dosya cihazından çıkmıyor</p>
        </div>`;
      return;
    }
    if (!state.files.length) {
      stage.innerHTML = emptyHtml();
      bindEmpty();
      return;
    }
    if (tool.pages !== "none") {
      stage.innerHTML = state.loading ? loadingHtml() : pagesHtml();
      if (!state.loading) bindPages();
      return;
    }
    stage.innerHTML = filesHtml();
    bindFiles();
  }

  function emptyHtml(): string {
    return `
      <div class="stage__drop" id="stagedrop" role="button" tabindex="0">
        ${icons.filePlus}
        <strong>${tool.accept === "pdf" ? "PDF ekle" : "Görsel ekle"}</strong>
        <span>sürükle ya da tıkla · ${tool.multi ? "birden fazla dosya olabilir" : "tek dosya"}</span>
      </div>
      <input type="file" id="stagefile" hidden
        accept="${tool.accept === "pdf" ? ".pdf,application/pdf" : "image/*"}"
        ${tool.multi ? "multiple" : ""} />`;
  }

  function loadingHtml(): string {
    return `
      <div class="busy">
        <p class="busy__label">sayfalar okunuyor</p>
        <div class="busy__track"><div class="busy__bar"></div></div>
        <p class="mono">${state.files.length} dosya</p>
      </div>`;
  }

  function filesHtml(): string {
    return `
      <div class="stage__head">
        <p class="mono">dosyalar</p>
        <p class="mono">${state.files.length} adet · ${fmtBytes(
          state.files.reduce((sum, f) => sum + f.size, 0),
        )}</p>
      </div>
      <div class="files">
        ${state.files
          .map(
            (f, i) => `
          <div class="file">
            <span class="file__no">${String(i + 1).padStart(2, "0")}</span>
            <div class="file__meta">
              <div class="file__name" title="${esc(f.name)}">${esc(f.name)}</div>
              <div class="file__sub">${fmtBytes(f.size)}</div>
            </div>
            ${
              tool.multi && state.files.length > 1
                ? `<div class="file__move">
                     <button class="icon-btn" type="button" data-move="up" data-i="${i}"
                       ${i === 0 ? "disabled" : ""} aria-label="Yukarı taşı">${icons.up}</button>
                     <button class="icon-btn" type="button" data-move="down" data-i="${i}"
                       ${i === state.files.length - 1 ? "disabled" : ""} aria-label="Aşağı taşı">${icons.down}</button>
                   </div>`
                : `<div></div>`
            }
            <button class="icon-btn icon-btn--danger" type="button" data-remove="${i}"
              aria-label="${esc(f.name)} dosyasını kaldır">${icons.close}</button>
          </div>`,
          )
          .join("")}
      </div>
      ${
        tool.multi
          ? `<button class="file-add" type="button" id="addmore">
               <span class="mono">+ dosya ekle</span>
             </button>
             <input type="file" id="addinput" hidden
               accept="${tool.accept === "pdf" ? ".pdf,application/pdf" : "image/*"}" multiple />`
          : ""
      }`;
  }

  function pagesHtml(): string {
    const doc = state.docs[0];
    if (!doc) return loadingHtml();
    const total = doc.getPageCount();
    const reorder = tool.pages === "reorder";
    const sequence = reorder && state.order.length === total ? state.order : doc.getPageIndices();

    const head = reorder
      ? `<p class="mono">sayfalar · sürükle ya da seç</p>
         <p class="mono">
           <button class="mini-btn" type="button" id="move-left"
             ${state.picked === null || state.picked === 0 ? "disabled" : ""}
             aria-label="Sola taşı">←</button>
           <button class="mini-btn" type="button" id="move-right"
             ${state.picked === null || state.picked === sequence.length - 1 ? "disabled" : ""}
             aria-label="Sağa taşı">→</button>
           <button class="mini-btn" type="button" id="reverse">${icons.reverse} ters çevir</button>
         </p>`
      : `<p class="mono">sayfalar · ${
          state.selected.size ? `${state.selected.size} seçili` : `${total} sayfa`
        }</p>
         <p class="mono">
           <button class="mini-btn" type="button" id="selectall">tümü</button>
           <button class="mini-btn" type="button" id="selectnone">hiçbiri</button>
         </p>`;

    const chips = sequence
      .map((original, pos) => {
        const on = reorder ? state.picked === pos : state.selected.has(original);
        const dim = !reorder && state.selected.size > 0 && !on;
        return `<button class="page${on ? " is-on" : ""}${dim ? " is-dim" : ""}"
          type="button" data-page="${original}" data-pos="${pos}"
          ${reorder ? 'draggable="true"' : ""}
          aria-pressed="${on}" aria-label="Sayfa ${original + 1}">
          <span class="page__thumb" data-thumb="${original}"></span>
          <span class="page__no">${original + 1}</span>
        </button>`;
      })
      .join("");

    return `<div class="stage__head">${head}</div><div class="pages" id="pages">${chips}</div>`;
  }

  function bindEmpty(): void {
    const drop = stage.querySelector<HTMLElement>("#stagedrop");
    const input = stage.querySelector<HTMLInputElement>("#stagefile");
    if (!drop || !input) return;

    const open = () => input.click();
    drop.addEventListener("click", open);
    drop.addEventListener("keydown", (e) => {
      if (e.key === "Enter" || e.key === " ") {
        e.preventDefault();
        open();
      }
    });
    input.addEventListener("change", () => {
      if (input.files?.length) addFiles(Array.from(input.files));
    });

    let depth = 0;
    drop.addEventListener("dragenter", (e) => {
      e.preventDefault();
      depth++;
      drop.classList.add("is-over");
    });
    drop.addEventListener("dragover", (e) => {
      e.preventDefault();
      if (e.dataTransfer) e.dataTransfer.dropEffect = "copy";
    });
    drop.addEventListener("dragleave", () => {
      depth = Math.max(0, depth - 1);
      if (!depth) drop.classList.remove("is-over");
    });
    drop.addEventListener("drop", (e) => {
      e.preventDefault();
      depth = 0;
      drop.classList.remove("is-over");
      const files = Array.from(e.dataTransfer?.files ?? []);
      if (files.length) addFiles(files);
    });
  }

  function bindFiles(): void {
    stage.querySelectorAll<HTMLButtonElement>("[data-remove]").forEach((btn) => {
      btn.addEventListener("click", () => {
        const i = Number(btn.dataset.remove);
        state.files.splice(i, 1);
        state.docs = [];
        state.selected.clear();
        state.order = [];
        updateChrome();
        void refresh();
      });
    });

    const moreBtn = stage.querySelector<HTMLButtonElement>("#addmore");
    const moreInput = stage.querySelector<HTMLInputElement>("#addinput");
    moreBtn?.addEventListener("click", () => moreInput?.click());
    moreInput?.addEventListener("change", () => {
      if (moreInput.files?.length) addFiles(Array.from(moreInput.files));
    });

    stage.querySelectorAll<HTMLButtonElement>("[data-move]").forEach((btn) => {
      btn.addEventListener("click", () => {
        const i = Number(btn.dataset.i);
        const to = btn.dataset.move === "up" ? i - 1 : i + 1;
        if (to < 0 || to >= state.files.length) return;
        const [item] = state.files.splice(i, 1);
        state.files.splice(to, 0, item);
        state.docs = [];
        updateChrome();
        renderStage();
      });
    });
  }

  function bindPages(): void {
    const pages = stage.querySelector<HTMLElement>("#pages");
    if (!pages) return;
    const reorder = tool.pages === "reorder";

    stage.querySelector("#selectall")?.addEventListener("click", () => {
      const doc = state.docs[0];
      state.selected = new Set(doc.getPageIndices());
      renderStage();
    });
    stage.querySelector("#selectnone")?.addEventListener("click", () => {
      state.selected.clear();
      renderStage();
    });
    stage.querySelector("#reverse")?.addEventListener("click", () => {
      state.order = [...state.order].reverse();
      state.picked = null;
      renderStage();
    });

    const movePicked = (delta: number) => {
      const from = state.picked;
      if (from === null) return;
      const to = from + delta;
      if (to < 0 || to >= state.order.length) return;
      const [item] = state.order.splice(from, 1);
      state.order.splice(to, 0, item);
      state.picked = to;
      renderStage();
      stage.querySelector<HTMLElement>(`.page[data-pos="${to}"]`)?.focus();
    };
    stage.querySelector("#move-left")?.addEventListener("click", () => movePicked(-1));
    stage.querySelector("#move-right")?.addEventListener("click", () => movePicked(1));

    setupThumbs();

    if (!reorder) {
      pages.querySelectorAll<HTMLButtonElement>(".page").forEach((chip) => {
        chip.addEventListener("click", () => {
          const page = Number(chip.dataset.page);
          if (state.selected.has(page)) state.selected.delete(page);
          else state.selected.add(page);
          renderStage();
        });
      });
      return;
    }

    /* sürükle-bırak sıralama */
    let dragFrom = -1;
    pages.querySelectorAll<HTMLElement>(".page").forEach((chip) => {
      const pos = Number(chip.dataset.pos);

      chip.addEventListener("dragstart", (e) => {
        dragFrom = pos;
        chip.classList.add("is-dragging");
        e.dataTransfer?.setData("text/plain", String(pos));
        if (e.dataTransfer) e.dataTransfer.effectAllowed = "move";
      });
      chip.addEventListener("dragend", () => {
        chip.classList.remove("is-dragging");
        pages.querySelectorAll(".is-dropzone").forEach((c) => c.classList.remove("is-dropzone"));
      });
      chip.addEventListener("dragover", (e) => {
        e.preventDefault();
        chip.classList.add("is-dropzone");
      });
      chip.addEventListener("dragleave", () => chip.classList.remove("is-dropzone"));
      chip.addEventListener("drop", (e) => {
        e.preventDefault();
        chip.classList.remove("is-dropzone");
        if (dragFrom < 0) return;
        const item = state.order.splice(dragFrom, 1)[0];
        state.order.splice(pos, 0, item);
        dragFrom = -1;
        renderStage();
      });

      // Dokunmatikte sürükleme yok: dokun → seç, sonra ← → ile taşı.
      chip.addEventListener("click", () => {
        state.picked = state.picked === pos ? null : pos;
        renderStage();
      });

      chip.addEventListener("keydown", (e) => {
        if (e.key !== "ArrowLeft" && e.key !== "ArrowRight") return;
        e.preventDefault();
        state.picked = pos;
        const to = pos + (e.key === "ArrowLeft" ? -1 : 1);
        if (to < 0 || to >= state.order.length) return;
        const item = state.order.splice(pos, 1)[0];
        state.order.splice(to, 0, item);
        state.picked = to;
        renderStage();
        stage.querySelector<HTMLElement>(`.page[data-pos="${to}"]`)?.focus();
      });
    });
  }

  function resultHtml(result: ToolOutput): string {
    const heading = result.kind === "file" ? "hazır." : "belge okundu.";
    return `
      <div class="result">
        <div class="result__top">
          ${icons.checkBig}
          <span class="mono">${result.kind === "file" ? "işlem tamam" : "inceleme"}</span>
        </div>
        <h2 tabindex="-1">${heading}</h2>
        ${result.note ? `<p>${esc(result.note)}</p>` : ""}
        <dl class="result__stats">
          ${result.stats
            .map(
              (s) => `<div class="result__stat"><dt>${esc(s.label)}</dt><dd title="${esc(
                s.value,
              )}">${esc(s.value)}</dd></div>`,
            )
            .join("")}
        </dl>
        <div class="result__actions">
          ${
            result.kind === "file" && result.blob && result.name
              ? `<button class="btn btn--primary" type="button" id="dl">
                   İndir ${icons.download}
                 </button>`
              : ""
          }
          ${
            canSaveAs() && result.kind === "file"
              ? `<button class="btn btn--ghost" type="button" id="saveas">Farklı kaydet…</button>`
              : ""
          }
          <button class="btn btn--ghost" type="button" id="again">Yeni iş</button>
        </div>
      </div>`;
  }

  function bindResult(result: ToolOutput): void {
    stage.querySelector<HTMLElement>(".result h2")?.focus({ preventScroll: true });
    stage.querySelector("#dl")?.addEventListener("click", () => {
      if (result.blob && result.name) download(result.blob, result.name);
    });
    stage.querySelector("#saveas")?.addEventListener("click", () => {
      if (result.blob && result.name) void saveAs(result.blob, result.name);
    });
    stage.querySelector("#again")?.addEventListener("click", () => {
      reset();
      stage.querySelector<HTMLElement>("#stagedrop")?.focus();
    });
  }

  /* ---------------- bağla ---------------- */

  runBtn.addEventListener("click", () => void run());
  resetBtn.addEventListener("click", reset);
  // Sahnenin herhangi bir yerine dosya bırakma (liste doluyken de çalışır).
  let dragDepth = 0;
  const hasFiles = (e: DragEvent) => Array.from(e.dataTransfer?.types ?? []).includes("Files");
  stage.addEventListener("dragenter", (e) => {
    if (!hasFiles(e)) return;
    dragDepth++;
    stage.classList.add("is-dropping");
  });
  stage.addEventListener("dragover", (e) => {
    if (!hasFiles(e)) return;
    e.preventDefault();
    if (e.dataTransfer) e.dataTransfer.dropEffect = "copy";
  });
  stage.addEventListener("dragleave", () => {
    dragDepth = Math.max(0, dragDepth - 1);
    if (!dragDepth) stage.classList.remove("is-dropping");
  });
  stage.addEventListener("drop", (e) => {
    if (!e.dataTransfer?.files.length) return;
    e.preventDefault();
    dragDepth = 0;
    stage.classList.remove("is-dropping");
    // Boş durumdaki kendi alanı zaten hallediyor; iki kez eklenmesin.
    if ((e.target as HTMLElement).closest("#stagedrop")) return;
    addFiles(Array.from(e.dataTransfer.files));
  });

  onDispose(resetThumbs);

  updateChrome();
  renderStage();
  setupPad();
  setupImagePicker();

  if (incoming.length) addFiles(incoming);
}

/* ------------------------------------------------------------------ */
/* Ayar alanı üreteci                                                  */
/* ------------------------------------------------------------------ */

function fieldHtml(o: Opt): string {
  const id = `f-${o.id}`;
  const hint = o.hint ? `<p class="field__hint">${esc(o.hint)}</p>` : "";
  const labelTag = o.hintLabel ? `<span class="hintlabel">${esc(o.hintLabel)}</span>` : "";

  switch (o.kind) {
    case "text":
      return `<div class="field">
        <div class="field__label"><label for="${id}">${esc(o.label)}</label>${labelTag}</div>
        <input class="input" id="${id}" data-opt="${o.id}" type="text"
          value="${esc(String(o.value))}" placeholder="${esc(o.placeholder ?? "")}" />
        ${hint}
      </div>`;

    case "number":
      return `<div class="field">
        <div class="field__label"><label for="${id}">${esc(o.label)}</label>${labelTag}</div>
        <input class="input" id="${id}" data-opt="${o.id}" type="number"
          value="${esc(String(o.value))}" min="${o.min ?? 0}" max="${o.max ?? 9999}"
          step="${o.step ?? 1}" />
        ${hint}
      </div>`;

    case "select":
      return `<div class="field">
        <div class="field__label"><label for="${id}">${esc(o.label)}</label>${labelTag}</div>
        <select class="input" id="${id}" data-opt="${o.id}">
          ${(o.options ?? [])
            .map(
              (op) =>
                `<option value="${esc(op.value)}" ${op.value === o.value ? "selected" : ""}>${esc(
                  op.label,
                )}</option>`,
            )
            .join("")}
        </select>
        ${hint}
      </div>`;

    case "segment":
      return `<div class="field">
        <div class="field__label"><span>${esc(o.label)}</span>${labelTag}</div>
        <div class="seg" role="group" aria-label="${esc(o.label)}">
          ${(o.options ?? [])
            .map(
              (op) => `<button class="seg__btn${op.value === o.value ? " is-on" : ""}" type="button"
                data-seg="${o.id}" data-val="${esc(op.value)}"
                aria-pressed="${op.value === o.value}">${esc(op.label)}</button>`,
            )
            .join("")}
        </div>
        ${hint}
      </div>`;

    case "toggle":
      return `<div class="field">
        <label class="switch">
          <input type="checkbox" data-opt="${o.id}" ${o.value ? "checked" : ""} />
          <span class="switch__track" aria-hidden="true"></span>
          <span>${esc(o.label)}</span>
        </label>
        ${hint}
      </div>`;

    case "range":
      return `<div class="field">
        <div class="field__label">
          <label for="${id}">${esc(o.label)}</label>
          <span class="range__val" data-val-for="${o.id}">${esc(String(o.value))}${esc(
            o.suffix ?? "",
          )}</span>
        </div>
        <input class="range" id="${id}" data-opt="${o.id}" type="range"
          value="${esc(String(o.value))}" min="${o.min ?? 0}" max="${o.max ?? 100}"
          step="${o.step ?? 1}" />
        ${hint}
      </div>`;

    case "image":
      return `<div class="field">
        <div class="field__label">
          <span>${esc(o.label)}</span>
          <span class="hintlabel">${esc(o.hintLabel ?? "png · jpg")}</span>
        </div>
        <div class="imgpick" data-imgpick="${o.id}">
          <img class="imgpick__prev" alt="" hidden />
          <span class="imgpick__empty mono">görsel seç</span>
          <button class="imgpick__clear" type="button" data-imgpick-clear hidden
            aria-label="Görseli kaldır">${icons.close}</button>
        </div>
        <input type="file" class="file-input" data-imgpick-input accept="image/png,image/jpeg" />
        ${hint}
      </div>`;

    case "pad":
      return `<div class="field">
        <div class="field__label">
          <span>${esc(o.label)}</span>
          <span class="hintlabel">${esc(o.hintLabel ?? "çiz")}</span>
        </div>
        <div class="pad" data-pad>
          <canvas class="pad__canvas"></canvas>
          <span class="pad__hint mono">imzala</span>
        </div>
        <div class="pad__actions">
          <button class="mini-btn" type="button" data-pad-clear>temizle</button>
        </div>
        ${hint}
      </div>`;
  }
}

/* ------------------------------------------------------------------ */
/* Yardımcılar                                                         */
/* ------------------------------------------------------------------ */

/** İmza tuvalini mürekkebin sınırlarına kırpar; boşsa "" döner. */
function trimmedPng(canvas: HTMLCanvasElement, ctx: CanvasRenderingContext2D): string {
  const { width, height } = canvas;
  if (!width || !height) return "";

  const data = ctx.getImageData(0, 0, width, height).data;
  let minX = width;
  let minY = height;
  let maxX = -1;
  let maxY = -1;

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      if (data[(y * width + x) * 4 + 3] < 10) continue;
      if (x < minX) minX = x;
      if (x > maxX) maxX = x;
      if (y < minY) minY = y;
      if (y > maxY) maxY = y;
    }
  }
  if (maxX < 0) return "";

  const pad = 4;
  minX = Math.max(0, minX - pad);
  minY = Math.max(0, minY - pad);
  maxX = Math.min(width - 1, maxX + pad);
  maxY = Math.min(height - 1, maxY + pad);

  const out = document.createElement("canvas");
  out.width = maxX - minX + 1;
  out.height = maxY - minY + 1;
  const octx = out.getContext("2d");
  if (!octx) return "";
  octx.drawImage(canvas, minX, minY, out.width, out.height, 0, 0, out.width, out.height);
  return out.toDataURL("image/png");
}

/** File System Access API varsa doğrudan diske yazar; yoksa indirir. */
const canSaveAs = (): boolean =>
  typeof (window as unknown as { showSaveFilePicker?: unknown }).showSaveFilePicker === "function";

async function saveAs(blob: Blob, name: string): Promise<void> {
  const picker = (
    window as unknown as {
      showSaveFilePicker?: (o?: { suggestedName?: string }) => Promise<FileSystemFileHandle>;
    }
  ).showSaveFilePicker;

  if (!picker) {
    download(blob, name);
    return;
  }
  try {
    const handle = await picker({ suggestedName: name });
    const writable = await handle.createWritable();
    await writable.write(blob);
    await writable.close();
    toast("Dosya kaydedildi.");
  } catch (err) {
    if ((err as DOMException)?.name === "AbortError") return;
    download(blob, name);
  }
}
