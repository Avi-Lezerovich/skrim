# Mobile audit — before (20.10.2026)

> **After:** the redesign, the verification numbers (Lighthouse before/after, page heights,
> device emulation) and every deviation from the plan are in `docs/design/DESIGN.md`.
> Screenshots after the redesign: `design-audit/mobile-after/`. Phone shots are stored at 1×
> CSS pixels, as JPEG, to keep the repository small.

Baseline for the mobile-first redesign and the rename to **skrim**. It is measured against
`docs/design/FRONTEND_PLAN.md`, which is the binding baseline. Nothing in `site/` has been changed yet.

- **Screenshots:** `design-audit/mobile-before/{page}-{width}-{scheme}.jpg` (full page) and
  `mobile-before/fold/…` (first screen only). Every page was captured at 360, 390, 768 and 1440px,
  in light and dark (72 shots).
- **Metrics:** `mobile-before/_report.json` (overflow, touch targets, font sizes, axe, meta tags).
- **How it was captured:** Playwright (Chromium) against the dev server on `:4321`, with the Astro dev
  toolbar hidden. Mobile widths were captured at DPR 2 with touch enabled. Every page was scrolled
  through first, so all lazy charts had mounted.
- **Lighthouse:** v12.8, mobile preset (simulated Moto G Power, slow 4G), run against `astro build`
  output served by `astro preview`. Dev-mode numbers would be meaningless.

## 0. Status of the plan

- **Approval.** `FRONTEND_PLAN.md` was never approved in writing. PR #4 says *"the open questions at
  the end need answers before implementation"*, and it has no comments or reviews. Steps 1–6 of §7.3
  were built anyway (PRs #6–#11, all on `main`).
- **De facto decisions.** The build settled some questions without a written answer: Plex as the
  font, «מפלגות הקואליציה» as the bloc name, and party colour swatches kept.
- **Open questions (§8).** All nine are still open in the document. The **Questions** section at
  the end lists them again, including the ones this task depends on.

**Gaps between the running site and the plan:**

| Plan item | State |
| --- | --- |
| §2.5 `/pollsters` (step 7, "if time") | **Not reworked.** G5 does not follow the spec: dots in link-blue, names drawn over the plot, interval whiskers invisible at 360, no `ChartFrame`, no alt table, no reserved height (CLS 0.215). The page is still at `pages/pollsters.astro`, not `pollsters/index.astro`. |
| §5 G1: vertical event lines (list filing, mergers) | Not implemented. |
| §5.1 / R7.1: historical-error context line next to the band | Not implemented. Blocked on data dependency 7.2.5. |
| §6.2 CLS ≤ 0.05 | **Fails:** /pollsters 0.215, /trends 0.117. |
| §6.2 Lighthouse Accessibility = 100 | **Fails on /trends (96):** `target-size`. |
| §6.3 screenshot baselines | Opt-in (`VISUAL=1`); never approved. |
| Pages from phase B/C (`/pollsters/[id]`, `/sponsors`, `/compare`, `/results`) | Not built. That matches the plan's schedule, but it matters for the OG images (see **Conflicts**). |
| Error page | Not in the plan. The site serves Astro's default `404: Not Found` in English, with no layout and no `lang`/`dir`. |

## 1. Scores and cross-page numbers

**Lighthouse mobile (before):**

| Page | Perf | A11y | Best pr. | SEO | LCP | CLS |
| --- | --- | --- | --- | --- | --- | --- |
| `/` | 100 | 100 | 100 | 60* | 1.0 s | 0.004 |
| `/trends` | 96 | **96** | 100 | 60* | 1.5 s | **0.117** |
| `/polls` | 99 | 100 | 100 | 60* | 1.7 s | 0.019 |
| `/polls/[key]` | 100 | 100 | 100 | 60* | 1.4 s | 0.006 |
| `/pollsters` | **87** | 100 | 100 | 60* | 2.3 s | **0.215** |
| `/methodology` | 100 | 100 | 100 | 60* | 0.9 s | 0.002 |
| `/data` | 100 | 100 | 100 | 60* | 1.4 s | 0.008 |

\* SEO 60 comes only from `is-crawlable`: the deliberate draft `noindex` (CLAUDE.md, publication ban).
It turns into 100 by itself once a build runs after `EMBARGO_END`. There is nothing to fix there,
so I won't chase "90+ SEO" before 27.10.

**At 360px, light theme** (dark is identical on every count):

| Page | Page height | Banner + header | Targets < 44px | Smallest text | axe |
| --- | --- | --- | --- | --- | --- |
| home | 3,951px | 77 + 65 = **142px**, not sticky | 36 / 38 | 12px (chart) | clean |
| trends | 5,273px | 142px | 18 / 21 | 12px (chart) | clean |
| polls | **22,199px** | 142px | 256 / 258 | 13px | clean |
| poll | 4,757px | 142px | 36 / 37 | 13px | clean |
| pollsters | 1,806px | 142px | 8 / 9 | 12px (chart) | clean |
| methodology | 5,139px | 142px | 22 / 24 | 13.5px | clean |
| data | 2,351px | 142px | 16 / 16 | 13px | clean |

- **Overflow.** No page overflows horizontally at any width. The earlier methodology fix holds.
- **Touch targets.** The "< 44px" column counts every link and control, including inline links in
  prose, which WCAG exempts. What matters is the controls:
  - header buttons: 40×40
  - selects and inputs: 40px tall
  - `<summary>` toggles: 20–28px tall
  - block links (party names, download links, TOC): 19–28px
  - header logo link: 28px tall
- **Meta tags.** No OG or Twitter tags, no `theme-color`, no manifest, no apple-touch-icon. The only
  icon is `favicon.svg`. The production URL is hard-coded in `astro.config.mjs`
  (`https://pollygraph-il.pages.dev`).

## 2. Ranked problems, per page

Severity: **P0** breaks the page on a phone · **P1** clearly hurts · **P2** polish.

### Shell (every page)

1. **P1 — 142px of chrome before any content, and none of it stays.**
   - The draft banner is three lines at 360px (77px), and the header adds 65px.
   - The header is not sticky. On a 5-section site, getting to the navigation means scrolling back
     to the top and opening a `<dialog>`.
   - Navigation sits at the far top corner, about as far from the thumb as it can be.
2. **P1 — header controls are 40×40.** That's under the 44px target in this brief. The logo link is
   28px tall.
3. **P2 — page meta lines wrap with one-word orphans.** For example «…ב-14 הימים / האחרונים» on
   home and «101 · / בממוצע» on polls. There is no `text-wrap: balance` or `pretty` anywhere.
4. **P2 — the breadcrumb separator points the wrong way.** `›` between «כל הסקרים» and the poll
   title points back toward the parent. In RTL, the separator toward the current page should be `‹`
   (RESEARCH 5.4: mirror navigation chevrons).
5. **P2 — no branded 404.** See the gap table above.
6. **P2 — no safe-area handling** (`viewport-fit`, `env(safe-area-inset-*)`). It isn't needed today,
   but a bottom bar would require it.

### Home `/`

1. **P0 — the bloc chart (G1) is desktop-first.**
   - At 360px the plot area is about **168px wide out of 296**: `marginRight: 92` goes to the end
     labels and `marginLeft: 36` to the y axis.
   - The y domain 0–72 squeezes coalition and opposition (46–57) into a band about 30px tall. There
     they cross, with overlapping bands and about 150 dots.
   - The «61 · רוב» label collides with the gridline and the dots.
   - Only three date ticks.
   - It's legible as texture, not as data. **This needs a mobile drawing, not a smaller one.**
2. **P1 — about 230px of text sits above the chart:**
   - a 5-line summary sentence
   - a 3-line legend
   - a readout box that reserves 4 lines (~110px) even when it holds 3
3. **P1 — the bloc tiles stack as three 97px cards**, so the strip (G2) starts at ~y=700. The three
   numbers are the answer to the page's question («מה אומרים הסקרים עכשיו»), and they should sit
   side by side in the first screen.
4. **P1 — party bars (G3) take two rows per party (52px each), and the whisker renders badly.**
   - Two rows per party means 11 parties fill about 600px.
   - The whisker's `box-shadow` halo draws a double line ("═") where the range crosses the bar end.
5. **P2 — the five poll cards are each about 170px.** Together that's another 900px for "recent
   polls", which is a list.
6. **P2 — the «סביב החסימה» items wrap to two lines each.**

### Trends `/trends`

1. **P0 — G1 is the same problem as on home**, at 300px tall.
2. **P1 — 15 small multiples, one per row at 360, about 230px each (3.5k px).**
   - The shared 0–35 scale is right (plan §5).
   - But eight of the fifteen are flat lines near the bottom of an empty frame. Each one repeats the
     axes, ticks and threshold line.
   - On a phone this reads as one chart repeated 15 times. The plan puts one per row at 375px.
     **I think that's the wrong mobile pattern** (see §3).
3. **P1 — the controls sit between the bloc chart and the party grid**, far from the thumb.
   - The range pills are 40px tall.
   - The «הדגשת סוקר» select is a native picker, which is fine.
   - There's no summary of what's highlighted once you scroll away.
4. **P1 — CLS 0.117** from `#bloc-chart .chart`, and `target-size` fails, which is the only A11y
   miss in the audit.
5. **P2 — the empty readout line** («הצביעו על נקודה…») reserves two lines between the controls and
   the grid.

### Polls `/polls`

1. **P0 — 120 full cards make a 22,199px page.** That's about 28 phone screens, with no
   pagination, grouping or jump links.
2. **P0 — the filter form is a 2-column grid of seven fields.** It fills the whole first screen
   (first poll at ~y=720).
   - The sort select's label is cut off («תאריך ביצוע, מהחז»).
   - «נקה סינון» sits alone in a half-width cell.
   - Once you scroll there's no active-filter summary, so you can't tell why you see 8 polls.
3. **P1 — the cards are verbose.** Each shows 4 lines plus a PDF link, so only about 3 are visible
   per screen. Comparing polls means scrolling.
4. **P2 — the date inputs show `mm/dd/yyyy`** in headless Chromium. Real he-IL devices localise
   this, so it isn't a site bug. The native date pair is still clumsy on phones. Quick ranges
   («14 יום / 30 יום / הכול») would serve most people better.

At 1440px the table works: sticky header and two sticky columns.
- **P2:** the filter row's baselines don't line up, because the date inputs are taller than the
  selects.
- **P2:** «נקה סינון» wraps onto its own row.

### Poll page `/polls/[key]`

1. **P1 — the results table scrolls horizontally, but the "raw %" column is cut off mid-number**
   («.7.2%»). It looks broken rather than scrollable. At 360px the row height is driven by
   `label-raw-inline` (2–4 lines per party).
2. **P1 — `label_raw` values with mirrored parentheses.** For example `)מתוך "מפלגה אחרת"(`, which
   appears in 30 rows across the data.
   - **This is a data issue, not a CSS one:** the extracted text stores the parentheses in visual
     order.
   - Per CLAUDE.md I won't touch the data or rewrite `label_raw` in the UI.
   - **Flag for the extract stage** (`extract/text.py: to_logical`).
3. **P1 — G6 (poll vs average) at 360px.** Each row is name/value plus a short track. The track is
   about 120px wide, so ±1 differences are a 4px nudge and the dot and ring overlap. The diff
   numbers carry the information; the track hardly does.
4. **P2 — order on mobile:** source → results → G6 → scenarios → disclosure → flags. It's correct
   per the plan, but the source card's «הוועדה מפרסמת… ללא אחריות» paragraph takes a full screen
   before any number appears.

### Pollsters `/pollsters`

1. **P0 — G5 is broken at 360px.**
   - The names render inside the plot area, to the left of the axis.
   - There's only one tick (0).
   - The interval lines are invisible, so it looks like dots without uncertainty, which the plan
     forbids.
   - The dots use `--link` blue, not the ink of the house-effect spec.
   - The axis captions («← פחות… / יותר… →») wrap into four broken lines.
   - It's an unconverted pre-plan chart.
2. **P1 — CLS 0.215 and Perf 87**: there's no reserved height.
3. **P1 — the 7-column table scrolls horizontally.** The pollster name is not pinned, so after one
   swipe you lose which row you're on.

### Methodology `/methodology`

1. **P2 — TOC links are 19–28px tall.**
2. **P2 — long prose at 17px/28px is comfortable.** The measure is fine (68ch caps it at desktop;
   at 360px it's about 38 characters).

The page is otherwise in good shape.

### Data `/data`

- **P2 — download links are 28px tall.** Each file's meta sits under it, so the tap target could
  be the whole row.

## 3. Desktop-first at the core: proposed mobile patterns

| Component | Verdict | Mobile pattern I propose |
| --- | --- | --- |
| **G1 blocs over time** | Desktop-first. Shrinking it can't work. | Below 768px, a dedicated drawing:<br>• end labels move **under** the chart as a 3-item key with today's values. The readout and the direct labels merge into one strip that updates on tap.<br>• the plot gets the full width.<br>• 4 date ticks, 3 gridlines (0 / 30 / 61).<br>• the band stays.<br>• dots drop to r=2 at 0.25 opacity.<br>• the 61 label sits at the left edge, above the line.<br>The y domain stays 0-based (see **Question 2**). |
| **G4 small multiples** | One per row is the desktop grid stacked. | A **list of parties**, one row each (~56px): swatch, name, current seats, range, a 30-day sparkline drawn on the shared scale.<br>Tapping a row expands its full chart in place (`<details>`), with the highlight and range controls applying to it.<br>Every chart stays one tap away, and the whole field fits in about two screens instead of seven. |
| **Polls list** | 120 verbose cards. | Compact rows (~64px): date · pollster · sponsor, then the three bloc numbers in a fixed 3-column grid so they line up down the list.<br>Grouped by week, with sticky week headers.<br>Filters in a **bottom sheet** (`<dialog>`), opened from a sticky «סינון (2)» bar that shows active-filter chips, each removable.<br>Optional «טבלה» toggle: the existing table, with date + pollster pinned. |
| **Poll results table** | Clipped scroller. | Two columns only on mobile: name (with the printed name under it) and seats.<br>Raw % moves into a secondary toggle, «הצג אחוזים».<br>No horizontal scroll. |
| **Pollsters table** | Unpinned scroller. | Cards, one per pollster: name, polls, median n, house effect as a small point-and-interval. |
| **Header navigation** | Five sections behind ≡ at the top. | Compact sticky header (48px: logo, theme). Plus a **bottom tab bar**: 5 items, 56px + safe-area inset, icon + label, `aria-current`.<br>From 768px up, the tabs move back into the header row. |

## 4. Design direction — delta from FRONTEND_PLAN

**Keep, unchanged:**
- every colour token, the bloc palette and contrast values (§3.1)
- Plex 400/600/700 with the metric-matched fallback; the type scale and 4px grid (§3.2–3.3)
- the component inventory and `ChartFrame` contract (§4)
- the RTL time-axis rule (§5)
- the readout-above-the-chart model, the budgets (§6.2) and the test matrix (§6.3)
- neutral wording, data-ordered parties, no bloc colours on party data

**Change (each needs your OK):**

| # | Change | Why |
| --- | --- | --- |
| D1 | Bottom tab bar under 768px, instead of the ≡ `<dialog>` (§4 `SiteHeader`) | Five sections; reachable with one thumb; the brief asks for it |
| D2 | Sticky compact header (48px) | Orientation and theme always available. Costs 48px, but the banner shrinks by more |
| D3 | One-line draft banner under 768px («גרסת פיתוח — לא לפרסום לפני 27.10, 22:00»), with the full §16ה text behind «פרטים» | It eats 77px on every page. **The legal wording is yours to approve** |
| D4 | G1 mobile drawing (§3 above): key under the chart, full-width plot, sparser ticks | §5 says "300px, end labels shortened". That alone isn't enough |
| D5 | G4 as a sparkline list that expands, below 768px | The plan's one-per-row at 375 is about 3,500px of near-identical frames |
| D6 | Polls: compact rows + bottom-sheet filters + active-filter chips | 22k px and a full-screen form are not usable |
| D7 | Bloc tiles in one row of three, at every width | The headline answer should sit in the first screen |
| D8 | G3 bars as one row per party (name · bar · value) at 360 | Halves the height; fixes the whisker artifact |
| D9 | `/pollsters` rebuilt on `ChartFrame` per G5 | It was never converted. This is a plan gap, not a deviation |
| D10 | Touch targets at least 44px for controls, block links, `<summary>` | The plan doesn't set a size; the brief does |
| D11 | `text-wrap: balance` on headings and meta, `pretty` on body | Fixes the orphans |
| D12 | Tap readout gets a source link (the poll page, and its PDF) | The brief's "tap tooltips with the source link", done the plan's way: in the readout, not a floating tooltip |

## 5. Logo concept

Three directions are in `design-audit/logo-options/` (`README.md` has a one-line rationale for each;
the PNGs are previews).

- **Wordmark.** A hand-drawn, monoline lowercase «skrim», the same in all three directions. It's
  pure paths, so it depends on no font.
- **Accent.** The only non-bloc hue in the plan, `--link` (#1a56a8 / #8ab8ff). Every direction also
  has a monochrome version.

My pick is **2-estimate**:
- **The idea.** A dot inside its interval band, with whiskers: the honest unit of a poll. The same
  device becomes the dot over the «i», so mark and wordmark say one thing.
- **Weakness 1.** Without a container, the bare mark is wide and short, and at 16px it can read as a
  slider or barbell. App and favicon versions would put it on a rounded tile.
- **Weakness 2.** In the wordmark, the whisker over the «i» is too thin. I'd make it heavier in the
  final version.

The other two:
- **1-band** is the most literal (the site's chart in a tile). It turns to noise at 16px.
- **3-slot** is the most legible at 16px, but it reads as a generic clipboard or analytics icon.

## 6. Rename inventory: «pollygraph» / «סקרנות» → «skrim»

**User-facing, to change** (once direction is approved):

| File | Line(s) | What |
| --- | --- | --- |
| `site/src/layouts/Base.astro` | 31 | `<title>` pattern |
| `site/src/pages/index.astro` | 18 | Home title |
| `site/src/components/layout/SiteHeader.astro` | 26, 56 | Brand name (header and menu) |
| `README.md` | 1 | Title |
| `methodology.md` | 1 | Heading (rendered on `/methodology`) |
| `docs/design/FRONTEND_PLAN.md` | 1, 102, 797 | Title, wireframe, open question 5 |
| `docs/research/RESEARCH.md` | 71 | "the pollygraph opportunity" |
| `SPEC.md` | 1, 7 | «סקרנות». It is a *snapshot of a live Claude Docs spec*, whose header says the live doc is the source. **Editing only the copy will drift; your call.** |
| `site/src/styles/tokens.css` (+ plan line 485) | 10, 47 | `"Pollygraph Fallback"` local font-face name. Not visible, but cheap and safe → `"Skrim Fallback"` |
| `src/pollygraph/__init__.py` | 1 | Docstring «סקרנות». Harmless, cosmetic |

**Identifiers: I will not touch these without your decision.**

| Identifier | Where | Risk of renaming |
| --- | --- | --- |
| Python package `pollygraph` | `src/pollygraph/`, `pyproject.toml` name and `packages`, every test import, CLAUDE.md commands, `scrape.yml` (`python -m pollygraph.scrape`) | Breaks the twice-daily scrape cron if any reference is missed, **during the last week of collection** (SPEC: "must not miss the last days"). Also invalidates `uv.lock`. **I recommend: not before 4.11.** |
| npm package `pollygraph-site` | `site/package.json`, `package-lock.json` | Private, never published. Low risk; lockfile churn only |
| Deploy domain `pollygraph-il.pages.dev` | `site/astro.config.mjs` | It's the Cloudflare Pages project name. Renaming creates a new URL; old links and WhatsApp caches point at the old one. I'll move it behind `SITE_URL` (see Q8) without changing the value |
| Repo URLs `github.com/Avi-Lezerovich/pollygraph-il` | `SiteFooter.astro`, `data/index.astro`, `methodology.astro`, `polls/[key].astro` (issue link), `scrape/cec.py` User-Agent | The git remote is already `Avi-Lezerovich/skrim`, so these links rely on GitHub's rename redirect (I couldn't verify it from here). Updating the **site links** is user-facing and low risk. I'd do it in the rename commit unless you say no. The **User-Agent** string is sent to gov.il: changing it is harmless, but it's pipeline code |
| Bot identity `pollygraph-bot` | `scrape.yml` | Commit author name only. Cosmetic |
| `CLAUDE.md` "Project: pollygraph (pollygraph-il…)" | line 3 | Repo instructions file. I'd add «skrim» as the product name and keep the package name, with your OK |
| Data/database files | `data/`, `polls.duckdb` | No hits. Nothing to do |

## 7. "skrim": quick web check (a flag, not a legal opinion)

Searches turned up nothing named "skrim" in polling, news or data journalism, in English or Hebrew.
What does exist:
- **Skrim, a mountain area in Norway**, with a company SKRIM AS and a visitor portal ("VisitSkrim").
- **"Skrimples / SKRIMP"**, a crypto token.
- **"scrim"** (English: a fabric, a theatre gauze, gaming slang for a practice match) and
  **"Skyrim"** (a video game). Both crowd search results.
- Several user handles ("skrim1997" and similar).

Brand notes:
- «skrim» is the transliteration of the generic Hebrew word «סקרים». That makes it **hard to own or
  trademark**.
- Search for «סקרים» will never favour the site. That probably doesn't matter for a site people
  share by link, but it does mean "skrim" + domain is the identifier, not the Hebrew word.

**Domains: not verified.** This sandbox has no DNS: every lookup fails, google.com included, and
RDAP fetches fail too. Please check `skrim.co.il` (isoc.org.il), `skrim.org.il`, `skrim.com`,
`skrim.org`, `skrim.io` and `skrim.app` at a registrar. The site will read its domain from one
config value, so any choice works.

## 8. Conflicts and questions

**Conflicts between this brief and the repo or plan.** In each case the repo rule wins unless you
say otherwise.

1. **Publication ban versus share images.**
   - CLAUDE.md: no poll analysis on the public site before 27.10, 22:00.
   - The brief asks for a home OG image with "a simplified poll-average chart". A share card is
     publication.
   - **Proposal:** while `draft` is true (the same `EMBARGO_END` check the banner uses), every OG
     image is brand-only with no numbers. The data visual turns on in the first build after the ban.
2. **Pages that don't exist.** The brief asks for per-page OG images for "a pollster page" and the
   "who was right" page. Neither `/pollsters/[id]` nor `/results` exists (plan: phases B and C).
   Building them goes beyond "presentation only".
   - **Proposal:** an OG *template* for each, plus an image for the existing `/pollsters` index.
     The `/results` image gets generated when the page is built.
3. **Floating tooltip versus readout.** The brief says "tap tooltips with the source link". The plan
   (§5, a11y) says no floating tooltip: the readout goes in a line above the chart.
   - **Proposal:** D12, the plan's readout plus the source link.
4. **"Muted party colours as defined in the plan."** The plan defines no party palette. It keeps
   the `parties.csv` hues as 10px swatches only, and open question 3 (keep or drop them) is still
   unanswered.
   - Several swatches are near-duplicates (browns, greys), and some are saturated brand colours
     (Likud blue, Democrats red).
   - **Inventing a muted party palette would be a new design system piece. Your call:** keep,
     mute, or drop.
5. **Logo accent colour.** The brief says "the plan's single accent". The plan has no brand
   accent; `--accent` is an alias of `--link` blue.
   - Blue sits near the Likud and flag blues. The plan moved the blocs off blue for exactly that
     reason, but as a link colour it reads as "web", not party.
   - I used it in the logo options and kept monochrome versions. Confirm, or pick ink-only.
6. **Branch and push.**
   - Repo convention is `feat/fe-*` branches with one PR per step. This session is assigned
     `claude/kind-curie-zbi5lt`; I'm on it and will stay on it unless you want `feat/fe-mobile`.
   - The session setup expects me to push when done; you said never push without your approval.
     **Yours wins: nothing is pushed.**
   - One PR or several: the repo says one stage per PR "where practical". I'd do one PR with
     atomic commits, or split it as shell+tokens / pages / brand+OG.
7. **No lint or typecheck in the site.** `site/` has no lint or `astro check` script. Adding one
   means adding `@astrojs/check` and `typescript` as devDependencies. Before each commit I'll run
   `npm run build` + `npm run test:e2e` (+ ruff/pytest, untouched). Want `astro check` added?
8. **The OG generator needs the production domain and a renderer.**
   - **Domain.** `SITE_URL` env var, falling back to the current `astro.config` value marked as a
     placeholder. Tell me the real domain once it exists.
   - **Renderer.** Satori has no real bidi/RTL support, which is risky for Hebrew. Playwright is
     already a devDependency and does Hebrew shaping and bidi correctly.
   - **Where it runs.** There is no deploy workflow in `.github/`. If Cloudflare Pages builds from
     git, its image may not run Chromium.
   - **Proposal:** `npm run og` runs in CI and before deploy, and the PNGs land in `site/public/og/`.
   - **Question:** how is the site deployed?

**Open plan questions (§8), still unanswered:**
1. Launch time (27.10 22:00 exactly, or later) and the election-night comparison.
2. Bloc name: implemented as «מפלגות הקואליציה». Confirm.
3. Party colour swatches: keep or drop. This is conflict 4.
4. Font: implemented as Plex. Confirm; I'll keep it.
5. Brand: this brief answers it (skrim). The domain is still open.
6. Durable archive (Zenodo / GitHub Release).
7. Historical error table, 2015–2022. Without it the band has no "how wrong were polls before"
   line.
8. Legal review of the flag wording.
9. When the §16ה ban starts. This decides the "last poll" for accuracy, and it now also decides
   when share cards may carry numbers.

**New questions from this audit:**

- **Q1 — approve D1–D12** (or strike any).
- **Q2 — G1 y-axis.** Keep 0-based on mobile (plan: "0–max(70)"), accepting that coalition and
  opposition share about 30px? Or zoom the mobile panel to about 35–70 with a clear break mark and
  keep the Arab bloc in its own mini panel? I lean toward keeping 0-based, since the honest
  baseline matters more here, and getting the room back from the margins (D4).
- **Q3 — pick a logo direction** (1, 2 or 3), or ask for a revision.
- **Q4 — the rename items** in §6 marked "your decision".
- **Q5 — DESIGN.md language.** Hebrew to match `docs/`, or English?
