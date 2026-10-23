import pytest

from pollygraph.scrape.cec import file_refs
from pollygraph.scrape.store import Store

RECORD = {
    "UrlName": "knesset_election76",
    "Data": {
        "reference_number": "4154",
        "survey_editor": "מכון DRI",
        "survey_publisher": "סקר עצמאי",
        "date_the_survey": "2026-09-14T21:00:00Z",
        "transfer_to_cec": "2026-09-15T21:00:00Z",
        "public_to_cec": "2026-09-16T21:00:00Z",
        "update_to_cec": "2026-09-16T21:00:00Z",
        "file_PDF": [{"FileName": "Survey_4154.pdf", "FileSize": "5"}],
    },
}


@pytest.fixture
def store(tmp_path):
    raw = tmp_path / "data" / "raw"
    raw.mkdir(parents=True)
    return Store(raw)


def test_file_refs_builds_blob_url():
    (ref,) = file_refs(RECORD)
    assert ref.key == "knesset_election76"
    assert ref.url == (
        "https://www.gov.il/BlobFolder/dynamiccollectorresultitem/knesset_election76/he/Survey_4154.pdf"
    )


def test_identical_bytes_are_not_stored_twice(store):
    (ref,) = file_refs(RECORD)
    assert store.add(ref, RECORD, b"%PDF1").version_no == 1
    assert store.add(ref, RECORD, b"%PDF1") is None
    assert len(store.rows) == 1


def test_known_bytes_restore_a_missing_local_copy(store):
    (ref,) = file_refs(RECORD)
    row = store.add(ref, RECORD, b"%PDF1")
    (store.pdfs / "knesset_election76.pdf").unlink()  # manifest committed by CI, PDF in R2
    assert store.needs_fetch(ref, RECORD)
    assert store.add(ref, RECORD, b"%PDF1") is None
    assert (store.pdfs / "knesset_election76.pdf").read_bytes() == b"%PDF1"
    assert store.rows == [row]


def test_changed_bytes_become_a_new_version(store):
    (ref,) = file_refs(RECORD)
    store.add(ref, RECORD, b"%PDF1")
    v2 = store.add(ref, RECORD, b"%PDF2")
    assert v2.version_no == 2
    assert v2.path.endswith("knesset_election76.v2.pdf")
    assert (store.pdfs / "knesset_election76.pdf").read_bytes() == b"%PDF1"  # original untouched


def test_needs_fetch_only_when_record_changes(store):
    (ref,) = file_refs(RECORD)
    assert store.needs_fetch(ref, RECORD)
    store.add(ref, RECORD, b"%PDF1")
    assert not store.needs_fetch(ref, RECORD)
    updated = {**RECORD, "Data": {**RECORD["Data"], "update_to_cec": "2026-09-20T21:00:00Z"}}
    assert store.needs_fetch(ref, updated)


def test_empty_download_is_rejected(store):
    (ref,) = file_refs(RECORD)
    with pytest.raises(ValueError):
        store.add(ref, RECORD, b"")


def test_manifest_round_trip_and_verify(store):
    (ref,) = file_refs(RECORD)
    store.add(ref, RECORD, b"%PDF1")
    store.save_manifest()
    reloaded = Store(store.raw)
    assert reloaded.rows[0].sha256 == store.rows[0].sha256
    assert reloaded.verify(1, {"knesset_election76"}) == []
    assert reloaded.verify(
        2, {"knesset_election76", "knesset_election77"}
    )  # missing file is reported


def test_reused_reference_number_gets_distinct_keys():
    other = {**RECORD, "UrlName": "knesset_election96"}
    other["Data"] = {**RECORD["Data"], "file_PDF": [{"FileName": "Survey_4186.pdf"}]}
    assert file_refs(RECORD)[0].key != file_refs(other)[0].key
