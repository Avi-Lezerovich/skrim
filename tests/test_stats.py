from datetime import date

import pytest

from pollygraph.analyze import stats
from pollygraph.analyze.stats import Poll

D = date(2026, 10, 10)


def poll(pollster, day, likud, n=400):
    return Poll(f"{pollster}-{day}", pollster, day, n, {"likud": likud, "yashar": 120 - likud})


def test_weight_halves_every_half_life():
    p = poll("a", D, 30)
    assert stats.weight(p, D) == pytest.approx(20.0)
    assert stats.weight(p, date(2026, 10, 17)) == pytest.approx(10.0)


def test_window_keeps_latest_poll_per_pollster_and_drops_old():
    polls = [
        poll("a", date(2026, 10, 1), 20),
        poll("a", date(2026, 10, 9), 30),
        poll("b", date(2026, 9, 20), 25),
    ]
    win = stats.window(polls, D)
    assert [p.seats["likud"] for p in win] == [30]


def test_average_is_weighted_and_reports_spread():
    polls = [poll("a", D, 30), poll("b", D, 20)]
    avg = stats.average(polls, D, {"likud"})
    assert avg["values"]["likud"] == {"mean": 25.0, "sd": 5.0}
    assert avg["n_polls"] == 2


def test_missing_party_counts_as_zero_only_if_someone_reports_it():
    a = Poll("a", "a", D, 400, {"likud": 30, "noam": 4})
    b = Poll("b", "b", D, 400, {"likud": 30})
    vals = stats.average([a, b], D, {"likud", "noam", "achi"})["values"]
    assert vals["noam"]["mean"] == 2.0
    assert "achi" not in vals


def test_house_effect_is_relative_to_other_pollsters():
    polls = []
    for d in range(1, 11):
        day = date(2026, 10, d)
        polls += [poll("high", day, 34), poll("x", day, 30), poll("y", day, 30)]
    effects = {(e["pollster"], e["key"]): e for e in stats.house_effects(polls, {"likud"})}
    assert effects[("high", "likud")]["effect"] == pytest.approx(4.0)
    assert effects[("x", "likud")]["effect"] == pytest.approx(-2.0)


def test_bloc_seats():
    bloc_of = {"likud": "coalition", "yashar": "opposition", "raam": "arab"}
    assert stats.bloc_seats({"likud": 30, "yashar": 25, "raam": 5, "new": 3}, bloc_of) == {
        "coalition": 30,
        "opposition": 25,
        "arab": 5,
        "other": 3,
    }


def test_grim():
    # n = 535 (as in the Next Data petition), one decimal: 27/535 = 5.05% and 28/535 = 5.23%,
    # so 5.0% is reachable but 5.1% is not.
    assert stats.grim_consistent(5.0, 535, 1)
    assert not stats.grim_consistent(5.1, 535, 1)
    assert stats.grim_consistent(5.0, 500, 1)
    assert stats.grim_consistent(19.7, 518, 1)  # 102/518 = 19.69%
    assert stats.decimals_of(19.8) == 1
