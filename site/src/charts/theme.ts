// Colors, formats and base Plot options shared by every chart. Charts read colors from the
// CSS tokens at render time, so they follow light/dark without their own palette.

export const css = (name: string) =>
  getComputedStyle(document.documentElement).getPropertyValue(name).trim();

export const fmtDay = new Intl.DateTimeFormat("he-IL", { day: "numeric", month: "numeric", timeZone: "UTC" });
export const day = (iso: string) => new Date(iso + "T00:00:00Z");

/** Token values used for chart chrome and marks (FRONTEND_PLAN §3.1). */
export function chrome() {
  const num = (name: string) => Number(css(name));
  return {
    ink: css("--ink"),
    ink2: css("--ink-2"),
    muted: css("--muted"),
    grid: css("--rule"),
    axis: css("--axis"),
    surface: css("--surface"),
    accent: css("--accent"),
    band: num("--band-opacity"),
    dot: num("--dot-opacity"),
    dotOn: num("--dot-on-opacity"),
    line: num("--line-width"),
  };
}

export function baseOptions(width: number, height: number) {
  const c = chrome();
  return {
    width,
    height,
    marginTop: 16,
    marginRight: 88,
    marginLeft: 36,
    marginBottom: 28,
    style: { background: "transparent", color: c.ink2, fontSize: "12px", overflow: "visible" },
    x: { type: "utc" as const, ticks: width < 500 ? 4 : 7, tickFormat: (d: Date) => fmtDay.format(d), label: null },
  };
}

/** Spread onto every mark: the SVG carries one label and description; marks stay silent. */
export const hidden = { ariaHidden: true } as const;
