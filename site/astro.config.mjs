import { defineConfig } from "astro/config";
import rehypeKatex from "rehype-katex";
import remarkMath from "remark-math";

const text = (node) =>
  node.type === "text" ? node.value : (node.children ?? []).map(text).join("");

/**
 * Wrap every Markdown table in a focusable, labelled scroll region (named after the heading
 * above it), so wide tables scroll inside themselves on phones instead of widening the page.
 */
function wrapTables() {
  return (tree) => {
    let heading = "";
    const visit = (node) => {
      if (!node.children) return;
      node.children = node.children.map((child) => {
        if (child.type === "element" && /^h[1-6]$/.test(child.tagName)) heading = text(child).trim();
        if (child.type === "element" && child.tagName === "table") {
          return {
            type: "element",
            tagName: "div",
            properties: { className: ["table-wrap"], tabIndex: 0, role: "region", ariaLabel: heading ? `טבלה: ${heading}` : "טבלה" },
            children: [child],
          };
        }
        visit(child);
        return child;
      });
    };
    visit(tree);
  };
}

/**
 * Where the site is served, for canonical and Open Graph URLs (share previews need absolute
 * image URLs) and for internal links. Defaults: the root of the GitHub Pages origin, which is
 * what CI and the tests use. The live site, https://avi-lezerovich.github.io/skrim/, is built
 * with BASE_PATH=/skrim (npm run build:pages). A custom domain later: SITE_URL=https://…,
 * BASE_PATH unset.
 */
const site = process.env.SITE_URL || "https://avi-lezerovich.github.io";
const base = process.env.BASE_PATH || "/";

export default defineConfig({
  site,
  base,
  // $…$ and $$…$$ in Markdown become MathML at build time; browsers draw it natively, so the
  // page loads no math fonts or CSS.
  markdown: {
    remarkPlugins: [remarkMath],
    rehypePlugins: [[rehypeKatex, { output: "mathml" }], wrapTables],
  },
  // methodology.md lives at the repo root, one level up
  vite: { server: { fs: { allow: [".."] } } },
});
