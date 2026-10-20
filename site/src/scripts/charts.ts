import * as Plot from "@observablehq/plot";

type Band = { date: string; mean: number; sd: number; n: number };
type Dot = { date: string; seats: number; pollster: string; key: string };

const css = (name: string) =>
  getComputedStyle(document.documentElement).getPropertyValue(name).trim();

const fmtDay = new Intl.DateTimeFormat("he-IL", { day: "numeric", month: "numeric", timeZone: "UTC" });
const day = (iso: string) => new Date(iso + "T00:00:00Z");

/** Re-render on resize and on light/dark change; charts read colors from CSS tokens. */
export function mount(el: HTMLElement, render: (width: number) => Element) {
  const draw = () => {
    const w = el.clientWidth || 640;
    el.replaceChildren(render(w));
  };
  draw();
  let last = el.clientWidth;
  new ResizeObserver(() => {
    if (Math.abs(el.clientWidth - last) > 8) {
      last = el.clientWidth;
      draw();
    }
  }).observe(el);
  matchMedia("(prefers-color-scheme: dark)").addEventListener("change", draw);
  return draw;
}

function chrome() {
  return {
    ink: css("--ink"),
    ink2: css("--ink-2"),
    muted: css("--muted"),
    grid: css("--grid"),
    axis: css("--axis"),
    surface: css("--surface"),
    accent: css("--accent"),
    accentSoft: css("--accent-soft"),
  };
}

function baseOptions(width: number, height: number) {
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

export type BlocData = {
  names: Record<string, string>;
  series: Record<string, Band[]>; // bloc -> daily average
  dots: Record<string, Dot[]>; // bloc -> polls
};

export function blocChart(data: BlocData, width: number) {
  const c = chrome();
  const blocs = Object.keys(data.series);
  const color = (b: string) => css(`--bloc-${b}`);
  const rows = blocs.flatMap((b) =>
    data.series[b].map((d) => ({ ...d, bloc: b, x: day(d.date), lo: d.mean - d.sd, hi: d.mean + d.sd })),
  );
  const dots = blocs.flatMap((b) => data.dots[b].map((d) => ({ ...d, bloc: b, x: day(d.date) })));
  const ends = blocs.map((b) => ({ ...rows.filter((r) => r.bloc === b).at(-1)!, name: data.names[b], labelY: 0 }));
  // Nudge end labels apart when blocs finish within a few seats of each other.
  const sorted = [...ends].sort((a, b) => b.mean - a.mean);
  sorted.forEach((e, i) => {
    e.labelY = i && sorted[i - 1].labelY - e.mean < 4 ? sorted[i - 1].labelY - 4 : e.mean;
  });
  const ymax = Math.max(70, ...dots.map((d) => d.seats)) + 2;
  return Plot.plot({
    ...baseOptions(width, width < 500 ? 300 : 380),
    marginRight: 132,
    y: { domain: [0, ymax], grid: true, label: "מנדטים", ticks: 6 },
    marks: [
      Plot.gridY({ stroke: c.grid, strokeOpacity: 1 }),
      Plot.ruleY([61], { stroke: c.muted, strokeWidth: 1 }),
      Plot.text([61], { y: (d) => d, frameAnchor: "left", dx: 4, dy: -7, text: () => "61 · רוב", fill: c.muted }),
      ...blocs.map((b) =>
        Plot.areaY(rows.filter((r) => r.bloc === b), { x: "x", y1: "lo", y2: "hi", fill: color(b), fillOpacity: 0.14, curve: "monotone-x" }),
      ),
      ...blocs.map((b) =>
        Plot.dot(dots.filter((d) => d.bloc === b), { x: "x", y: "seats", r: 2.5, fill: color(b), fillOpacity: 0.35 }),
      ),
      ...blocs.map((b) =>
        Plot.lineY(rows.filter((r) => r.bloc === b), { x: "x", y: "mean", stroke: color(b), strokeWidth: 2, curve: "monotone-x" }),
      ),
      Plot.text(ends, { x: "x", y: "labelY", text: (d) => `${Math.round(d.mean)} · ${d.name}`, textAnchor: "start", dx: 6, fill: c.ink, fontWeight: 600 }),
      Plot.ruleX(rows, Plot.pointerX({ x: "x", stroke: c.axis })),
      Plot.tip(
        rows,
        Plot.pointerX({
          x: "x",
          y: "mean",
          title: (d) =>
            `${fmtDay.format(d.x)} · ${data.names[d.bloc]}\n${d.mean.toFixed(1)} מנדטים (פיזור ${d.lo.toFixed(0)}–${d.hi.toFixed(0)})\n${d.n} סוקרים בחלון`,
          fill: c.surface,
          stroke: c.axis,
        }),
      ),
    ],
  });
}

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

export type EffectRow = { name: string; effect: number; lo: number; hi: number; n: number };

export function houseEffectChart(rows: EffectRow[], width: number) {
  const c = chrome();
  const sorted = [...rows].sort((a, b) => b.effect - a.effect);
  const ext = Math.max(4, ...rows.flatMap((r) => [Math.abs(r.lo), Math.abs(r.hi)])) + 1;
  return Plot.plot({
    width,
    height: 40 + sorted.length * 34,
    marginLeft: 16,
    marginRight: 160,
    marginTop: 24,
    style: { background: "transparent", color: c.ink2, fontSize: "12px" },
    x: { domain: [-ext, ext], grid: true, label: null, tickFormat: (v: number) => (v > 0 ? `+${v}` : `${v}`) },
    y: { domain: sorted.map((r) => r.name), axis: "right", label: null, tickSize: 0 },
    marks: [
      Plot.gridX({ stroke: c.grid, strokeOpacity: 1 }),
      Plot.ruleX([0], { stroke: c.muted }),
      Plot.ruleY(sorted, { y: "name", x1: "lo", x2: "hi", stroke: c.accent, strokeWidth: 2 }),
      Plot.dot(sorted, { y: "name", x: "effect", r: 5, fill: c.accent, stroke: c.surface, strokeWidth: 2 }),
      Plot.tip(
        sorted,
        Plot.pointerY({
          y: "name",
          x: "effect",
          title: (r) => `${r.name}\n${r.effect > 0 ? "+" : ""}${r.effect.toFixed(1)} מנדטים (95%: ${r.lo.toFixed(1)} עד ${r.hi.toFixed(1)})\n${r.n} סקרים`,
          fill: c.surface,
          stroke: c.axis,
        }),
      ),
    ],
  });
}
