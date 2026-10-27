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
