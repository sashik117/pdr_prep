from __future__ import annotations

from typing import Any

import psycopg


class TheoryRepository:
    def __init__(self, conn: psycopg.Connection):
        self.conn = conn

    @staticmethod
    def _dict(row: Any) -> dict[str, Any] | None:
        return dict(row) if row else None

    def list_categories(self) -> list[dict[str, Any]]:
        rows = self.conn.execute(
            """
            SELECT slug, title, description, sort_order
            FROM theory_categories
            ORDER BY sort_order, title
            """
        ).fetchall()
        return [dict(row) for row in rows]

    def list_topics(self, category_slug: str) -> list[dict[str, Any]]:
        rows = self.conn.execute(
            """
            SELECT t.id, t.slug, t.title, t.description, t.topic_type, t.sort_order, t.source_url
            FROM theory_topics t
            JOIN theory_categories c ON c.id = t.category_id
            WHERE c.slug = %s
            ORDER BY t.sort_order, t.title
            """,
            (category_slug,),
        ).fetchall()
        return [dict(row) for row in rows]

    def list_sections(self, topic_slug: str) -> list[dict[str, Any]]:
        rows = self.conn.execute(
            """
            SELECT s.id, s.slug, s.title, s.description, s.chapter_num, s.sort_order, s.source_url
            FROM theory_sections s
            JOIN theory_topics t ON t.id = s.topic_id
            WHERE t.slug = %s
            ORDER BY COALESCE(s.chapter_num, s.sort_order), s.sort_order, s.title
            """,
            (topic_slug,),
        ).fetchall()
        return [dict(row) for row in rows]

    def get_section(self, section_id: int) -> dict[str, Any] | None:
        row = self.conn.execute(
            """
            SELECT
                s.*,
                t.slug AS topic_slug,
                t.title AS topic_title,
                t.topic_type AS topic_type,
                c.slug AS category_slug,
                c.title AS category_title
            FROM theory_sections s
            JOIN theory_topics t ON t.id = s.topic_id
            JOIN theory_categories c ON c.id = t.category_id
            WHERE s.id = %s
            """,
            (section_id,),
        ).fetchone()
        return self._dict(row)

    def list_assets(self, section_id: int) -> list[dict[str, Any]]:
        rows = self.conn.execute(
            """
            SELECT asset_type, asset_url, alt_text, caption, sort_order
            FROM theory_assets
            WHERE section_id = %s
            ORDER BY sort_order, id
            """,
            (section_id,),
        ).fetchall()
        return [dict(row) for row in rows]

    def get_legacy_handbook_section(self, section_id: int) -> dict[str, Any] | None:
        row = self.conn.execute(
            """
            SELECT id, topic_key, chapter_num, sort_order, section_title, source_url, source_slug,
                   comment_html, content_html, content_text, video_url, embed_url, image_paths
            FROM handbook_data
            WHERE id = %s
            """,
            (section_id,),
        ).fetchone()
        return self._dict(row)
