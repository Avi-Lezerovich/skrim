// /data/average.json — the daily average by party and bloc, with the spread between pollsters.
import type { APIRoute } from "astro";
import { jsonResponse } from "../../lib/csv";
import { averageJson } from "../../lib/exports";

export const GET: APIRoute = () => jsonResponse(averageJson());
