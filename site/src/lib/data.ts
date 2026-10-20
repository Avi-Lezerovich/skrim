// Typed access to the JSON written by `python -m pollygraph.analyze`.
import pollsJson from "../data/polls.json";
import averageJson from "../data/average.json";
import houseJson from "../data/house_effects.json";
import partiesJson from "../data/parties.json";
import pollstersJson from "../data/pollsters.json";
import sponsorsJson from "../data/sponsors.json";
import metaJson from "../data/meta.json";
import type { BlocData, BlocDay } from "../charts/readout";
import { ltr } from "./format";

export type Flag = { code: string; level: "error" | "warn" | "info"; detail: string };
export type Row = {
  label_raw: string;
  party_id: string | null;
  seats: number | null;
  pct: number | null;
  page: number;
};
export type Poll = {
  key: string;
  survey_id: string;
  field_date: string | null;
  transfer_date: string | null;
  published_date: string | null;
  pollster: string | null;
  pollster_raw: string;
  sponsor: string | null;
  sponsor_raw: string;
  source_url: string;
  status: "ok" | "needs_review";
  method: string;
  meta: {
    respondents: number | null;
    contacted: number | null;
    planned_n: number | null;
    response_rate: number | null;
    moe_reported: number | null;
    moe_computed: number | null;
    mode: "online" | "phone" | "mixed" | null;
    weighted_declared: boolean;
  };
  rows: Row[];
  seats: Record<string, number>;
  blocs: Record<Bloc, number> | null;
  scenario_tables: number;
  flags: Flag[];
};
export type Bloc = "coalition" | "opposition" | "arab" | "other";
export type AvgPoint = {
  date: string;
  n_polls: number;
  pollsters: string[];
  values: Record<string, { mean: number; sd: number }>;
};
export type HouseEffect = {
  pollster: string;
  key: string;
  effect: number;
  ci_low: number;
  ci_high: number;
  n_polls: number;
};
type Party = { id: string; name_he: string; name_en: string; bloc: string; color: string };

export const polls = pollsJson as unknown as Poll[];
export const average = averageJson as unknown as {
  window_days: number;
  half_life_days: number;
  parties: AvgPoint[];
  blocs: AvgPoint[];
};
export const houseEffects = houseJson as unknown as {
  parties: HouseEffect[];
  blocs: HouseEffect[];
};
export const parties = partiesJson as unknown as Record<string, Party>;
export const pollsters = pollstersJson as unknown as Record<
  string,
  { id: string; name_he: string; name_en: string }
>;
export const sponsors = sponsorsJson as unknown as Record<
  string,
  { id: string; name_he: string; type: string }
>;
export const meta = metaJson;

// Polls close at 22:00 on election day; before then the site carries a draft banner
// (publication ban, §16ה). Deploying publicly is a separate, deliberate decision.
export const EMBARGO_END = new Date("2026-10-27T22:00:00+02:00");

export const BLOCS: Bloc[] = ["coalition", "opposition", "arab", "other"];
export const BLOC_NAMES: Record<Bloc, string> = {
  coalition: "מפלגות הקואליציה",
  opposition: "האופוזיציה",
  arab: "המפלגות הערביות",
  other: "אחרות",
};
/** Short names for chart end labels. */
export const BLOC_SHORT: Record<Bloc, string> = {
  coalition: "קואליציה",
  opposition: "אופוזיציה",
  arab: "מפלגות ערביות",
  other: "אחרות",
};

export const partyName = (id: string | null) => (id && parties[id]?.name_he) || id || "—";
export const pollsterName = (id: string | null, raw = "") =>
  (id && pollsters[id]?.name_he) || raw || "—";
export const sponsorName = (id: string | null, raw = "") =>
  (id && sponsors[id]?.name_he) || raw || "—";

const dateFmt = new Intl.DateTimeFormat("he-IL", {
  day: "numeric",
  month: "numeric",
  year: "numeric",
  timeZone: "UTC",
});
export const fmtDate = (iso: string | null) => (iso ? dateFmt.format(new Date(iso)) : "—");
export const fmtInt = (n: number | null | undefined) =>
  n == null ? "—" : n.toLocaleString("he-IL");
export const fmtPct = (n: number | null | undefined) => (n == null ? "—" : `${n}%`);

export const okPolls = polls.filter((p) => p.status === "ok");
export const latestParties = average.parties.at(-1)!;
export const latestBlocs = average.blocs.at(-1)!;

/** Parties in the latest average with at least half a seat, largest first. */
export const leadingParties = Object.entries(latestParties.values)
  .filter(([, v]) => v.mean >= 0.5)
  .sort((a, b) => b[1].mean - a[1].mean)
  .map(([id, v]) => ({ id, ...v }));

/** Every party that averaged at least one seat on some day, for the trend grid. */
export const trendParties = (() => {
  const peak: Record<string, number> = {};
  for (const d of average.parties)
    for (const [id, v] of Object.entries(d.values)) peak[id] = Math.max(peak[id] ?? 0, v.mean);
  const order = new Map(leadingParties.map((p, i) => [p.id, i]));
  return Object.keys(peak)
    .filter((id) => peak[id] >= 1)
    .sort((a, b) => (order.get(a) ?? 99) - (order.get(b) ?? 99) || peak[b] - peak[a]);
})();

export const MODE_NAMES = { online: "אינטרנט", phone: "טלפון", mixed: "משולב" } as const;

/**
 * Wording for each QA flag (FRONTEND_PLAN §4): a factual title whose subject is the data, the
 * innocent reading ("הסבר אפשרי"), and what we did about it. Never "חשוד", "מניפולציה",
 * "זיוף" or "בעייתי". `title` may use the poll's own numbers.
 */
export const FLAG_TEXT: Record<string, { title: string | ((p: Poll, f: Flag) => string); why: string; did?: string }> = {
  seat_sum: {
    title: (_, f) => {
      const n = f.detail.match(/\d+/)?.[0];
      return n ? `סכום המנדטים שחולצו הוא ${n}, לא 120` : "סכום המנדטים שחולצו אינו 120";
    },
    why: "כמעט תמיד שגיאת חילוץ שלנו בטבלה בפורמט חריג.",
  },
  no_seat_table: {
    title: "לא אותרה טבלת מנדטים בחילוץ",
    why: "הדיווח בפורמט שהחילוץ האוטומטי לא מזהה, או שהסקר לא כלל חלוקת מנדטים.",
  },
  duplicate_party: {
    title: "מפלגה מופיעה פעמיים בטבלה שחולצה",
    why: "בדרך כלל שתי טבלאות שחוברו בטעות בחילוץ.",
  },
  seats_below_threshold: {
    title: (_, f) => {
      const ids = f.detail.split(":")[1]?.split(",").map((s) => partyName(s.trim())) ?? [];
      return `מנדטים למפלגה שאחוז התמיכה הגולמי שלה בדיווח מתחת ל-3.25%${ids.length ? `: ${ids.join(", ")}` : ""}`;
    },
    why: "האחוז הגולמי אינו משוקלל; אחרי שקלול המפלגה יכולה לעבור את אחוז החסימה.",
  },
  no_respondents: {
    title: "מספר המשיבים לא אותר בחילוץ",
    why: "ייתכן שהוא מופיע בדיווח בניסוח שהחילוץ לא מזהה.",
  },
  respondents_gt_contacted: {
    title: "מספר המשיבים שחולץ גדול ממספר הפניות",
    why: "בדרך כלל הדיווח מפרט כמה תת-מדגמים, והחילוץ קרא רק חלק מהם.",
  },
  response_rate_mismatch: {
    title: (p) => {
      const { response_rate: rr, respondents: n, contacted: c } = p.meta;
      return rr != null && n && c
        ? `שיעור ההיענות המדווח (${ltr(`${rr}%`)}) שונה ממשיבים חלקי פניות (${ltr(`${((100 * n) / c).toFixed(1)}%`)})`
        : "שיעור ההיענות המדווח שונה ממשיבים חלקי פניות";
    },
    why: "סוקרים מגדירים היענות בדרכים שונות, למשל כולל מי שהתחיל את הסקר ולא סיים.",
  },
  moe_mismatch: {
    title: (p) => {
      const { moe_reported: r, moe_computed: c } = p.meta;
      return r != null && c != null
        ? `טעות הדגימה המדווחת (${ltr(`±${r}%`)}) שונה מהמחושבת לפי מספר המשיבים (${ltr(`±${c.toFixed(1)}%`)})`
        : "טעות הדגימה המדווחת שונה מהמחושבת לפי מספר המשיבים";
    },
    why: "שקלול מגדיל את טעות הדגימה בפועל, ולכן דיווח שמרני הוא סביר.",
  },
  field_after_transfer: {
    title: "תאריך הביצוע ברשימת הוועדה מאוחר מתאריך ההעברה לוועדה",
    why: "ככל הנראה טעות הקלדה ברשימה.",
  },
  field_date_corrected: {
    title: (_, f) => {
      const [listed, transfer] = f.detail.match(/\d{4}-\d{2}-\d{2}/g) ?? [];
      return listed && transfer
        ? `תאריך הביצוע ברשימת הוועדה (${fmtDate(listed)}) מאוחר ממועד ההעברה (${fmtDate(transfer)})`
        : "תאריך הביצוע ברשימת הוועדה מאוחר ממועד ההעברה";
    },
    why: "ככל הנראה טעות הקלדה ברשימה.",
    did: "השתמשנו בתאריך הביצוע המודפס בדיווח עצמו.",
  },
  scanned: {
    title: "הדיווח הוא קובץ סרוק",
    why: "בקובץ סרוק יש מעט טקסט שאפשר לחלץ, ולכן הנתונים דורשים בדיקה מול המקור.",
  },
};

/** Title, innocent reading and action for one flag on one poll. */
export function flagText(p: Poll, f: Flag) {
  const t = FLAG_TEXT[f.code];
  const title = typeof t?.title === "function" ? t.title(p, f) : (t?.title ?? f.code);
  const did =
    t?.did ??
    (f.level === "error"
      ? "הסקר אינו נכלל בממוצע עד שייבדק ידנית מול ה-PDF."
      : "אין השפעה על הממוצע. הדגל מוצג לשקיפות בלבד.");
  return { title, why: t?.why ?? "", did };
}

// ---- chart payloads (serialised into the page, rendered client-side) ----

const r2 = (v: number) => Math.round(v * 100) / 100;

/** One-sentence reading of the latest bloc average, written at build time (G1 summary). */
function blocSummary(last: BlocDay, shown: Bloc[]) {
  const seats = (b: Bloc) => Math.round(last.v[b][0]);
  const parts = shown.map((b) => `${BLOC_NAMES[b]} ${seats(b)}`).join(", ");
  const [a, b] = [...shown].sort((x, y) => last.v[y][0] - last.v[x][0]);
  const gap = Math.abs(seats(a) - seats(b));
  const spread = Math.max(last.v[a][1], last.v[b][1]);
  const gapText =
    gap === 0
      ? "לשני הגושים הגדולים אותו מספר מנדטים בממוצע."
      : `הפער בין שני הגושים הגדולים (${gap}) ${gap < spread ? "קטן" : "גדול"} מהפיזור בין הסוקרים.`;
  const majority = shown.find((x) => seats(x) >= 61);
  const majorityText = majority
    ? `גוש עם 61 מנדטים או יותר בממוצע: ${BLOC_NAMES[majority]}.`
    : "אף גוש אינו מגיע ל-61 מנדטים בממוצע.";
  return `בממוצע של ${fmtDate(last.date)}: ${parts} מנדטים. ${gapText} ${majorityText}`;
}

export function blocChartData(): BlocData {
  const shown: Bloc[] = ["coalition", "opposition", "arab"];
  const days: BlocDay[] = average.blocs.map((d) => ({
    date: d.date,
    n: d.n_polls,
    v: Object.fromEntries(
      shown.filter((b) => d.values[b]).map((b) => [b, [r2(d.values[b].mean), r2(d.values[b].sd)]]),
    ),
  }));
  return {
    label: "ממוצע המנדטים לפי גוש לאורך זמן",
    summary: blocSummary(days.at(-1)!, shown),
    blocs: shown,
    names: BLOC_NAMES,
    short: BLOC_SHORT,
    tiny: { ...BLOC_SHORT, arab: "ערביות" },
    days,
    dots: okPolls
      .filter((p) => p.blocs && p.field_date)
      .map((p) => ({ date: p.field_date!, s: shown.map((b) => p.blocs![b] ?? null) })),
  };
}
