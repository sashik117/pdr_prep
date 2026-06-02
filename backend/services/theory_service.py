from __future__ import annotations

from collections.abc import Callable
from typing import Any

from core.config import (
    BASE_DIR,
    HANDBOOK_TOPIC_CATEGORY_MAP,
    MULTI_TOPIC_CATEGORY_SLUGS,
    PUBLIC_STATIC_IMAGES_DIR,
    THEORY_CATEGORY_FALLBACKS,
)
from core.database import db
from domain.media import filter_available_assets, remove_unavailable_media_tags
from parsers.theory_sources import THEORY_SOURCE_MAP
from repositories.handbook_repository import HandbookRepository
from repositories.theory_repository import TheoryRepository
from services.errors import ServiceError


TextSanitizer = Callable[[Any], str]
DescriptionExtractor = Callable[[dict[str, Any]], str]
HtmlSanitizer = Callable[[Any, str], str]
OptionalStringExtractor = Callable[[dict[str, Any]], str | None]
TopicResolver = Callable[[Any, Any, Any], str | None]


def list_theory_category_payloads() -> list[dict[str, Any]]:
    with db() as conn:
        rows = TheoryRepository(conn).list_categories()
    return rows or THEORY_CATEGORY_FALLBACKS


def list_theory_topic_payloads(category: str) -> list[dict[str, Any]]:
    with db() as conn:
        rows = TheoryRepository(conn).list_topics(category)
    if rows:
        return rows

    fallback = next((item for item in THEORY_CATEGORY_FALLBACKS if item["slug"] == category), None)
    if not fallback or category in MULTI_TOPIC_CATEGORY_SLUGS:
        return []
    return [
        {
            "id": 0,
            "slug": category,
            "title": fallback["title"],
            "description": fallback.get("description"),
            "topic_type": "video" if category == "video-lectures" else "topic",
            "sort_order": int(fallback.get("sort_order", 0)),
            "source_url": THEORY_SOURCE_MAP.get(category),
        }
    ]


def list_theory_section_payloads(
    topic: str,
    *,
    sanitize_text: TextSanitizer,
    extract_description: DescriptionExtractor,
) -> list[dict[str, Any]]:
    with db() as conn:
        rows = TheoryRepository(conn).list_sections(topic)
        if rows:
            return rows
        fallback_rows = HandbookRepository(conn).rows_for_topic(
            topic=topic,
            fallback_category=HANDBOOK_TOPIC_CATEGORY_MAP.get(topic, topic),
        )
    return [
        {
            "id": row["id"],
            "slug": row.get("source_slug") or f"{topic}-{row['id']}",
            "title": sanitize_text(row.get("section_title")),
            "description": extract_description(dict(row)) or None,
            "sort_order": int(row.get("sort_order") or 0),
            "source_url": row.get("source_url"),
            "chapter_num": row.get("chapter_num"),
        }
        for row in fallback_rows
    ]


def get_theory_section_payload(
    section_id: int,
    *,
    sanitize_text: TextSanitizer,
    sanitize_html: HtmlSanitizer,
    extract_description: DescriptionExtractor,
    extract_comment_html: DescriptionExtractor,
    extract_video_url: OptionalStringExtractor,
    extract_embed_url: OptionalStringExtractor,
    resolve_topic: TopicResolver,
) -> dict[str, Any]:
    with db() as conn:
        repo = TheoryRepository(conn)
        section = repo.get_section(section_id)
        if section:
            return {
                **section,
                "content_html": remove_unavailable_media_tags(
                    section.get("content_html"),
                    public_images_dir=PUBLIC_STATIC_IMAGES_DIR,
                    uploads_dir=BASE_DIR / "uploads",
                ),
                "comment_html": remove_unavailable_media_tags(
                    section.get("comment_html"),
                    public_images_dir=PUBLIC_STATIC_IMAGES_DIR,
                    uploads_dir=BASE_DIR / "uploads",
                ),
                "assets": filter_available_assets(
                    repo.list_assets(section_id),
                    public_images_dir=PUBLIC_STATIC_IMAGES_DIR,
                    uploads_dir=BASE_DIR / "uploads",
                ),
            }
        row = repo.get_legacy_handbook_section(section_id)

    if not row:
        raise ServiceError(404, "Розділ довідника не знайдено")

    resolved_topic = resolve_topic(row.get("topic_key"), None, row.get("source_url")) or "rules"
    return {
        "id": row["id"],
        "slug": row.get("source_slug") or f"legacy-{row['id']}",
        "title": sanitize_text(row.get("section_title")),
        "description": extract_description(row) or None,
        "comment_html": remove_unavailable_media_tags(
            extract_comment_html(row) or None,
            public_images_dir=PUBLIC_STATIC_IMAGES_DIR,
            uploads_dir=BASE_DIR / "uploads",
        ),
        "content_html": remove_unavailable_media_tags(
            sanitize_html(row.get("content_html"), str(row.get("section_title") or "")),
            public_images_dir=PUBLIC_STATIC_IMAGES_DIR,
            uploads_dir=BASE_DIR / "uploads",
        ),
        "content_text": sanitize_text(row.get("content_text")),
        "chapter_num": row.get("chapter_num"),
        "sort_order": int(row.get("sort_order") or 0),
        "source_url": row.get("source_url"),
        "topic_slug": resolved_topic,
        "category_slug": resolved_topic,
        "video_url": extract_video_url(row),
        "embed_url": extract_embed_url(row),
        "assets": filter_available_assets(
            [
                {"asset_type": "image", "asset_url": item, "alt_text": None, "caption": None, "sort_order": index}
                for index, item in enumerate(row.get("image_paths") or [], start=1)
            ],
            public_images_dir=PUBLIC_STATIC_IMAGES_DIR,
            uploads_dir=BASE_DIR / "uploads",
        ),
    }
