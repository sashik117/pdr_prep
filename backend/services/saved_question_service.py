from __future__ import annotations

from typing import Any

from core.database import db
from repositories.saved_question_repository import SavedQuestionRepository
from services.errors import ServiceError


def _normalize_ids(values: list[int] | None) -> list[int]:
    normalized: list[int] = []
    for value in values or []:
        try:
            question_id = int(value)
        except (TypeError, ValueError):
            continue
        if question_id > 0:
            normalized.append(question_id)
    return list(dict.fromkeys(normalized))


def list_saved_question_ids(user: dict[str, Any]) -> dict[str, Any]:
    with db() as conn:
        repo = SavedQuestionRepository(conn)
        repo.ensure_schema()
        conn.commit()
        ids = repo.list_ids(user_id=int(user["id"]))
    return {"ids": ids}


def replace_saved_question_ids(user: dict[str, Any], question_ids: list[int]) -> dict[str, Any]:
    ids = _normalize_ids(question_ids)
    with db() as conn:
        repo = SavedQuestionRepository(conn)
        repo.ensure_schema()
        valid_ids = [
            question_id
            for question_id in ids
            if repo.question_exists(question_id=question_id)
        ]
        next_ids = repo.replace_ids(user_id=int(user["id"]), question_ids=valid_ids)
        conn.commit()
    return {"ids": next_ids}


def save_question(user: dict[str, Any], question_id: int) -> dict[str, Any]:
    with db() as conn:
        repo = SavedQuestionRepository(conn)
        repo.ensure_schema()
        if not repo.question_exists(question_id=question_id):
            raise ServiceError(404, "Питання не знайдено")
        repo.save(user_id=int(user["id"]), question_id=question_id)
        conn.commit()
        ids = repo.list_ids(user_id=int(user["id"]))
    return {"ids": ids, "saved": True}


def unsave_question(user: dict[str, Any], question_id: int) -> dict[str, Any]:
    with db() as conn:
        repo = SavedQuestionRepository(conn)
        repo.ensure_schema()
        repo.unsave(user_id=int(user["id"]), question_id=question_id)
        conn.commit()
        ids = repo.list_ids(user_id=int(user["id"]))
    return {"ids": ids, "saved": False}
