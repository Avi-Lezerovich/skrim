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

export default defineConfig({
  site: "https://pollygraph-il.pages.dev",
  markdown: { rehypePlugins: [wrapTables] },
  // methodology.md lives at the repo root, one level up
  vite: { server: { fs: { allow: [".."] } } },
});
