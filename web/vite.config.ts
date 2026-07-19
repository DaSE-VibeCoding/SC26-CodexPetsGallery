import { defineConfig } from "vite";
import preact from "@preact/preset-vite";
import tailwindcss from "@tailwindcss/vite";
import path from "node:path";
import { fileURLToPath } from "node:url";

const webRoot = path.dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  root: webRoot,
  base: "./",
  plugins: [preact(), tailwindcss()],
  publicDir: path.join(webRoot, "public"),
  build: {
    outDir: path.join(webRoot, "..", "dist"),
    emptyOutDir: true,
  },
  server: {
    port: 4173,
  },
});
