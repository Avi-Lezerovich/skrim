// Value readout for the bloc chart. Used at build time (the latest day is in the HTML, so the
// line has its height before JS runs) and in the browser as the reader moves along the chart.
import { fmtNum } from "../lib/format";

/** One day of the bloc average: [mean, sd] per bloc, and the number of pollsters in the window. */
export type BlocDay = { date: string; n: number; v: Record<string, [number, number]> };

export type BlocData = {
  label: string;
  summary: string;
  blocs: string[];
  names: Record<string, string>;
  /** End-label names; `tiny` below 500px. */
  short: Record<string, string>;
  tiny: Record<string, string>;
  days: BlocDay[];
  /** One entry per poll: field date and seats per bloc, in the order of `blocs`. */
  dots: { date: string; s: (number | null)[] }[];
};

const dateFmt = new Intl.DateTimeFormat("he-IL", { day: "numeric", month: "numeric", year: "numeric", timeZone: "UTC" });

export function blocReadout(d: BlocDay, data: Pick<BlocData, "blocs" | "names">): string {
  const items = data.blocs
    .filter((b) => d.v[b])
    .map((b) => {
      const [mean, sd] = d.v[b];
      const range = fmtNum(null, "range", { lo: Math.max(0, mean - sd), hi: mean + sd });
      return (
        `<span class="ro-item"><i class="swatch" style="background: var(--bloc-${b})"></i>` +
        `${data.names[b]} <strong><bdi>${fmtNum(mean, "seats")}</bdi></strong> ` +
        `<span class="muted">(<bdi>${range}</bdi>)</span></span>`
      );
    });
  const pollsters = d.n === 1 ? "סוקר אחד בחלון" : `${d.n} סוקרים בחלון`;
  return (
    `<strong class="ro-date"><bdi>${dateFmt.format(new Date(d.date))}</bdi></strong>` +
    items.join("") +
    `<span class="ro-n muted">${pollsters} · בסוגריים: פיזור בין הסוקרים</span>`
  );
}
