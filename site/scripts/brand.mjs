// Brand assets from src/lib/brand.mjs: SVG sources in public/brand/, the favicons, the
// apple-touch and PWA icons, and the web manifest. Rasters are drawn by Playwright's Chromium
// (already a devDependency). Run after changing the logo: `npm run brand`. Manifest URLs are
// relative to the manifest, so they hold under a base path (GitHub Pages: /skrim/).
// CHROMIUM_PATH points at a browser other than the one `npx playwright install` fetched.
import { mkdirSync, writeFileSync } from "node:fs";
import { chromium } from "@playwright/test";
import { COLORS, LOCKUP, lockupPaths, markPaths, wordmarkPaths } from "../src/lib/brand.mjs";

const pub = new URL("../public/", import.meta.url);
const out = (name, data) => writeFileSync(new URL(name, pub), data);
mkdirSync(new URL("brand/", pub), { recursive: true });

const svg = (w, h, body, title) =>
  `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${w} ${h}" width="${w}" height="${h}" role="img" aria-label="${title}"><title>${title}</title>${body}</svg>\n`;

// SVG sources: colour on light, colour on dark, and one-colour versions of each.
for (const theme of ["light", "dark"]) {
  const { ink, accent } = COLORS[theme];
  out(`brand/skrim-logo-${theme}.svg`, svg(LOCKUP.width, LOCKUP.height, lockupPaths(ink, accent), "skrim"));
  out(`brand/skrim-logo-mono-${theme}.svg`, svg(LOCKUP.width, LOCKUP.height, lockupPaths(ink, ink), "skrim"));
  out(`brand/skrim-mark-${theme}.svg`, svg(32, 32, markPaths(ink, accent), "skrim"));
  out(`brand/skrim-mark-mono-${theme}.svg`, svg(32, 32, markPaths(ink, ink), "skrim"));
  out(`brand/skrim-wordmark-${theme}.svg`, svg(86, 36, wordmarkPaths(ink), "skrim"));
}

// favicon.svg follows the browser theme, so the outline stays visible on dark tab bars.
const L = COLORS.light, D = COLORS.dark;
out(
  "favicon.svg",
  svg(
    32,
    32,
    `<style>:root{--i:${L.ink};--a:${L.accent}}@media (prefers-color-scheme:dark){:root{--i:${D.ink};--a:${D.accent}}}</style>${markPaths("var(--i)", "var(--a)")}`,
    "skrim",
  ),
);

// Raster icons sit on a light tile, so they read on any background without a media query.
// `scale` is the mark's share of the canvas; maskable icons keep it inside the 80% safe circle.
const tile = (size, { scale, radius }) => `
  <svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">
    <rect width="${size}" height="${size}" rx="${size * radius}" fill="${L.page}"/>
    <svg x="${(size * (1 - scale)) / 2}" y="${(size * (1 - scale)) / 2}" width="${size * scale}" height="${size * scale}" viewBox="0 0 32 32">${markPaths(L.ink, L.accent)}</svg>
  </svg>`;

const browser = await chromium.launch(process.env.CHROMIUM_PATH ? { executablePath: process.env.CHROMIUM_PATH } : {});
const page = await browser.newPage();
async function png(size, opts) {
  await page.setViewportSize({ width: size, height: size });
  await page.setContent(`<style>html,body{margin:0;background:transparent}</style>${tile(size, opts)}`);
  return page.screenshot({ omitBackground: true, clip: { x: 0, y: 0, width: size, height: size } });
}
const rounded = { scale: 0.82, radius: 0.22 };
out("apple-touch-icon.png", await png(180, { scale: 0.7, radius: 0 })); // iOS rounds the corners
out("icon-192.png", await png(192, rounded));
out("icon-512.png", await png(512, rounded));
out("icon-maskable-512.png", await png(512, { scale: 0.56, radius: 0 }));

// favicon.ico: 16, 32 and 48 px PNG frames in one ICO container.
const frames = [];
for (const s of [16, 32, 48]) frames.push({ s, data: await png(s, { scale: 0.92, radius: 0.18 }) });
await browser.close();
const head = Buffer.alloc(6 + 16 * frames.length);
head.writeUInt16LE(0, 0);
head.writeUInt16LE(1, 2); // type: icon
head.writeUInt16LE(frames.length, 4);
let offset = head.length;
frames.forEach(({ s, data }, i) => {
  const e = 6 + 16 * i;
  head.writeUInt8(s, e);
  head.writeUInt8(s, e + 1);
  head.writeUInt16LE(1, e + 4); // planes
  head.writeUInt16LE(32, e + 6); // bits per pixel
  head.writeUInt32LE(data.length, e + 8);
  head.writeUInt32LE(offset, e + 12);
  offset += data.length;
});
out("favicon.ico", Buffer.concat([head, ...frames.map((f) => f.data)]));

out(
  "manifest.webmanifest",
  JSON.stringify(
    {
      name: "skrim — סקרי הבחירות לכנסת ה-26",
      short_name: "skrim",
      description: "מאגר פתוח של סקרי הבחירות לכנסת ה-26, מקושר לדיווחים לוועדת הבחירות המרכזית",
      lang: "he",
      dir: "rtl",
      start_url: "./",
      scope: "./",
      display: "standalone",
      background_color: L.page,
      theme_color: L.surface,
      icons: [
        { src: "icon-192.png", sizes: "192x192", type: "image/png" },
        { src: "icon-512.png", sizes: "512x512", type: "image/png" },
        { src: "icon-maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
        { src: "favicon.svg", sizes: "any", type: "image/svg+xml" },
      ],
    },
    null,
    2,
  ) + "\n",
);
console.log("brand assets written to public/");
