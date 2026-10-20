import { defineConfig } from "astro/config";

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
 * The production origin, used for canonical and Open Graph URLs (share previews need absolute
 * image URLs). Set SITE_URL in the deploy environment, e.g. SITE_URL=https://skrim.co.il.
 * PLACEHOLDER until a domain exists: the current Pages project URL.
 */
const PLACEHOLDER_SITE = "https://pollygraph-il.pages.dev";
const site = process.env.SITE_URL || PLACEHOLDER_SITE;
if (site === PLACEHOLDER_SITE) console.warn(`[skrim] SITE_URL is not set; share previews use the placeholder ${site}`);

export default defineConfig({
  site,
  markdown: { rehypePlugins: [wrapTables] },
  // methodology.md lives at the repo root, one level up
  vite: { server: { fs: { allow: [".."] } } },
});
