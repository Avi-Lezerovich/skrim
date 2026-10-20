// G5 — house effects: point and 95% interval around zero, one row per pollster.
import * as Plot from "@observablehq/plot";
import { chrome } from "./theme";

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
