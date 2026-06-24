from __future__ import annotations

import json
from collections.abc import Callable
from typing import Any

from core.database import db
from repositories.admin_question_repository import AdminQuestionRepository
from schemas.requests import AdminQuestionCreateRequest, AdminQuestionUpdateRequest
from services.errors import ServiceError


QuestionPresenter = Callable[[dict[str, Any]], dict[str, Any]]
TextCleaner = Callable[[Any], str]


def search_admin_questions(
    *,
    search: str,
    section: str,
    limit: int,
    offset: int = 0,
    has_images: bool | None = None,
    present_question: QuestionPresenter,
) -> dict[str, Any]:
    with db() as conn:
        result = AdminQuestionRepository(conn).search_questions(
            search=search.strip(),
            section=section.strip(),
            limit=limit,
            offset=max(0, offset),
            has_images=has_images,
        )
    return {
        "items": [present_question(row) for row in result["items"]],
        "total": result["total"],
        "limit": limit,
        "offset": max(0, offset),
    }


def list_admin_question_sections() -> list[dict[str, Any]]:
    with db() as conn:
        return AdminQuestionRepository(conn).list_sections()


def _normalize_question_values(
    req: AdminQuestionCreateRequest | AdminQuestionUpdateRequest,
    *,
    clean_text: TextCleaner,
    require_all: bool,
) -> dict[str, Any]:
    values: dict[str, Any] = {}
    section = getattr(req, "section", None)
    if section is not None:
        clean_section = str(section).strip()
        if not clean_section:
            raise ServiceError(400, "Вкажіть розділ питання")
        values["section"] = clean_section

    question_text = getattr(req, "question_text", None)
    if question_text is not None:
        clean_question = question_text.strip()
        if not clean_question:
            raise ServiceError(400, "Вкажіть текст питання")
        values["question_text"] = clean_question

    explanation = getattr(req, "explanation", None)
    if explanation is not None:
        values["explanation"] = explanation.strip()

    difficulty = getattr(req, "difficulty", None)
    if difficulty is not None:
        values["difficulty"] = difficulty.strip().lower() or "medium"

    section_name = getattr(req, "section_name", None)
    if section_name is not None:
        values["section_name"] = section_name.strip()

    options_value = getattr(req, "options", None)
    if options_value is not None:
        options = [clean_text(option) for option in options_value if clean_text(option)]
        if len(options) < 2:
            raise ServiceError(400, "Потрібно щонайменше 2 варіанти відповіді")
        values["options"] = json.dumps(options, ensure_ascii=False)

    images_value = getattr(req, "images", None)
    if images_value is not None:
        values["images"] = json.dumps(
            [str(item).strip() for item in images_value if str(item).strip()],
            ensure_ascii=False,
        )

    correct_ans = getattr(req, "correct_ans", None)
    if correct_ans is not None:
        correct = int(correct_ans)
        if correct < 1:
            raise ServiceError(400, "Правильна відповідь має бути 1 або більше")
        values["correct_ans"] = correct

    if require_all:
        for field in ("section", "question_text", "options", "correct_ans"):
            if field not in values:
                raise ServiceError(400, "Заповніть розділ, текст, відповіді та правильний варіант")

    if "options" in values and "correct_ans" in values:
        options = json.loads(values["options"])
        if int(values["correct_ans"]) > len(options):
            raise ServiceError(400, "Номер правильної відповіді більший за кількість варіантів")

    return values


def create_admin_question(
    req: AdminQuestionCreateRequest,
    *,
    clean_text: TextCleaner,
    present_question: QuestionPresenter,
) -> dict[str, Any]:
    values = _normalize_question_values(req, clean_text=clean_text, require_all=True)
    values.setdefault("difficulty", "medium")
    values.setdefault("section_name", "")
    values.setdefault("explanation", "")
    values.setdefault("images", "[]")

    with db() as conn:
        repo = AdminQuestionRepository(conn)
        row = repo.create_question(values=values)
        conn.commit()
    return present_question(row)


def update_admin_question(
    question_id: int,
    req: AdminQuestionUpdateRequest,
    *,
    clean_text: TextCleaner,
    present_question: QuestionPresenter,
) -> dict[str, Any]:
    values = _normalize_question_values(req, clean_text=clean_text, require_all=False)
    if not values:
        raise ServiceError(400, "Немає полів для оновлення")

    with db() as conn:
        repo = AdminQuestionRepository(conn)
        if not repo.exists(question_id=question_id):
            raise ServiceError(404, "Питання не знайдено")
        repo.update_question(question_id=question_id, values=values)
        conn.commit()
        row = repo.get_question(question_id=question_id)
    return present_question(row or {})


def delete_admin_question(question_id: int) -> dict[str, Any]:
    with db() as conn:
        repo = AdminQuestionRepository(conn)
        deleted = repo.delete_question(question_id=question_id)
        if not deleted:
            raise ServiceError(404, "Питання не знайдено")
        conn.commit()
    return {"ok": True, "deleted_id": question_id}
