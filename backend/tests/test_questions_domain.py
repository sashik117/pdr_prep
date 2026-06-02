from __future__ import annotations

import re

from domain.questions import dedupe_and_filter_questions, sanitize_question_row, strip_embedded_options_from_question


UI_MARKERS = ("Ілюстрація до питання", "Аналіз ситуації")
EMBEDDED_OPTION_RE = re.compile(r"\s+(?:1|A|А)[.)]\s+")
BROKEN_OPTION_RE = re.compile(r"(?:^|[.!?])\s*\d{1,3}[.)]?\s*[A-ZА-ЯІЇЄҐ]")
IMAGE_REQUIRED_MARKERS = ("зображений дорожній знак",)


def test_strip_embedded_options_from_question_when_answer_text_leaked_into_question() -> None:
    text = "Що повинен зробити водій у цій ситуації? 1) Продовжити рух прямо."

    assert (
        strip_embedded_options_from_question(text, ui_markers=UI_MARKERS, embedded_option_re=EMBEDDED_OPTION_RE)
        == "Що повинен зробити водій у цій ситуації?"
    )


def test_sanitize_question_row_cleans_ui_markers_and_options() -> None:
    row = {
        "id": 1,
        "section": 14,
        "section_name": " Дорожні знаки\n",
        "question_text": "Ілюстрація до питання Що означає знак?",
        "difficulty": "",
        "explanation": " Аналіз ситуації Пояснення ",
        "options": [" A ", "", " B\n"],
        "images": [" sign.png ", ""],
    }

    question = sanitize_question_row(row, ui_markers=UI_MARKERS, embedded_option_re=EMBEDDED_OPTION_RE)

    assert question["section"] == "14"
    assert question["section_name"] == "Дорожні знаки"
    assert question["question_text"] == "Що означає знак?"
    assert question["difficulty"] == "medium"
    assert question["explanation"] == "Пояснення"
    assert question["options"] == ["A", "B"]
    assert question["images"] == [" sign.png "]


def test_dedupe_and_filter_questions_requires_images_for_sign_questions() -> None:
    rows = [
        {
            "id": 1,
            "section": "33",
            "section_name": "Дорожні знаки",
            "question_text": "Зображений дорожній знак вказує:",
            "options": ["Один", "Два"],
            "correct_ans": 1,
            "images": ["missing.png"],
        },
        {
            "id": 2,
            "section": "33",
            "section_name": "Дорожні знаки",
            "question_text": "Зображений дорожній знак вказує:",
            "options": ["Один", "Два"],
            "correct_ans": 1,
            "images": ["ok.png"],
        },
    ]

    filtered = dedupe_and_filter_questions(
        rows,
        count=None,
        ui_markers=UI_MARKERS,
        embedded_option_re=EMBEDDED_OPTION_RE,
        broken_option_re=BROKEN_OPTION_RE,
        image_required_markers=IMAGE_REQUIRED_MARKERS,
        image_exists=lambda question: "ok.png" in question.get("images", []),
    )

    assert [question["id"] for question in filtered] == [2]
