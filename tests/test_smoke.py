def test_import():
    import pollygraph  # noqa: F401


def test_update_stops_at_first_failing_stage(monkeypatch):
    from pollygraph import update

    calls = []
    monkeypatch.setattr(update, "scrape", lambda argv: calls.append("scrape") or 1)
    monkeypatch.setattr(update, "extract", lambda: calls.append("extract") or 0)
    monkeypatch.setattr(update, "analyze", lambda: calls.append("analyze") or 0)
    assert update.main([]) == 1
    assert calls == ["scrape"]
