import { brandMark, githubMark, icons } from "./icons";
import { MAX_BYTES, fmtBytes } from "./lib/format";
import { announce, reveal, toast } from "./motion";
import { setPending } from "./session";
import { syncTheme } from "./theme";
import { catalog } from "./catalog";

const isPdf = (f: File) => f.type === "application/pdf" || /\.pdf$/i.test(f.name);
const isImage = (f: File) => f.type.startsWith("image/") || /\.(png|jpe?g|webp|avif|gif)$/i.test(f.name);

export function renderLanding(root: HTMLElement): void {
  root.innerHTML = `
    <header class="topbar" id="topbar">
      <div class="shell topbar__in">
        <a class="brand" href="#/" aria-label="sayfa — ana sayfa">
          ${brandMark}
          <span class="brand__word">sayfa<span class="brand__dot">.</span></span>
        </a>

        <nav class="topnav" aria-label="Bölümler">
          <a href="#araclar">araçlar</a>
          <a href="#nasil">nasıl</a>
          <a href="#gizlilik">gizlilik</a>
        </nav>

        <div class="topbar__right">
          <a class="icon-btn theme-btn" href="https://github.com/BerkeHazar/sayfa"
            target="_blank" rel="noopener" title="github.com/BerkeHazar/sayfa"
            aria-label="GitHub deposu — yeni sekmede açılır">${githubMark}</a>
          <button class="icon-btn theme-btn" type="button" data-theme-toggle
            aria-label="Karanlık moda geç"></button>
          <a class="btn btn--sm btn--primary" href="#araclar">Araç seç</a>
        </div>
      </div>
    </header>

    <main id="main">
      <section class="hero">
        <div class="gridlines" aria-hidden="true"></div>
        <div class="shell hero__in">
          <div class="hero__copy">
            <p class="kicker hero__kicker">PDF araçları · ${catalog.length} adet · tarayıcı içi</p>
            <h1 class="display">pdf işleri<br /><em>tek sayfada</em><br />biter.</h1>
            <p class="lede">
              Birleştir, böl, döndür, filigran bas. Dosya tarayıcına girer,
              iş orada biter.
            </p>

            <div class="hero__actions">
              <label class="btn btn--primary" for="hero-file" id="hero-pick">
                Dosya seç <span class="btn__arrow" aria-hidden="true">→</span>
              </label>
              <a class="link" href="#araclar">${catalog.length} aracın hepsi</a>
            </div>

          </div>

          <div class="hero__drop">
            <div class="drop" id="drop" role="button" tabindex="0"
                 aria-label="PDF dosyası bırak veya seçmek için tıkla">
              <i class="crop crop--tl"></i><i class="crop crop--tr"></i>
              <i class="crop crop--bl"></i><i class="crop crop--br"></i>

              <div class="drop__head">
                <span class="mono">girdi · pdf</span>
                <span class="mono">bırak → araç seç</span>
              </div>

              <div class="drop__body">
                <div class="stack" aria-hidden="true"><span></span><span></span><span></span></div>
                <p class="drop__title">Dosyanı buraya bırak</p>
                <p class="drop__sub">ya da <u>bilgisayarından seç</u></p>
              </div>

              <div class="drop__foot">
                <span class="mono">birden fazla dosya olabilir</span>
              </div>
            </div>

          </div>
        </div>
      </section>

      <section class="sec" id="araclar">
        <div class="shell">
          <div class="sec__head">
            <h2 class="display-l">iş listesi</h2>
            <p class="mono">${catalog.length} araç / hepsi cihazında</p>
          </div>

          <div class="ticket" role="list">
            ${catalog
              .map(
                (tool, i) => `
              <a class="ticket__row" role="listitem" href="#/arac/${tool.id}"
                 data-reveal data-delay="${(i % 3) * 40}">
                <span class="ticket__no mono">${tool.num}</span>
                ${icons[mapIcon(tool.id)]}
                <span class="ticket__name">${tool.title}</span>
                <span class="ticket__desc">${tool.desc}</span>
                <span class="ticket__go" aria-hidden="true">→</span>
              </a>`,
              )
              .join("")}
          </div>
        </div>
      </section>

      <section class="sec" id="nasil">
        <div class="shell">
          <div class="sec__head">
            <h2 class="display-l">üç adım</h2>
            <p class="mono">bırak · ayarla · indir</p>
          </div>
          <div class="steps__in">
            <article class="step" data-reveal>
              <div class="step__top">
                <span class="step__no mono">01</span>
                <span class="step__rule" aria-hidden="true"></span>
                ${icons.trayDown}
              </div>
              <h3>Bırak</h3>
              <p>Dosyayı sürükle ya da seç. Birden fazla dosya olabilir; sırasını sonra değiştirirsin.</p>
            </article>
            <article class="step" data-reveal data-delay="60">
              <div class="step__top">
                <span class="step__no mono">02</span>
                <span class="step__rule" aria-hidden="true"></span>
                ${icons.sliders}
              </div>
              <h3>Ayarla</h3>
              <p>Aralık yaz, sayfa işaretle, açıyı çevir. Sonucu indirmeden önce ne olacağını görürsün.</p>
            </article>
            <article class="step" data-reveal data-delay="120">
              <div class="step__top">
                <span class="step__no mono">03</span>
                <span class="step__rule" aria-hidden="true"></span>
                ${icons.download}
              </div>
              <h3>İndir</h3>
              <p>İş bitince dosya iner. Birden fazla parça çıktıysa hepsi tek ZIP olarak gelir.</p>
            </article>
          </div>
        </div>
      </section>

      <section class="plate" id="gizlilik">
        <div class="shell plate__in">
          <div>
            <p class="kicker">gizlilik</p>
            <h2 class="display-l">dosyan<br />cihazından<br /><em>çıkmıyor.</em></h2>
            <p>
              Her araç, dosyayı tarayıcının kendi PDF motoruyla açıp yeniden yazıyor.
              Aradaki hiçbir adımda ağa çıkmıyor.
            </p>
          </div>

          <div class="counter">
            <div class="counter__row">
              <span class="mono">dış istek</span><b data-netcount>0</b>
            </div>
            <p class="counter__note mono">
              sayfa açıldığından beri. bir dosya işle, tekrar bak.
            </p>
          </div>
        </div>
      </section>
    </main>

    <footer class="foot">
      <div class="shell">
        <div class="foot__in">
          <div>
            <a class="brand" href="#/">
              ${brandMark}
              <span class="brand__word">sayfa<span class="brand__dot">.</span></span>
            </a>
            <p class="foot__note">
              PDF araçları. Tarayıcıda çalışır, dosyanı hiçbir yere göndermez.
              Açık kaynak, MIT.
            </p>
          </div>
          <div>
            <h4>Araçlar</h4>
            <ul>
              ${catalog
                .slice(0, 5)
                .map((t) => `<li><a href="#/arac/${t.id}">${t.title}</a></li>`)
                .join("")}
            </ul>
          </div>
          <div>
            <h4>Daha fazla</h4>
            <ul>
              <li><a href="#gizlilik">Gizlilik yaklaşımı</a></li>
              <li><a href="https://github.com/BerkeHazar/sayfa" rel="noopener" target="_blank">Kaynak kodu</a></li>
              <li><a href="#nasil">Nasıl çalışır</a></li>
            </ul>
          </div>
        </div>
        <div class="foot__base mono">
          <span>© 2026 sayfa · MIT</span>
          <span>v1.0</span>
        </div>
      </div>
    </footer>

    <input type="file" id="hero-file" class="file-input" accept=".pdf,application/pdf" multiple />
  `;

  syncTheme();
  reveal(root);
  wireTopbar();
  wireDrop(root);

  // Niyet görülünce motoru önden indir (hover), böylece geçiş anında hazır olur.
  root.querySelectorAll<HTMLElement>(".ticket__row").forEach((row) => {
    row.addEventListener(
      "pointerenter",
      () => {
        void import("./tools");
      },
      { once: true },
    );
  });
}

function mapIcon(id: string): string {
  const map: Record<string, string> = {
    birlestir: "merge",
    bol: "split",
    dondur: "rotate",
    sil: "remove",
    sirala: "organize",
    filigran: "watermark",
    numara: "number",
    gorsel: "images",
    imza: "imza",
    kirp: "kirp",
    damga: "damga",
    resim: "resim",
    metin: "metin",
    meta: "meta",
    bilgi: "info",
    sikistir: "compress",
  };
  return map[id] ?? "info";
}

let scrollHandler: (() => void) | null = null;

function wireTopbar(): void {
  const bar = document.getElementById("topbar");
  if (!bar) return;
  // Her görünüm değişiminde yeni dinleyici eklenmesin.
  if (scrollHandler) window.removeEventListener("scroll", scrollHandler);
  scrollHandler = () => bar.classList.toggle("is-stuck", window.scrollY > 8);
  scrollHandler();
  window.addEventListener("scroll", scrollHandler, { passive: true });
}

function wireDrop(root: HTMLElement): void {
  const drop = root.querySelector<HTMLElement>("#drop");
  const input = root.querySelector<HTMLInputElement>("#hero-file");
  if (!drop || !input) return;

  const open = () => input.click();

  drop.addEventListener("click", open);
  drop.addEventListener("keydown", (e) => {
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      open();
    }
  });
  // Etiket zaten dosya seçiciyi açar; JS kapalıyken de çalışır.

  input.addEventListener("change", () => {
    if (input.files?.length) openPicker(Array.from(input.files));
    input.value = "";
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
    if (depth === 0) drop.classList.remove("is-over");
  });
  drop.addEventListener("drop", (e) => {
    e.preventDefault();
    depth = 0;
    drop.classList.remove("is-over");
    const files = Array.from(e.dataTransfer?.files ?? []);
    if (files.length) openPicker(files);
  });
}

/** Dosyaları alır, hangi araçla devam edileceğini sorar. */
function openPicker(files: File[]): void {
  const total = files.reduce((sum, f) => sum + f.size, 0);
  if (total > MAX_BYTES) {
    toast(`${fmtBytes(total)} çok büyük — tarayıcı belleği yetmeyebilir.`, "warn");
    return;
  }

  const allPdf = files.every(isPdf);
  const allImg = files.every(isImage);
  if (!allPdf && !allImg) {
    toast("PDF ile görseli aynı anda karıştıramazsın.", "warn");
    return;
  }

  const pool = catalog.filter(
    (t) => t.accept === (allPdf ? "pdf" : "image") && (files.length === 1 || t.multi),
  );

  const el = document.createElement("div");
  el.className = "picker";
  el.innerHTML = `
    <div class="picker__panel" role="dialog" aria-modal="true" aria-labelledby="picker-title"
      tabindex="-1">
      <div class="picker__head">
        <strong id="picker-title">${files.length} dosya · ne yapalım?</strong>
        <button class="picker__close" type="button" aria-label="Kapat">✕</button>
      </div>
      <div class="picker__list">
        ${pool
          .map(
            (t) => `
          <button class="picker__item" type="button" data-tool="${t.id}">
            ${icons[mapIcon(t.id)]}
            <span><b>${t.title}</b><small>${t.desc}</small></span>
            <span aria-hidden="true">→</span>
          </button>`,
          )
          .join("")}
      </div>
      <div class="picker__files mono">
        ${files.map((f) => f.name).join(" · ")}
      </div>
    </div>
  `;

  const opener = document.activeElement as HTMLElement | null;
  const close = () => {
    el.classList.remove("is-on");
    setTimeout(() => el.remove(), 220);
    document.removeEventListener("keydown", onKey);
    // Dosya seçici programatik açıldığı için odak gövdeye düşüyor;
    // kullanıcıyı bırakma alanına geri getir.
    const back =
      opener && opener !== document.body ? opener : document.getElementById("drop");
    back?.focus?.();
  };
  const onKey = (e: KeyboardEvent) => {
    if (e.key === "Escape") close();
  };

  el.addEventListener("click", (e) => {
    if (e.target === el) close();
  });
  el.querySelector(".picker__close")?.addEventListener("click", close);
  el.querySelectorAll<HTMLElement>("[data-tool]").forEach((btn) => {
    btn.addEventListener("click", () => {
      const id = btn.dataset.tool;
      if (!id) return;
      setPending(files);
      close();
      location.hash = `#/arac/${id}`;
    });
  });

  document.body.appendChild(el);
  document.addEventListener("keydown", onKey);
  window.setTimeout(() => el.classList.add("is-on"), 16);
  el.querySelector<HTMLElement>(".picker__panel")?.focus({ preventScroll: true });
  announce(`${files.length} dosya için araç seçimi açıldı`);
}
