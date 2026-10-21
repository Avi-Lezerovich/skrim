"""Incremental update: fetch new CEC filings, extract them, rebuild the database and site data.

uv run python -m pollygraph.update

Runs scrape → extract → analyze and stops at the first stage that fails, so a listing
that does not match TotalResults never reaches the site data. Extraction and analysis are
deterministic: polls already held come out byte-identical, so `git diff` shows only what
is new. Review the new polls (data/extracted/review_queue.csv, flags) before committing.
"""

from __future__ import annotations

import sys

from .analyze.__main__ import main as analyze
from .extract.__main__ import main as extract
from .scrape.__main__ import main as scrape


def main(argv: list[str] | None = None) -> int:
    stages = [
        ("scrape", lambda: scrape(argv or [])),
        ("extract", extract),
        ("analyze", analyze),
    ]
    for name, run in stages:
        print(f"== {name}")
        code = run()
        if code:
            print(f"update stopped: {name} exited with {code}", file=sys.stderr)
            return code
    return 0


if __name__ == "__main__":
    sys.exit(main(sys.argv[1:]))
