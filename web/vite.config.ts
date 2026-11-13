import { defineConfig } from "vite";
import { resolve } from "node:path";

// Static site: everything runs in the browser, nothing is uploaded.
export default defineConfig({
  root: __dirname,
  publicDir: resolve(__dirname, "public"),
  server: { port: 5173, fs: { allow: [resolve(__dirname, "..")] } },
  build: {
    outDir: resolve(__dirname, "dist"),
    emptyOutDir: true,
    target: "es2022",
    rollupOptions: {
      input: {
        main: resolve(__dirname, "index.html"),
        about: resolve(__dirname, "about.html"),
      },
    },
  },
});
