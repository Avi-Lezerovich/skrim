# CLAUDE.md

Project: pollygraph (pollygraph-il; working name in the spec: סקרנות) — open database + static site of Knesset-26 election polls filed with the Central Elections Committee (CEC). The full spec is in `SPEC.md`; read it before changing the pipeline or site.

## Rules

- **Never delete or overwrite files under `data/raw/`.** Raw PDFs and listings are append-only; a changed file is a new version with its own hash.
- **Every number has a source.** Each extracted value must trace back to a CEC PDF (`source_file`). The site links every poll to its PDF.
- Hebrew text is UTF-8 everywhere. On Windows set `PYTHONUTF8=1` when running scripts.
- Keep `label_raw` (the party name as printed) next to any normalized `party_id`.
- Flags, not accusations: anomaly checks are shown as "statistical flags" with an innocent explanation beside them. No verbal commentary on parties.
- Do not publish poll analysis to the public site before polls close on 27.10.2026 (publication ban, §16ה).
- Be polite to gov.il: 1–2 s between requests, identifying User-Agent, retry with backoff.

## Layout

```
src/pollygraph/scrape/     CEC listing API + PDF download → data/raw/
src/pollygraph/extract/    PDF → structured JSON → data/extracted/
src/pollygraph/normalize/  aliases + QA → polls.duckdb
src/pollygraph/analyze/    averages, house effects, GRIM → site/src/data/
data/reference/            hand-maintained alias tables (parties, pollsters, sponsors)
site/                      Astro static site (Hebrew, RTL)
```

## Commands

```bash
uv sync                                   # install deps
uv run python -m pollygraph.scrape        # fetch listing + new PDFs
uv run python -m pollygraph.extract       # PDFs -> data/extracted/polls/*.json + review_queue.csv
uv run python -m pollygraph.analyze       # -> data/polls.duckdb + site/src/data/*.json
uv run pytest                             # tests
cd site && npm install && npm run dev     # site dev server
```

## Workflow

Work on a feature branch and open a PR into `main`. One pipeline stage per PR where practical.
