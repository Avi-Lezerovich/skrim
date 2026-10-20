// Derived views over the JSON in data.ts, computed at build time.
import {
  BLOC_NAMES,
  EMBARGO_END,
  average,
  latestBlocs,
  latestParties,
  okPolls,
  partyName,
  parties,
  pollsterName,
  trendParties,
  type Bloc,
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
 * Compact payload for the trends grid (G4): polls are listed once and referenced by index,
 * and each party's series is [mean, sd] per average day (null when absent).
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
  return {
    polls: list.map((p) => ({ k: p.key, d: p.field_date!, p: p.pollster ?? "" })),
    days,
    charts,
    ymax,
    threshold: THRESHOLD_SEATS,
    pollsterNames: Object.fromEntries(pollsterIds.map((id) => [id, pollsterName(id)])),
  };
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
