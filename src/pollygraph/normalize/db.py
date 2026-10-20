"""Load extracted polls and reference tables into DuckDB (SPEC: "מודל הנתונים").

The database is a build artifact for ad-hoc SQL; it is rebuilt from scratch each run.
"""

from __future__ import annotations

from pathlib import Path

import duckdb

from ..extract.aliases import parties, pollsters, sponsors

SCHEMA = """
CREATE TABLE pollster (id TEXT PRIMARY KEY, name_he TEXT, name_en TEXT, aliases TEXT[]);
CREATE TABLE sponsor (id TEXT PRIMARY KEY, name_he TEXT, type TEXT, aliases TEXT[]);
CREATE TABLE party (id TEXT PRIMARY KEY, name_he TEXT, name_en TEXT, bloc TEXT, color TEXT);
CREATE TABLE source_file (
    id TEXT PRIMARY KEY, cec_survey_id TEXT, url TEXT, sha256 TEXT, version_no INTEGER,
    submitted_at DATE, published_at DATE
);
CREATE TABLE poll (
    id TEXT PRIMARY KEY, source_file_id TEXT, pollster_id TEXT, sponsor_id TEXT,
    pollster_raw TEXT, sponsor_raw TEXT, field_date DATE, mode TEXT,
    contacted INTEGER, planned_n INTEGER, respondents INTEGER, response_rate DOUBLE,
    moe_reported DOUBLE, moe_computed DOUBLE, extraction_method TEXT,
    extraction_status TEXT, qa_flags TEXT[]
);
CREATE TABLE answer (
    poll_id TEXT, ord INTEGER, label_raw TEXT, party_id TEXT, seats INTEGER, pct DOUBLE,
    page INTEGER
);
"""


def build_db(polls: list[dict], path: Path) -> Path:
    path.unlink(missing_ok=True)
    con = duckdb.connect(str(path))
    con.execute(SCHEMA)
    con.executemany(
        "INSERT INTO pollster VALUES (?, ?, ?, ?)",
        [
            (r["id"], r["name_he"], r["name_en"], r["aliases"].split("|"))
            for r in pollsters().values()
        ],
    )
    con.executemany(
        "INSERT INTO sponsor VALUES (?, ?, ?, ?)",
        [(r["id"], r["name_he"], r["type"], r["aliases"].split("|")) for r in sponsors().values()],
    )
    con.executemany(
        "INSERT INTO party VALUES (?, ?, ?, ?, ?)",
        [(p.id, p.name_he, p.name_en, p.bloc, p.color) for p in parties().values()],
    )
    for p in polls:
        m = p["meta"]
        con.execute(
            "INSERT INTO source_file VALUES (?, ?, ?, ?, ?, ?, ?)",
            [
                p["key"],
                p["survey_id"],
                p["source_url"],
                p["sha256"],
                p["version_no"],
                p["transfer_date"],
                p["published_date"],
            ],
        )
        con.execute(
            "INSERT INTO poll VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
            [
                p["key"],
                p["key"],
                p["pollster_id"],
                p["sponsor_id"],
                p["pollster_raw"],
                p["sponsor_raw"],
                p["field_date"],
                m.get("mode"),
                m.get("contacted"),
                m.get("planned_n"),
                m.get("respondents"),
                m.get("response_rate"),
                m.get("moe_reported"),
                m.get("moe_computed"),
                p["method"],
                p["status"],
                [f["code"] for f in p["qa_flags"]],
            ],
        )
        answers = [
            (p["key"], i, r["label_raw"], r["party_id"], r["seats"], r["pct"], r["page"])
            for i, r in enumerate(p["seats"])
        ]
        if answers:
            con.executemany("INSERT INTO answer VALUES (?, ?, ?, ?, ?, ?, ?)", answers)
    con.close()
    return path
