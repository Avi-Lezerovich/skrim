// Party colours as CSS variables, one per party. The colours in parties.csv are picked for the
// light page; on the dark page several (Shas, UTJ, Beyachad…) sit near 1:1 against the surface
// and their bars and swatches vanish. In dark mode each colour is lightened in OKLab, keeping its
// hue and chroma, until it reaches 3:1 against surface-2, the lighter of the two dark surfaces
// that marks sit on (WCAG 1.4.11). Light-mode colours are unchanged.
import { parties } from "./data";

/** The colour to use in markup and inline styles: follows the theme. */
export const partyColor = (id: string | null) => (id && parties[id] ? `var(--party-${id})` : "transparent");

/** surface-2 in dark mode; keep in step with tokens.css. */
const DARK_SURFACE_2 = "#242422";
const MIN_CONTRAST = 3;

type Rgb = [number, number, number];
const toLinear = (c: number) => (c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4);
const toGamma = (c: number) => (c <= 0.0031308 ? 12.92 * c : 1.055 * c ** (1 / 2.4) - 0.055);
const hexToRgb = (hex: string): Rgb => [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255) as Rgb;
const rgbToHex = (rgb: Rgb) =>
  "#" + rgb.map((c) => Math.round(Math.min(1, Math.max(0, c)) * 255).toString(16).padStart(2, "0")).join("");

const luminance = (rgb: Rgb) => {
  const [r, g, b] = rgb.map(toLinear);
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
};
const contrast = (a: Rgb, b: Rgb) => {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
};

function toOklab(rgb: Rgb): Rgb {
  const [r, g, b] = rgb.map(toLinear);
  const l = Math.cbrt(0.4122214708 * r + 0.5363325363 * g + 0.0514459929 * b);
  const m = Math.cbrt(0.2119034982 * r + 0.6806995451 * g + 0.1073969566 * b);
  const s = Math.cbrt(0.0883024619 * r + 0.2817188376 * g + 0.6299787005 * b);
  return [
    0.2104542553 * l + 0.793617785 * m - 0.0040720468 * s,
    1.9779984951 * l - 2.428592205 * m + 0.4505937099 * s,
    0.0259040371 * l + 0.7827717662 * m - 0.808675766 * s,
  ];
}

function fromOklab([L, a, b]: Rgb): Rgb {
  const l = (L + 0.3963377774 * a + 0.2158037573 * b) ** 3;
  const m = (L - 0.1055613458 * a - 0.0638541728 * b) ** 3;
  const s = (L - 0.0894841775 * a - 1.291485548 * b) ** 3;
  return [
    4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s,
    -1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s,
    -0.0041960863 * l - 0.7034186147 * m + 1.707614701 * s,
  ].map((c) => toGamma(Math.min(1, Math.max(0, c)))) as Rgb;
}

/** The colour, lightened in steps of OKLab lightness until it reaches MIN_CONTRAST on the dark surface. */
function darkVariant(hex: string): string {
  const surface = hexToRgb(DARK_SURFACE_2);
  const [L0, a, b] = toOklab(hexToRgb(hex));
  for (let L = L0; L <= 1; L += 0.01) {
    const out = rgbToHex(fromOklab([L, a, b]));
    if (contrast(hexToRgb(out), surface) >= MIN_CONTRAST) return out;
  }
  return "#ffffff";
}

const light = Object.values(parties).map((p) => `--party-${p.id}: ${p.color};`).join(" ");
const dark = Object.values(parties).map((p) => `--party-${p.id}: ${darkVariant(p.color)};`).join(" ");

/** The variables for the page head (built once): light values, and dark ones under the same selectors as tokens.css. */
export const PARTY_COLOR_CSS = `:root { ${light} }
@media (prefers-color-scheme: dark) { :root:where(:not([data-theme="light"])) { ${dark} } }
:root[data-theme="dark"] { ${dark} }`;
