// /data/answers.csv — one row per party per poll, with the party name as printed (label_raw).
import type { APIRoute } from "astro";
import { csvResponse } from "../../lib/csv";
import { answersCsv } from "../../lib/exports";

export const GET: APIRoute = () => csvResponse(answersCsv());
