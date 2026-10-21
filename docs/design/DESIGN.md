# skrim — design reference

> 20.10.2026. This sits on top of [`FRONTEND_PLAN.md`](FRONTEND_PLAN.md), which stays the
> baseline for tokens, palette, type scale, chart specs and budgets. This file records:
> - what was built in the mobile-first pass
> - how the name and logo are used
> - every place we deviate from the plan, and why
>
> The audit that led here is `design-audit/MOBILE_AUDIT.md`.

## 1. Name

| Context | How it is written |
| --- | --- |
| Logo, header | The lockup: mark plus the wordmark «skrim», drawn as paths, never typed |
| `<title>` | `{page} · skrim`; home: `skrim · סקרי הבחירות לכנסת ה-26` |
| `og:site_name`, manifest `short_name` | `skrim` |
| `og:title` | The page name only, e.g. `מגמות`. Home: `ממוצע סקרי הבחירות לכנסת ה-26` |
| Running Hebrew text, footer | `<bdi lang="en">skrim</bdi>`. Always lowercase, never «סקרים» as the brand |
| Hebrew descriptor, where one helps | «סקרי הבחירות לכנסת ה-26» (header from 1024px, share cards) |
| Code, package names | Unchanged: Python package `pollygraph`, npm `pollygraph-site` |

**Bidi.** «skrim» is Latin inside RTL text:
- In markup it always sits in `<bdi>` (or the logo SVG), so punctuation next to it stays on the
  right side.
- Titles start with Hebrew where possible, so share previews and tabs pick RTL as the base
  direction.
- On the home page the title starts with «skrim» deliberately, and browsers render it
  correctly.

## 2. Tokens

`site/src/styles/tokens.css`, unchanged from plan §3. Colours, type scale, the 4px spacing grid,
radius and motion are all as the plan defines them. The only additions:

- `"Skrim Fallback"`, the renamed metric-matched Arial face.
- `--tile-color`, set per bloc tile from `--bloc-*`.

Preloaded faces: Hebrew 400, Latin 400 (the digits) and Hebrew 600 (headings).
- That is about 50KB in the first request; the full set is 77KB, inside the 80KB budget.
- Preloading all three is what stopped the font swap from rewrapping the text above the charts.
  Trends CLS went from 0.11 to 0 on throttled 4G.

## 3. Layout and navigation (mobile first)

Base styles target 360px and enhance with `min-width` queries at 480 / 600 / 768 / 1024 / 1280.
No `max-width` query is left (`grep "max-width: [0-9]" global.css` finds only property values).

- **Header:** sticky, 48px (56px from 768px). Logo at the start edge, theme switch at the end.
- **Primary navigation:**
  - Under 768px it is a fixed **bottom tab bar** of five items (icon and label, 56px, plus
    `env(safe-area-inset-bottom)`).
  - From 768px the same `<nav>` sits in the header row.
  - Plain links, so it works without JS.
- **Safe areas:** `viewport-fit=cover`. Gutters use `max(--gutter, env(safe-area-inset-*))`;
  the RTL start edge is the right inset. Sheet heights use `dvh`.
- **Touch targets:** every control and block link is at least 44×44, including `<summary>` toggles.
  The drawn summary marker points to the line end (RTL) and turns down when open. Inline links
  in prose are exempt (WCAG 2.5.8).
- **Text:** `text-wrap: balance` on headings, meta lines and leads; `pretty` on paragraphs.
- **404:** a branded page in the site layout.

## 4. Components (new or changed)

| Component | What it is |
| --- | --- |
| `Logo` | Inline lockup. The box and wordmark use `currentColor`, the line and dot `--link`. The name is real text for screen readers (`lang="en"`) |
| `BlocTile` | Three in one row at every width: short name, whole seats, spread, sparkline. Full names for screen readers (and visible from 768px) |
| `SeatBars` (G3) | One 44px row per party: name with the spread under it, a light bar, a dark whisker with end caps, then the seats |
| `PollsCompact` | Polls as a 4-column table that fits 360px: pollster, then date · sponsor · n, plus the three bloc totals in aligned columns. Used on home and on `/polls` under 768px. **Replaces `PollCard`** |
| `HouseEffect` (G5) | HTML deviation chart: a point with its 95% interval around 0, numeric axis left to right, names at the start edge linking to that pollster's polls |
| Filter sheet (`/polls`) | Under 768px the filter form is a bottom-sheet `<dialog>`, opened from a sticky bar with the live count and a removable chip per active filter. The sheet's button says how many polls it will show. Inline from 768px and without JS |
| Party rows (`/trends`) | Under 768px, one `<details>` row per party (sparkline on the shared scale; a tap opens the chart). From 768px every row is open, giving the plan's grid |
| `ChartFrame` | The legend goes under the chart on phones (read the chart, then the key); above it from 768px |
| Poll results table | Fits 360px: party (with the printed name under it), seats, PDF page. Raw % sits behind «הצגת האחוזים הגולמיים» on phones |

## 5. Charts and RTL

The plan's single RTL decision stands, as in plan §5:
- **Time** runs left to right.
- **Categorical bars** grow from the start edge.
- **Numeric deviation axes** run left to right.
- SVG text uses `unicode-bidi: plaintext`.

Mobile drawings are their own layouts, not scaled-down desktop charts.

- **G1 (blocs over time)**, under 500px plot width:
  - the plot gets the width (margins 26 / 30px instead of 36 / 132)
  - end labels are the bare number in the bloc colour, and the readout above names the blocs
  - gridlines at 0/20/40 plus the dashed 61 line
  - dots r=2 at 75% of the normal opacity
  - **the y axis stays 0-based, as the plan says**
  - date ticks: one per ~72px of plot, at most seven
- **Readout** (the plan's "value line instead of a floating tooltip"):
  - two lines: the day, the pollsters in its window and a **link to those polls** (the source),
    then each bloc with its spread
  - on trends, the tapped poll shows under its own chart: seats, pollster, date, its page and
    its PDF
- **Minimum chart text:** 12px. The band always stays visible.
- **Party colours** stay what the plan says: 10px swatches with an inset ring, never data marks.

## 6. Logo

Direction 3, «slot», was picked from the three options in `design-audit/logo-options/`:
- **Mark:** a ballot box with the slot notch at the top, a dot in the slot and a trend line.
- **Wordmark:** monoline lowercase «skrim».
- **Source:** all paths are hand-written in `site/src/lib/brand.mjs`, and `npm run brand`
  regenerates every file.

**Files** (`site/public/brand/`):
- `skrim-logo-{light,dark}.svg` and `skrim-logo-mono-{light,dark}.svg`
- `skrim-mark-…` (colour and mono)
- `skrim-wordmark-{light,dark}.svg`

**Icons:**
- `favicon.svg` follows the browser theme.
- `favicon.ico` (16/32/48).
- `apple-touch-icon.png` (180, full bleed).
- `icon-192/512.png` (rounded light tile).
- `icon-maskable-512.png` (mark inside the 80% safe circle).
- `manifest.webmanifest` (theme `#ffffff`). `<meta name="theme-color">`: `#ffffff` light,
  `#1a1a19` dark; it follows a theme picked by hand too.

**Usage:**
- Colours: ink plus `--link` (#1a56a8 / #8ab8ff), or mono.
- Never bloc colours, flags or party colours.
- Minimum size: 16px for the mark, 16px tall for the lockup.
- Clear space: half the mark's width.
- The lockup never mirrors in RTL.

## 7. Share previews (WhatsApp, Open Graph)

- **Tags on every page:**
  - canonical, `og:title`, `og:description`, `og:url`, `og:site_name`, `og:locale he_IL`, `og:type`
  - `og:image` (absolute https) with type, 1200×630 and alt
  - `twitter:card summary_large_image` with its title, description, image and alt
- **Images:**
  - `npm run og` renders them in Playwright's Chromium from an HTML template, with Plex
    embedded. The run fails if the Hebrew face did not load.
  - Satori was rejected: its bidi/RTL support is not enough for Hebrew.
  - Cards are centred so square crops keep the headline. PNG, falling back to JPEG over 300KB;
    the largest is about 54KB.
  - Home: the bloc numbers plus a simplified G1. Trends: G1. A poll page: that poll's bloc
    totals. Pollsters and polls: text. `/results`: a ready card for the page that opens after 4.11.
  - Per-page images go to `public/og/` (gitignored); the committed `og-default.png` is the fallback.
- **Address:** `SITE_URL` + `BASE_PATH` (`astro.config.mjs`). See section 8.

**Verify after deploy:**
1. Paste `https://avi-lezerovich.github.io/skrim/?v=1` into a WhatsApp chat (to yourself),
   and wait for the card.
2. WhatsApp caches previews aggressively: after any change, bump `?v=2`, `?v=3`…
3. Optional cross-checks: Facebook Sharing Debugger (fetches fresh), and
   `https://www.opengraph.xyz/url/<encoded url>`.

## 8. Deploy

- **Live:** https://avi-lezerovich.github.io/skrim/, served from the `gh-pages` branch.
- **Build:**
  - `npm run build:pages` sets `SITE_URL=https://avi-lezerovich.github.io` and
    `BASE_PATH=/skrim`, then runs `npm run og` and the build, and writes `.nojekyll`.
  - Commit the contents of `site/dist/` on top of `gh-pages`.
- **Internal links** go through `u()` in `site/src/lib/url.ts`, so the same code works at a root
  or under `/skrim`.
- **CI and tests** build at the root (`BASE_PATH` unset).
- **A custom domain later:** `SITE_URL=https://…`, with `BASE_PATH` unset.

## 9. Deviations from FRONTEND_PLAN

| # | Plan | Now | Why |
| --- | --- | --- | --- |
| D1 | ≡ button opening a `<dialog>` menu on mobile (§4 `SiteHeader`) | Bottom tab bar under 768px | Five sections, thumb reach, one tap to any section |
| D2 | Static header | Sticky 48px header | Orientation and theme always at hand. It costs 48px; the old banner and header cost 142px |
| D3 | Draft banner with full §16ה text | One line on phones, then **removed** at go-live (20.10.2026, the owner's decision, recorded in CLAUDE.md) | 77px on every page; then the site went public |
| D4 | G1 "300px, shortened end labels" | Dedicated narrow drawing (see section 5) | At 360px the plot had 168 of 296px |
| D5 | G4 one chart per row at 375 | Party rows with sparklines; a tap opens the chart | One per row was about 3,500px of near-identical frames |
| D6 | Polls as cards under 768 | `PollsCompact` table, 30 at a time, filters in a bottom sheet with chips | 120 cards made a 22,199px page; the form filled the first screen |
| D7 | Tiles stacked on mobile | Three tiles in one row at every width | The headline answer belongs in the first screen |
| D8 | G3 two rows per party on mobile | One 44px row per party | Halves the height; fixes the whisker halo artifact |
| D9 | G5 on Plot | G5 in HTML | No chart library on the page, no layout shift (CLS 0.215 → 0); the rows are their own text alternative |
| D10 | No target size | 44px for controls and block links | Brief |
| D11 | — | `text-wrap` balance / pretty | One-word orphans in meta lines |
| D12 | Readout line instead of tooltips | Kept, plus a source link (polls behind the day; poll page + PDF) | The brief asked for "tap tooltips with the source link"; this keeps the plan's accessible readout |
| — | "No images except the logo SVG" (§6.2) | PNG share images | They are never loaded by the pages, only by link previews |
| — | `PollCard` (§4) | Removed | `PollsCompact` covers home and the list |
| — | Plan §2: `noindex` until polls close | Removed at go-live | The owner's decision (see D3) |

## 10. Verification (20.10.2026)

**Lighthouse mobile** (v12.8, simulated Moto G Power on slow 4G, `astro preview`):

| Page | Before (Perf / A11y / BP / SEO, CLS) | After |
| --- | --- | --- |
| `/` | 100 / 100 / 100 / 60*, 0.004 | 100 / 100 / 100 / 100, 0 |
| `/trends` | 96 / **96** / 100 / 60*, **0.117** | 99 / 100 / 100 / 100, 0 |
| `/polls` | 99 / 100 / 100 / 60*, 0.019 | 100 / 100 / 100 / 100, 0 |
| `/polls/[key]` | 100 / 100 / 100 / 60*, 0.006 | 100 / 100 / 100 / 100, 0 |
| `/pollsters` | **87** / 100 / 100 / 60*, **0.215** | 100 / 100 / 100 / 100, 0 |
| `/methodology` | 100 / 100 / 100 / 60*, 0.002 | 100 / 100 / 100 / 100, 0 |
| `/data` | 100 / 100 / 100 / 60*, 0.008 | 100 / 100 / 100 / 100, 0.001 |

\* The draft `noindex`.

**Page height at 360px:**

| Page | Before | After |
| --- | --- | --- |
| home | 3,951px | 3,253px |
| trends | 5,273px | 2,859px |
| polls | 22,199px | 2,700px |
| pollsters | 1,806px | 4,523px |

The pollsters page grew because a sideways-scrolling table became readable cards.

**Device emulation** (Playwright: iPhone 13 and Moto G4, with 150ms latency, 1.6 Mbit/s and
4× CPU):
- LCP 0.5–0.8s, CLS 0 on home, trends, polls and a poll page.
- No horizontal overflow, the tab bar flush at the bottom, Plex loaded, the filter sheet opens on tap.

**Tests:**
- e2e: 72 passing, with new tests for the tab bar, 404, readout link, compact list with the
  sheet and chips, and the share tags plus image.
- The site's 127 HTML files and 2,587 internal references were checked under `/skrim/`.
- Screenshots before and after, and from the device emulation, were taken but are not kept in the
  repository (about 40 MB); the metrics are in `design-audit/mobile-*/_report.json`.

## 11. Open

**Pipeline flags:**
- 30 `label_raw` values store their parentheses in visual order (`)מתוך "מפלגה אחרת"(`). This
  is extraction (`to_logical`), not CSS, and is shown as printed.

**Waiting for the owner:**
- The rename items: the Python and npm package names, CLAUDE.md wording beyond the publication
  line, SPEC.md (a copy of a live document) and the `methodology.md` heading.
- Domains: not checked; the sandbox has no DNS.
- Content for the /data sections removed at go-live: license, who runs the site and its
  independence, funding.

**Plan questions still open** (§8 in FRONTEND_PLAN): durable archive, historical error table,
legal review of the flag wording, and the exact §16ה blackout start.
