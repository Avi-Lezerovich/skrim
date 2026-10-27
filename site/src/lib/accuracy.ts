// "Who was right" (SPEC, ציון דיוק; methodology.md): each pollster's last poll before the
// publication ban and each channel's election-night numbers, scored against the CEC results.
// The definitions and formulas are the ones methodology.md fixed before election day.
import { EMBARGO_END, exitPolls, partyName, pollsterName, polls, type ExitMethod } from "./data";
import { partyColor } from "./partyColors";
import { blocTotals, seatDistance } from "./selectors";

/** The ban starts at the end of Friday 23.10.2026 (§16ה(ח)); a poll fielded by then can be a "last poll". */
export const BAN_START = "2026-10-23";
export const ELECTION_DAY = EMBARGO_END.toISOString().slice(0, 10);
/** A last poll fielded more than this many days before the election is marked apart. */
export const STALE_DAYS = 7;

export type EntryKind = "poll" | ExitMethod["kind"];
export type Entry = {
  kind: EntryKind;
  id: string;
  name: string;
  /** The pollster behind a channel's numbers, when the channel named one. */
  by?: string;
  date: string | null;
  /** The site's page for a poll (internal path); the page the numbers were copied from for election night. */
  href: string;
  seats: Record<string, number>;
  /** National vote shares as reported, by party; null when none were reported. */
  pct: Record<string, number> | null;
  stale: boolean;
  /** The last poll is still waiting for manual review (QA), so it is listed but not scored. */
  review: boolean;
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

const coalition = (seats: Record<string, number>) => blocTotals(seats).coalition ?? 0;

const daysBefore = (iso: string, end: string) => (Date.parse(end) - Date.parse(iso)) / 86_400_000;

/** Each pollster's latest poll fielded by BAN_START (latest field date, then latest filing), reviewed or not. */
export function lastPolls(): Entry[] {
  const last = new Map<string, (typeof polls)[number]>();
  for (const p of polls) {
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
      date: p.field_date,
      href: `/polls/${p.key}`,
      seats: p.seats,
      pct: Object.keys(pct).length ? pct : null,
      stale: daysBefore(p.field_date!, ELECTION_DAY) > STALE_DAYS,
      review: p.status !== "ok",
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
      by: v.pollster ?? undefined,
      date: ELECTION_DAY,
      href: v.source_url,
      seats: v.seats,
      pct: null,
      stale: false,
      review: false,
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

/** Entries with their scores, best first (main score, then bloc error), with shared ranks for ties; polls in review last, unscored. */
export function ranked(entries: Entry[]) {
  const res = exitPolls.results;
  const held = entries.filter((e) => !res || e.review).map((e) => ({ ...e, score: null, rank: null }));
  if (!res) return held;
  const scored = entries
    .filter((e) => !e.review)
    .map((e) => ({ ...e, score: score(e, res) }))
    .sort((a, b) => a.score.main - b.score.main || a.score.bloc - b.score.bloc);
  return [...scored.map((e) => ({ ...e, rank: 1 + scored.findIndex((o) => o.score.main === e.score.main && o.score.bloc === e.score.bloc) })), ...held];
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
