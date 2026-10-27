// Share-preview images (Open Graph, 1200×630) rendered by Playwright's Chromium from an HTML
// template, so Hebrew is shaped and laid out right to left by a real browser, with IBM Plex
// Sans Hebrew embedded (the run fails if the Hebrew face did not load: no boxes).
//
//   npm run og                     per-page images → public/og/ (gitignored) + index.json
//   npm run og -- --default-only   the timeless brand image → public/og-default.png (committed)
//
// The cards carry the same numbers as the pages (published 20.10.2026 by the owner's
// decision; see CLAUDE.md). SITE_URL and BASE_PATH (as in astro.config.mjs) set the address
// printed in the footer.
// CHROMIUM_PATH points at a browser other than the one `npx playwright install` fetched.
import { mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { chromium } from "@playwright/test";
import { COLORS, LOCKUP, lockupPaths } from "../src/lib/brand.mjs";
import { EMBARGO_END } from "../src/lib/embargo.mjs";

const root = new URL("../", import.meta.url);
const json = (name) => JSON.parse(readFileSync(new URL(`src/data/${name}`, root), "utf8"));
const polls = json("polls.json");
const average = json("average.json");
const pollsters = json("pollsters.json");
const sponsors = json("sponsors.json");
const meta = json("meta.json");
const exitPolls = json("exit_polls.json");
const parties = json("parties.json");

const defaultOnly = process.argv.includes("--default-only");
const host = `${new URL(process.env.SITE_URL || "https://avi-lezerovich.github.io").host}${(process.env.BASE_PATH ?? "/skrim").replace(/\/$/, "")}`;
const W = 1200, H = 630;
const MAX_BYTES = 300 * 1024; // WhatsApp may drop larger images
const C = { ...COLORS.light, ink2: "#45433f", muted: "#5f5d58", rule: "#e4e2dc", axis: "#8f8d86" };
const BLOC = { coalition: "#6a3d9a", opposition: "#7d6608", arab: "#b8336a" };
const BLOC_SHORT = { coalition: "קואליציה", opposition: "אופוזיציה", arab: "מפלגות ערביות" };

// ---- fonts: the fontsource files with their own unicode-range, embedded as data URLs ----
const fontDir = new URL("node_modules/@fontsource/ibm-plex-sans-hebrew/", root);
const fontFaces = [400, 600, 700]
  .flatMap((w) => {
    const css = readFileSync(new URL(`${w}.css`, fontDir), "utf8");
    return [...css.matchAll(/@font-face\s*{([^}]*)}/g)].map((m) => {
      const file = m[1].match(/url\(\.\/files\/([^)]+\.woff2)\)/)?.[1];
      const range = m[1].match(/unicode-range:\s*([^;]+);/)?.[1];
      if (!file || !/-(hebrew|latin)-/.test(file)) return "";
      const data = readFileSync(new URL(`files/${file}`, fontDir)).toString("base64");
      return `@font-face{font-family:Plex;font-weight:${w};src:url(data:font/woff2;base64,${data}) format("woff2");unicode-range:${range};}`;
    });
  })
  .join("");

const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]);
const dmy = (iso) => (iso ? `${+iso.slice(8, 10)}.${+iso.slice(5, 7)}.${iso.slice(0, 4)}` : "—");
const dm = (iso) => `${+iso.slice(8, 10)}.${+iso.slice(5, 7)}`;
const pollsterName = (id, raw) => pollsters[id]?.name_he ?? raw ?? "—";
const sponsorName = (id, raw) => sponsors[id]?.name_he ?? raw ?? "—";

// ---- visuals ----
const logoSvg = (h) => `<svg height="${h}" width="${(h * LOCKUP.width) / LOCKUP.height}" viewBox="0 0 ${LOCKUP.width} ${LOCKUP.height}">${lockupPaths(C.ink, C.accent)}</svg>`;

/** Simplified G1: bloc averages over the last `days` days, 0-based, the 61 line, end values. */
function blocChart(days, w, h) {
  const rows = average.blocs.slice(-days);
  const pad = { l: 8, r: 52, t: 16, b: 30 };
  const x = (i) => pad.l + (i / (rows.length - 1)) * (w - pad.l - pad.r);
  const y = (v) => pad.t + (1 - v / 72) * (h - pad.t - pad.b);
  const lines = Object.keys(BLOC).map((b) => {
    const pts = rows.map((d, i) => (d.values[b] ? `${x(i).toFixed(1)},${y(d.values[b].mean).toFixed(1)}` : null)).filter(Boolean);
    const band = rows
      .map((d, i) => (d.values[b] ? [x(i), y(d.values[b].mean + d.values[b].sd), y(Math.max(0, d.values[b].mean - d.values[b].sd))] : null))
      .filter(Boolean);
    const area = `M${band.map(([a, t]) => `${a.toFixed(1)},${t.toFixed(1)}`).join("L")}L${band.reverse().map(([a, , bot]) => `${a.toFixed(1)},${bot.toFixed(1)}`).join("L")}Z`;
    const last = rows.at(-1).values[b].mean;
    return { b, pts, area, last };
  });
  // end labels pushed apart
  const ends = [...lines].sort((a, b) => b.last - a.last);
  let prev = -Infinity;
  for (const e of ends) {
    e.ly = Math.max(y(e.last), prev + 26);
    prev = e.ly;
  }
  const ticks = [0, Math.floor(rows.length / 2), rows.length - 1];
  return `<svg width="${w}" height="${h}" viewBox="0 0 ${w} ${h}" style="direction:ltr">
    ${[0, 20, 40].map((v) => `<line x1="${pad.l}" x2="${w - pad.r}" y1="${y(v)}" y2="${y(v)}" stroke="${C.rule}"/>`).join("")}
    <line x1="${pad.l}" x2="${w - pad.r}" y1="${y(61)}" y2="${y(61)}" stroke="${C.axis}" stroke-dasharray="6 5" stroke-width="2"/>
    <text x="${pad.l + 4}" y="${y(61) - 8}" font-size="20" fill="${C.muted}" style="unicode-bidi:plaintext">61 · רוב</text>
    ${lines.map((l) => `<path d="${l.area}" fill="${BLOC[l.b]}" fill-opacity=".16"/>`).join("")}
    ${lines.map((l) => `<polyline points="${l.pts.join(" ")}" fill="none" stroke="${BLOC[l.b]}" stroke-width="4" stroke-linejoin="round"/>`).join("")}
    ${lines.map((l) => `<text x="${w - pad.r + 10}" y="${l.ly + 8}" font-size="26" font-weight="700" fill="${BLOC[l.b]}">${Math.round(l.last)}</text>`).join("")}
    ${ticks.map((i) => `<text x="${x(i)}" y="${h - 4}" font-size="20" fill="${C.muted}" text-anchor="${i === 0 ? "start" : i === rows.length - 1 ? "end" : "middle"}">${dm(rows[i].date)}</text>`).join("")}
  </svg>`;
}

/** One row per channel's exit poll: name and a 120-seat bar of the blocs, with the 61 tick. */
function exitRows() {
  const order = ["coalition", "arab", "opposition"];
  const rows = exitPolls.channels.map((c) => {
    const blocs = Object.fromEntries(order.map((b) => [b, 0]));
    for (const [id, n] of Object.entries(c.versions.at(-1).seats)) if (parties[id]?.bloc in blocs) blocs[parties[id].bloc] += n;
    const segs = order.map((b) => `<span style="width:${((100 * blocs[b]) / 120).toFixed(3)}%;background:${BLOC[b]}">${blocs[b]}</span>`).join("");
    const tag = c.method?.kind === "survey" ? `<small>סקר, לא מדגם</small>` : "";
    return `<div class="erow"><span class="ename">${esc(c.name)}${tag}</span><span class="ebar">${segs}<i></i></span></div>`;
  });
  const key = order.map((b) => `<span><b style="background:${BLOC[b]}"></b>${BLOC_SHORT[b]}</span>`).join("");
  return `<div class="exit"><p class="ekey">${key}<span>· קו: 61 מנדטים</span></p>${rows.join("")}</div>`;
}

const blocNumbers = (vals, label) => `
  <div class="nums">${Object.keys(BLOC)
    .filter((b) => vals[b] != null)
    .map((b) => `<div class="num" style="--c:${BLOC[b]}"><span class="num-v">${Math.round(vals[b])}</span><span class="num-l">${BLOC_SHORT[b]}</span></div>`)
    .join("")}</div>${label ? `<p class="note">${label}</p>` : ""}`;

/**
 * The card, centred so a square crop (small previews) keeps the headline: logo, headline,
 * subline, then an optional data row (numbers beside a chart). Footer: source line and domain.
 */
const card = ({ title, sub = "", body = "", visual = "", foot = "כל מספר מקושר לדיווח בוועדת הבחירות המרכזית" }) => `<!doctype html>
<html lang="he" dir="rtl"><head><meta charset="utf-8"><style>
${fontFaces}
*{box-sizing:border-box;margin:0}
html,body{width:${W}px;height:${H}px;background:${C.page};color:${C.ink};font-family:Plex,sans-serif;font-variant-numeric:tabular-nums}
.frame{position:absolute;inset:0;padding:52px 80px 44px;display:flex;flex-direction:column;align-items:center;text-align:center}
.frame::after{content:"";position:absolute;inset-inline:0;bottom:0;height:10px;background:${C.accent}}
.main{flex:1;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:0;min-height:0}
h1{font-size:${visual || body ? 58 : 68}px;line-height:1.14;font-weight:700;text-wrap:balance;max-width:960px}
.sub{margin-top:16px;font-size:30px;line-height:1.3;color:${C.ink2};max-width:900px;text-wrap:balance}
.data{display:flex;align-items:center;gap:44px;margin-top:26px}
.nums{display:flex;gap:24px}
.num{display:grid;justify-items:center;border-top:6px solid var(--c);padding-top:6px;min-width:118px}
.num-v{font-size:60px;line-height:1;font-weight:700}
.num-l{font-size:21px;color:${C.ink2}}
.note{margin-top:10px;font-size:21px;color:${C.muted}}
.foot{width:100%;display:flex;justify-content:space-between;font-size:22px;color:${C.muted}}
.exit{width:900px;display:grid;gap:10px}
.ekey{display:flex;justify-content:center;gap:22px;font-size:21px;color:${C.ink2}}
.ekey span{display:inline-flex;align-items:center;gap:8px}
.ekey b{width:16px;height:16px;border-radius:3px}
.erow{display:grid;grid-template-columns:170px 1fr;align-items:center;gap:20px}
.ename{display:grid;font-size:28px;line-height:1.1;font-weight:700;text-align:start}
.ename small{justify-self:start;margin-top:2px;padding:0 8px;border-radius:99px;background:#9a5b00;color:#fff;font-size:16px;font-weight:600}
.ebar{position:relative;display:flex;height:38px;border-radius:5px;overflow:visible}
.ebar span{display:flex;align-items:center;justify-content:center;color:#fff;font-size:22px;font-weight:700;box-shadow:inset -2px 0 0 ${C.page}}
.ebar span:first-child{border-radius:0 5px 5px 0}
.ebar span:last-child{border-radius:5px 0 0 5px;box-shadow:none}
.ebar i{position:absolute;top:-6px;bottom:-6px;inset-inline-start:${((100 * 61) / 120).toFixed(3)}%;width:3px;margin-inline-start:-1.5px;background:linear-gradient(${C.ink} 0 7px,transparent 7px calc(100% - 7px),${C.ink} calc(100% - 7px))}
</style></head><body><div class="frame">
${logoSvg(56)}
<div class="main"><h1>${title}</h1>${sub ? `<p class="sub">${sub}</p>` : ""}${body || visual ? `<div class="data">${body ? `<div>${body}</div>` : ""}${visual}</div>` : ""}</div>
<div class="foot"><span>${foot}</span><bdi dir="ltr">${esc(host)}</bdi></div>
</div></body></html>`;

// ---- the pages ----
const last = average.blocs.at(-1);
const lastVals = Object.fromEntries(Object.entries(last.values).map(([b, v]) => [b, v.mean]));
const pages = [];
const add = (slug, alt, html) => pages.push({ slug, alt, html });

const homeTitle = "ממוצע סקרי הבחירות לכנסת ה-26";
if (defaultOnly) {
  add("default", "הלוגו של skrim והכותרת: מאגר פתוח של סקרי הבחירות לכנסת ה-26", card({ title: "מאגר פתוח של סקרי הבחירות לכנסת ה-26", sub: "כל סקר שהוגש לוועדת הבחירות, מקושר לדיווח המקורי" }));
} else {
  const dateNote = `ממוצע ${last.n_polls} סוקרים, ${dmy(last.date)}`;
  // Election night: once polls close the home page leads with the exit polls, and so does its card.
  const exitNight = new Date() >= EMBARGO_END && exitPolls.channels.length > 0;
  if (exitNight)
    add("home", `מדגמי הערוצים לכנסת ה-26 לפי גוש: ${exitPolls.channels.map((c) => {
      const b = { coalition: 0, opposition: 0, arab: 0 };
      for (const [id, n] of Object.entries(c.versions.at(-1).seats)) if (parties[id]?.bloc in b) b[parties[id].bloc] += n;
      return `${c.name}: ${Object.keys(b).map((k) => `${BLOC_SHORT[k]} ${b[k]}`).join(", ")}`;
    }).join("; ")}`,
      card({ title: "מדגמי הערוצים לכנסת ה-26", visual: exitRows(), foot: "המדגמים כפי שפורסמו בערוצים ב-27.10.2026 בשעה 22:00" }));
  else add("home", `ממוצע הסקרים ב-${dmy(last.date)}: ${Object.keys(BLOC).map((b) => `${BLOC_SHORT[b]} ${Math.round(lastVals[b])}`).join(", ")} מנדטים, עם גרף הגושים ב-60 הימים האחרונים`,
    card({ title: homeTitle, body: blocNumbers(lastVals, dateNote), visual: blocChart(60, 400, 230) }));
  add("trends", `גרף ממוצע הגושים מאז ${dmy(average.blocs[0].date)}, עם קו 61`,
    card({ title: "מגמות בסקרי הבחירות", sub: `הממוצע לפי גוש מאז ${dmy(average.blocs[0].date)}`, visual: blocChart(average.blocs.length, 640, 250) }));
  add("polls", "הלוגו של skrim והכותרת: כל סקרי הבחירות לכנסת ה-26", card({ title: "כל סקרי הבחירות לכנסת ה-26", sub: `${meta.polls_total} סקרים שהוגשו לוועדת הבחירות, עם קישור לכל דיווח` }));
  add("pollsters", "הלוגו של skrim והכותרת: השוואת סוקרים", card({ title: "השוואת סוקרים", sub: "במה כל סוקר שונה מהשאר, לפני התוצאות ואחריהן" }));
  for (const p of polls) {
    const who = esc(pollsterName(p.pollster, p.pollster_raw));
    const ok = p.status === "ok" && p.blocs;
    add(`poll-${p.key}`, `סקר ${who} מ-${dmy(p.field_date)}${ok ? `: ${Object.keys(BLOC).map((b) => `${BLOC_SHORT[b]} ${p.blocs[b]}`).join(", ")} מנדטים` : ""}`,
      card({
        title: `<bdi>${who}</bdi>`,
        sub: `סקר מ-${dmy(p.field_date)} עבור <bdi>${esc(sponsorName(p.sponsor, p.sponsor_raw))}</bdi>${p.meta.respondents ? ` · <bdi>n=${p.meta.respondents.toLocaleString("en")}</bdi>` : ""}`,
        body: ok ? blocNumbers(p.blocs, "מנדטים לפי גוש, כפי שדווח לוועדה") : `<p class="note">ממתין לבדיקה ידנית ואינו נכלל בממוצע</p>`,
      }));
  }
}
if (!defaultOnly) {
  // "Who was right" opens after the official results (4.11): its card carries no ranking.
  add("results", "הלוגו של skrim והכותרת: מי צדק? דיוק הסוקרים מול התוצאות", card({ title: "מי צדק? דיוק הסוקרים מול התוצאות", sub: "הסקר האחרון של כל סוקר מול התוצאות הרשמיות, לפי כללים שנקבעו מראש" }));
}

// ---- render ----
const browser = await chromium.launch(process.env.CHROMIUM_PATH ? { executablePath: process.env.CHROMIUM_PATH } : {});
const page = await browser.newPage({ viewport: { width: W, height: H }, deviceScaleFactor: 1 });
const outDir = new URL("public/og/", root);
if (!defaultOnly) {
  rmSync(outDir, { recursive: true, force: true });
  mkdirSync(outDir, { recursive: true });
}
const index = {};
for (const p of pages) {
  await page.setContent(p.html, { waitUntil: "load" });
  await page.evaluate(() => document.fonts.ready);
  const ok = await page.evaluate(() => document.fonts.check('700 62px Plex', "סקרים") && [...document.fonts].some((f) => f.status === "loaded" && /0590|590/i.test(f.unicodeRange)));
  if (!ok) throw new Error(`Hebrew web font did not load for ${p.slug}`);
  let buf = await page.screenshot({ type: "png" });
  let ext = "png";
  if (buf.length > MAX_BYTES) {
    buf = await page.screenshot({ type: "jpeg", quality: 86 });
    ext = "jpg";
  }
  if (buf.length > MAX_BYTES) throw new Error(`${p.slug}: ${buf.length} bytes, over ${MAX_BYTES}`);
  if (defaultOnly) writeFileSync(new URL(`public/og-default.${ext}`, root), buf);
  else writeFileSync(new URL(`${p.slug}.${ext}`, outDir), buf);
  index[p.slug] = { file: defaultOnly ? `/og-default.${ext}` : `/og/${p.slug}.${ext}`, alt: p.alt.replace(/<[^>]+>/g, ""), bytes: buf.length };
}
await browser.close();
if (!defaultOnly) writeFileSync(new URL("index.json", outDir), JSON.stringify({ generated: new Date().toISOString(), images: index }, null, 1) + "\n");
const sizes = Object.values(index).map((i) => i.bytes);
console.log(`${pages.length} image(s), ${defaultOnly ? "brand-only" : "with data"}; largest ${Math.max(...sizes)} bytes`);
