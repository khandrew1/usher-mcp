import { defineConfig } from "vite";
import { resolve } from "path";
import { fileURLToPath } from "url";

import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import { viteSingleFile } from "vite-plugin-singlefile";

const __dirname = fileURLToPath(new URL(".", import.meta.url));

const INPUT = process.env.INPUT;

if (!INPUT) {
  throw new Error("INPUT environment variable is not set");
}

const isDevelopment = process.env.NODE_ENV === "development";

export default defineConfig({
  root: __dirname,
  plugins: [react(), tailwindcss(), viteSingleFile()],
  resolve: {
    alias: {
      "@": resolve(__dirname, "src"),
    },
  },
  build: {
    sourcemap: isDevelopment ? "inline" : undefined,
    cssMinify: !isDevelopment,
    minify: !isDevelopment,
    rollupOptions: {
      input: resolve(__dirname, INPUT),
    },
    outDir: `dist`,
    emptyOutDir: false,
  },
});
