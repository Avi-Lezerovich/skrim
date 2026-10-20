"""Extract every stored filing into data/extracted/polls/{key}.json.

    uv run python -m pollygraph.extract

Uses the latest version of each file in data/raw/manifest.csv. A hand-checked
correction in data/reference/overrides/{key}.json replaces the parsed fields it
names (seats, meta) and marks the poll as manually reviewed.
"""

from __future__ import annotations

import csv
import json
import sys
from collections import Counter
from datetime import datetime
from pathlib import Path
from zoneinfo import ZoneInfo

from ..normalize import qa
from .aliases import match_pollster, match_sponsor
from .parse import extract
from .text import looks_scanned, pdf_pages

ROOT = Path(__file__).resolve().parents[3]
MANIFEST = ROOT / "data" / "raw" / "manifest.csv"
OUT = ROOT / "data" / "extracted" / "polls"
TEXT_CACHE = ROOT / "data" / "extracted" / "text"
OVERRIDES = ROOT / "data" / "reference" / "overrides"
PARSER_VERSION = "text-v1"
IL = ZoneInfo("Asia/Jerusalem")


def local_date(iso: str) -> str | None:
    """CEC timestamps are midnight Israel time expressed in UTC ("…T21:00:00Z")."""
    if not iso:
        return None
    return datetime.fromisoformat(iso).astimezone(IL).date().isoformat()


def latest_rows() -> list[dict]:
    with MANIFEST.open(encoding="utf-8", newline="") as f:
        rows = list(csv.DictReader(f))
    latest: dict[str, dict] = {}
    for r in rows:
        if r["key"] not in latest or int(r["version_no"]) > int(latest[r["key"]]["version_no"]):
            latest[r["key"]] = r
    return list(latest.values())


def pages_for(row: dict) -> list[list[str]]:
    TEXT_CACHE.mkdir(parents=True, exist_ok=True)
    cached = TEXT_CACHE / f"{row['key']}.{row['sha256'][:12]}.json"
    if cached.exists():
        return json.loads(cached.read_text(encoding="utf-8"))
    pages = pdf_pages(ROOT / row["path"])
    cached.write_text(json.dumps(pages, ensure_ascii=False), encoding="utf-8")
    return pages


def fix_field_date(poll: dict) -> None:
    """The CEC listing has typos (18.10 for 18.9). A field date after the date the poll was
    transferred to the CEC is impossible; prefer the date printed in the PDF, else cap it."""
    listed, transfer, pdf = poll["field_date"], poll["transfer_date"], poll.pop("field_date_pdf")
    poll["field_date_listed"] = listed
    poll["field_date_pdf"] = pdf
    if listed and transfer and listed > transfer:
        poll["field_date"] = pdf if pdf and pdf <= transfer else transfer
        poll["field_date_source"] = "pdf" if pdf and pdf <= transfer else "transfer_date"
    else:
        poll["field_date_source"] = "listing"


def build(row: dict) -> dict:
    pages = pages_for(row)
    parsed = extract(pages)
    poll = {
        "key": row["key"],
        "survey_id": row["survey_id"],
        "version_no": int(row["version_no"]),
        "sha256": row["sha256"],
        "source_url": row["url"],
        "pollster_raw": row["pollster"],
        "pollster_id": match_pollster(row["pollster"]),
        "sponsor_raw": row["sponsor"],
        "sponsor_id": match_sponsor(row["sponsor"]),
        "field_date": local_date(row["field_date"]),
        "transfer_date": local_date(row["transfer_to_cec"]),
        "published_date": local_date(row["public_to_cec"]),
        "pages": len(pages),
        "scanned": looks_scanned(pages),
        "method": PARSER_VERSION,
        **parsed,
    }
    fix_field_date(poll)
    override = OVERRIDES / f"{row['key']}.json"
    if override.exists():
        fix = json.loads(override.read_text(encoding="utf-8"))
        if fix.get("sha256") and fix["sha256"] != row["sha256"]:
            print(f"  ! override for {row['key']} is for another file version; ignored")
        else:
            for k in ("seats", "meta", "field_date"):
                if k in fix:
                    poll[k] = {**poll[k], **fix[k]} if k == "meta" else fix[k]
            poll["method"] = fix.get("method", "manual")
            poll["review_note"] = fix.get("note")
    poll["seat_sum"] = sum(
        r["seats"] or 0 for r in poll["seats"] if r["party_id"] not in qa.NON_PARTY
    )
    poll["meta"]["moe_computed"] = qa.moe_computed(poll["meta"].get("respondents"))
    poll["qa_flags"] = qa.check(poll)
    poll["status"] = qa.status(poll["qa_flags"])
    return poll


def main() -> int:
    OUT.mkdir(parents=True, exist_ok=True)
    rows = latest_rows()
    stats: Counter = Counter()
    unknown: Counter = Counter()
    queue = []
    for row in rows:
        poll = build(row)
        if poll["status"] != "ok":
            errors = "; ".join(f["detail"] for f in poll["qa_flags"] if f["level"] == "error")
            queue.append(
                [poll["key"], poll["pollster_raw"], poll["field_date"], errors, poll["source_url"]]
            )
        stats[poll["status"]] += 1
        for kind in ("pollster", "sponsor"):
            if poll[f"{kind}_id"] is None:
                unknown[f"{kind}: {poll[f'{kind}_raw']}"] += 1
        text = json.dumps(poll, ensure_ascii=False, indent=1)
        (OUT / f"{row['key']}.json").write_text(text + "\n", encoding="utf-8")
    with (OUT.parent / "review_queue.csv").open("w", encoding="utf-8", newline="") as f:
        w = csv.writer(f, lineterminator="\n")
        w.writerow(["key", "pollster", "field_date", "errors", "pdf"])
        w.writerows(sorted(queue))
    total = sum(stats.values())
    print(f"extracted {total} polls: {dict(stats)} ({100 * stats['ok'] / total:.0f}% pass QA)")
    for name, n in unknown.items():
        print(f"  unmapped {name} ({n})")
    return 0


if __name__ == "__main__":
    sys.exit(main())
