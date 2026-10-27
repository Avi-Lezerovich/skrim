"""Election-night exit polls and the official results, from hand-maintained tables.

Exit polls are not filed with the CEC, so each row in data/reference/exit_polls.csv names
the page its numbers were copied from (`source_url`). data/reference/results.csv stays
empty until the CEC publishes results; the site scores the exit polls against it then.
"""

from __future__ import annotations

from ..extract.aliases import _read, parties

SEATS = 120

# Broadcast names and order (by channel number) for the election-night table.
CHANNELS = {
    "kan": "כאן 11",
    "ch12": "חדשות 12",
    "ch13": "חדשות 13",
    "ch14": "ערוץ 14",
    "i24": "i24NEWS",
    "ch16": "ערוץ 16",
}


def _rows(name: str) -> list[dict]:
    known = parties()
    rows = _read(name)
    for r in rows:
        if r["party_id"] not in known:
            raise ValueError(f"{name}: unknown party {r['party_id']!r}")
        if not r["source_url"].startswith("https://"):
            raise ValueError(f"{name}: row for {r['party_id']!r} has no source_url")
    return rows


def exit_polls() -> dict:
    """{"channels": [...], "results": {...} | None} for site/src/data/exit_polls.json."""
    versions: dict[tuple[str, int], dict] = {}
    for r in _rows("exit_polls.csv"):
        if r["channel"] not in CHANNELS:
            raise ValueError(f"exit_polls.csv: unknown channel {r['channel']!r}")
        v = versions.setdefault(
            (r["channel"], int(r["version"])),
            {
                "version": int(r["version"]),
                "published_at": r["published_at"] or None,
                "pollster": r["pollster"] or None,
                "source_url": r["source_url"],
                "note": None,
                "rows": [],
                "seats": {},
            },
        )
        v["note"] = v["note"] or r["note"] or None
        v["rows"].append({"label_raw": r["label_raw"], "party_id": r["party_id"], "seats": int(r["seats"])})
        v["seats"][r["party_id"]] = int(r["seats"])
    for (ch, n), v in versions.items():
        total = sum(v["seats"].values())
        if total != SEATS:
            raise ValueError(f"exit poll {ch} v{n} sums to {total}, not {SEATS}")
    channels = [
        {
            "id": ch,
            "name": name,
            "versions": sorted((v for (c, _), v in versions.items() if c == ch), key=lambda v: v["version"]),
        }
        for ch, name in CHANNELS.items()
    ]
    return {"channels": [c for c in channels if c["versions"]], "results": results()}


def results() -> dict | None:
    """The CEC results once results.csv has rows: seats per party, with status and date."""
    rows = _rows("results.csv")
    if not rows:
        return None
    statuses = {r["status"] for r in rows}
    if len(statuses) != 1 or statuses - {"partial", "final"}:
        raise ValueError(f"results.csv: one status per file, partial or final; got {statuses}")
    return {
        "status": statuses.pop(),
        "as_of": max(r["as_of"] for r in rows),
        "source_url": rows[0]["source_url"],
        "rows": [{"label_raw": r["label_raw"], "party_id": r["party_id"], "seats": int(r["seats"])} for r in rows],
        "seats": {r["party_id"]: int(r["seats"]) for r in rows},
    }
