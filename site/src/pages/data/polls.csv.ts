// /data/polls.csv — one row per poll, built at build time from polls.json.
import type { APIRoute } from "astro";
import { csvResponse } from "../../lib/csv";
import { pollsCsv } from "../../lib/exports";

export const GET: APIRoute = () => csvResponse(pollsCsv());
