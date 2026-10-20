"""Text-based extraction of the seat table and methodology fields from a CEC filing.

This is the cheap first pass of the spec's extraction pipeline. It handles the
common layouts (one row per party: label, seats, raw %). Filings it cannot read
cleanly are marked ``needs_review`` and go to the vision/LLM pass or manual review.
"""

from __future__ import annotations

import re
from dataclasses import asdict, dataclass, field

from .aliases import match_party, match_party_in

NUM = re.compile(r"^[-+±]?\d{1,3}(?:,\d{3})*(?:\.\d+)?%?[-+±]?$")
NON_PARTY = {"undecided", "other"}


@dataclass
class SeatRow:
    label_raw: str
    party_id: str | None
    seats: int | None
    pct: float | None
    page: int
    ints: list[int] = field(default_factory=list, repr=False)  # whole-number columns, in order


@dataclass
class Table:
    rows: list[SeatRow] = field(default_factory=list)
    seats_col: int | None = None

    def party_ids(self) -> set[str]:
        return {r.party_id for r in self.rows if r.party_id}

    def seat_sum(self) -> int:
        return sum(r.seats or 0 for r in self.rows if r.party_id not in NON_PARTY)

    def has_seats(self) -> bool:
        return any(r.seats is not None for r in self.rows)

    def resolve_seats(self) -> None:
        """Choose which whole-number column holds seats.

        Layouts differ: "label seats %", "label n % seats" (respondent counts first),
        "label % seats-now seats-prev seats-prev2". The seats column is the one whose
        values are all 0–61 and sum to 120; failing that, the first plausible column.
        """
        party_rows = [r for r in self.rows if r.party_id not in NON_PARTY]
        width = max((len(r.ints) for r in party_rows), default=0)
        plausible = []
        for j in range(width):
            col = [r.ints[j] for r in party_rows if len(r.ints) > j]
            if col and all(0 <= v <= 61 for v in col):
                plausible.append((j, sum(col)))
        exact = [j for j, total in plausible if total == 120]
        self.seats_col = exact[0] if exact else (plausible[0][0] if plausible else None)
        for r in self.rows:
            ok = self.seats_col is not None and len(r.ints) > self.seats_col
            r.seats = r.ints[self.seats_col] if ok else None


def _num(tok: str) -> float | None:
    t = tok.strip("-+±").replace(",", "")
    try:
        return float(t.rstrip("%"))
    except ValueError:
        return None


def split_row(line: str) -> tuple[str, list[str]]:
    """Split 'label 26 19.8%' into ('label', ['26', '19.8%'])."""
    toks = line.split()
    nums: list[str] = []
    while toks and NUM.match(toks[-1]):
        nums.insert(0, toks.pop())
    return " ".join(toks), nums


def parse_row(label: str, nums: list[str], page: int, in_table: bool = False) -> SeatRow | None:
    if not nums:
        return None
    pid = match_party(label)
    if pid is None and in_table:
        pid = match_party_in(label)
    if pid is None:
        return None
    ints: list[int] = []
    pct = None
    for tok in nums:
        v = _num(tok)
        if v is None:
            continue
        if "%" in tok or v != int(v):
            # a decimal without a % sign is a percentage column too
            if pct is None and v <= 100:
                pct = v
        else:
            ints.append(int(v))
    if not ints and pct is None:
        return None
    return SeatRow(label.strip(), pid, None, pct, page, ints)


def find_tables(pages: list[list[str]]) -> list[Table]:
    tables: list[Table] = []
    cur = Table()
    pending: tuple[str, int] | None = None  # a party label whose numbers wrapped onto the next line

    def close() -> None:
        nonlocal cur
        if len(cur.rows) >= 3:
            cur.resolve_seats()
            tables.append(cur)
        cur = Table()

    for pno, lines in enumerate(pages, start=1):
        for line in lines:
            label, nums = split_row(line)
            if not label and nums and pending:
                label, pending = pending[0], None
            row = parse_row(label, nums, pno, in_table=len(cur.rows) >= 3)
            if row is None:
                if label and not nums and match_party(label) and len(label) < 80:
                    pending = (label, pno)
                elif "?" in line and len(cur.rows) >= 3:
                    close()  # a new question starts a new table
                continue
            pending = None
            if row.party_id not in NON_PARTY and row.party_id in cur.party_ids():
                close()
            cur.rows.append(row)
    close()
    return tables


def pick_vote_table(tables: list[Table]) -> tuple[Table | None, int]:
    """The vote-intention table: the first one whose seats sum to 120.

    Returns (table, number of further 120-seat tables, which are usually scenarios).
    """
    full = [t for t in tables if t.has_seats() and t.seat_sum() == 120]
    if full:
        return full[0], len(full) - 1
    with_seats = [t for t in tables if t.has_seats()]
    if with_seats:
        return max(with_seats, key=lambda t: len(t.rows)), 0
    return None, 0


# --- methodology fields -------------------------------------------------------

# Keywords per field, most specific first; compared with spaces removed because some
# filings split letters ("בפוע ל"). A line containing an excluded word is skipped.
FIELDS: dict[str, tuple[str, ...]] = {
    "respondents": (
        "משיביםבפועל",
        "המשיביםבפועל",
        "השתתפובסקרבפועל",
        "המשתתפיםבפועל",
        "המרואיינים",
        "גודלהמדגםהסופי",
        "מספרהמשיבים",
        "נדגמים",
        "בפועל",
        "משיבים",
    ),
    "contacted": ("התבקשו", "מתבקשים", "מספרהפניות", "פניות"),
    "planned_n": ("המדגםההתחלתי", "מדגםמתוכנן", "גודלהמדגםהמתוכנן"),
    "response_rate": ("שיעורההיענות", "היענות"),
    "moe_reported": ("טעותהדגימה", "טעותדגימה", "מרווחטעות", "מרווחהטעות", "טעות"),
}
EXCLUDE: dict[str, tuple[str, ...]] = {
    "respondents": ("סירבו", "סרבו", "התבקשו", "מתבקשים", "התאימו", "שיעור"),
    "contacted": ("שיעור",),
    "planned_n": (),
    "response_rate": ("סירבו", "סרבו", "התאימו"),
    "moe_reported": (),
}
INT = re.compile(r"(?<![\d.])(\d{1,3}(?:,\d{3})+|\d{2,6})(?![\d.%])")
PCT = re.compile(r"(\d{1,2}(?:\.\d+)?)\s*%|%\s*(\d{1,2}(?:\.\d+)?)")


def _first_int(line: str, minimum: int) -> int | None:
    for m in INT.finditer(line):
        v = int(m.group(1).replace(",", ""))
        if v >= minimum and not (1990 <= v <= 2035):  # skip years
            return v
    return None


def _first_pct(line: str) -> float | None:
    m = PCT.search(line)
    if m:
        return float(m.group(1) or m.group(2))
    return None


def parse_meta(pages: list[list[str]]) -> dict:
    # Methodology is reported on the first page or two, before the questions.
    lines = [ln for page in pages[:2] for ln in page]
    compact = [ln.replace(" ", "") for ln in lines]
    out: dict = {}
    for key, words in FIELDS.items():
        out[key] = None
        for word in words:
            for i, c in enumerate(compact):
                if word not in c or any(x in c for x in EXCLUDE[key]):
                    continue
                window = lines[i] + " " + (lines[i + 1] if i + 1 < len(lines) else "")
                if key in ("response_rate", "moe_reported"):
                    v = _first_pct(lines[i]) or _first_pct(window)
                else:
                    v = _first_int(lines[i], 100) or _first_int(window, 100)
                if v is not None:
                    out[key] = v
                    break
            if out[key] is not None:
                break
    text = " ".join(lines)
    online = "אינטרנט" in text
    phone = "טלפונ" in text
    out["mode"] = (
        "mixed" if online and phone else "online" if online else "phone" if phone else None
    )
    out["weighted_declared"] = ("משוקלל" in text or "שקלול" in text) and "לא משוקלל" not in text
    return out


DATE = re.compile(r"(?<!\d)(\d{1,2})[./](\d{1,2})[./](20\d{2}|\d{2})(?!\d)")
DATE_WORDS = ("ביצוע", "איסוף", "מועד", "תאריך", "נערך", "בוצע")


def parse_field_date(pages: list[list[str]]) -> str | None:
    """First d.m.yyyy date on a line about fieldwork, as ISO; None if not found."""
    for line in (ln for page in pages[:2] for ln in page):
        if not any(w in line.replace(" ", "") for w in DATE_WORDS):
            continue
        m = DATE.search(line)
        if m:
            d, mo, y = int(m.group(1)), int(m.group(2)), int(m.group(3))
            y = y + 2000 if y < 100 else y
            if 1 <= mo <= 12 and 1 <= d <= 31:
                return f"{y:04d}-{mo:02d}-{d:02d}"
    return None


def _row_out(r: SeatRow) -> dict:
    d = asdict(r)
    d.pop("ints")
    return d


def extract(pages: list[list[str]]) -> dict:
    tables = find_tables(pages)
    vote, scenarios = pick_vote_table(tables)
    return {
        "meta": parse_meta(pages),
        "field_date_pdf": parse_field_date(pages),
        "seats": [_row_out(r) for r in vote.rows] if vote else [],
        "seat_sum": vote.seat_sum() if vote else None,
        "scenario_tables": scenarios,
        "tables_found": len(tables),
    }
