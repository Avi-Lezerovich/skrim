// Value readout for the bloc chart. Used at build time (the latest day is in the HTML, so the
// line has its height before JS runs) and in the browser as the reader moves along the chart.
import { fmtNum } from "../lib/format";
import { u } from "../lib/url";

/** One day of the bloc average: [mean, sd] per bloc, and the number of pollsters in the window. */
export type BlocDay = { date: string; n: number; v: Record<string, [number, number]> };

export type BlocData = {
  label: string;
  summary: string;
  blocs: string[];
  names: Record<string, string>;
  /** End-label names on wide charts; `tiny` names the blocs in the readout. */
  short: Record<string, string>;
  tiny: Record<string, string>;
  /** Days in the averaging window, for the link to the polls behind a day. */
  window: number;
  days: BlocDay[];
  /** One entry per poll: field date and seats per bloc, in the order of `blocs`. */
  dots: { date: string; s: (number | null)[] }[];
};

const dateFmt = new Intl.DateTimeFormat("he-IL", { day: "numeric", month: "numeric", year: "numeric", timeZone: "UTC" });

/**
 * Two short lines: the day, the pollsters in its window and a link to those polls (the source
 * of the numbers); then each bloc's average with the spread in brackets.
 */
export function blocReadout(d: BlocDay, data: Pick<BlocData, "blocs" | "tiny" | "window">): string {
  const items = data.blocs
    .filter((b) => d.v[b])
    .map((b) => {
      const [mean, sd] = d.v[b];
      const range = fmtNum(null, "range", { lo: Math.max(0, mean - sd), hi: mean + sd });
      return (
        `<span class="ro-item"><i class="swatch" style="background: var(--bloc-${b})"></i>` +
        `${data.tiny[b]} <strong><bdi>${fmtNum(mean, "seats")}</bdi></strong> ` +
        `<span class="muted"><span class="sr-only">פיזור בין הסוקרים </span>(<bdi>${range}</bdi>)</span></span>`
      );
    });
  const pollsters = d.n === 1 ? "סוקר אחד" : `${d.n} סוקרים`;
  const from = new Date(new Date(d.date).getTime() - (data.window - 1) * 86_400_000).toISOString().slice(0, 10);
  return (
    `<span class="ro-head"><strong class="ro-date"><bdi>${dateFmt.format(new Date(d.date))}</bdi></strong>` +
    ` <span class="muted">· ${pollsters} בחלון</span>` +
    ` <a class="ro-src" href="${u(`/polls?from=${from}&amp;to=${d.date}&amp;status=ok`)}">הסקרים ←</a></span>` +
    `<span class="ro-items">${items.join("")}</span>`
  );
}
