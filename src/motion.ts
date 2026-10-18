/* ============================================================
   Hareket ve durum katmanı
   İlkeler: yalnızca transform/opacity; 160–560ms; tek easing ailesi;
   prefers-reduced-motion açıksa hiçbiri çalışmaz.
   ============================================================ */

export const prefersReduced = (): boolean =>
  window.matchMedia("(prefers-reduced-motion: reduce)").matches;

/**
 * DOM değişimini her koşulda senkron çalıştırır, sonra yeni görünüme
 * CSS giriş animasyonu ekler.
 *
 * Not: `document.startViewTransition` bilinçli olarak kullanılmıyor. Gömülü
 * panellerde/arka plandaki iframe'lerde güncelleme geri çağrısı hiç
 * tetiklenmeyebiliyor ve tıklama "hiçbir şey yapmıyor" gibi görünüyor.
 */
export function swap(fn: () => void): void {
  fn();
  const app = document.getElementById("app");
  if (!app || prefersReduced()) return;
  app.classList.remove("view-enter");
  void app.offsetWidth;
  app.classList.add("view-enter");
}

/** Kaydırmayla görünür olan bloklar. */
export function reveal(root: ParentNode = document): void {
  const els = Array.from(root.querySelectorAll<HTMLElement>("[data-reveal]"));
  if (!("IntersectionObserver" in window) || prefersReduced()) {
    els.forEach((el) => el.classList.add("is-in"));
    return;
  }
  const io = new IntersectionObserver(
    (entries) => {
      for (const entry of entries) {
        if (!entry.isIntersecting) continue;
        entry.target.classList.add("is-in");
        io.unobserve(entry.target);
      }
    },
    { rootMargin: "0px 0px -6% 0px", threshold: 0.08 },
  );
  els.forEach((el) => {
    el.style.setProperty("--reveal-delay", `${Number(el.dataset.delay ?? 0)}ms`);
    io.observe(el);
  });
}

/* --- Dış istek sayacı --------------------------------------------- */

let externalRequests = 0;

const isExternal = (input: string): boolean => {
  try {
    return new URL(input, location.href).origin !== location.origin;
  } catch {
    return false;
  }
};

function paintCounters(): void {
  document.querySelectorAll<HTMLElement>("[data-netcount]").forEach((el) => {
    el.textContent = String(externalRequests);
    if (externalRequests > 0) el.classList.add("is-bump");
  });
}

/**
 * Sayfa açıldıktan sonra kendi kaynağımız dışına çıkan her isteği sayar.
 * Amaç iddiayı kanıtlanabilir kılmak: dosya hiçbir yere gitmiyorsa sayaç 0 kalır.
 */
export function installNetCounter(): void {
  const originalFetch = window.fetch;
  window.fetch = function patchedFetch(
    this: Window,
    input: RequestInfo | URL,
    init?: RequestInit,
  ) {
    const url = typeof input === "string" ? input : input instanceof URL ? input.href : input.url;
    if (isExternal(url)) {
      externalRequests++;
      paintCounters();
    }
    return originalFetch.call(this, input as RequestInfo, init);
  } as typeof window.fetch;

  const open = XMLHttpRequest.prototype.open;
  XMLHttpRequest.prototype.open = function patchedOpen(
    this: XMLHttpRequest,
    method: string,
    url: string | URL,
    ...rest: unknown[]
  ) {
    if (isExternal(String(url))) {
      externalRequests++;
      paintCounters();
    }
    return (open as (...args: unknown[]) => void).call(this, method, url, ...rest);
  } as typeof XMLHttpRequest.prototype.open;

  const beacon = navigator.sendBeacon?.bind(navigator);
  if (beacon) {
    navigator.sendBeacon = (url: string | URL, data?: BodyInit | null) => {
      if (isExternal(String(url))) {
        externalRequests++;
        paintCounters();
      }
      return beacon(url, data);
    };
  }
  paintCounters();
}

/* --- Duyurular ---------------------------------------------------- */

export function announce(message: string): void {
  const live = document.getElementById("live");
  if (live) live.textContent = message;
}

let toastTimer = 0;

export function toast(message: string, kind: "info" | "warn" = "info"): void {
  let el = document.querySelector<HTMLElement>(".toast");
  if (!el) {
    el = document.createElement("div");
    el.className = "toast";
    document.body.appendChild(el);
  }
  el.className = `toast${kind === "warn" ? " toast--warn" : ""}`;
  el.textContent = message;
  window.setTimeout(() => el?.classList.add("is-on"), 16);
  announce(message);
  window.clearTimeout(toastTimer);
  toastTimer = window.setTimeout(() => el?.classList.remove("is-on"), 4200);
}
