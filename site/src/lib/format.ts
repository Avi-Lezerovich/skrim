// Number formatting with bidi in mind. In Hebrew text, ranges ("46–57"), signed values
// ("−2.0") and percentages ("±3.5%") reorder unless they are isolated; the Num component
// wraps the strings built here in <bdi>. Where markup is impossible (title attributes,
// SVG text, CSV), ltr() isolates with invisible LRI…PDI marks instead.

export const MINUS = "−"; // real minus sign, not a hyphen
export const DASH = "–"; // en dash for ranges
export const MISSING = "—";

export type NumKind = "seats" | "pct" | "int" | "range" | "signed";

export type NumOptions = {
  lo?: number | null;
  hi?: number | null;
  /** Decimal places. Defaults: seats/range 0 (whole seats in headlines), signed 1, pct as given. */
  digits?: number;
};

const intFmt = new Intl.NumberFormat("he-IL", { maximumFractionDigits: 0 });
const fixed = (v: number, digits: number) => v.toFixed(digits).replace("-", MINUS);
const ok = (v: number | null | undefined): v is number => v != null && Number.isFinite(v);

/** Format a value for display, or null when it is missing (caller shows "—"). */
export function fmtNum(value: number | null | undefined, kind: NumKind, opts: NumOptions = {}): string | null {
  const { lo, hi, digits } = opts;
  switch (kind) {
    case "seats":
      return ok(value) ? fixed(value, digits ?? 0) : null;
    case "int":
      return ok(value) ? intFmt.format(value) : null;
    case "pct":
      return ok(value) ? `${digits == null ? String(value) : value.toFixed(digits)}%` : null;
    case "range": {
      if (!ok(lo) || !ok(hi)) return null;
      const d = digits ?? 0;
      return `${fixed(lo, d)}${DASH}${fixed(hi, d)}`;
    }
    case "signed": {
      if (!ok(value)) return null;
      const s = value.toFixed(digits ?? 1);
      if (Number(s) === 0) return s.replace("-", "");
      return value > 0 ? `+${s}` : s.replace("-", MINUS);
    }
  }
}

/** Isolate a left-to-right run inside RTL plain text (attributes, SVG, CSV). */
export const ltr = (s: string) => `⁦${s}⁩`;
