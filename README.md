# skrim

מאגר פתוח של סקרי הבחירות לכנסת ה-26 שהוגשו לוועדת הבחירות המרכזית, ואתר שמשווה סוקרים, מזמינים וערוצים לאורך זמן.

An open database of Israeli Knesset-26 election polls filed with the Central Elections Committee, plus a static site comparing pollsters over time and (after 4.11.2026) scoring their accuracy.

See `SPEC.md` for the full specification. The product is called **skrim** («סקרים»); the code keeps the package name `pollygraph`.

## Updating with new polls

```bash
uv run python -m pollygraph.update
```

Fetches the CEC listing, downloads new or changed PDFs, extracts them and rebuilds `polls.duckdb` and `site/src/data/`. It stops at the first stage that fails (for example when the manifest does not match `TotalResults`). Existing polls come out unchanged, so `git diff` shows only the new data. Before committing, check the new polls against their PDFs and look at `data/extracted/review_queue.csv`. Polls listed there stay out of the averages. Write up each run in `docs/updates/`.
