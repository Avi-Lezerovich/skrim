// G4 — one small chart per party on a shared scale (trends page).
import * as Plot from "@observablehq/plot";
import { baseOptions, chrome, day, fmtDay } from "./theme";

type Band = { date: string; mean: number; sd: number; n: number };
type Dot = { date: string; seats: number; pollster: string; key: string };

export type PartyData = {
  name: string;
  series: Band[];
  dots: Dot[];
  ymax: number;
  domain: [string, string];
  highlight: string | null;
  pollsterNames: Record<string, string>;
};

export function partyChart(d: PartyData, width: number) {
  const c = chrome();
  const rows = d.series.map((s) => ({ ...s, x: day(s.date), lo: Math.max(0, s.mean - s.sd), hi: s.mean + s.sd }));
  const dots = d.dots.map((p) => ({ ...p, x: day(p.date), on: d.highlight === p.pollster }));
  const last = rows.at(-1);
  return Plot.plot({
    ...baseOptions(width, 170),
    marginRight: 40,
    marginTop: 8,
    x: { ...baseOptions(width, 170).x, ticks: 3, domain: d.domain.map(day) },
    y: { domain: [0, d.ymax], ticks: 3, grid: true, label: null },
    marks: [
      Plot.gridY({ stroke: c.grid, strokeOpacity: 1, ticks: 3 }),
      Plot.ruleY([0], { stroke: c.axis }),
      Plot.areaY(rows, { x: "x", y1: "lo", y2: "hi", fill: c.accent, fillOpacity: 0.14, curve: "monotone-x" }),
      Plot.dot(dots.filter((p) => !p.on), { x: "x", y: "seats", r: 2, fill: c.muted, fillOpacity: d.highlight ? 0.25 : 0.5 }),
      Plot.lineY(rows, { x: "x", y: "mean", stroke: c.accent, strokeWidth: 2, curve: "monotone-x" }),
      Plot.dot(dots.filter((p) => p.on), { x: "x", y: "seats", r: 4, fill: c.ink, stroke: c.surface, strokeWidth: 2 }),
      last ? Plot.text([last], { x: "x", y: "mean", text: (r) => r.mean.toFixed(0), textAnchor: "start", dx: 6, fill: c.ink, fontWeight: 700 }) : null,
      Plot.tip(
        dots,
        Plot.pointer({
          x: "x",
          y: "seats",
          title: (p) => `${d.pollsterNames[p.pollster] ?? p.pollster}\n${fmtDay.format(p.x)}: ${p.seats} מנדטים`,
          fill: c.surface,
          stroke: c.axis,
          maxRadius: 24,
        }),
      ),
    ],
  });
}
