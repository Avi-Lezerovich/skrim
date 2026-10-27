from pollygraph.analyze import exit_polls as ep
from pollygraph.analyze import stats
from pollygraph.extract.aliases import parties

# Bloc totals each channel reported on air, for the version listed first.
REPORTED = {
    "kan": {"coalition": 50, "opposition": 53, "arab": 17},
    "ch12": {"coalition": 50, "opposition": 52, "arab": 18},
    "ch13": {"coalition": 50, "opposition": 53, "arab": 17},
    "ch14": {"coalition": 60, "opposition": 43, "arab": 17},
    "i24": {"coalition": 55, "opposition": 49, "arab": 16},
    "ch16": {"coalition": 53, "opposition": 51, "arab": 16},
}


def test_every_exit_poll_sums_to_120_and_has_a_source():
    data = ep.exit_polls()
    assert [c["id"] for c in data["channels"]] == list(REPORTED)
    for c in data["channels"]:
        for v in c["versions"]:
            assert sum(v["seats"].values()) == 120
            assert v["source_url"].startswith("https://")
            assert all(r["label_raw"] for r in v["rows"])


def test_bloc_totals_match_what_the_channels_reported():
    bloc_of = {pid: p.bloc for pid, p in parties().items()}
    for c in ep.exit_polls()["channels"]:
        blocs = stats.bloc_seats(c["versions"][0]["seats"], bloc_of)
        assert {b: blocs.get(b, 0) for b in REPORTED[c["id"]]} == REPORTED[c["id"]], c["id"]


def test_results_are_empty_or_a_full_house():
    res = ep.results()
    assert res is None or (sum(res["seats"].values()) == 120 and res["source_url"].startswith("https://"))


def test_results_read_seats_and_optional_pct(monkeypatch):
    rows = [
        {"party_id": "likud", "label_raw": "הליכוד", "seats": "120", "pct": "41.5", "status": "final", "as_of": "2026-11-04", "source_url": "https://example.org"},
        {"party_id": "shas", "label_raw": "ש\"ס", "seats": "0", "pct": "", "status": "final", "as_of": "2026-11-04", "source_url": "https://example.org"},
    ]
    monkeypatch.setattr(ep, "_rows", lambda name: rows)
    res = ep.results()
    assert res["status"] == "final" and res["seats"] == {"likud": 120, "shas": 0}
    assert [r["pct"] for r in res["rows"]] == [41.5, None]


def test_every_method_but_unknown_has_a_source():
    for c in ep.exit_polls()["channels"]:
        m = c["method"]
        assert m["kind"] in ep.METHODS
        assert m["kind"] == "unknown" or m["source_url"].startswith("https://"), c["id"]
