from __future__ import annotations

from typing import Any, Optional

import psycopg


TOPIC_MATCH_SQL = """
topic_key = %s
OR (COALESCE(topic_key, '') = '' AND category = %s)
OR (%s = 'rules' AND source_url LIKE '%%/theory/rules/%%')
OR (%s = 'road-signs' AND source_url LIKE '%%/theory/road-signs%%')
OR (%s = 'road-markings' AND source_url LIKE '%%/theory/road-markings%%')
OR (%s = 'regulator' AND source_url LIKE '%%/theory/regulator%%')
OR (%s = 'traffic-light' AND source_url LIKE '%%/theory/traffic-light%%')
"""


class HandbookRepository:
    def __init__(self, conn: psycopg.Connection):
        self.conn = conn

    @staticmethod
    def _row(row: Any) -> Optional[dict[str, Any]]:
        return dict(row) if row else None

    def topic_counts(self) -> dict[str, int]:
        rows = self.conn.execute(
            """
            SELECT
                CASE
                    WHEN topic_key IS NOT NULL AND BTRIM(topic_key) <> '' THEN topic_key
                    WHEN category = 'rules' OR source_url LIKE '%/theory/rules/%' THEN 'rules'
                    WHEN category = 'signs' OR source_url LIKE '%/theory/road-signs%' THEN 'road-signs'
                    WHEN category = 'markings' OR source_url LIKE '%/theory/road-markings%' THEN 'road-markings'
                    WHEN category = 'regulator' OR source_url LIKE '%/theory/regulator%' THEN 'regulator'
                    WHEN category = 'traffic-light' OR source_url LIKE '%/theory/traffic-light%' THEN 'traffic-light'
                    ELSE topic_key
                END AS topic_key,
                COUNT(*) AS count
            FROM handbook_data
            GROUP BY 1
            """
        ).fetchall()
        return {row["topic_key"]: int(row["count"] or 0) for row in rows}

    def rows_for_topic(self, *, topic: str, fallback_category: str) -> list[dict[str, Any]]:
        rows = self.conn.execute(
            f"""
            SELECT id, topic_key, category, chapter_num, sort_order, section_title, source_url, source_slug, image_paths, created_at
            FROM handbook_data
            WHERE {TOPIC_MATCH_SQL}
            ORDER BY
                COALESCE(chapter_num, 10_000),
                sort_order,
                id
            """,
            (topic, fallback_category, topic, topic, topic, topic, topic),
        ).fetchall()
        return [dict(row) for row in rows]

    def get_entry(self, *, entry_id: int) -> Optional[dict[str, Any]]:
        row = self.conn.execute(
            """
            SELECT id, topic_key, category, chapter_num, sort_order, section_title, source_url, source_slug,
                   content_html, content_text, image_paths, created_at
            FROM handbook_data
            WHERE id = %s
            """,
            (entry_id,),
        ).fetchone()
        return self._row(row)

    def search(self, *, query: str, topic: Optional[str], fallback_category: Optional[str]) -> list[dict[str, Any]]:
        conds = ["search_vector @@ websearch_to_tsquery('simple', %s)"]
        params: list[Any] = [query]
        if topic and fallback_category:
            conds.append(f"({TOPIC_MATCH_SQL})")
            params.extend([topic, fallback_category, topic, topic, topic, topic, topic])

        rows = self.conn.execute(
            f"""
            SELECT id, topic_key, category, chapter_num, sort_order, section_title, source_url, source_slug,
                   ts_rank(search_vector, websearch_to_tsquery('simple', %s)) AS rank
            FROM handbook_data
            WHERE {' AND '.join(conds)}
            ORDER BY rank DESC, COALESCE(chapter_num, 10_000), sort_order, id
            LIMIT 30
            """,
            [query, *params],
        ).fetchall()
        return [dict(row) for row in rows]
