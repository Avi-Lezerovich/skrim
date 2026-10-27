"""Build polls.duckdb and the site's JSON from data/extracted/polls/.

uv run python -m pollygraph.analyze
"""

from __future__ import annotations

import json
import sys
from datetime import UTC, date, datetime
from pathlib import Path

from ..extract.aliases import parties, pollsters, sponsors
from ..normalize.db import build_db
from . import stats
from .exit_polls import exit_polls

ROOT = Path(__file__).resolve().parents[3]
POLLS = ROOT / "data" / "extracted" / "polls"
SITE_DATA = ROOT / "site" / "src" / "data"
NON_PARTY = {"undecided", "other"}


def load() -> list[dict]:
    polls = [json.loads(p.read_text(encoding="utf-8")) for p in sorted(POLLS.glob("*.json"))]
    return sorted(polls, key=lambda p: (p["field_date"] or "", p["key"]), reverse=True)


def grim(poll: dict) -> dict | None:
    """Granularity check of raw % against the respondent count (SPEC: GRIM).

    Not exported to the site yet: most filings print % over a base other than all
    respondents (eligible voters, excluding undecided) or weight without saying so, so a
    failed check here is not evidence of anything. Enable per pollster once the base and
    weighting are extracted.
    """
    n = poll["meta"].get("respondents")
    rows = [r for r in poll["seats"] if r["pct"] is not None]
    if not n or len(rows) < 5:
        return None
    dec = max(stats.decimals_of(r["pct"]) for r in rows)
    if dec == 0:
        return None  # whole percentages are almost always reachable
    bad = [r["party_id"] for r in rows if not stats.grim_consistent(r["pct"], n, dec)]
    return {"n": n, "decimals": dec, "checked": len(rows), "inconsistent": bad}


def site_poll(p: dict, bloc_of: dict[str, str]) -> dict:
    seats = {
        r["party_id"]: r["seats"] or 0
        for r in p["seats"]
        if r["party_id"] and r["party_id"] not in NON_PARTY
    }
    return {
        "key": p["key"],
        "survey_id": p["survey_id"],
        "field_date": p["field_date"],
        "transfer_date": p["transfer_date"],
        "published_date": p["published_date"],
        "pollster": p["pollster_id"],
        "pollster_raw": p["pollster_raw"],
        "sponsor": p["sponsor_id"],
        "sponsor_raw": p["sponsor_raw"],
        "source_url": p["source_url"],
        "status": p["status"],
        "method": p["method"],
        "meta": p["meta"],
        "rows": p["seats"],
        "seats": seats,
        "blocs": stats.bloc_seats(seats, bloc_of) if p["status"] == "ok" else None,
        "scenario_tables": p["scenario_tables"],
        "flags": p["qa_flags"],
    }


def write(name: str, data) -> None:
    (SITE_DATA / name).write_text(
        json.dumps(data, ensure_ascii=False, separators=(",", ":")), encoding="utf-8"
    )


def main() -> int:
    raw = load()
    SITE_DATA.mkdir(parents=True, exist_ok=True)
    party_ref = parties()
    bloc_of = {pid: p.bloc for pid, p in party_ref.items()}

    db_path = build_db(raw, ROOT / "data" / "polls.duckdb")
    out_polls = [site_poll(p, bloc_of) for p in raw]
    ok = [p for p in out_polls if p["status"] == "ok" and p["field_date"]]

    party_polls = [
        stats.Poll(
            p["key"],
            p["pollster"],
            date.fromisoformat(p["field_date"]),
            p["meta"].get("respondents"),
            p["seats"],
        )
        for p in ok
    ]
    bloc_polls = [
        stats.Poll(p.key, p.pollster, p.day, p.n, stats.bloc_seats(p.seats, bloc_of))
        for p in party_polls
    ]
    party_keys = {k for p in party_polls for k in p.seats}
    bloc_keys = set(stats.BLOCS)

    write("polls.json", out_polls)
    write(
        "average.json",
        {
            "window_days": stats.WINDOW_DAYS,
            "half_life_days": stats.HALF_LIFE_DAYS,
            "parties": stats.daily_series(party_polls, party_keys),
            "blocs": stats.daily_series(bloc_polls, bloc_keys),
        },
    )
    write(
        "house_effects.json",
        {
            "parties": stats.house_effects(party_polls, party_keys),
            "blocs": stats.house_effects(bloc_polls, bloc_keys),
        },
    )
    write("parties.json", {pid: vars(p) for pid, p in party_ref.items()})
    write("pollsters.json", pollsters())
    write("sponsors.json", sponsors())
    write("exit_polls.json", exit_polls())
    write(
        "meta.json",
        {
            "generated_at": datetime.now(UTC).strftime("%Y-%m-%dT%H:%M:%SZ"),
            "polls_total": len(out_polls),
            "polls_ok": len(ok),
            "first_field_date": min((p["field_date"] for p in ok), default=None),
            "last_field_date": max((p["field_date"] for p in ok), default=None),
            "source": "https://www.gov.il/he/Departments/DynamicCollectors/knesset_election_polls_26",
        },
    )
    print(f"site data: {len(out_polls)} polls ({len(ok)} in averages) → {SITE_DATA}")
    print(f"database: {db_path}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
