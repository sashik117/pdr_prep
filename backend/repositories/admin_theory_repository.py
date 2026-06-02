from __future__ import annotations

from typing import Any, Optional

import psycopg


THEORY_SECTION_SELECT = """
SELECT
    s.id,
    s.slug,
    s.title,
    s.description,
    s.comment_html,
    s.content_html,
    s.video_url,
    s.embed_url,
    s.chapter_num,
    s.sort_order,
    s.source_url,
    t.slug AS topic_slug,
    t.title AS topic_title,
    c.slug AS category_slug,
    c.title AS category_title,
    COUNT(a.id) AS assets_count,
    COALESCE(jsonb_agg(a.asset_url ORDER BY a.sort_order) FILTER (WHERE a.id IS NOT NULL), '[]'::jsonb) AS assets
FROM theory_sections s
JOIN theory_topics t ON t.id = s.topic_id
JOIN theory_categories c ON c.id = t.category_id
LEFT JOIN theory_assets a ON a.section_id = s.id
"""


class AdminTheoryRepository:
    def __init__(self, conn: psycopg.Connection):
        self.conn = conn

    @staticmethod
    def _row(row: Any) -> Optional[dict[str, Any]]:
        return dict(row) if row else None

    def list_sections(self, *, search: str, topic: str, category: str, limit: int) -> list[dict[str, Any]]:
        rows = self.conn.execute(
            THEORY_SECTION_SELECT
            + """
            WHERE (%s = '' OR t.slug = %s)
              AND (%s = '' OR c.slug = %s)
              AND (
                    %s = ''
                 OR s.title ILIKE %s
                 OR s.description ILIKE %s
                 OR s.content_text ILIKE %s
                 OR t.title ILIKE %s
                 OR c.title ILIKE %s
              )
            GROUP BY s.id, t.slug, t.title, c.slug, c.title, c.sort_order, t.sort_order
            ORDER BY c.sort_order, t.sort_order, COALESCE(s.chapter_num, s.sort_order), s.sort_order, s.title
            LIMIT %s
            """,
            (
                topic,
                topic,
                category,
                category,
                search,
                f"%{search}%",
                f"%{search}%",
                f"%{search}%",
                f"%{search}%",
                f"%{search}%",
                limit,
            ),
        ).fetchall()
        return [dict(row) for row in rows]

    def get_summary_totals(self) -> dict[str, int]:
        return {
            "categories": int(self.conn.execute("SELECT COUNT(*) AS count FROM theory_categories").fetchone()["count"] or 0),
            "topics": int(self.conn.execute("SELECT COUNT(*) AS count FROM theory_topics").fetchone()["count"] or 0),
            "sections": int(self.conn.execute("SELECT COUNT(*) AS count FROM theory_sections").fetchone()["count"] or 0),
            "assets": int(self.conn.execute("SELECT COUNT(*) AS count FROM theory_assets").fetchone()["count"] or 0),
        }

    def get_summary_by_category(self) -> list[dict[str, Any]]:
        rows = self.conn.execute(
            """
            SELECT
                c.slug,
                c.title,
                COUNT(DISTINCT t.id) AS topics_count,
                COUNT(DISTINCT s.id) AS sections_count,
                COUNT(DISTINCT a.id) AS assets_count
            FROM theory_categories c
            LEFT JOIN theory_topics t ON t.category_id = c.id
            LEFT JOIN theory_sections s ON s.topic_id = t.id
            LEFT JOIN theory_assets a ON a.section_id = s.id
            GROUP BY c.id, c.slug, c.title, c.sort_order
            ORDER BY c.sort_order, c.title
            """
        ).fetchall()
        return [dict(row) for row in rows]

    def section_exists(self, *, section_id: int) -> bool:
        row = self.conn.execute("SELECT id FROM theory_sections WHERE id = %s", (section_id,)).fetchone()
        return bool(row)

    def update_section(self, *, section_id: int, values: dict[str, Any]) -> None:
        assignments = [f"{column} = %s" for column in values]
        params = list(values.values()) + [section_id]
        self.conn.execute(
            f"UPDATE theory_sections SET {', '.join(assignments)} WHERE id = %s",
            params,
        )

    def get_section(self, *, section_id: int) -> Optional[dict[str, Any]]:
        row = self.conn.execute(
            THEORY_SECTION_SELECT
            + """
            WHERE s.id = %s
            GROUP BY s.id, t.slug, t.title, c.slug, c.title
            """,
            (section_id,),
        ).fetchone()
        return self._row(row)
