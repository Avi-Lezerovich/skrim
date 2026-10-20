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
  const narrow = width < 500;
  const names = narrow ? data.tiny : data.short;
  const ends = data.blocs.map((b) => ({ ...rows.filter((r) => r.bloc === b).at(-1)!, name: names[b], labelY: 0 }));
  // Nudge end labels apart when blocs finish within a few seats of each other.
  const sorted = [...ends].sort((a, b) => b.mean - a.mean);
  sorted.forEach((e, i) => {
    e.labelY = i && sorted[i - 1].labelY - e.mean < 4 ? sorted[i - 1].labelY - 4 : e.mean;
  });
  const ymax = Math.max(70, ...dots.map((d) => d.seats)) + 2;
  return Plot.plot({
    ...baseOptions(width, height),
    marginRight: narrow ? 92 : 132,
    y: { domain: [0, ymax] },
    marks: [
      Plot.gridY({ ...hidden, stroke: c.grid, strokeOpacity: 1, ticks: 7 }),
      Plot.axisX({ ...hidden, ticks: narrow ? 4 : 7, tickFormat: (d: Date) => fmtDay.format(d), label: null }),
      Plot.axisY({ ...hidden, ticks: 7, label: "מנדטים" }),
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
        Plot.dot(dots.filter((d) => d.bloc === b), { ...hidden, x: "x", y: "seats", r: 2.5, fill: color(b), fillOpacity: c.dot }),
      ),
      ...data.blocs.map((b) =>
        Plot.lineY(rows.filter((r) => r.bloc === b), {
          ...hidden, x: "x", y: "mean", stroke: color(b), strokeWidth: c.line, curve: "monotone-x",
        }),
      ),
      Plot.text(ends, {
        ...hidden, x: "x", y: "labelY", text: (d) => `${Math.round(d.mean)} · ${d.name}`,
        textAnchor: "start", dx: 8, fill: c.ink, stroke: c.surface, strokeWidth: 3, fontWeight: 600,
      }),
    ],
  });
}

/** Marker dots for the scrubbed day. */
export const blocPoints = (data: BlocData, i: number) =>
  data.blocs.filter((b) => data.days[i].v[b]).map((b) => ({ y: data.days[i].v[b][0], color: css(`--bloc-${b}`) }));
