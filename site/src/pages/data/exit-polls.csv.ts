// /data/exit-polls.csv — one row per list in each channel's election-night numbers, built from exit_polls.json.
import type { APIRoute } from "astro";
import { csvResponse } from "../../lib/csv";
import { exitPollsCsv } from "../../lib/exports";

export const GET: APIRoute = () => csvResponse(exitPollsCsv());
