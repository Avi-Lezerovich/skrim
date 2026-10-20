// The downloadable files, built once and shared by the static endpoints and the /data page
// (which lists their sizes and row counts).
import { createHash } from "node:crypto";
import { toCsv } from "./csv";
import { average, meta, partyName, pollsterName, polls, sponsorName, sponsors, type Poll, type Row } from "./data";

export const pollsCsv = () =>
  toCsv<Poll>(polls, [
    ["key", (p) => p.key],
    ["cec_survey_id", (p) => p.survey_id],
    ["field_date", (p) => p.field_date],
    ["transfer_date", (p) => p.transfer_date],
    ["published_date", (p) => p.published_date],
    ["pollster_id", (p) => p.pollster],
    ["pollster", (p) => pollsterName(p.pollster, p.pollster_raw)],
    ["pollster_raw", (p) => p.pollster_raw],
    ["sponsor_id", (p) => p.sponsor],
    ["sponsor", (p) => sponsorName(p.sponsor, p.sponsor_raw)],
    ["sponsor_raw", (p) => p.sponsor_raw],
    ["sponsor_type", (p) => (p.sponsor ? sponsors[p.sponsor]?.type : null)],
    ["status", (p) => p.status],
    ["in_average", (p) => p.status === "ok"],
    ["mode", (p) => p.meta.mode],
    ["contacted", (p) => p.meta.contacted],
    ["planned_n", (p) => p.meta.planned_n],
    ["respondents", (p) => p.meta.respondents],
    ["response_rate_pct", (p) => p.meta.response_rate],
    ["moe_reported_pct", (p) => p.meta.moe_reported],
    ["moe_computed_pct", (p) => p.meta.moe_computed],
    ["weighting_declared", (p) => p.meta.weighted_declared],
    ["seats_coalition", (p) => p.blocs?.coalition],
    ["seats_opposition", (p) => p.blocs?.opposition],
    ["seats_arab", (p) => p.blocs?.arab],
    ["seats_other", (p) => p.blocs?.other],
    ["scenario_tables", (p) => p.scenario_tables],
    ["flags", (p) => p.flags.map((f) => f.code).join(";")],
    ["source_url", (p) => p.source_url],
  ]);

type Answer = Row & { poll: Poll };
const answers = (): Answer[] => polls.flatMap((poll) => poll.rows.map((r) => ({ ...r, poll })));

export const answersCsv = () =>
  toCsv<Answer>(answers(), [
    ["key", (a) => a.poll.key],
    ["field_date", (a) => a.poll.field_date],
    ["pollster_id", (a) => a.poll.pollster],
    ["pollster", (a) => pollsterName(a.poll.pollster, a.poll.pollster_raw)],
    ["status", (a) => a.poll.status],
    ["party_id", (a) => a.party_id],
    ["party", (a) => (a.party_id ? partyName(a.party_id) : null)],
    ["label_raw", (a) => a.label_raw],
    ["seats", (a) => a.seats],
    ["raw_pct", (a) => a.pct],
    ["pdf_page", (a) => a.page],
    ["source_url", (a) => a.poll.source_url],
  ]);

export const averageJson = () => JSON.stringify({ generated_at: meta.generated_at, ...average });

/** Short fingerprint of the published data, shown on /data so readers can cite a version. */
export const dataVersion = () =>
  createHash("sha256").update(JSON.stringify(polls)).update(JSON.stringify(average)).digest("hex").slice(0, 12);

export const answerCount = () => answers().length;
