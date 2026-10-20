"""PDF → logical-order text lines.

pdfplumber returns Hebrew in visual order (each line reversed), while digits,
Latin and punctuation runs come out in logical order. Reversing the whole line
and then re-reversing those LTR runs yields readable Hebrew with numbers intact:

    "19.8% 26 דוכילה"  →  "הליכוד 26 19.8%"
"""

from __future__ import annotations

import re
from pathlib import Path

import pdfplumber

LTR_RUN = re.compile(r"[A-Za-z0-9.,%:+\-/=()\[\]]+")
HEBREW = re.compile("[֐-׿]")
MIN_CHARS_PER_PAGE = 80  # below this a page is probably a scan


NUMERIC_TOKEN = re.compile(r"^[-+±()]*\d[\d.,%]*[-+±()]*$|^-$")


def to_logical(line: str) -> str:
    if not HEBREW.search(line):
        toks = line.split()
        # A numbers-only line inside an RTL table (a row whose label wrapped) comes out
        # in visual order, i.e. with its columns reversed.
        if len(toks) > 1 and all(NUMERIC_TOKEN.match(t) for t in toks):
            return " ".join(reversed(toks))
        return line
    rev = line[::-1]
    return LTR_RUN.sub(lambda m: _mirror(m.group(0)[::-1]), rev)


def _mirror(run: str) -> str:
    # Brackets reversed along with the text point the wrong way; swap them back.
    return run.translate(str.maketrans("()[]", ")(]["))


def pdf_pages(path: Path) -> list[list[str]]:
    """Logical-order lines per page."""
    with pdfplumber.open(path) as pdf:
        return [[to_logical(ln) for ln in (p.extract_text() or "").splitlines()] for p in pdf.pages]


def looks_scanned(pages: list[list[str]]) -> bool:
    chars = sum(len(ln) for page in pages for ln in page)
    return chars < MIN_CHARS_PER_PAGE * max(1, len(pages))
