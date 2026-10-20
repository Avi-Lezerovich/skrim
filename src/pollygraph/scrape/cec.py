"""Client for the Central Elections Committee (CEC) poll filings on gov.il.

The listing page is an AngularJS app backed by an internal JSON API:

    POST https://www.gov.il/he/api/DynamicCollector
    {"DynamicTemplateID": TEMPLATE_ID, "QueryFilters": {"skip": {"Query": N}}, "From": N}

It returns 10 records per page plus ``TotalResults``. The API sits behind a
Cloudflare bot check that rejects plain HTTP clients, so we use curl_cffi with
browser TLS impersonation. PDF downloads from /BlobFolder/ are not challenged.
"""

from __future__ import annotations

import random
import time
from collections.abc import Iterator
from dataclasses import dataclass
from urllib.parse import quote

from curl_cffi import requests

BASE = "https://www.gov.il"
LISTING_PAGE = f"{BASE}/he/Departments/DynamicCollectors/knesset_election_polls_26"
API_URL = f"{BASE}/he/api/DynamicCollector"
TEMPLATE_ID = "b043127d-d79d-472e-ac10-5567bc9e8d3d"
PAGE_SIZE = 10
USER_AGENT_NOTE = "pollygraph-il research scraper; https://github.com/Avi-Lezerovich/pollygraph-il"


@dataclass(frozen=True)
class FileRef:
    """One PDF attached to a listing record."""

    survey_id: str  # CEC reference_number, e.g. "4154" (NOT unique: the CEC has reused numbers)
    url_name: str  # record slug, e.g. "knesset_election76"
    file_name: str  # e.g. "Survey_4154.pdf" (sometimes misspelled by the CEC)
    file_size: int | None
    index: int  # position in file_PDF; almost always 0

    @property
    def url(self) -> str:
        return f"{BASE}/BlobFolder/dynamiccollectorresultitem/{self.url_name}/he/{quote(self.file_name)}"

    @property
    def key(self) -> str:
        """Stable local id: the record slug, suffixed when a record carries several PDFs.

        reference_number is not unique (e.g. 4146 labels both a Kantar and a DRI poll), so
        the slug is the only reliable identity.
        """
        return self.url_name if self.index == 0 else f"{self.url_name}-{self.index}"


def file_refs(record: dict) -> list[FileRef]:
    data = record.get("Data") or {}
    survey_id = str(data.get("reference_number") or "").strip()
    if not survey_id:
        raise ValueError(f"record without reference_number: {record.get('UrlName')}")
    refs = []
    for i, f in enumerate(data.get("file_PDF") or []):
        size = f.get("FileSize")
        refs.append(
            FileRef(
                survey_id=survey_id,
                url_name=record["UrlName"],
                file_name=f["FileName"],
                file_size=int(size) if size and str(size).isdigit() else None,
                index=i,
            )
        )
    return refs


class CecClient:
    def __init__(self, delay: tuple[float, float] = (1.0, 2.0), retries: int = 4):
        self.delay = delay
        self.retries = retries
        self.session = requests.Session(impersonate="chrome")
        self._warmed = False

    def _sleep(self) -> None:
        time.sleep(random.uniform(*self.delay))

    def _request(self, method: str, url: str, **kw) -> requests.Response:
        last: Exception | None = None
        for attempt in range(self.retries):
            try:
                r = self.session.request(method, url, timeout=60, **kw)
                if r.status_code == 200:
                    return r
                last = RuntimeError(f"{method} {url} -> HTTP {r.status_code}")
            except requests.RequestsError as e:  # network errors from libcurl
                last = e
            time.sleep(2 ** (attempt + 1))
        raise RuntimeError(f"giving up after {self.retries} attempts: {last}")

    def _warm(self) -> None:
        # Loading the HTML page first picks up the Cloudflare cookies the API expects.
        if not self._warmed:
            self._request("GET", LISTING_PAGE)
            self._warmed = True
            self._sleep()

    def fetch_page(self, skip: int) -> dict:
        self._warm()
        body = {
            "DynamicTemplateID": TEMPLATE_ID,
            "QueryFilters": {"skip": {"Query": skip}},
            "From": skip,
        }
        headers = {
            "Referer": f"{LISTING_PAGE}?skip={skip}",
            "Origin": BASE,
            "X-Scraper": USER_AGENT_NOTE,
        }
        return self._request("POST", API_URL, json=body, headers=headers).json()

    def iter_listing(self) -> Iterator[tuple[dict, int]]:
        """Yield (record, total_results) for every record in the listing."""
        skip, total = 0, None
        while total is None or skip < total:
            page = self.fetch_page(skip)
            total = int(page.get("TotalResults") or 0)
            results = page.get("Results") or []
            if not results:
                break
            for rec in results:
                yield rec, total
            skip += PAGE_SIZE
            self._sleep()

    def download(self, ref: FileRef) -> bytes:
        r = self._request("GET", ref.url, headers={"X-Scraper": USER_AGENT_NOTE})
        self._sleep()
        return r.content
