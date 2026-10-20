import { defineConfig } from "astro/config";

export default defineConfig({
  site: "https://pollygraph-il.pages.dev",
  // methodology.md lives at the repo root, one level up
  vite: { server: { fs: { allow: [".."] } } },
});
