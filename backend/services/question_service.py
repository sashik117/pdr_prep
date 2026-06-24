from __future__ import annotations

from collections.abc import Callable
from typing import Any, Optional

from core.config import (
    BROKEN_OPTION_RE,
    CATEGORY_SECTION_RULES,
    EMBEDDED_OPTION_RE,
    IMAGE_REQUIRED_MARKERS,
    PUBLIC_IMAGES_DIR,
    PUBLIC_STATIC_IMAGES_DIR,
    QUESTION_UI_MARKERS,
)
from core.database import db
from domain.questions import dedupe_and_filter_questions, local_or_remote_image_exists, sanitize_question_row
from repositories.question_repository import QuestionRepository, section_number_sql
from services.errors import ServiceError


ImportQuestionPreparer = Callable[[dict[str, Any]], dict[str, Any]]


def _category_sections(category: Optional[str]) -> list[int]:
    normalized = (category or "").strip().upper()
    return CATEGORY_SECTION_RULES.get(normalized, [])


def _append_category_condition(conds: list[str], params: list[Any], category: Optional[str], prefix: str = "") -> None:
    sections = _category_sections(category)
    if not sections:
        return
    column = f"{prefix}section" if prefix else "section"
    conds.append(f"{section_number_sql(column)} = ANY(%s)")
    params.append(sections)


def _question_has_available_image(question: dict[str, Any]) -> bool:
    return any(
        local_or_remote_image_exists(image, PUBLIC_IMAGES_DIR)
        or local_or_remote_image_exists(image, PUBLIC_STATIC_IMAGES_DIR)
        for image in question.get("images") or []
    )


def _prepare_questions(rows: list[dict[str, Any]], count: Optional[int] = None) -> list[dict[str, Any]]:
    return dedupe_and_filter_questions(
        rows,
        count=count,
        ui_markers=QUESTION_UI_MARKERS,
        embedded_option_re=EMBEDDED_OPTION_RE,
        broken_option_re=BROKEN_OPTION_RE,
        image_required_markers=IMAGE_REQUIRED_MARKERS,
        image_exists=_question_has_available_image,
    )


def list_questions(
    *,
    section: Optional[str],
    category: Optional[str],
    topic: Optional[str],
    limit: int,
    offset: int,
    search: Optional[str],
    ids: Optional[str],
) -> dict[str, Any]:
    conds: list[str] = []
    params: list[Any] = []
    if section:
        conds.append("section = %s")
        params.append(section)
    if topic:
        conds.append("section_name = %s")
        params.append(topic)
    if search:
        conds.append("question_text ILIKE %s")
        params.append(f"%{search}%")
    if ids:
        parsed_ids = [int(value) for value in ids.split(",") if value.strip().isdigit()]
        if parsed_ids:
            conds.append("id = ANY(%s)")
            params.append(parsed_ids)
    _append_category_condition(conds, params, category)

    where_sql = f"WHERE {' AND '.join(conds)}" if conds else ""
    with db() as conn:
        rows = QuestionRepository(conn).list_questions(where_sql=where_sql, params=params)
    prepared = _prepare_questions(rows)
    return {"total": len(prepared), "items": prepared[offset : offset + limit]}


def random_questions(
    *,
    count: int,
    section: Optional[str],
    category: Optional[str],
    topic: Optional[str],
    difficulty: Optional[str],
    exclude_ids: str,
    difficult_only: bool,
    seed: Optional[str],
    user: Optional[dict[str, Any]],
) -> list[dict[str, Any]]:
    conds: list[str] = []
    params: list[Any] = []
    if section:
        conds.append("q.section = %s")
        params.append(section)
    if topic:
        conds.append("q.section_name = %s")
        params.append(topic)
    if difficulty:
        conds.append("LOWER(COALESCE(q.difficulty, 'medium')) = %s")
        params.append(difficulty.strip().lower())
    _append_category_condition(conds, params, category, prefix="q.")
    parsed_excluded: list[int] = []
    if exclude_ids.strip():
        parsed = [int(value) for value in exclude_ids.split(",") if value.strip().isdigit()]
        if parsed:
            parsed_excluded.extend(parsed)
            conds.append("q.id <> ALL(%s)")
            params.append(parsed)
    if difficult_only:
        if not user or not isinstance(user, dict):
            return []
        conds.append(
            """
            q.id IN (
                SELECT question_id
                FROM user_answers
                WHERE user_id = %s AND is_correct = false
            )
            """
        )
        params.append(user["id"])

    with db() as conn:
        repo = QuestionRepository(conn)
        if user and not difficult_only:
            recent_ids = [
                question_id
                for question_id in repo.list_recent_answered_question_ids(user_id=int(user["id"]))
                if question_id not in parsed_excluded
            ]
            if recent_ids:
                first_pass_conds = [*conds, "q.id <> ALL(%s)"]
                first_pass_params = [*params, recent_ids]
                first_pass_where = f"WHERE {' AND '.join(first_pass_conds)}"
                first_pass_rows = repo.list_random_candidates(
                    where_sql=first_pass_where,
                    params=first_pass_params,
                    seed=seed,
                    limit=max(count * 30, 150),
                )
                prepared = _prepare_questions(first_pass_rows, count=count)
                if len(prepared) >= count:
                    return prepared[:count]

        where_sql = f"WHERE {' AND '.join(conds)}" if conds else ""
        rows = repo.list_random_candidates(
            where_sql=where_sql,
            params=params,
            seed=seed,
            limit=max(count * 30, 150),
        )
    return _prepare_questions(rows, count=count)[:count]


def get_question(question_id: int) -> dict[str, Any]:
    with db() as conn:
        row = QuestionRepository(conn).get_question(question_id=question_id)
    if not row:
        raise ServiceError(404, "Питання не знайдено")
    return sanitize_question_row(
        row,
        ui_markers=QUESTION_UI_MARKERS,
        embedded_option_re=EMBEDDED_OPTION_RE,
    )


def list_sections(*, category: Optional[str]) -> list[dict[str, Any]]:
    conds: list[str] = []
    params: list[Any] = []
    _append_category_condition(conds, params, category)
    where_sql = f"WHERE {' AND '.join(conds)}" if conds else ""
    with db() as conn:
        rows = QuestionRepository(conn).list_sections(
            where_sql=where_sql,
            params=params,
            section_order_sql=section_number_sql("section"),
        )
    return [
        {
            "section": row["section"],
            "section_name": row["section_name"],
            "count": row["count"],
        }
        for row in rows
    ]


def import_questions(
    payload: list[dict[str, Any]],
    user: Optional[dict[str, Any]],
    *,
    prepare_question: ImportQuestionPreparer,
) -> dict[str, Any]:
    if not payload:
        raise ServiceError(400, "Немає питань для імпорту")

    prepared_rows = []
    for item in payload:
        prepared = prepare_question(item)
        if not prepared["question_text"] or len(prepared["options"]) < 2 or prepared["correct_ans"] < 1:
            continue
        prepared_rows.append(prepared)

    if not prepared_rows:
        raise ServiceError(400, "Усі записи невалідні")

    with db() as conn:
        QuestionRepository(conn).upsert_questions(prepared_rows)
        conn.commit()

    imported_by = user["email"] if isinstance(user, dict) else "anonymous"
    return {"imported": len(prepared_rows), "imported_by": imported_by}
