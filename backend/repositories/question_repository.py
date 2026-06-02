from __future__ import annotations

import json
from typing import Any

import psycopg


def section_number_sql(column: str) -> str:
    return f"NULLIF(SUBSTRING(TRIM(COALESCE({column}::text, '')) FROM '^\\d+'), '')::INT"


class QuestionRepository:
    def __init__(self, conn: psycopg.Connection):
        self.conn = conn

    def get_mvs_block_candidates(
        self,
        *,
        sections: list[int],
        excluded_ids: set[int],
        seed: str,
        block_key: str,
        count: int,
    ) -> list[dict[str, Any]]:
        if not sections or count <= 0:
            return []

        conditions = [f"{section_number_sql('q.section')} = ANY(%s)"]
        params: list[Any] = [sections]
        if excluded_ids:
            conditions.append("NOT (q.id = ANY(%s))")
            params.append(list(excluded_ids))

        rows = self.conn.execute(
            f"""
            SELECT *
            FROM questions q
            WHERE {' AND '.join(conditions)}
            ORDER BY md5(q.id::text || %s)
            LIMIT %s
            """,
            params + [f"{seed}:{block_key}", max(count * 40, 120)],
        ).fetchall()
        return [dict(row) for row in rows]

    def list_questions(self, *, where_sql: str, params: list[Any]) -> list[dict[str, Any]]:
        rows = self.conn.execute(f"SELECT * FROM questions {where_sql} ORDER BY id", params).fetchall()
        return [dict(row) for row in rows]

    def list_random_candidates(
        self,
        *,
        where_sql: str,
        params: list[Any],
        seed: str | None,
        limit: int,
    ) -> list[dict[str, Any]]:
        order_sql = "ORDER BY md5(q.id::text || %s)" if seed else "ORDER BY RANDOM()"
        query_params = params + ([seed] if seed else []) + [limit]
        rows = self.conn.execute(
            f"SELECT * FROM questions q {where_sql} {order_sql} LIMIT %s",
            query_params,
        ).fetchall()
        return [dict(row) for row in rows]

    def get_question(self, *, question_id: int) -> dict[str, Any] | None:
        row = self.conn.execute("SELECT * FROM questions WHERE id = %s", (question_id,)).fetchone()
        return dict(row) if row else None

    def list_sections(self, *, where_sql: str, params: list[Any], section_order_sql: str) -> list[dict[str, Any]]:
        rows = self.conn.execute(
            f"""
            SELECT section, section_name, COUNT(*) AS count, {section_order_sql} AS section_order
            FROM questions
            {where_sql}
            GROUP BY section, section_name
            ORDER BY section_order NULLS LAST, section
            """,
            params,
        ).fetchall()
        return [dict(row) for row in rows]

    def upsert_questions(self, rows: list[dict[str, Any]]) -> None:
        with self.conn.cursor() as cursor:
            cursor.executemany(
                """
                INSERT INTO questions (
                    id, section, section_name, num_in_section, category, difficulty,
                    explanation, question_text, options, correct_ans, images, page
                )
                VALUES (
                    %(id)s, %(section)s, %(section_name)s, %(num_in_section)s, %(category)s, %(difficulty)s,
                    %(explanation)s, %(question_text)s, %(options)s::jsonb, %(correct_ans)s, %(images)s::jsonb, %(page)s
                )
                ON CONFLICT (id) DO UPDATE SET
                    section = EXCLUDED.section,
                    section_name = EXCLUDED.section_name,
                    num_in_section = EXCLUDED.num_in_section,
                    category = EXCLUDED.category,
                    difficulty = EXCLUDED.difficulty,
                    explanation = EXCLUDED.explanation,
                    question_text = EXCLUDED.question_text,
                    options = EXCLUDED.options,
                    correct_ans = EXCLUDED.correct_ans,
                    images = EXCLUDED.images,
                    page = EXCLUDED.page
                """,
                [
                    {
                        **row,
                        "options": json.dumps(row["options"], ensure_ascii=False),
                        "images": json.dumps(row["images"], ensure_ascii=False),
                    }
                    for row in rows
                ],
            )
