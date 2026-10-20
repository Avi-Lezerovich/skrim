// G4 — one small chart per party on a shared scale (trends page): average line, spread band,
// poll dots, the threshold line. A highlighted pollster's dots stay solid and the rest fade.
import * as Plot from "@observablehq/plot";
import { chrome, fmtDay, hidden } from "./theme";

export type PartyDot = { x: Date; seats: number; pollster: string; key: string };

export type PartyData = {
  id: string;
  name: string;
  series: { x: Date; mean: number; sd: number }[];
  dots: PartyDot[];
  /** Too few polls for an average line: dots only. */
  sparse: boolean;
};

export type PartyView = {
  ymax: number;
  threshold: number;
  domain: [Date, Date];
  highlight: string | null;
};

/** Render one party. `onPoint` receives the poll under the pointer (or null). */
export function partyChart(d: PartyData, v: PartyView, width: number, height: number, onPoint?: (p: PartyDot | null) => void) {
  const c = chrome();
  const inside = (x: Date) => x >= v.domain[0] && x <= v.domain[1];
  const rows = d.series.filter((s) => inside(s.x)).map((s) => ({ ...s, lo: Math.max(0, s.mean - s.sd), hi: s.mean + s.sd }));
  const dots = d.dots.filter((p) => inside(p.x));
  const on = dots.filter((p) => p.pollster === v.highlight);
  const off = v.highlight ? dots.filter((p) => p.pollster !== v.highlight) : dots;
  const last = rows.at(-1);
  const svg = Plot.plot({
    width,
    height,
    marginTop: 10,
    marginRight: 30,
    marginLeft: 28,
    marginBottom: 24,
    style: { background: "transparent", color: c.ink2, fontSize: "12px", overflow: "visible" },
    x: { type: "utc", domain: v.domain },
    y: { domain: [0, v.ymax] },
    marks: [
      Plot.gridY({ ...hidden, stroke: c.grid, strokeOpacity: 1, ticks: 3 }),
      Plot.axisX({
        ...hidden,
        // Short ranges get a tick every week; the full range three ticks.
        ticks: v.domain[1].getTime() - v.domain[0].getTime() <= 31 * 86_400_000 ? "week" : width < 280 ? 2 : 3,
        tickFormat: (x: Date) => fmtDay.format(x),
        label: null,
      }),
      Plot.axisY({ ...hidden, ticks: 3, label: null }),
      Plot.ruleY([v.threshold], { ...hidden, stroke: c.axis, strokeDasharray: "4 3" }),
      d.sparse ? null : Plot.areaY(rows, { ...hidden, x: "x", y1: "lo", y2: "hi", fill: c.ink, fillOpacity: c.band, curve: "monotone-x" }),
      Plot.dot(off, { ...hidden, x: "x", y: "seats", r: 2.5, fill: c.ink2, fillOpacity: v.highlight ? 0.14 : c.dot }),
      d.sparse ? null : Plot.lineY(rows, { ...hidden, x: "x", y: "mean", stroke: c.ink, strokeWidth: c.line, curve: "monotone-x" }),
      Plot.dot(on, { ...hidden, x: "x", y: "seats", r: 3.5, fill: c.ink, fillOpacity: c.dotOn, stroke: c.surface, strokeWidth: 1.5 }),
      !d.sparse && last
        ? Plot.text([last], {
            ...hidden, x: "x", y: "mean", text: (r) => Math.round(r.mean).toString(), textAnchor: "start", dx: 6,
            fill: c.ink, stroke: c.surface, strokeWidth: 3, fontWeight: 700,
          })
        : null,
      // Ring around the poll under the pointer; Plot reports it through the "input" event.
      Plot.dot(dots, Plot.pointer({ ...hidden, x: "x", y: "seats", r: 6, fill: "none", stroke: c.ink, strokeWidth: 1.5, maxRadius: 24 })),
    ],
  }) as SVGSVGElement & { value?: PartyDot | null };
  if (onPoint) svg.addEventListener("input", () => onPoint(svg.value ?? null));
  return svg;
}
