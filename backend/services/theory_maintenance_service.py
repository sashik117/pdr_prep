from __future__ import annotations

from collections.abc import Callable
from typing import Any

from core.database import db
from repositories.theory_maintenance_repository import TheoryMaintenanceRepository


TextCleaner = Callable[[Any], str]
HtmlBuilder = Callable[[str], str]
HtmlSanitizer = Callable[[Any, str], str]
DescriptionExtractor = Callable[[dict[str, Any]], str]
TopicResolver = Callable[[Any, Any, Any], str | None]
OptionalStringExtractor = Callable[[dict[str, Any]], str | None]
JsonListCoercer = Callable[[Any], list[Any]]


def ensure_theory_seed_data(*, category_fallbacks: list[dict[str, Any]]) -> None:
    with db() as conn:
        repo = TheoryMaintenanceRepository(conn)
        for item in category_fallbacks:
            repo.upsert_category(item)
        conn.commit()


def sync_theory_data(
    *,
    category_fallbacks: list[dict[str, Any]],
    multi_topic_category_slugs: set[str],
    theory_source_map: dict[str, str],
    clean_text: TextCleaner,
    sanitize_text: TextCleaner,
    sanitize_html: HtmlSanitizer,
    coerce_json_list: JsonListCoercer,
    resolve_topic: TopicResolver,
    extract_description: DescriptionExtractor,
    extract_comment_html: DescriptionExtractor,
    extract_video_url: OptionalStringExtractor,
    extract_embed_url: OptionalStringExtractor,
) -> None:
    with db() as conn:
        repo = TheoryMaintenanceRepository(conn)
        category_map = repo.category_map()

        for item in category_fallbacks:
            if item["slug"] in multi_topic_category_slugs:
                continue
            category_id = category_map.get(item["slug"])
            if not category_id:
                continue
            repo.upsert_topic(
                category_id=category_id,
                item=item,
                topic_type="video" if item["slug"] == "video-lectures" else "topic",
                source_url=theory_source_map.get(item["slug"]),
            )

        topic_map = repo.topic_map()
        seen_section_slugs: set[str] = set()
        seen_topic_ids: set[int] = set()

        for row in repo.list_handbook_rows():
            topic_slug = resolve_topic(row.get("topic_key"), row.get("category"), row.get("source_url"))
            if not topic_slug:
                continue
            topic_id = topic_map.get(topic_slug)
            if not topic_id:
                continue
            seen_topic_ids.add(int(topic_id))

            section_slug = (
                clean_text(row.get("source_slug"))
                or f"{topic_slug}-{int(row.get('chapter_num') or row.get('sort_order') or row['id'])}"
            )
            seen_section_slugs.add(section_slug)
            section_id = repo.upsert_section(
                topic_id=topic_id,
                section_slug=section_slug,
                values={
                    "title": sanitize_text(row.get("section_title")),
                    "description": extract_description(row),
                    "comment_html": extract_comment_html(row),
                    "content_html": sanitize_html(row.get("content_html"), str(row.get("section_title") or "")),
                    "content_text": sanitize_text(row.get("content_text")),
                    "video_url": extract_video_url(row),
                    "embed_url": extract_embed_url(row),
                    "chapter_num": row.get("chapter_num"),
                    "sort_order": int(row.get("sort_order") or 0),
                    "source_url": row.get("source_url"),
                },
            )

            image_paths = coerce_json_list(row.get("image_paths"))
            assets = [
                {
                    "asset_type": "image",
                    "asset_url": str(asset_url),
                    "alt_text": sanitize_text(row.get("section_title")),
                    "caption": None,
                    "sort_order": index,
                }
                for index, asset_url in enumerate(image_paths)
                if str(asset_url or "").strip()
            ]
            repo.replace_section_assets(section_id=section_id, assets=assets)

        repo.delete_stale_sections(
            topic_ids=list(seen_topic_ids),
            section_slugs=list(seen_section_slugs),
        )
        conn.commit()


def ensure_question_metadata(
    *,
    clean_text: TextCleaner,
    plain_to_html: HtmlBuilder,
) -> None:
    with db() as conn:
        repo = TheoryMaintenanceRepository(conn)
        rules_sections = repo.list_rules_sections()
        section_map = {str(row["chapter_num"]): row for row in rules_sections if row.get("chapter_num") is not None}

        for index, question in enumerate(repo.list_question_metadata_rows()):
            values: dict[str, Any] = {}
            if question.get("ticket_number") is None:
                values["ticket_number"] = (index // 20) + 1
            if question.get("question_number") is None:
                values["question_number"] = (index % 20) + 1

            section_key = clean_text(question.get("section"))
            section_ref = section_map.get(section_key)
            if section_ref:
                if question.get("theory_section_id") is None:
                    values["theory_section_id"] = section_ref["id"]
                if not clean_text(question.get("source_rule_slug")):
                    values["source_rule_slug"] = section_ref["slug"]

            if not clean_text(question.get("explanation_html")) and clean_text(question.get("explanation")):
                values["explanation_html"] = plain_to_html(str(question.get("explanation") or ""))

            repo.update_question_metadata(question_id=int(question["id"]), values=values)

        conn.commit()
