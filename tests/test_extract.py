from pollygraph.extract.aliases import match_party, match_party_in
from pollygraph.extract.parse import extract, find_tables, parse_meta, split_row
from pollygraph.extract.text import to_logical
from pollygraph.normalize import qa


def test_to_logical_reverses_hebrew_and_keeps_numbers():
    assert to_logical("19.8% 26 דוכילה") == "הליכוד 26 19.8%"


def test_to_logical_reverses_column_order_of_number_only_lines():
    assert to_logical("6% 6% 7 7 7 5") == "5 7 7 7 6% 6%"
    assert to_logical("2026") == "2026"


def test_split_row():
    assert split_row("הליכוד בראשות בנימין נתניהו 29 22.4%") == (
        "הליכוד בראשות בנימין נתניהו",
        ["29", "22.4%"],
    )


def test_match_party_from_start_only():
    assert match_party('מפלגת "ישר!" בראשות גדי איזנקוט') == "yashar"
    assert match_party("ישראל ביתנו בראשות אביגדור ליברמן") == "yisrael_beytenu"
    assert match_party("מפלג ת ישר! בראשות גדי איזנקוט") == "yashar"  # letters split
    # metadata lines that merely contain an alias are not party rows
    assert match_party("סוגי האוכלוסייה שנדגמו מדגם ארצי בישראל") is None
    assert match_party("מס' האנשים שסרבו/לא התאימו") is None
    assert match_party("מזמין הסקר חדשות 13") is None


def test_match_party_in_whole_words():
    assert match_party_in("רשימה ערבית משותפת של חדש תעל ובלד בראשות יוסף גאברין") == (
        "hadash_taal_balad"
    )


def test_match_party_split_acronym_and_official_names():
    # Midgam: the PDF splits the last letter of an acronym off after the gershayim
    assert match_party('חד" ש-תע" ל בראשות יוסף ג`בארין ואחמד טיב י') == "hadash_taal_balad"
    # DRI prints the registered list names
    assert match_party("התאחדות הספרדים שומרי תורה תנועתו של מרן הרב עובדי") == "shas"
    assert match_party("הרשימה הערבית המאוחדת") == "raam"
    # Winter's list before it had a name
    assert match_party("מפלגה בראשות עופר וינטר") == "amcha"
    assert match_party_in("מפלגת ימין חדשה בראשות עופר וינטר") == "amcha"
    assert match_party("הציונות הדתי ת + זהות, בראשות בצלאל") == "rzp"


def test_bayit_zioni_and_reservists_are_different_lists():
    # Tropper + Hendel (until early Sept 2026) vs Hendel + Zelekha (after)
    assert match_party("בית ציוני - המילואימניקים בראשות חילי טרופר ויועז הנדל") == "bayit_zioni"
    assert match_party_in("חילי טרופר ויועז הנדל – מפלגת בית ציוני המילואימניקים") == (
        "bayit_zioni"
    )
    assert match_party("המילואימניקים בראשות יועז הנדל וחילי טרופ ר") == "bayit_zioni"
    assert match_party("המילואימניקים והכלכלית בראשות יועז הנדל וירון זליכה") == "reservists"
    assert match_party("המילואמיניקים בראשות יועז הנדל והמפלגה הכלכלית") == "reservists"


PARTIES = [
    ("הליכוד", 30),
    ("ישר!", 24),
    ("ביחד", 14),
    ("הדמוקרטים", 10),
    ('ש"ס', 10),
    ("יהדות התורה", 8),
    ("עוצמה יהודית", 8),
    ("ישראל ביתנו", 8),
    ('רע"ם', 4),
    ("הציונות הדתית", 4),
]


def test_seat_column_inferred_when_respondent_counts_come_first():
    # Tatika layout: label, respondents, %, seats
    lines = [f"{name} {seats * 4} {seats / 1.2:.1f}% {seats}" for name, seats in PARTIES]
    (table,) = find_tables([lines])
    assert table.seats_col == 1
    assert table.seat_sum() == 120


def test_history_columns_with_fractional_seats_and_dashes():
    # Maagar Mochot: label, raw %, % of decided, seats now, seats in three earlier polls.
    # Lists under the threshold get a fractional "seat" (2.2), new lists a "-" in old columns.
    lines = [
        '"ישר!" בראשות גדי איזנקוט 17% 18% 23 20 21 25',
        "הליכוד בראשות בנימין נתניהו 15% 17% 20 19 21 22",
        '"ביחד" בראשות נפתלי בנט 11% 12% 16 18 16 16',
        "עוצמה יהודית בראשות איתמר בן גביר 6% 7% 9 9 9 9",
        'ש"ס בראשות אריה דרעי 7% 7% 9 9 9 9',
        "הדמוקרטים בראשות יאיר גולן 7% 7% 9 10 11 10",
        "יהדות התורה בראשות יעקב אשר 5% 6% 7 7 7 7",
        "ישראל ביתנו בראשות אביגדור ליברמן 5% 6% 7 7 8 9",
        "הרשימה המשותפת בראשות פרופ' יוסף",
        to_logical("5 7 7 7 6% 6%"),  # numbers-only lines come in visual order
        'רע"מ בראשות מנסור עבאס 4% 4% 5 4 4 4',
        "הציונות הדתית + זהות, בראשות בצלאל",
        to_logical("4 3.1+0.9 5 4 3.29% 3%"),  # visual order, as pdfplumber returns it
        "עמך ישראל בראשות עופר וינטר 3% 3.32% 4 5 7 -",
        "המילואימניקים והכלכלית בראשות יועז 2% 2% 2.2 - - -",
        "כחול לבן בראשות בני גנץ 1% 1.0% 1.2 1 1.3 1.2",
    ]
    (table,) = find_tables([lines])
    seats = {r.party_id: r.seats for r in table.rows}
    assert seats["rzp"] == 4
    assert seats["amcha"] == 4
    assert seats["reservists"] is None
    assert seats["blue_white"] is None  # 1.2, not the 1 from the previous poll's column
    assert table.seat_sum() == 120


def test_first_120_table_is_the_vote_table_and_later_ones_are_scenarios():
    main = [f"{name} {seats} {seats / 1.2:.1f}%" for name, seats in PARTIES]
    scenario = ["ואם גלעד ארדן היה מקים מפלגה, למי היית מצביע?"] + main
    out = extract([main + scenario])
    assert out["seat_sum"] == 120
    assert out["scenario_tables"] == 1


def test_parse_meta_prefers_actual_respondents():
    lines = [
        "מס' האנשים שהתבקשו להשתתף בסקר 18,184",
        "גודל המדגם ההתחלתי 1,800",
        "מס' האנשים שהשתתפו בסקר בפוע ל 1,891",
        "שיעור ההיענות לסקר 10.39%",
        "מרווח טעות ±3.5% בהסתברות של 95%",
    ]
    meta = parse_meta([lines])
    assert meta["respondents"] == 1891
    assert meta["contacted"] == 18184
    assert meta["planned_n"] == 1800
    assert meta["response_rate"] == 10.39
    assert meta["moe_reported"] == 3.5


def test_qa_moe_and_seat_sum():
    assert qa.moe_computed(1891) == 2.25
    poll = {
        "seats": [{"party_id": "likud", "seats": 119, "pct": 50.0}],
        "meta": {"respondents": 500, "contacted": 400},
        "field_date": "2026-10-10",
        "transfer_date": "2026-10-09",
    }
    codes = {f["code"] for f in qa.check(poll)}
    assert {"seat_sum", "respondents_gt_contacted", "field_after_transfer"} <= codes
    assert qa.status(qa.check(poll)) == "needs_review"
