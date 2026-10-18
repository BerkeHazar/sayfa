import "./styles/index.css";
import { renderLanding } from "./landing";
import { disposeAll } from "./lifecycle";
import { installNetCounter, reveal, swap, toast } from "./motion";
import { takePending } from "./session";
import { initTheme } from "./theme";

document.documentElement.classList.add("js");
installNetCounter();
initTheme();

window.addEventListener("error", (event) => {
  if (event.message) toast(`Beklenmeyen hata: ${event.message}`, "warn");
});
window.addEventListener("unhandledrejection", (event) => {
  const reason = event.reason instanceof Error ? event.reason.message : String(event.reason);
  toast(`Beklenmeyen hata: ${reason}`, "warn");
});

const app = document.getElementById("app")!;
let mounted = "";
let navToken = 0;

const LANDING_TITLE = "sayfa — PDF araçları, tarayıcında";

function mountLanding(): void {
  disposeAll();
  mounted = "landing";
  swap(() => renderLanding(app));
  reveal(app);
  document.title = LANDING_TITLE;
}

/**
 * Araç ekranı ve PDF motoru (~1 MB) yalnızca gerektiğinde indirilir.
 * Açılış sayfası bu yükü hiç görmez.
 */
async function openTool(id: string): Promise<void> {
  const token = ++navToken;
  let mods;
  try {
    mods = await Promise.all([import("./tools"), import("./workspace")]);
  } catch {
    toast("Araç yüklenemedi. Sayfayı yenileyip tekrar dene.", "warn");
    return;
  }
  const [{ toolById }, { renderWorkspace }] = mods;
  if (token !== navToken) return;

  const tool = toolById(id);
  if (!tool) {
    location.hash = "#/";
    return;
  }

  const files = takePending();
  disposeAll();
  mounted = `tool:${tool.id}`;
  swap(() => renderWorkspace(app, tool, files));
  window.scrollTo({ top: 0, behavior: "auto" });
  app.querySelector<HTMLElement>("#stage")?.focus({ preventScroll: true });
  document.title = `${tool.title} — sayfa`;
}

function route(): void {
  const hash = location.hash;
  const isRoute = hash === "" || hash === "#" || hash.startsWith("#/");

  // "#araclar" gibi bölüm bağlantıları yönlendirme değil; yalnızca kaydırır.
  if (!isRoute) {
    if (!mounted) mountLanding();
    return;
  }

  const path = hash.replace(/^#\/?/, "");
  const match = path.match(/^arac\/([\w-]+)$/);

  if (match) {
    void openTool(match[1]);
    return;
  }

  if (mounted === "landing") return;
  mountLanding();
}

window.addEventListener("hashchange", route);
route();
