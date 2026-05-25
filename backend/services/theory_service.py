from __future__ import annotations

from typing import Any


def list_theory_categories(conn) -> list[dict[str, Any]]:
    rows = conn.execute(
        """
        SELECT slug, title, description, sort_order
        FROM theory_categories
        ORDER BY sort_order, title
        """
    ).fetchall()
    return [dict(row) for row in rows]


def list_theory_topics(conn, category_slug: str) -> list[dict[str, Any]]:
    rows = conn.execute(
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


def list_theory_sections(conn, topic_slug: str) -> list[dict[str, Any]]:
    rows = conn.execute(
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


def get_theory_section(conn, section_id: int) -> dict[str, Any] | None:
    row = conn.execute(
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
    return dict(row) if row else None
