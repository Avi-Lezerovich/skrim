// Rendering, accessibility and interaction shared by every chart. No Plot import here: this
// module is tiny, and the chart modules (which pull in Plot) load only when a chart is visible.

/** Hover, touch or arrow keys move a marker along the x axis; the page shows a value readout. */
export type Scrub = {
  dates: Date[];
  /** Index shown when idle — usually the latest day. */
  initial: number;
  /** Marker dots for index i, in data units. */
  points: (i: number) => { y: number; color: string }[];
  onIndex: (i: number) => void;
};

export type ChartOptions = {
  /** Accessible name of the SVG (the chart title). */
  label: string;
  /** The build-time summary sentence. */
  description?: string;
  scrub?: Scrub;
};

type PlotSvg = SVGSVGElement & { scale?: (name: string) => { apply: (v: unknown) => number; range: number[] } };

const SVG = "http://www.w3.org/2000/svg";

/** Silence every mark: Plot labels each <g>, which is not allowed without a role (axe). */
function quiet(root: Element) {
  for (const g of root.querySelectorAll("[aria-label], [aria-description]")) {
    if (g.tagName.toLowerCase() === "svg" && !g.parentElement?.closest("svg")) continue;
    g.removeAttribute("aria-label");
    g.removeAttribute("aria-description");
    g.setAttribute("aria-hidden", "true");
  }
}

/** Show the fallback message and open the table when a chart cannot render. */
export function fail(el: HTMLElement, err?: unknown) {
  if (err) console.error(err);
  const frame = el.closest("figure");
  el.hidden = true;
  if (!frame) return;
  frame.querySelector<HTMLElement>(".chart-error")?.removeAttribute("hidden");
  const table = frame.querySelector<HTMLDetailsElement>("details.table-view");
  if (table) table.open = true;
}

/**
 * Render into el, and re-render on resize and on light/dark change (charts read the CSS
 * tokens). Without options the container is expected to carry its own role="img" label,
 * and the SVG is hidden from assistive tech.
 */
export function mount(el: HTMLElement, render: (width: number, height: number) => Element, opts?: ChartOptions) {
  let index = opts?.scrub?.initial ?? 0;
  let svg: PlotSvg | null = null;

  const marker = () => {
    const s = opts?.scrub;
    if (!s || !svg?.scale) return;
    svg.querySelector(".scrub")?.remove();
    const x = svg.scale("x").apply(s.dates[index]);
    const y = svg.scale("y");
    const g = document.createElementNS(SVG, "g");
    g.setAttribute("class", "scrub");
    g.setAttribute("aria-hidden", "true");
    const line = document.createElementNS(SVG, "line");
    for (const [k, v] of Object.entries({ x1: x, x2: x, y1: y.range[0], y2: y.range[1] })) line.setAttribute(k, String(v));
    line.style.stroke = "var(--axis)";
    g.append(line);
    for (const p of s.points(index)) {
      const c = document.createElementNS(SVG, "circle");
      c.setAttribute("cx", String(x));
      c.setAttribute("cy", String(y.apply(p.y)));
      c.setAttribute("r", "4.5");
      c.style.cssText = `fill: ${p.color}; stroke: var(--surface); stroke-width: 2px`;
      g.append(c);
    }
    svg.append(g);
  };

  const draw = () => {
    try {
      const out = render(el.clientWidth || 640, el.clientHeight || 300);
      quiet(out);
      svg = (out.tagName.toLowerCase() === "svg" ? out : out.querySelector("svg")) as PlotSvg | null;
      if (svg && opts) {
        svg.setAttribute("role", "img");
        svg.setAttribute("aria-label", opts.label);
        if (opts.description) svg.setAttribute("aria-description", opts.description);
      } else svg?.setAttribute("aria-hidden", "true");
      el.replaceChildren(out);
      el.dataset.ready = "";
      marker();
    } catch (err) {
      fail(el, err);
    }
  };
  draw();

  // Plot adds tips and other nodes after render; keep them silent too.
  new MutationObserver((records) => {
    for (const r of records) for (const n of r.addedNodes) if (n instanceof Element) quiet(n);
  }).observe(el, { childList: true, subtree: true });

  let last = [el.clientWidth, el.clientHeight];
  new ResizeObserver(() => {
    if (Math.abs(el.clientWidth - last[0]) > 8 || el.clientHeight !== last[1]) {
      last = [el.clientWidth, el.clientHeight];
      draw();
    }
  }).observe(el);
  matchMedia("(prefers-color-scheme: dark)").addEventListener("change", draw);
  // The header's theme switch sets data-theme on <html>.
  new MutationObserver(draw).observe(document.documentElement, { attributeFilter: ["data-theme"] });

  const s = opts?.scrub;
  if (s) {
    const go = (i: number) => {
      i = Math.max(0, Math.min(s.dates.length - 1, i));
      if (i === index) return;
      index = i;
      marker();
      s.onIndex(i);
    };
    const nearest = (clientX: number) => {
      if (!svg?.scale) return index;
      const rect = svg.getBoundingClientRect();
      const px = ((clientX - rect.left) * (svg.viewBox.baseVal?.width || rect.width)) / rect.width;
      const xs = svg.scale("x");
      let best = 0;
      for (let i = 1; i < s.dates.length; i++)
        if (Math.abs(xs.apply(s.dates[i]) - px) < Math.abs(xs.apply(s.dates[best]) - px)) best = i;
      return best;
    };
    el.addEventListener("pointermove", (e) => go(nearest(e.clientX)));
    el.addEventListener("pointerdown", (e) => go(nearest(e.clientX)));
    // A mouse leaving returns to the latest day; a finger lifting keeps the value it chose.
    el.addEventListener("pointerleave", (e) => e.pointerType === "mouse" && go(s.initial));
    el.addEventListener("keydown", (e) => {
      const step = { ArrowLeft: -1, ArrowRight: 1, PageDown: -7, PageUp: 7 }[e.key];
      if (step) go(index + step);
      else if (e.key === "Home") go(0);
      else if (e.key === "End") go(s.dates.length - 1);
      else return;
      e.preventDefault();
    });
  }
}

/**
 * Wire a ChartFrame: read its JSON payload and, once the chart nears the viewport, load the
 * chart module and start it. Failures show the frame's fallback message.
 */
export function lazyChart<M, D>(
  frameId: string,
  load: () => Promise<M>,
  start: (mod: M, el: HTMLElement, data: D, frame: HTMLElement) => void,
) {
  const frame = document.getElementById(frameId);
  const el = frame?.querySelector<HTMLElement>(".chart-box");
  if (!frame || !el) return;
  const run = async () => {
    try {
      const data = JSON.parse(frame.querySelector("script[data-chart]")!.textContent!) as D;
      start(await load(), el, data, frame);
    } catch (err) {
      fail(el, err);
    }
  };
  if (!("IntersectionObserver" in window)) return void run();
  const io = new IntersectionObserver(
    (entries) => {
      if (entries.some((e) => e.isIntersecting)) {
        io.disconnect();
        run();
      }
    },
    { rootMargin: "300px 0px" },
  );
  io.observe(el);
}
