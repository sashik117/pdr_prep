from __future__ import annotations

from collections.abc import Callable
from typing import Any, Optional

from core.database import db
from repositories.handbook_repository import HandbookRepository
from services.errors import ServiceError


TextSanitizer = Callable[[Any], str]
HtmlSanitizer = Callable[[Any, str], str]


def list_handbook_topics(*, handbook_topics: list[dict[str, Any]]) -> list[dict[str, Any]]:
    with db() as conn:
        counts = HandbookRepository(conn).topic_counts()
    return [
        {
            "key": topic["key"],
            "title": topic["title"],
            "category": topic["category"],
            "count": counts.get(topic["key"], 0),
            "chapters": topic["chapters"],
        }
        for topic in handbook_topics
    ]


def list_handbook_rows_for_topic(*, topic: str, topic_category_map: dict[str, str]) -> list[dict[str, Any]]:
    fallback_category = topic_category_map.get(topic, topic)
    with db() as conn:
        return HandbookRepository(conn).rows_for_topic(topic=topic, fallback_category=fallback_category)


def list_handbook_entries(
    *,
    topic: str,
    topic_category_map: dict[str, str],
    sanitize_text: TextSanitizer,
) -> list[dict[str, Any]]:
    rows = list_handbook_rows_for_topic(topic=topic, topic_category_map=topic_category_map)
    return [
        {
            **row,
            "section_title": sanitize_text(row.get("section_title")),
            "image_paths": row.get("image_paths") or [],
        }
        for row in rows
    ]


def get_handbook_entry(
    entry_id: int,
    *,
    sanitize_text: TextSanitizer,
    sanitize_html: HtmlSanitizer,
) -> dict[str, Any]:
    with db() as conn:
        row = HandbookRepository(conn).get_entry(entry_id=entry_id)
    if not row:
        raise ServiceError(404, "Розділ довідника не знайдено")
    return {
        **row,
        "section_title": sanitize_text(row.get("section_title")),
        "content_text": sanitize_text(row.get("content_text")),
        "content_html": sanitize_html(row.get("content_html"), str(row.get("section_title") or "")),
        "image_paths": row.get("image_paths") or [],
    }


def search_handbook_entries(
    *,
    query: str,
    topic: Optional[str],
    topic_category_map: dict[str, str],
    sanitize_text: TextSanitizer,
) -> list[dict[str, Any]]:
    fallback_category = topic_category_map.get(topic, topic) if topic else None
    with db() as conn:
        rows = HandbookRepository(conn).search(query=query, topic=topic, fallback_category=fallback_category)
    return [
        {
            **row,
            "section_title": sanitize_text(row.get("section_title")),
        }
        for row in rows
    ]
