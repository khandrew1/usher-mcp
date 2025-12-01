import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import { resolve } from "path";
import { fileURLToPath } from "url";
import { defineConfig } from "vite";

const __dirname = fileURLToPath(new URL(".", import.meta.url));

export default defineConfig(({ mode }) => {
  const isShowtime = mode === "movie-showtime-widget";
  const name = isShowtime ? "movie-showtime-widget" : "movie-detail-widget";
  const htmlFile = isShowtime ? "movie-showtime-widget.html" : "widget.html";

  return {
    root: __dirname,
    plugins: [react(), tailwindcss()],
    resolve: {
      alias: {
        "@": resolve(__dirname, "src"),
      },
    },
    build: {
      outDir: resolve(__dirname, "dist"),
      emptyOutDir: !isShowtime,
      rollupOptions: {
        input: {
          [name]: resolve(__dirname, htmlFile),
        },
        output: {
          entryFileNames: `${name}.js`,
          chunkFileNames: `${name}.js`,
          assetFileNames: (assetInfo) => {
            if (assetInfo.name && assetInfo.name.endsWith(".css")) {
              return `${name}.css`;
            }
            return assetInfo.name || "asset";
          },
          manualChunks: undefined,
        },
      },
    },
  };
});
