import { icons } from "./icons";

type Theme = "light" | "dark";
const KEY = "sayfa-theme";

export const currentTheme = (): Theme =>
  document.documentElement.dataset.theme === "dark" ? "dark" : "light";

/** Tema düğmelerini, meta rengini ve `color-scheme`'i günceller. */
export function syncTheme(): void {
  const theme = currentTheme();
  const next = theme === "dark" ? "aydınlık" : "karanlık";

  document.querySelectorAll<HTMLElement>("[data-theme-toggle]").forEach((btn) => {
    btn.innerHTML = theme === "dark" ? icons.sun : icons.moon;
    btn.setAttribute("aria-label", `${next[0].toUpperCase()}${next.slice(1)} moda geç`);
    btn.setAttribute("title", `${next[0].toUpperCase()}${next.slice(1)} moda geç`);
  });

  document
    .querySelector('meta[name="theme-color"]')
    ?.setAttribute("content", theme === "dark" ? "#12100C" : "#F4F0E8");
}

export function toggleTheme(): void {
  const theme: Theme = currentTheme() === "dark" ? "light" : "dark";
  document.documentElement.dataset.theme = theme;
  try {
    localStorage.setItem(KEY, theme);
  } catch {
    /* gizli sekmede sessizce geç */
  }
  syncTheme();
}

/** Sayfa ilk kurulduğunda bir kez bağlanır. */
export function initTheme(): void {
  document.addEventListener("click", (event) => {
    const btn = (event.target as HTMLElement).closest("[data-theme-toggle]");
    if (!btn) return;
    toggleTheme();
  });
  syncTheme();
}
