// Internal links carry the deploy base path (BASE_PATH, e.g. "/skrim" on GitHub Pages), so the
// same build works at a domain root or under a project path. Works in pages and client scripts.
const BASE = import.meta.env.BASE_URL.replace(/\/$/, "");

/** "/polls?x=1" → "/skrim/polls?x=1" under a base path. */
export const u = (path: string) => `${BASE}${path}`;

/** The site path without the base: "/skrim/polls/" → "/polls/". */
export const unbase = (pathname: string) => (BASE && pathname.startsWith(BASE) ? pathname.slice(BASE.length) || "/" : pathname);

/** The public repository: source code, issues, data history. */
export const REPO = "https://github.com/Avi-Lezerovich/skrim";
