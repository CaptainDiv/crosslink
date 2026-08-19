import { defineConfig } from "vite";

// GitHub Pages serves a project site (not a custom domain) at
// https://<owner>.github.io/<repo>/ — the build output has to know that
// prefix, or every asset URL resolves relative to the domain root instead.
export default defineConfig({
  base: "/crosslink/",
});
