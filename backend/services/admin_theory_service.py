from __future__ import annotations

import re
from collections.abc import Callable
from typing import Any

from core.database import db
from repositories.admin_theory_repository import AdminTheoryRepository
from schemas.requests import AdminTheorySectionUpdateRequest
from services.errors import ServiceError


TextSanitizer = Callable[[Any], str]


def list_admin_theory_sections(*, search: str, topic: str, category: str, limit: int) -> list[dict[str, Any]]:
    with db() as conn:
        return AdminTheoryRepository(conn).list_sections(
            search=search.strip(),
            topic=topic.strip(),
            category=category.strip(),
            limit=limit,
        )


def get_admin_theory_summary() -> dict[str, Any]:
    with db() as conn:
        repo = AdminTheoryRepository(conn)
        return {
            **repo.get_summary_totals(),
            "by_category": repo.get_summary_by_category(),
        }


def update_admin_theory_section(
    section_id: int,
    req: AdminTheorySectionUpdateRequest,
    *,
    sanitize_text: TextSanitizer,
) -> dict[str, Any]:
    values: dict[str, Any] = {}
    for key in ("title", "description", "comment_html", "video_url", "embed_url"):
        value = getattr(req, key)
        if value is not None:
            values[key] = str(value).strip()

    if req.content_html is not None:
        content_html = str(req.content_html).strip()
        values["content_html"] = content_html
        values["content_text"] = sanitize_text(re.sub(r"<[^>]+>", " ", content_html))
    if req.chapter_num is not None:
        values["chapter_num"] = int(req.chapter_num)
    if req.sort_order is not None:
        values["sort_order"] = int(req.sort_order)

    if not values:
        raise ServiceError(400, "Немає полів для оновлення")

    with db() as conn:
        repo = AdminTheoryRepository(conn)
        if not repo.section_exists(section_id=section_id):
            raise ServiceError(404, "Розділ теорії не знайдено")
        repo.update_section(section_id=section_id, values=values)
        conn.commit()
        updated = repo.get_section(section_id=section_id)

    return updated or {}
