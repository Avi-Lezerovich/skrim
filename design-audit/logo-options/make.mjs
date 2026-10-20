// Writes the three logo-direction sheets. Every shape is hand-written path data: no fonts.
// node design-audit/logo-options/make.mjs
import { writeFileSync } from "node:fs";

const INK = { light: "#111111", dark: "#efeee9" };
const PAGE = { light: "#fafaf8", dark: "#111110" };
const ACCENT = { light: "#1a56a8", dark: "#8ab8ff" }; // --link / --focus, the plan's only non-bloc hue
const MUTED = { light: "#5f5d58", dark: "#a3a199" };

/** Monoline lowercase "skrim" on a 36-unit body (baseline 32, x-height 12). */
const wordmark = (tittle) => `
  <g fill="none" stroke="currentColor" stroke-width="4.4" stroke-linecap="round" stroke-linejoin="round">
    <path d="M13.4 15.2C12.4 13.1 10.4 12 7.9 12 4.6 12 2.6 13.8 2.6 16.3c0 5.9 11.2 3.9 11.2 10.4 0 3.2-2.7 5.3-6.1 5.3-3 0-5.1-1.2-6.2-3.3"/>
    <path d="M21 2.4V32M31.6 12.4 21.6 22.6M25.2 19.4 32.4 32"/>
    <path d="M39 12.4V32M39 19.6c0-4.6 2.9-7.4 7.6-7.4"/>
    <path d="M53 12.4V32"/>
    <path d="M60 12.4V32M60 19.4c0-4.6 2.5-7.2 6-7.2s5.6 2.6 5.6 7.2V32M71.6 19.4c0-4.6 2.5-7.2 6-7.2s5.6 2.6 5.6 7.2V32"/>
  </g>
  ${tittle}`;
const dotTittle = `<circle cx="53" cy="4.2" r="2.7" fill="currentColor"/>`;

/** Each direction: mark (32×32 viewBox) per theme, and the i tittle used in its wordmark. */
const directions = {
  "1-band": {
    title: "Band — the site's chart grammar in a tile",
    why: "Average line inside its spread band with poll dots around it, on an accent tile: says 'poll average with uncertainty' and grows out of the current favicon.",
    mark: (t) => `
      <rect width="32" height="32" rx="7" fill="${ACCENT[t]}"/>
      <path d="M4 21.5C10 20 13 15 19 14.2c3.6-.5 6.2-2.2 9-4.2v8c-2.8 2-5.4 3.5-9 4C13 22.8 10 26.6 4 28z" fill="${PAGE[t]}" fill-opacity=".28"/>
      <path d="M4 24.6C10 23.2 13 19 19 18.2c3.6-.5 6.2-2.2 9-4.2" fill="none" stroke="${PAGE[t]}" stroke-width="2.6" stroke-linecap="round"/>
      <circle cx="9" cy="19" r="1.9" fill="${PAGE[t]}"/><circle cx="15.5" cy="23.4" r="1.9" fill="${PAGE[t]}"/><circle cx="23.5" cy="12.2" r="1.9" fill="${PAGE[t]}"/>`,
    tittle: () => dotTittle,
  },
  "2-estimate": {
    title: "Estimate — a point with its interval",
    why: "One dot with a band and whiskers: the honest unit of a poll (a number plus how unsure it is). It also becomes the dot on the i, so mark and wordmark share one idea.",
    mark: (t) => `
      <rect x="5" y="11" width="22" height="10" rx="5" fill="${ACCENT[t]}" fill-opacity=".24"/>
      <path d="M2.5 16h27M2.5 11.5v9M29.5 11.5v9" fill="none" stroke="${INK[t]}" stroke-width="2.4" stroke-linecap="round"/>
      <circle cx="17.5" cy="16" r="5.6" fill="${ACCENT[t]}" stroke="${PAGE[t]}" stroke-width="1.6"/>`,
    tittle: (t) => `
      <path d="M46.5 4.4h13" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/>
      <circle cx="54" cy="4.4" r="3" fill="${ACCENT[t]}"/>`,
  },
  "3-slot": {
    title: "Slot — a ballot box whose slot holds a trend",
    why: "Box outline with the slot notch at the top and a rising line ending in a dot: polls exist to anticipate the ballot, and the dot sits in the slot.",
    mark: (t) => `
      <path d="M11.5 4.5H7A3.5 3.5 0 0 0 3.5 8v17A3.5 3.5 0 0 0 7 28.5h18a3.5 3.5 0 0 0 3.5-3.5V8A3.5 3.5 0 0 0 25 4.5h-4.5" fill="none" stroke="${INK[t]}" stroke-width="2.8" stroke-linecap="round"/>
      <path d="M8.5 23 13 18.5l3.6 2.6L22 13" fill="none" stroke="${ACCENT[t]}" stroke-width="2.8" stroke-linecap="round" stroke-linejoin="round"/>
      <circle cx="16" cy="5" r="3" fill="${ACCENT[t]}"/>`,
    tittle: () => dotTittle,
  },
};

const lockup = (d, t, mono = false) => {
  const ink = mono ? INK[t] : INK[t];
  const mark = mono ? d.mark(t).replaceAll(ACCENT[t], INK[t]) : d.mark(t);
  const tittle = mono ? d.tittle(t).replaceAll(ACCENT[t], INK[t]) : d.tittle(t);
  return `<g color="${ink}"><svg width="36" height="36" viewBox="0 0 32 32">${mark}</svg><g transform="translate(46 0)">${wordmark(tittle)}</g></g>`;
};

const mark = (d, t, size, mono = false) => {
  const m = mono ? d.mark(t).replaceAll(ACCENT[t], INK[t]) : d.mark(t);
  return `<svg width="${size}" height="${size}" viewBox="0 0 32 32">${m}</svg>`;
};

for (const [name, d] of Object.entries(directions)) {
  const W = 640, H = 470;
  const panel = (t, y, h) => `<rect y="${y}" width="${W}" height="${h}" fill="${PAGE[t]}"/>`;
  const label = (t, x, y, s) => `<text x="${x}" y="${y}" font-family="system-ui, sans-serif" font-size="12" fill="${MUTED[t]}">${s}</text>`;
  const sizes = (t, y) =>
    [64, 32, 24, 16]
      .map((s, i, a) => {
        const x = 32 + a.slice(0, i).reduce((n, v) => n + v + 28, 0);
        return `<g transform="translate(${x} ${y + 64 - s})">${mark(d, t, s)}</g>${label(t, x, y + 82, `${s}px`)}`;
      })
      .join("");
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">
  <title>skrim logo direction ${name}: ${d.title}</title>
  ${panel("light", 0, 235)}${panel("dark", 235, 235)}
  <g transform="translate(32 28) scale(1.6)">${lockup(d, "light")}</g>
  <g transform="translate(352 40) scale(1.0)">${lockup(d, "light", true)}</g>${label("light", 352, 96, "monochrome")}
  ${sizes("light", 120)}
  <g transform="translate(32 263) scale(1.6)">${lockup(d, "dark")}</g>
  <g transform="translate(352 275) scale(1.0)">${lockup(d, "dark", true)}</g>${label("dark", 352, 331, "monochrome")}
  ${sizes("dark", 355)}
</svg>`;
  writeFileSync(new URL(`./${name}.svg`, import.meta.url), svg);
}
writeFileSync(
  new URL("./README.md", import.meta.url),
  `# Logo directions (proposals — nothing is wired in)\n\nAll shapes are hand-written paths (no font). Accent = \`--link\` (#1a56a8 light / #8ab8ff dark). Each sheet shows the lockup in light and dark, a monochrome lockup, and the mark at 64/32/24/16px.\n\n${Object.entries(directions)
    .map(([n, d]) => `- **${n}.svg — ${d.title}.** ${d.why}`)
    .join("\n")}\n\nRegenerate: \`node design-audit/logo-options/make.mjs\`\n`,
);
