from __future__ import annotations

import json
from collections.abc import Callable
from typing import Any

from core.database import db
from repositories.admin_question_repository import AdminQuestionRepository
from schemas.requests import AdminQuestionUpdateRequest
from services.errors import ServiceError


QuestionPresenter = Callable[[dict[str, Any]], dict[str, Any]]
TextCleaner = Callable[[Any], str]


def search_admin_questions(
    *,
    search: str,
    section: str,
    limit: int,
    present_question: QuestionPresenter,
) -> list[dict[str, Any]]:
    with db() as conn:
        rows = AdminQuestionRepository(conn).search_questions(
            search=search.strip(),
            section=section.strip(),
            limit=limit,
        )
    return [present_question(row) for row in rows]


def list_admin_question_sections() -> list[dict[str, Any]]:
    with db() as conn:
        return AdminQuestionRepository(conn).list_sections()


def update_admin_question(
    question_id: int,
    req: AdminQuestionUpdateRequest,
    *,
    clean_text: TextCleaner,
    present_question: QuestionPresenter,
) -> dict[str, Any]:
    values: dict[str, Any] = {}
    if req.question_text is not None:
        values["question_text"] = req.question_text.strip()
    if req.explanation is not None:
        values["explanation"] = req.explanation.strip()
    if req.difficulty is not None:
        values["difficulty"] = req.difficulty.strip().lower() or "medium"
    if req.section_name is not None:
        values["section_name"] = req.section_name.strip()
    if req.options is not None:
        options = [clean_text(option) for option in req.options if clean_text(option)]
        if len(options) < 2:
            raise ServiceError(400, "Потрібно щонайменше 2 варіанти відповіді")
        values["options"] = json.dumps(options, ensure_ascii=False)
    if req.images is not None:
        values["images"] = json.dumps([str(item).strip() for item in req.images if str(item).strip()], ensure_ascii=False)
    if req.correct_ans is not None:
        values["correct_ans"] = int(req.correct_ans)
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
