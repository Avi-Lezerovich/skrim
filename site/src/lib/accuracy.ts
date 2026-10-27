// "Who was right" (SPEC, ציון דיוק; methodology.md): each pollster's last poll before the
// publication ban and each channel's election-night numbers, scored against the CEC results.
// The definitions and formulas are the ones methodology.md fixed before election day.
import { exitPolls, okPolls, partyName, parties, pollsterName, type Bloc, type ExitMethod } from "./data";
import { partyColor } from "./partyColors";
import { seatDistance } from "./selectors";

/** The ban starts at the end of Friday 23.10.2026 (§16ה(ח)); a poll fielded by then can be a "last poll". */
export const BAN_START = "2026-10-23";
export const ELECTION_DAY = "2026-10-27";
/** A last poll fielded more than this many days before the election is marked apart. */
export const STALE_DAYS = 7;

export type EntryKind = "poll" | ExitMethod["kind"];
export type Entry = {
  kind: EntryKind;
  id: string;
  name: string;
  /** Who ran it (pollster) or published it (channel). */
  by: string;
  date: string | null;
  /** The site's page for a poll; the page the numbers were copied from for election night. */
  href: string;
  external: boolean;
  seats: Record<string, number>;
  /** National vote shares as reported, by party; null when none were reported. */
  pct: Record<string, number> | null;
  stale: boolean;
};

export type Score = {
  /** Half the sum of absolute seat errors: seats that "moved" to the wrong list. */
  main: number;
  /** |coalition in the entry − coalition in the results|. */
  bloc: number;
  /** Lists put on the right side of the threshold, out of every list in either. */
  threshold: { right: number; of: number };
  /** Root mean square error in percentage points over the lists the entry reported; null without shares. */
  rmse: number | null;
  /** Entry minus result, per list. */
  signed: Record<string, number>;
};

const coalition = (seats: Record<string, number>) =>
  Object.entries(seats).reduce((s, [id, n]) => s + (parties[id]?.bloc === ("coalition" satisfies Bloc) ? n : 0), 0);

const daysBefore = (iso: string, end: string) => (Date.parse(end) - Date.parse(iso)) / 86_400_000;

/** Each pollster's latest poll fielded by BAN_START (latest field date, then latest filing). */
export function lastPolls(): Entry[] {
  const last = new Map<string, (typeof okPolls)[number]>();
  for (const p of okPolls) {
    if (!p.pollster || !p.field_date || p.field_date > BAN_START) continue;
    const prev = last.get(p.pollster);
    if (!prev || p.field_date > prev.field_date! || (p.field_date === prev.field_date && (p.transfer_date ?? "") > (prev.transfer_date ?? "")))
      last.set(p.pollster, p);
  }
  return [...last.values()].map((p) => {
    const pct = Object.fromEntries(p.rows.filter((r) => r.party_id && r.pct != null).map((r) => [r.party_id!, r.pct!]));
    return {
      kind: "poll",
      id: p.key,
      name: pollsterName(p.pollster, p.pollster_raw),
      by: pollsterName(p.pollster, p.pollster_raw),
      date: p.field_date,
      href: `/polls/${p.key}`,
      external: false,
      seats: p.seats,
      pct: Object.keys(pct).length ? pct : null,
      stale: daysBefore(p.field_date!, ELECTION_DAY) > STALE_DAYS,
    };
  });
}

/** Each channel's latest election-night numbers. */
export function nightEntries(): Entry[] {
  return exitPolls.channels.map((c) => {
    const v = c.versions.at(-1)!;
    return {
      kind: c.method.kind,
      id: c.id,
      name: c.name,
      by: v.pollster ?? c.name,
      date: ELECTION_DAY,
      href: v.source_url,
      external: true,
      seats: v.seats,
      pct: null,
      stale: false,
    };
  });
}

export function score(e: Entry, results: NonNullable<typeof exitPolls.results>): Score {
  const ids = [...new Set([...Object.keys(e.seats), ...Object.keys(results.seats)])];
  const signed = Object.fromEntries(ids.map((id) => [id, (e.seats[id] ?? 0) - (results.seats[id] ?? 0)]));
  const right = ids.filter((id) => (e.seats[id] ?? 0) > 0 === (results.seats[id] ?? 0) > 0).length;
  const actualPct = new Map(results.rows.flatMap((r) => (r.pct == null ? [] : [[r.party_id, r.pct] as const])));
  const both = e.pct ? Object.keys(e.pct).filter((id) => actualPct.has(id)) : [];
  return {
    main: seatDistance(e.seats, results.seats),
    bloc: Math.abs(coalition(e.seats) - coalition(results.seats)),
    threshold: { right, of: ids.length },
    rmse: both.length ? Math.sqrt(both.reduce((s, id) => s + (e.pct![id] - actualPct.get(id)!) ** 2, 0) / both.length) : null,
    signed,
  };
}

/** Entries with their scores, best first (main score, then bloc error), with shared ranks for ties. */
export function ranked(entries: Entry[]) {
  const res = exitPolls.results;
  if (!res) return entries.map((e) => ({ ...e, score: null, rank: null }));
  const scored = entries.map((e) => ({ ...e, score: score(e, res) })).sort((a, b) => a.score.main - b.score.main || a.score.bloc - b.score.bloc);
  return scored.map((e) => ({ ...e, rank: 1 + scored.findIndex((o) => o.score.main === e.score.main && o.score.bloc === e.score.bloc) }));
}

/** Lists for the signed-error table: every list with seats in the results or in any entry, largest result first. */
export function signedRows(entries: Entry[]) {
  const res = exitPolls.results;
  if (!res) return [];
  const ids = [...new Set([...Object.keys(res.seats), ...entries.flatMap((e) => Object.keys(e.seats))])].filter(
    (id) => (res.seats[id] ?? 0) > 0 || entries.some((e) => (e.seats[id] ?? 0) > 0),
  );
  return ids
    .map((id) => ({ id, name: partyName(id), color: partyColor(id), actual: res.seats[id] ?? 0 }))
    .sort((a, b) => b.actual - a.actual || a.name.localeCompare(b.name, "he"));
}
