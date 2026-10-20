"""Fetch the CEC listing and download new or changed poll PDFs.

uv run python -m pollygraph.scrape            # incremental
uv run python -m pollygraph.scrape --recheck  # re-download and re-hash everything
uv run python -m pollygraph.scrape --listing-only
"""

from __future__ import annotations

import argparse
import sys

from .cec import CecClient, file_refs
from .store import Store


def main(argv: list[str] | None = None) -> int:
    ap = argparse.ArgumentParser(prog="pollygraph.scrape")
    ap.add_argument(
        "--recheck", action="store_true", help="re-download every file and compare hashes"
    )
    ap.add_argument(
        "--listing-only", action="store_true", help="refresh listing.json without downloading"
    )
    ap.add_argument(
        "--trust-manifest",
        action="store_true",
        help="treat files in the manifest as held even if not on disk (CI; PDFs live in R2)",
    )
    args = ap.parse_args(argv)

    client, store = CecClient(), Store()
    records, total = [], 0
    for rec, total in client.iter_listing():
        records.append(rec)
    print(f"listing: {len(records)} records, TotalResults={total}")
    if total == 0 or not records:
        print("ERROR: listing returned no results — has the gov.il page changed?", file=sys.stderr)
        return 2
    changed = store.save_listing(records, total)
    print(f"listing.json {'updated' if changed else 'unchanged'}")
    if args.listing_only:
        return 0

    refs = [(ref, rec) for rec in records for ref in file_refs(rec)]
    new = 0
    try:
        for ref, rec in refs:
            if not store.needs_fetch(
                ref, rec, recheck=args.recheck, trust_manifest=args.trust_manifest
            ):
                continue
            row = store.add(ref, rec, client.download(ref))
            if row:
                new += 1
                print(f"  + {row.path} ({row.size:,} B) {row.pollster} / {row.sponsor}")
    finally:
        store.save_manifest()  # keep what we got even if a download fails midway

    print(f"downloaded {new} new file version(s); manifest holds {len(store.rows)} rows")
    problems = store.verify(total, {ref.key for ref, _ in refs})
    for p in problems:
        print(f"CHECK FAILED: {p}", file=sys.stderr)
    if not problems:
        print(f"acceptance OK: {len({r.key for r in store.rows})} files for {total} listed surveys")
    return 1 if problems else 0


if __name__ == "__main__":
    sys.exit(main())
