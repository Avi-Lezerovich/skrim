"""Poll average, bloc totals, house effects and GRIM (SPEC: "אנליטיקה", "זיהוי חריגות").

Every function here is pure and unit-tested; methodology.md documents the choices.
"""

from __future__ import annotations

import math
from collections import defaultdict
from dataclasses import dataclass
from datetime import date, timedelta

WINDOW_DAYS = 14
HALF_LIFE_DAYS = 7.0
BLOCS = ("coalition", "opposition", "arab", "other")


@dataclass(frozen=True)
class Poll:
    key: str
    pollster: str
    day: date
    n: int | None
    seats: dict[str, int]  # party_id -> seats (parties only, 0 allowed)


def weight(poll: Poll, on: date) -> float:
    """√n × exponential time decay. A poll with unknown n counts as n = 500."""
    age = (on - poll.day).days
    return math.sqrt(poll.n or 500) * 0.5 ** (age / HALF_LIFE_DAYS)


def window(polls: list[Poll], on: date, exclude_pollster: str | None = None) -> list[Poll]:
    """Latest poll of each pollster fielded within WINDOW_DAYS up to and including `on`.

    One poll per pollster keeps a frequent pollster from dominating the average.
    """
    start = on - timedelta(days=WINDOW_DAYS - 1)
    latest: dict[str, Poll] = {}
    for p in polls:
        in_window = start <= p.day <= on and p.pollster != exclude_pollster
        if in_window and (p.pollster not in latest or p.day > latest[p.pollster].day):
            latest[p.pollster] = p
    return list(latest.values())


def weighted_mean_sd(values: list[float], weights: list[float]) -> tuple[float, float]:
    total = sum(weights)
    mean = sum(v * w for v, w in zip(values, weights, strict=True)) / total
    var = sum(w * (v - mean) ** 2 for v, w in zip(values, weights, strict=True)) / total
    return mean, math.sqrt(var)


def average(
    polls: list[Poll], on: date, keys: set[str], exclude_pollster: str | None = None
) -> dict[str, dict] | None:
    """Weighted average seats per key on a day, with the weighted spread between pollsters.

    A key absent from a poll counts as 0 seats in that poll (it did not clear the threshold
    or was not offered), except when no poll in the window mentions it at all.
    """
    win = window(polls, on, exclude_pollster)
    if not win:
        return None
    ws = [weight(p, on) for p in win]
    out = {}
    for k in keys:
        if not any(k in p.seats for p in win):
            continue
        mean, sd = weighted_mean_sd([p.seats.get(k, 0) for p in win], ws)
        out[k] = {"mean": round(mean, 2), "sd": round(sd, 2)}
    return {"n_polls": len(win), "pollsters": sorted(p.pollster for p in win), "values": out}


def bloc_seats(seats: dict[str, int], bloc_of: dict[str, str]) -> dict[str, int]:
    out = dict.fromkeys(BLOCS, 0)
    for pid, s in seats.items():
        b = bloc_of.get(pid, "other")
        out[b if b in out else "other"] += s
    return out


def daily_series(polls: list[Poll], keys: set[str]) -> list[dict]:
    if not polls:
        return []
    first, last = min(p.day for p in polls), max(p.day for p in polls)
    series, d = [], first
    while d <= last:
        avg = average(polls, d, keys)
        if avg:
            series.append({"date": d.isoformat(), **avg})
        d += timedelta(days=1)
    return series


def house_effects(polls: list[Poll], keys: set[str], min_polls: int = 2) -> list[dict]:
    """Per pollster × key: mean of (poll − average of the *other* pollsters on that day).

    Measures how a pollster differs from the rest, not from the truth.
    """
    diffs: dict[tuple[str, str], list[float]] = defaultdict(list)
    for p in polls:
        ref = average(polls, p.day, keys, exclude_pollster=p.pollster)
        if not ref or ref["n_polls"] < 2:
            continue
        for k, v in ref["values"].items():
            diffs[(p.pollster, k)].append(p.seats.get(k, 0) - v["mean"])
    out = []
    for (pollster, k), ds in sorted(diffs.items()):
        if len(ds) < min_polls:
            continue
        mean = sum(ds) / len(ds)
        sd = math.sqrt(sum((d - mean) ** 2 for d in ds) / (len(ds) - 1)) if len(ds) > 1 else 0.0
        half = 1.96 * sd / math.sqrt(len(ds))
        out.append(
            {
                "pollster": pollster,
                "key": k,
                "effect": round(mean, 2),
                "ci_low": round(mean - half, 2),
                "ci_high": round(mean + half, 2),
                "n_polls": len(ds),
            }
        )
    return out


def grim_consistent(pct: float, n: int, decimals: int) -> bool:
    """GRIM: can `pct` (rounded to `decimals`) arise as k/n for a whole number k?"""
    if n <= 0:
        return True
    tol = 0.5 * 10**-decimals + 1e-9
    k = round(pct * n / 100)
    return any(abs(100 * kk / n - pct) <= tol for kk in (k - 1, k, k + 1) if kk >= 0)


def decimals_of(pct: float) -> int:
    s = f"{pct}"
    return len(s.split(".")[1].rstrip("0")) if "." in s else 0
