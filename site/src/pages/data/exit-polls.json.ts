// /data/exit-polls.json — each channel's election-night numbers by version, its method and, once published, the results.
import type { APIRoute } from "astro";
import { jsonResponse } from "../../lib/csv";
import { exitPollsJson } from "../../lib/exports";

export const GET: APIRoute = () => jsonResponse(exitPollsJson());
