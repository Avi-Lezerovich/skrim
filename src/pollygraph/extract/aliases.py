"""Reference tables in data/reference/ and alias matching for parties, pollsters, sponsors."""

from __future__ import annotations

import csv
import re
from dataclasses import dataclass
from functools import cache
from pathlib import Path

REF = Path(__file__).resolve().parents[3] / "data" / "reference"

# Quote marks, geresh, punctuation and whitespace vary between filings and some
# PDFs split letters with spaces ("מפלג ת ישר!"), so we compare with all of them removed.
_STRIP = re.compile(r"[\s\"'״׳“”‘’`!?.,:;()\-–—_/\\]+")
_FINALS = str.maketrans("ךםןףץ", "כמנפצ")


def norm(text: str) -> str:
    return _STRIP.sub("", text).translate(_FINALS)


def _read(name: str) -> list[dict]:
    with (REF / name).open(encoding="utf-8", newline="") as f:
        return list(csv.DictReader(f))


@dataclass(frozen=True)
class Party:
    id: str
    name_he: str
    name_en: str
    bloc: str
    color: str


@cache
def parties() -> dict[str, Party]:
    return {r["id"]: Party(**r) for r in _read("parties.csv")}


_QUOTES = re.compile(r"[\"'״׳“”‘’`]")
_PUNCT = re.compile(r"[!?.,:;()\-–—_/\\+&]+")
# Words a list name may be prefixed with in a filing ("מפלגת הדמוקרטים", "רשימת ...").
_PREFIXES = ("מפלגת", "רשימת", "תנועת", "מפלגה", "רשימה", "תנועה")


def words(text: str) -> str:
    """Quotes dropped, punctuation → space, final letters normalised, spaces collapsed."""
    t = _PUNCT.sub(" ", _QUOTES.sub("", text)).translate(_FINALS)
    return " ".join(t.split())


def _strip_prefix(s: str, sep: str) -> str:
    for p in _PREFIXES:
        if s.startswith(p + sep) and len(s) > len(p + sep):
            return s[len(p + sep) :]
    return s


@cache
def _party_aliases() -> list[tuple[str, str]]:
    pairs = [(words(r["alias"]), r["party_id"]) for r in _read("party_aliases.csv")]
    known = parties()
    for _, pid in pairs:
        if pid not in known:
            raise ValueError(f"party_aliases.csv references unknown party {pid!r}")
    # Longest alias first, so "ישראל ביתנו" wins over "ישר".
    return sorted(pairs, key=lambda p: -len(p[0]))


def match_party_in(label: str) -> str | None:
    """Looser match: a known alias appears anywhere in the label as whole words.

    Only safe on lines already known to be rows of a seat table, e.g.
    "רשימה ערבית משותפת של חדש תעל ובלד בראשות ...".
    """
    w = f" {words(label)} "
    for alias, pid in _party_aliases():
        if len(alias) >= 3 and f" {alias} " in w:
            return pid
    return None


def match_party(label: str) -> str | None:
    """Party id when the label *starts with* a known alias (after an optional "מפלגת" etc.).

    Matching from the start, on word boundaries, keeps metadata lines such as
    "סוגי האוכלוסייה ... בישראל" from matching "ישר". A fallback compares with spaces
    removed, for filings that split letters ("מפלג ת ישר !"); it requires the alias to be
    followed by the end of the label or by "בראשות"/"בהובלת", so "ישראל" is not "ישר".
    """
    w = _strip_prefix(words(label), " ")
    if not w:
        return None
    for alias, pid in _party_aliases():
        if w == alias or w.startswith(alias + " "):
            return pid
    joined = _strip_prefix(w.replace(" ", ""), "")
    for alias, pid in _party_aliases():
        a = alias.replace(" ", "")
        if joined.startswith(a):
            rest = joined[len(a) :]
            if not rest or rest.startswith(("בראשות", "בהובלת", "וזהות", "והכלכלית")):
                return pid
    return None


def _entity_map(name: str) -> dict[str, str]:
    out = {}
    for r in _read(name):
        for alias in [r["name_he"], *r["aliases"].split("|")]:
            if alias.strip():
                out[norm(alias)] = r["id"]
    return out


@cache
def _pollster_map() -> dict[str, str]:
    return _entity_map("pollsters.csv")


@cache
def _sponsor_map() -> dict[str, str]:
    return _entity_map("sponsors.csv")


@cache
def pollsters() -> dict[str, dict]:
    return {r["id"]: r for r in _read("pollsters.csv")}


@cache
def sponsors() -> dict[str, dict]:
    return {r["id"]: r for r in _read("sponsors.csv")}


def match_pollster(name: str) -> str | None:
    return _pollster_map().get(norm(name))


def match_sponsor(name: str) -> str | None:
    return _sponsor_map().get(norm(name))
