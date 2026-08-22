import { resolve } from "node:path";
import { defineConfig } from "vite";

// GitHub Pages serves a project site (not a custom domain) at
// https://<owner>.github.io/<repo>/ — the build output has to know that
// prefix, or every asset URL resolves relative to the domain root instead.
// Vercel (Root Directory: apps/web) serves this project from the domain
// root, and sets VERCEL=1 in every build environment — a documented, stable
// Vercel convention, more reliable to key off than guessing the host.
const base = process.env.VERCEL ? "/" : "/crosslink/";

export default defineConfig({
  base,
  build: {
    rollupOptions: {
      input: {
        main: resolve(__dirname, "index.html"),
        wallet: resolve(__dirname, "wallet.html"),
        demo: resolve(__dirname, "demo.html"),
        proof: resolve(__dirname, "proof.html"),
      },
    },
  },
});
