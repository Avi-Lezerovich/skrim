// G1 — blocs over time: average line, spread band, poll dots, the 61 line and end labels.
import * as Plot from "@observablehq/plot";
import type { BlocData } from "./readout";
import { baseOptions, chrome, css, day, fmtDay, hidden } from "./theme";

export function blocChart(data: BlocData, width: number, height: number) {
  const c = chrome();
  const color = (b: string) => css(`--bloc-${b}`);
  const rows = data.blocs.flatMap((b) =>
    data.days
      .filter((d) => d.v[b])
      .map((d) => {
        const [mean, sd] = d.v[b];
        return { bloc: b, x: day(d.date), mean, lo: Math.max(0, mean - sd), hi: mean + sd };
      }),
  );
  const dots = data.blocs.flatMap((b, i) =>
    data.dots.filter((p) => p.s[i] != null).map((p) => ({ bloc: b, x: day(p.date), seats: p.s[i]! })),
  );
  // Under 500px the plot gets the width: end labels are just the number (the readout above
  // names the blocs), fewer gridlines, lighter dots. The y axis stays 0-based (FRONTEND_PLAN G1).
  const narrow = width < 500;
  const names = data.short;
  const ends = data.blocs.map((b) => ({ ...rows.filter((r) => r.bloc === b).at(-1)!, name: names[b], labelY: 0 }));
  // Nudge end labels apart when blocs finish within a few seats of each other.
  const sorted = [...ends].sort((a, b) => b.mean - a.mean);
  const gap = narrow ? 5 : 4;
  sorted.forEach((e, i) => {
    e.labelY = i && sorted[i - 1].labelY - e.mean < gap ? sorted[i - 1].labelY - gap : e.mean;
  });
  const ymax = Math.max(70, ...dots.map((d) => d.seats)) + 2;
  const yTicks = narrow ? [0, 20, 40] : 7;
  const marginRight = narrow ? 30 : 132;
  const marginLeft = narrow ? 26 : 36;
  // one date label per ~72px of plot, never more than 7
  const xTicks = Math.max(3, Math.min(7, Math.floor((width - marginLeft - marginRight) / 72)));
  return Plot.plot({
    ...baseOptions(width, height),
    marginRight,
    marginLeft,
    y: { domain: [0, ymax] },
    marks: [
      Plot.gridY({ ...hidden, stroke: c.grid, strokeOpacity: 1, ticks: yTicks }),
      Plot.axisX({ ...hidden, ticks: xTicks, tickFormat: (d: Date) => fmtDay.format(d), label: null }),
      Plot.axisY({ ...hidden, ticks: yTicks, tickSize: narrow ? 0 : 6, label: narrow ? null : "מנדטים" }),
      Plot.ruleY([61], { ...hidden, stroke: c.axis, strokeDasharray: "4 3" }),
      Plot.text([61], {
        ...hidden, y: (d) => d, frameAnchor: "left", dx: 4, dy: -8, text: () => "61 · רוב",
        fill: c.muted, stroke: c.surface, strokeWidth: 3,
      }),
      ...data.blocs.map((b) =>
        Plot.areaY(rows.filter((r) => r.bloc === b), {
          ...hidden, x: "x", y1: "lo", y2: "hi", fill: color(b), fillOpacity: c.band, curve: "monotone-x",
        }),
      ),
      ...data.blocs.map((b) =>
        Plot.dot(dots.filter((d) => d.bloc === b), {
          ...hidden, x: "x", y: "seats", r: narrow ? 2 : 2.5, fill: color(b), fillOpacity: narrow ? c.dot * 0.75 : c.dot,
        }),
      ),
      ...data.blocs.map((b) =>
        Plot.lineY(rows.filter((r) => r.bloc === b), {
          ...hidden, x: "x", y: "mean", stroke: color(b), strokeWidth: c.line, curve: "monotone-x",
        }),
      ),
      Plot.text(ends, {
        ...hidden, x: "x", y: "labelY", text: (d) => (narrow ? `${Math.round(d.mean)}` : `${Math.round(d.mean)} · ${d.name}`),
        textAnchor: "start", dx: narrow ? 6 : 8, fill: (d) => (narrow ? color(d.bloc) : c.ink),
        stroke: c.surface, strokeWidth: 3, fontWeight: 700, fontSize: narrow ? 13 : 12,
      }),
    ],
  });
}

/** Marker dots for the scrubbed day. */
export const blocPoints = (data: BlocData, i: number) =>
  data.blocs.filter((b) => data.days[i].v[b]).map((b) => ({ y: data.days[i].v[b][0], color: css(`--bloc-${b}`) }));
