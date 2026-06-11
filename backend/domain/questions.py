from __future__ import annotations

import re
from collections.abc import Callable
from pathlib import Path
from typing import Any, Optional, Pattern


ImageAvailabilityChecker = Callable[[dict[str, Any]], bool]


def clean_text(value: Any, ui_markers: tuple[str, ...]) -> str:
    text = str(value or "").replace("\r", " ").replace("\n", " ").strip()
    for marker in ui_markers:
        text = text.replace(marker, " ")
    return re.sub(r"\s+", " ", text).strip()


def strip_embedded_options_from_question(
    value: Any,
    *,
    ui_markers: tuple[str, ...],
    embedded_option_re: Pattern[str],
) -> str:
    text = clean_text(value, ui_markers)
    match = embedded_option_re.search(text)
    if not match:
        return text
    question_part = text[: match.start()].strip()
    if question_part.endswith("?") or len(question_part.split()) >= 8:
        return question_part
    return text


def question_requires_image(question: dict[str, Any], required_markers: tuple[str, ...]) -> bool:
    text = f"{question.get('question_text') or ''} {question.get('section_name') or ''}".casefold()
    return any(marker in text for marker in required_markers)


def local_or_remote_image_exists(image_ref: Any, public_images_dir: Path) -> bool:
    normalized = str(image_ref or "").strip()
    if not normalized:
        return False
    if normalized.startswith(("http://", "https://")):
        return True
    clean_path = normalized.split("?")[0].split("#")[0].replace("\\", "/")
    if clean_path.startswith("/images/"):
        relative_path = clean_path.removeprefix("/images/").lstrip("/")
        return (public_images_dir / relative_path).exists()
    if clean_path.startswith("images/"):
        relative_path = clean_path.removeprefix("images/").lstrip("/")
        return (public_images_dir / relative_path).exists()
    return (public_images_dir / Path(clean_path).name).exists()


def sanitize_question_row(
    row: dict[str, Any],
    *,
    ui_markers: tuple[str, ...],
    embedded_option_re: Pattern[str],
) -> dict[str, Any]:
    options = [clean_text(option, ui_markers) for option in (row.get("options") or []) if clean_text(option, ui_markers)]
    images = [str(image) for image in (row.get("images") or []) if str(image).strip()]
    question_text = strip_embedded_options_from_question(
        row.get("question_text"),
        ui_markers=ui_markers,
        embedded_option_re=embedded_option_re,
    )
    return {
        **row,
        "section": str(row.get("section") or ""),
        "section_name": clean_text(row.get("section_name"), ui_markers),
        "question_text": question_text,
        "difficulty": clean_text(row.get("difficulty"), ui_markers) or "medium",
        "explanation": clean_text(row.get("explanation"), ui_markers),
        "options": options,
        "images": images,
    }


def question_is_usable(
    row: dict[str, Any],
    *,
    ui_markers: tuple[str, ...],
    embedded_option_re: Pattern[str],
    broken_option_re: Pattern[str],
    image_required_markers: tuple[str, ...],
    image_exists: ImageAvailabilityChecker,
) -> bool:
    question = sanitize_question_row(row, ui_markers=ui_markers, embedded_option_re=embedded_option_re)
    options = question.get("options") or []
    correct_ans = int(question.get("correct_ans") or 0)
    if not question.get("question_text") or len(options) < 2:
        return False
    if correct_ans < 1 or correct_ans > len(options):
        return False
    if any(broken_option_re.search(option) for option in options):
        return False
    if question_requires_image(question, image_required_markers) and not image_exists(question):
        return False
    return True


def dedupe_and_filter_questions(
    rows: list[dict[str, Any]],
    *,
    count: Optional[int],
    ui_markers: tuple[str, ...],
    embedded_option_re: Pattern[str],
    broken_option_re: Pattern[str],
    image_required_markers: tuple[str, ...],
    image_exists: ImageAvailabilityChecker,
) -> list[dict[str, Any]]:
    prepared: list[dict[str, Any]] = []
    seen_ids: set[Any] = set()
    seen_texts: set[str] = set()

    for row in rows:
        if not question_is_usable(
            row,
            ui_markers=ui_markers,
            embedded_option_re=embedded_option_re,
            broken_option_re=broken_option_re,
            image_required_markers=image_required_markers,
            image_exists=image_exists,
        ):
            continue
        question = sanitize_question_row(row, ui_markers=ui_markers, embedded_option_re=embedded_option_re)
        qid = question.get("id")
        text_key = question.get("question_text", "").casefold()
        if qid in seen_ids or text_key in seen_texts:
            continue
        seen_ids.add(qid)
        seen_texts.add(text_key)
        prepared.append(question)
        if count and len(prepared) >= count:
            break
    return prepared
