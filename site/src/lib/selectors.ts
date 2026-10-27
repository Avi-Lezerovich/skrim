// Derived views over the JSON in data.ts, computed at build time.
import {
  BLOC_NAMES,
  EMBARGO_END,
  average,
  exitPolls,
  latestBlocs,
  latestParties,
  okPolls,
  partyName,
  parties,
  pollsterName,
  sponsorName,
  trendParties,
  type Bloc,
  type ExitVersion,
  type Poll,
} from "./data";

/** Seats a party gets when it just passes the 3.25% threshold. */
export const THRESHOLD_SEATS = 4;

/** After polls close the home headline says this is the final pre-election average (build time). */
export const isFinal = () => new Date() >= EMBARGO_END;

const DAY = 86_400_000;

/** The polls behind the latest average: each pollster's latest poll inside the window. */
export function windowPolls(): Poll[] {
  const end = Date.parse(latestParties.date);
  const start = end - average.window_days * DAY;
  return latestParties.pollsters
    .map((id) =>
      okPolls.find((p) => p.pollster === id && p.field_date && Date.parse(p.field_date) >= start && Date.parse(p.field_date) <= end),
    )
    .filter((p): p is Poll => p != null);
}

export type BlocTileData = { bloc: Bloc; name: string; mean: number; lo: number; hi: number; spark: number[] };

export function blocTiles(): BlocTileData[] {
  return (["coalition", "opposition", "arab"] as const).map((b) => {
    const v = latestBlocs.values[b];
    return {
      bloc: b,
      name: BLOC_NAMES[b],
      mean: v.mean,
      lo: Math.max(0, v.mean - v.sd),
      hi: v.mean + v.sd,
      spark: average.blocs.slice(-30).map((d) => d.values[b]?.mean ?? 0),
    };
  });
}

export type StripSegment = { bloc: Bloc; name: string; seats: number };

/**
 * The 120-seat strip: coalition from the start edge, opposition from the end edge, the
 * other blocs between them, so a majority line in the middle reads the same from both sides.
 */
export function stripSegments(): StripSegment[] {
  const order: Bloc[] = ["coalition", "arab", "other", "opposition"];
  return order
    .filter((b) => latestBlocs.values[b])
    .map((b) => ({ bloc: b, name: BLOC_NAMES[b], seats: latestBlocs.values[b].mean }));
}

/** Parties with fewer polls than this get dots only, no average line (FRONTEND_PLAN §2.2). */
export const MIN_POLLS_FOR_LINE = 5;

/**
 * Compact payload for the trends grid (G4): polls are listed once (key, date, pollster, channel, PDF)
 * and referenced by index, and each party's series is [mean, sd] per average day (null when
 * absent).
 */
export function trendsPayload() {
  const r2 = (v: number) => Math.round(v * 100) / 100;
  const list = okPolls.filter((p) => p.field_date);
  const days = average.parties.map((d) => d.date);
  const charts = trendParties.map((id) => {
    const dots = list.flatMap((p, i) => (id in p.seats ? [[i, p.seats[id]] as [number, number]] : []));
    return {
      id,
      name: partyName(id),
      s: average.parties.map((d) => (d.values[id] ? ([r2(d.values[id].mean), r2(d.values[id].sd)] as [number, number]) : null)),
      dots,
      sparse: dots.length < MIN_POLLS_FOR_LINE,
    };
  });
  const ymax = Math.ceil(Math.max(THRESHOLD_SEATS, ...charts.flatMap((c) => c.dots.map((d) => d[1]))) / 5) * 5;
  const pollsterIds = [...new Set(list.map((p) => p.pollster).filter(Boolean))] as string[];
  const sponsorIds = [...new Set(list.map((p) => p.sponsor).filter(Boolean))] as string[];
  return {
    polls: list.map((p) => ({ k: p.key, d: p.field_date!, p: p.pollster ?? "", s: p.sponsor ?? "", u: p.source_url })),
    days,
    charts,
    ymax,
    threshold: THRESHOLD_SEATS,
    pollsterNames: Object.fromEntries(pollsterIds.map((id) => [id, pollsterName(id)])),
    sponsorNames: Object.fromEntries(sponsorIds.map((id) => [id, sponsorName(id)])),
  };
}

/**
 * Sparkline points ("x,y …") for a party's average on the shared trends scale: x spans the
 * whole period (0–100), y is 0–ymax seats over `h` units, top down.
 */
export function sparkPoints(series: ([number, number] | null)[], ymax: number, h: number) {
  const n = Math.max(1, series.length - 1);
  return series
    .flatMap((v, i) => (v ? [`${((100 * i) / n).toFixed(1)},${(h - (h * Math.min(v[0], ymax)) / ymax).toFixed(1)}`] : []))
    .join(" ");
}

export type PartyRow = {
  id: string;
  name: string;
  color: string;
  mean: number;
  lo: number;
  hi: number;
  /** Polls in the window that gave the party seats (i.e. passing the threshold). */
  passing: number;
};

/**
 * Parties in the latest average, largest first (ties alphabetical). `above`: the spread stays
 * at or over the threshold. `around`: everyone else that has seats in at least one poll in the
 * window or averages half a seat or more.
 */
export function partyRows() {
  const polls = windowPolls();
  const rows: PartyRow[] = Object.entries(latestParties.values)
    .map(([id, v]) => ({
      id,
      name: partyName(id),
      color: parties[id]?.color ?? "transparent",
      mean: v.mean,
      lo: Math.max(0, v.mean - v.sd),
      hi: v.mean + v.sd,
      passing: polls.filter((p) => (p.seats[id] ?? 0) > 0).length,
    }))
    .sort((a, b) => b.mean - a.mean || a.name.localeCompare(b.name, "he"));
  return {
    above: rows.filter((r) => r.lo >= THRESHOLD_SEATS),
    around: rows.filter((r) => r.lo < THRESHOLD_SEATS && (r.passing > 0 || r.mean >= 0.5)),
    windowSize: polls.length,
  };
}

export type ChannelScore = {
  sponsor: string;
  name: string;
  poll: Poll;
  /** Seats that would have to move for the poll to match the average of all polls that day. */
  score: number;
  /** The party furthest from the average, with the poll minus the average. */
  top: { id: string; name: string; diff: number } | null;
};

/**
 * Each channel's latest poll against the average of all polls on its field date, newest
 * first. The score is half the sum of absolute seat gaps over every party in either.
 */
export function channelScores(): ChannelScore[] {
  const byDate = new Map(average.parties.map((d) => [d.date, d.values]));
  const latest = new Map<string, Poll>();
  for (const p of okPolls) {
    if (!p.sponsor || !p.field_date || !byDate.has(p.field_date)) continue;
    const cur = latest.get(p.sponsor);
    if (!cur || p.field_date > cur.field_date!) latest.set(p.sponsor, p);
  }
  return [...latest.entries()]
    .map(([sponsor, poll]) => {
      const avg = byDate.get(poll.field_date!)!;
      const gaps = [...new Set([...Object.keys(poll.seats), ...Object.keys(avg)])].map((id) => ({
        id,
        name: partyName(id),
        diff: (poll.seats[id] ?? 0) - (avg[id]?.mean ?? 0),
      }));
      const top = gaps.reduce<(typeof gaps)[number] | null>((a, g) => (!a || Math.abs(g.diff) > Math.abs(a.diff) ? g : a), null);
      return { sponsor, name: sponsorName(sponsor), poll, score: gaps.reduce((s, g) => s + Math.abs(g.diff), 0) / 2, top };
    })
    .sort((a, b) => b.poll.field_date!.localeCompare(a.poll.field_date!) || a.name.localeCompare(b.name, "he"));
}

/**
 * Seats that would have to move for `a` to match `b`: half the sum of absolute gaps over every
 * party in either. 0 is identical; it is the same score used for the channels table on trends.
 */
export const seatDistance = (a: Record<string, number>, b: Record<string, number>) =>
  [...new Set([...Object.keys(a), ...Object.keys(b)])].reduce((s, id) => s + Math.abs((a[id] ?? 0) - (b[id] ?? 0)), 0) / 2;

/** `name` is the list as the channel printed it; `label` the site's name for the party. */
export type ExitBar = { id: string; name: string; label: string; color: string; seats: number; before: number | null };

export type ExitCard = {
  id: string;
  name: string;
  latest: ExitVersion;
  /** The first version when the channel later updated it. */
  first: ExitVersion | null;
  blocs: StripSegment[];
  bars: ExitBar[];
  /** The channel's last poll filed with the CEC before election day. */
  lastPoll: Poll | null;
  vsLastPoll: number | null;
  vsAverage: number;
  /** Distance from the CEC results; null until they are published. */
  accuracy: number | null;
};

const finalAverage = () => Object.fromEntries(Object.entries(latestParties.values).map(([id, v]) => [id, v.mean]));

/** One card per channel: its latest exit poll, against its own last poll, the final average and the results. */
export function exitCards(): ExitCard[] {
  const avg = finalAverage();
  const results = exitPolls.results?.seats ?? null;
  return exitPolls.channels.map((c) => {
    const latest = c.versions.at(-1)!;
    const lastPoll = okPolls.find((p) => p.sponsor === c.id && p.field_date) ?? null;
    const blocs = blocTotals(latest.seats);
    return {
      id: c.id,
      name: c.name,
      latest,
      first: c.versions.length > 1 ? c.versions[0] : null,
      blocs: (["coalition", "arab", "opposition"] as const).map((b) => ({ bloc: b, name: BLOC_NAMES[b], seats: blocs[b] ?? 0 })),
      bars: latest.rows
        .map((r) => ({
          id: r.party_id,
          name: r.label_raw,
          label: partyName(r.party_id),
          color: parties[r.party_id]?.color ?? "transparent",
          seats: r.seats,
          before: lastPoll ? (lastPoll.seats[r.party_id] ?? 0) : null,
        }))
        .sort((a, b) => b.seats - a.seats || a.name.localeCompare(b.name, "he")),
      lastPoll,
      vsLastPoll: lastPoll ? seatDistance(latest.seats, lastPoll.seats) : null,
      vsAverage: seatDistance(latest.seats, avg),
      accuracy: results ? seatDistance(latest.seats, results) : null,
    };
  });
}

function blocTotals(seats: Record<string, number>) {
  const out: Partial<Record<Bloc, number>> = {};
  for (const [id, n] of Object.entries(seats)) {
    const b = parties[id]?.bloc as Bloc | undefined;
    if (b && b in BLOC_NAMES) out[b] = (out[b] ?? 0) + n;
  }
  return out;
}

export type ExitColumn = { id: string; name: string; seats: Record<string, number>; distance: number | null; kind: "exit" | "average" | "results" };

/**
 * The side-by-side table: a column per channel (latest version), the mean of the exit polls,
 * the final pre-election average and, once published, the results. Rows are parties, largest
 * in the exit polls first; `distance` is each column's distance from the results.
 */
export function exitTable() {
  const cards = exitCards();
  const results = exitPolls.results?.seats ?? null;
  const ids = [...new Set(cards.flatMap((c) => Object.keys(c.latest.seats)))];
  const mean = Object.fromEntries(ids.map((id) => [id, cards.reduce((s, c) => s + (c.latest.seats[id] ?? 0), 0) / cards.length]));
  const avg = finalAverage();
  const dist = (s: Record<string, number>) => (results ? seatDistance(s, results) : null);
  const columns: ExitColumn[] = [
    ...cards.map((c) => ({ id: c.id, name: c.name, seats: c.latest.seats, distance: c.accuracy, kind: "exit" as const })),
    { id: "mean", name: "ממוצע המדגמים", seats: mean, distance: dist(mean), kind: "average" },
    { id: "polls", name: "ממוצע הסקרים", seats: avg, distance: dist(avg), kind: "average" },
    ...(results ? [{ id: "results", name: exitPolls.results!.status === "final" ? "תוצאות האמת" : "תוצאות (חלקיות)", seats: results, distance: 0, kind: "results" as const }] : []),
  ];
  const printed = new Map(cards.flatMap((c) => c.latest.rows.map((r) => [r.party_id, r.label_raw] as const)));
  const rows = ids
    .map((id) => ({ id, name: printed.get(id) ?? partyName(id), color: parties[id]?.color ?? "transparent", bloc: parties[id]?.bloc as Bloc }))
    .sort((a, b) => mean[b.id] - mean[a.id] || a.name.localeCompare(b.name, "he"));
  const blocRows = (["coalition", "opposition", "arab"] as const).map((b) => ({
    bloc: b,
    name: BLOC_NAMES[b],
    values: columns.map((col) => blocTotals(col.seats)[b] ?? 0),
  }));
  return { columns, rows, blocRows, avgDate: latestParties.date };
}
