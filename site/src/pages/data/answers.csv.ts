// /data/answers.csv — one row per party per poll, with the party name as printed (label_raw).
import type { APIRoute } from "astro";
import { csvResponse, toCsv } from "../../lib/csv";
import { partyName, pollsterName, polls, type Poll, type Row } from "../../lib/data";

type Answer = Row & { poll: Poll };

export const GET: APIRoute = () =>
  csvResponse(
    toCsv<Answer>(
      polls.flatMap((poll) => poll.rows.map((r) => ({ ...r, poll }))),
      [
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
      ],
    ),
  );
