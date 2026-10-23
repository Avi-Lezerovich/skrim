"""Append-only local store for raw CEC filings.

data/raw/pdfs/{key}.pdf        first version of each file (gitignored, backed up to R2)
data/raw/pdfs/{key}.v{n}.pdf   later versions whose bytes differ
data/raw/manifest.csv          one row per stored file version (tracked in git)
data/raw/listing.json          latest full listing, records as returned by the API
data/raw/listings/{ts}.json    snapshot of the listing each time it changes
"""

from __future__ import annotations

import csv
import hashlib
import json
from dataclasses import asdict, dataclass, fields
from datetime import UTC, datetime
from pathlib import Path

from .cec import FileRef

ROOT = Path(__file__).resolve().parents[3]
RAW = ROOT / "data" / "raw"


@dataclass
class ManifestRow:
    key: str
    survey_id: str
    version_no: int
    url_name: str
    file_name: str
    url: str
    path: str  # relative to repo root
    sha256: str
    size: int
    fetched_at: str
    pollster: str
    sponsor: str
    field_date: str
    transfer_to_cec: str
    public_to_cec: str
    update_to_cec: str


FIELDS = [f.name for f in fields(ManifestRow)]


def _slug_no(key: str) -> int:
    """Numeric part of a record slug, for stable ordering: knesset_election76 -> 76."""
    digits = "".join(ch for ch in key.split("-")[0] if ch.isdigit())
    return int(digits) if digits else 0


def now_iso() -> str:
    return datetime.now(UTC).strftime("%Y-%m-%dT%H:%M:%SZ")


def sha256(data: bytes) -> str:
    return hashlib.sha256(data).hexdigest()


class Store:
    def __init__(self, raw: Path = RAW):
        self.raw = raw
        self.pdfs = raw / "pdfs"
        self.manifest_path = raw / "manifest.csv"
        self.pdfs.mkdir(parents=True, exist_ok=True)
        self.rows: list[ManifestRow] = self._load()

    def _load(self) -> list[ManifestRow]:
        if not self.manifest_path.exists():
            return []
        with self.manifest_path.open(encoding="utf-8", newline="") as f:
            return [
                ManifestRow(**{**r, "version_no": int(r["version_no"]), "size": int(r["size"])})
                for r in csv.DictReader(f)
            ]

    def save_manifest(self) -> None:
        rows = sorted(self.rows, key=lambda r: (_slug_no(r.key), r.key, r.version_no))
        tmp = self.manifest_path.with_suffix(".tmp")
        with tmp.open("w", encoding="utf-8", newline="") as f:
            w = csv.DictWriter(f, fieldnames=FIELDS, lineterminator="\n")
            w.writeheader()
            w.writerows(asdict(r) for r in rows)
        tmp.replace(self.manifest_path)

    def latest(self, key: str) -> ManifestRow | None:
        versions = [r for r in self.rows if r.key == key]
        return max(versions, key=lambda r: r.version_no) if versions else None

    def needs_fetch(
        self, ref: FileRef, record: dict, recheck: bool = False, trust_manifest: bool = False
    ) -> bool:
        """Download when the file is new, its local copy is missing, or the CEC record changed.

        trust_manifest skips the on-disk check, for CI runners that hold the manifest but not
        the PDFs (those live in R2).
        """
        last = self.latest(ref.key)
        if last is None or recheck:
            return True
        if not trust_manifest and not (self.raw.parent.parent / last.path).exists():
            return True
        data = record.get("Data") or {}
        return (
            last.file_name != ref.file_name
            or last.update_to_cec != (data.get("update_to_cec") or "")
            or (ref.file_size is not None and ref.file_size != last.size)
        )

    def add(self, ref: FileRef, record: dict, content: bytes) -> ManifestRow | None:
        """Store bytes as a new version unless identical to one we already hold. Never overwrites."""
        if not content:
            raise ValueError(f"empty download for {ref.url}")
        digest = sha256(content)
        versions = [r for r in self.rows if r.key == ref.key]
        known = next((r for r in versions if r.sha256 == digest), None)
        if known:
            held = self.raw.parent.parent / known.path
            if not held.exists():  # manifest row from CI, PDF not yet on this machine
                held.write_bytes(content)
            return None
        version = max((r.version_no for r in versions), default=0) + 1
        name = f"{ref.key}.pdf" if version == 1 else f"{ref.key}.v{version}.pdf"
        path = self.pdfs / name
        if path.exists():  # a file we do not know about: refuse to clobber it
            raise FileExistsError(path)
        path.write_bytes(content)
        data = record.get("Data") or {}
        row = ManifestRow(
            key=ref.key,
            survey_id=ref.survey_id,
            version_no=version,
            url_name=ref.url_name,
            file_name=ref.file_name,
            url=ref.url,
            path=path.relative_to(self.raw.parent.parent).as_posix(),
            sha256=digest,
            size=len(content),
            fetched_at=now_iso(),
            pollster=(data.get("survey_editor") or "").strip(),
            sponsor=(data.get("survey_publisher") or "").strip(),
            field_date=data.get("date_the_survey") or "",
            transfer_to_cec=data.get("transfer_to_cec") or "",
            public_to_cec=data.get("public_to_cec") or "",
            update_to_cec=data.get("update_to_cec") or "",
        )
        self.rows.append(row)
        return row

    def save_listing(self, records: list[dict], total: int) -> bool:
        """Write the latest listing; snapshot it when it differs from the previous one."""
        records = sorted(
            records, key=lambda r: int((r.get("Data") or {}).get("reference_number") or 0)
        )
        payload = {"total_results": total, "records": records}
        text = json.dumps(payload, ensure_ascii=False, indent=1, sort_keys=True)
        latest = self.raw / "listing.json"
        if latest.exists() and latest.read_text(encoding="utf-8") == text:
            return False
        latest.write_text(text, encoding="utf-8")
        snaps = self.raw / "listings"
        snaps.mkdir(exist_ok=True)
        (snaps / f"{now_iso().replace(':', '')}.json").write_text(text, encoding="utf-8")
        return True

    def verify(self, total_results: int, expected_keys: set[str]) -> list[str]:
        """Stage-1 acceptance: every listed file is stored, none is empty or missing on disk."""
        problems = []
        held = {r.key for r in self.rows}
        missing = expected_keys - held
        if missing:
            problems.append(f"{len(missing)} listed files not in manifest: {sorted(missing)[:10]}")
        records = {k.split("-")[0] for k in expected_keys}
        if len(records) != total_results:
            problems.append(f"listing has {len(records)} records but TotalResults={total_results}")
        for r in self.rows:
            p = self.raw.parent.parent / r.path
            if r.size == 0:
                problems.append(f"zero-size file: {r.path}")
            elif p.exists() and p.stat().st_size != r.size:
                problems.append(f"size mismatch on disk: {r.path}")
        return problems
