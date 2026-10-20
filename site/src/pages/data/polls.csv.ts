// /data/polls.csv — one row per poll, built at build time from polls.json.
import type { APIRoute } from "astro";
import { csvResponse, toCsv } from "../../lib/csv";
import { pollsterName, polls, sponsorName, sponsors, type Poll } from "../../lib/data";

export const GET: APIRoute = () =>
  csvResponse(
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
    ]),
  );
