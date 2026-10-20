"""Automatic QA checks on an extracted poll (SPEC: "בקרות אוטומטיות").

Each check yields a flag {code, level, detail}. level "error" sends the poll to the
review queue and keeps it out of averages; "warn" and "info" are shown on the poll
page for transparency but do not block it.
"""

from __future__ import annotations

import math
from datetime import date

THRESHOLD_PCT = 3.25
NON_PARTY = {"undecided", "other"}


def moe_computed(n: int | None) -> float | None:
    """95% margin of error, in percentage points, for p = 0.5 and a simple random sample."""
    if not n or n <= 0:
        return None
    return round(1.96 * math.sqrt(0.25 / n) * 100, 2)


def _flag(code: str, level: str, detail: str) -> dict:
    return {"code": code, "level": level, "detail": detail}


def check(poll: dict) -> list[dict]:
    flags: list[dict] = []
    seats = [r for r in poll["seats"] if r["party_id"] not in NON_PARTY]
    meta = poll["meta"]

    if not seats:
        flags.append(_flag("no_seat_table", "error", "no seat table extracted"))
    else:
        total = sum(r["seats"] or 0 for r in seats)
        if total != 120:
            flags.append(_flag("seat_sum", "error", f"seats sum to {total}, not 120"))
        ids = [r["party_id"] for r in seats]
        dupes = sorted({i for i in ids if ids.count(i) > 1})
        if dupes:
            flags.append(_flag("duplicate_party", "error", f"listed twice: {', '.join(dupes)}"))
        below = [
            r["party_id"]
            for r in seats
            if (r["seats"] or 0) > 0 and r["pct"] is not None and r["pct"] < THRESHOLD_PCT
        ]
        if below:
            # Raw (unweighted) % can legitimately sit under the threshold while the
            # weighted estimate behind the seat count clears it.
            flags.append(
                _flag(
                    "seats_below_threshold",
                    "info",
                    f"seats given while raw % < {THRESHOLD_PCT}: {', '.join(below)}",
                )
            )

    n, contacted, rr = meta.get("respondents"), meta.get("contacted"), meta.get("response_rate")
    if n is None:
        flags.append(_flag("no_respondents", "warn", "number of respondents not found"))
    if n and contacted:
        if n > contacted:
            flags.append(
                _flag(
                    "respondents_gt_contacted", "warn", f"respondents {n} > contacted {contacted}"
                )
            )
        elif rr is not None and abs(100 * n / contacted - rr) > 2:
            flags.append(
                _flag(
                    "response_rate_mismatch",
                    "info",
                    f"reported {rr}% vs respondents/contacted {100 * n / contacted:.1f}%",
                )
            )
    mc, mr = moe_computed(n), meta.get("moe_reported")
    if mc is not None and mr is not None and abs(mc - mr) > 1.0:
        flags.append(
            _flag(
                "moe_mismatch",
                "info",
                f"reported ±{mr}% vs ±{mc}% for n={n} (weighting/design effect can explain this)",
            )
        )

    fd, td = poll.get("field_date"), poll.get("transfer_date")
    if fd and td and date.fromisoformat(fd) > date.fromisoformat(td):
        flags.append(
            _flag("field_after_transfer", "warn", f"field date {fd} is after CEC transfer {td}")
        )
    if poll.get("field_date_source") in ("pdf", "transfer_date"):
        flags.append(
            _flag(
                "field_date_corrected",
                "info",
                f"CEC listing gives {poll['field_date_listed']}, after the transfer date {td}; "
                f"using {fd} from the {poll['field_date_source'].replace('_', ' ')}",
            )
        )
    if poll.get("scanned"):
        flags.append(_flag("scanned", "warn", "little extractable text; probably a scan"))
    return flags


def status(flags: list[dict]) -> str:
    return "needs_review" if any(f["level"] == "error" for f in flags) else "ok"
