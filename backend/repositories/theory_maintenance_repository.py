from __future__ import annotations

from typing import Any

import psycopg


class TheoryMaintenanceRepository:
    def __init__(self, conn: psycopg.Connection):
        self.conn = conn

    def upsert_category(self, item: dict[str, Any]) -> None:
        self.conn.execute(
            """
            INSERT INTO theory_categories (slug, title, description, sort_order)
            VALUES (%s, %s, %s, %s)
            ON CONFLICT (slug) DO UPDATE
            SET title = EXCLUDED.title,
                description = EXCLUDED.description,
                sort_order = EXCLUDED.sort_order
            """,
            (
                item["slug"],
                item["title"],
                item.get("description"),
                int(item.get("sort_order", 0)),
            ),
        )

    def category_map(self) -> dict[str, int]:
        rows = self.conn.execute("SELECT id, slug FROM theory_categories").fetchall()
        return {str(row["slug"]): int(row["id"]) for row in rows}

    def upsert_topic(
        self,
        *,
        category_id: int,
        item: dict[str, Any],
        topic_type: str,
        source_url: str | None,
    ) -> None:
        self.conn.execute(
            """
            INSERT INTO theory_topics (category_id, slug, title, description, topic_type, sort_order, source_url)
            VALUES (%s, %s, %s, %s, %s, %s, %s)
            ON CONFLICT (slug) DO UPDATE
            SET category_id = EXCLUDED.category_id,
                title = EXCLUDED.title,
                description = EXCLUDED.description,
                topic_type = EXCLUDED.topic_type,
                sort_order = EXCLUDED.sort_order,
                source_url = EXCLUDED.source_url
            """,
            (
                category_id,
                item["slug"],
                item["title"],
                item.get("description"),
                topic_type,
                int(item.get("sort_order", 0)),
                source_url,
            ),
        )

    def topic_map(self) -> dict[str, int]:
        rows = self.conn.execute("SELECT id, slug FROM theory_topics").fetchall()
        return {str(row["slug"]): int(row["id"]) for row in rows}

    def list_handbook_rows(self) -> list[dict[str, Any]]:
        rows = self.conn.execute(
            """
            SELECT id, topic_key, category, chapter_num, sort_order, section_title, source_url, source_slug,
                   comment_html, content_html, content_text, video_url, embed_url, image_paths
            FROM handbook_data
            ORDER BY topic_key, sort_order, chapter_num, id
            """
        ).fetchall()
        return [dict(row) for row in rows]

    def upsert_section(self, *, topic_id: int, section_slug: str, values: dict[str, Any]) -> int:
        row = self.conn.execute(
            """
            INSERT INTO theory_sections (
                topic_id, slug, title, description, comment_html, content_html, content_text,
                video_url, embed_url, chapter_num, sort_order, source_url
            )
            VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
            ON CONFLICT (slug) DO UPDATE
            SET topic_id = EXCLUDED.topic_id,
                title = EXCLUDED.title,
                description = EXCLUDED.description,
                comment_html = EXCLUDED.comment_html,
                content_html = EXCLUDED.content_html,
                content_text = EXCLUDED.content_text,
                video_url = EXCLUDED.video_url,
                embed_url = EXCLUDED.embed_url,
                chapter_num = EXCLUDED.chapter_num,
                sort_order = EXCLUDED.sort_order,
                source_url = EXCLUDED.source_url
            RETURNING id
            """,
            (
                topic_id,
                section_slug,
                values["title"],
                values["description"],
                values["comment_html"],
                values["content_html"],
                values["content_text"],
                values["video_url"],
                values["embed_url"],
                values["chapter_num"],
                values["sort_order"],
                values["source_url"],
            ),
        ).fetchone()
        return int(row["id"])

    def replace_section_assets(self, *, section_id: int, assets: list[dict[str, Any]]) -> None:
        self.conn.execute("DELETE FROM theory_assets WHERE section_id = %s", (section_id,))
        for asset in assets:
            self.conn.execute(
                """
                INSERT INTO theory_assets (section_id, asset_type, asset_url, alt_text, caption, sort_order)
                VALUES (%s, %s, %s, %s, %s, %s)
                """,
                (
                    section_id,
                    asset["asset_type"],
                    asset["asset_url"],
                    asset.get("alt_text"),
                    asset.get("caption"),
                    asset["sort_order"],
                ),
            )

    def delete_stale_sections(self, *, topic_ids: list[int], section_slugs: list[str]) -> None:
        if not topic_ids or not section_slugs:
            return
        self.conn.execute(
            """
            DELETE FROM theory_sections
            WHERE topic_id = ANY(%s)
              AND slug IS NOT NULL
              AND slug <> ''
              AND slug <> ALL(%s)
            """,
            (topic_ids, section_slugs),
        )

    def list_rules_sections(self) -> list[dict[str, Any]]:
        rows = self.conn.execute(
            """
            SELECT s.id, s.slug, s.chapter_num
            FROM theory_sections s
            JOIN theory_topics t ON t.id = s.topic_id
            WHERE t.slug = 'rules' AND chapter_num IS NOT NULL
            """
        ).fetchall()
        return [dict(row) for row in rows]

    def list_question_metadata_rows(self) -> list[dict[str, Any]]:
        rows = self.conn.execute(
            """
            SELECT id, section, explanation, explanation_html, ticket_number, question_number,
                   theory_section_id, source_rule_slug, num_in_section, page
            FROM questions
            ORDER BY COALESCE(page, 999999), COALESCE(question_number, num_in_section, id), id
            """
        ).fetchall()
        return [dict(row) for row in rows]

    def update_question_metadata(self, *, question_id: int, values: dict[str, Any]) -> None:
        if not values:
            return
        assignments = [f"{column} = %s" for column in values]
        params = list(values.values()) + [question_id]
        self.conn.execute(f"UPDATE questions SET {', '.join(assignments)} WHERE id = %s", params)
