import { defineConfig } from "vite";

/**
 * GitHub Pages uyumluluğu için `base` göreli tutulur.
 * Böylece site hem kullanici.github.io/repo/ altında, hem özel alan adında,
 * hem de file:// üzerinden açıldığında varlıkları doğru çözer.
 */
export default defineConfig({
  base: "./",
  build: {
    target: "es2022",
    assetsInlineLimit: 2048,
    cssCodeSplit: false,
    reportCompressedSize: true,
    rollupOptions: {
      output: {
        // pdf-lib ağır; ilk boyamayı kilitlemesin diye ayrı chunk'a alınır.
        manualChunks(id) {
          if (id.includes("pdf-lib") || id.includes("fontkit")) return "pdf";
          if (id.includes("jszip")) return "zip";
        },
      },
    },
  },
});
