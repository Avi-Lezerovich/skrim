// The skrim logo — direction 3, "slot" (design-audit/logo-options). Hand-written path data,
// no font. Colours sit in style attributes, so callers may pass CSS variables. The header
// (Logo.astro) and scripts/brand.mjs both draw from here, so the inline logo, the SVG files
// and the raster icons cannot drift apart.

/** Mark, on a 32×32 grid: a ballot box with the slot notch at the top, a dot in the slot,
 *  and a trend line inside. `ink` draws the box, `accent` the line and the dot. */
export const markPaths = (ink, accent) => `
  <path d="M11.5 4.5H7A3.5 3.5 0 0 0 3.5 8v17A3.5 3.5 0 0 0 7 28.5h18a3.5 3.5 0 0 0 3.5-3.5V8A3.5 3.5 0 0 0 25 4.5h-4.5" style="fill:none;stroke:${ink}" stroke-width="2.8" stroke-linecap="round"/>
  <path d="M8.5 23 13 18.5l3.6 2.6L22 13" style="fill:none;stroke:${accent}" stroke-width="2.8" stroke-linecap="round" stroke-linejoin="round"/>
  <circle cx="16" cy="5" r="3" style="fill:${accent}"/>`;

/** Monoline lowercase "skrim" on an 86×36 grid (baseline 32, x-height 12, ascender 2.4). */
export const wordmarkPaths = (ink) => `
  <g style="fill:none;stroke:${ink}" stroke-width="4.4" stroke-linecap="round" stroke-linejoin="round">
    <path d="M13.4 15.2C12.4 13.1 10.4 12 7.9 12 4.6 12 2.6 13.8 2.6 16.3c0 5.9 11.2 3.9 11.2 10.4 0 3.2-2.7 5.3-6.1 5.3-3 0-5.1-1.2-6.2-3.3"/>
    <path d="M21 2.4V32M31.6 12.4 21.6 22.6M25.2 19.4 32.4 32"/>
    <path d="M39 12.4V32M39 19.6c0-4.6 2.9-7.4 7.6-7.4"/>
    <path d="M53 12.4V32"/>
    <path d="M60 12.4V32M60 19.4c0-4.6 2.5-7.2 6-7.2s5.6 2.6 5.6 7.2V32M71.6 19.4c0-4.6 2.5-7.2 6-7.2s5.6 2.6 5.6 7.2V32"/>
  </g>
  <circle cx="53" cy="4.2" r="2.7" style="fill:${ink}"/>`;

/** Full lockup on a 134×36 grid: the mark scaled to 36, a 12-unit gap, the wordmark. */
export const LOCKUP = { width: 134, height: 36, wordmarkX: 48 };
export const lockupPaths = (ink, accent) => `
  <g transform="scale(1.125)">${markPaths(ink, accent)}</g>
  <g transform="translate(${LOCKUP.wordmarkX} 0)">${wordmarkPaths(ink)}</g>`;

/** Brand colours: --ink and --link from tokens.css (FRONTEND_PLAN §3.1). */
export const COLORS = {
  light: { ink: "#111111", accent: "#1a56a8", page: "#fafaf8", surface: "#ffffff" },
  dark: { ink: "#efeee9", accent: "#8ab8ff", page: "#111110", surface: "#1a1a19" },
};
