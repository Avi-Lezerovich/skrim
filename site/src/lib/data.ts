// Typed access to the JSON written by `python -m pollygraph.analyze`.
import pollsJson from "../data/polls.json";
import averageJson from "../data/average.json";
import houseJson from "../data/house_effects.json";
import partiesJson from "../data/parties.json";
import pollstersJson from "../data/pollsters.json";
import sponsorsJson from "../data/sponsors.json";
import metaJson from "../data/meta.json";

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
  coalition: "גוש נתניהו",
  opposition: "האופוזיציה",
  arab: "המפלגות הערביות",
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

/** Plain-language explanation of each QA flag, with the innocent reading next to it. */
export const FLAG_TEXT: Record<string, { title: string; why: string }> = {
  seat_sum: {
    title: "סכום המנדטים שחולץ אינו 120",
    why: "כמעט תמיד שגיאת חילוץ שלנו מטבלה בפורמט חריג. הסקר ממתין לבדיקה ידנית ואינו נכלל בממוצע.",
  },
  no_seat_table: {
    title: "לא אותרה טבלת מנדטים",
    why: "הדיווח בפורמט שהחילוץ האוטומטי לא מזהה, או שהסקר לא כלל חלוקת מנדטים. ממתין לבדיקה ידנית.",
  },
  duplicate_party: {
    title: "מפלגה מופיעה פעמיים",
    why: "בדרך כלל שתי טבלאות שחוברו בטעות בחילוץ.",
  },
  seats_below_threshold: {
    title: "מנדטים למפלגה שאחוז התמיכה הגולמי שלה מתחת ל-3.25%",
    why: "האחוז הגולמי אינו משוקלל; אחרי שקלול המפלגה יכולה לעבור את אחוז החסימה.",
  },
  no_respondents: {
    title: "מספר המשיבים לא אותר בדיווח",
    why: "ייתכן שהוא מופיע בניסוח שהחילוץ לא מזהה.",
  },
  respondents_gt_contacted: {
    title: "יותר משיבים מפניות",
    why: "בדרך כלל דיווח נפרד לכמה תת-מדגמים, שהחילוץ קרא חלקית.",
  },
  response_rate_mismatch: {
    title: "שיעור ההיענות המדווח שונה ממשיבים ÷ פניות",
    why: "סוקרים מגדירים היענות בדרכים שונות (למשל כולל מי שהתחיל ולא סיים).",
  },
  moe_mismatch: {
    title: "טעות הדגימה המדווחת שונה מהמחושבת לפי n",
    why: "השקלול מגדיל את טעות הדגימה בפועל (design effect), ולכן דיווח שמרני הוא סביר.",
  },
  field_after_transfer: {
    title: "תאריך הביצוע מאוחר מתאריך ההעברה לוועדה",
    why: "טעות הקלדה ברשימת הוועדה.",
  },
  field_date_corrected: {
    title: "תאריך הביצוע תוקן לפי ה-PDF",
    why: "ברשימת הוועדה הופיע תאריך מאוחר ממועד ההעברה, שאינו אפשרי; השתמשנו בתאריך המודפס בדיווח.",
  },
  scanned: {
    title: "קובץ סרוק",
    why: "מעט טקסט ניתן לחילוץ; הנתונים דורשים בדיקה מול המקור.",
  },
};

// ---- chart payloads (serialised into the page, rendered client-side) ----

const band = (d: AvgPoint, key: string) => ({
  date: d.date,
  mean: d.values[key].mean,
  sd: d.values[key].sd,
  n: d.n_polls,
});

export function blocChartData() {
  const shown: Bloc[] = ["coalition", "opposition", "arab"];
  return {
    names: BLOC_NAMES,
    series: Object.fromEntries(
      shown.map((b) => [b, average.blocs.filter((d) => d.values[b]).map((d) => band(d, b))]),
    ),
    dots: Object.fromEntries(
      shown.map((b) => [
        b,
        okPolls
          .filter((p) => p.blocs && p.field_date)
          .map((p) => ({ date: p.field_date!, seats: p.blocs![b], pollster: p.pollster ?? "", key: p.key })),
      ]),
    ),
  };
}

export function partyChartData(id: string) {
  return {
    name: partyName(id),
    series: average.parties.filter((d) => d.values[id]).map((d) => band(d, id)),
    dots: okPolls
      .filter((p) => p.field_date && id in p.seats)
      .map((p) => ({ date: p.field_date!, seats: p.seats[id], pollster: p.pollster ?? "", key: p.key })),
  };
}

export const seriesDomain: [string, string] = [
  average.parties[0].date,
  average.parties.at(-1)!.date,
];
