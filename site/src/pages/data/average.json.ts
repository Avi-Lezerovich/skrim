// /data/average.json — the daily average by party and bloc, with the spread between pollsters.
import type { APIRoute } from "astro";
import { averageJson } from "../../lib/exports";

export const GET: APIRoute = () =>
  new Response(averageJson(), { headers: { "Content-Type": "application/json; charset=utf-8" } });
