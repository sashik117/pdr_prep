#!/usr/bin/env python3
from __future__ import annotations

import json
import os
from pathlib import Path

import psycopg

from database_setup import DATABASE_URL, QUESTIONS_FILE, ensure_schema, flatten_questions, import_questions, prepare_questions

BASE_DIR = Path(__file__).resolve().parents[1]
THEORY_SEED_FILE = BASE_DIR / "data" / "theory" / "theory_seed.json"


def ensure_ticket_metadata(conn: psycopg.Connection) -> None:
    conn.execute(
        """
        WITH ordered_questions AS (
            SELECT
                id,
                ROW_NUMBER() OVER (
                    ORDER BY COALESCE(page, 999999), COALESCE(question_number, num_in_section, id), id
                ) - 1 AS row_index
            FROM questions
        )
        UPDATE questions AS q
        SET ticket_number = (ordered_questions.row_index / 20)::int + 1,
            question_number = (ordered_questions.row_index % 20)::int + 1
        FROM ordered_questions
        WHERE q.id = ordered_questions.id
          AND (q.ticket_number IS NULL OR q.question_number IS NULL)
        """
    )
    conn.commit()


def import_theory_seed(conn: psycopg.Connection) -> None:
    if not THEORY_SEED_FILE.exists():
        print(f"Theory seed not found at {THEORY_SEED_FILE}. Skipping theory import.", flush=True)
        return

    seed = json.loads(THEORY_SEED_FILE.read_text(encoding="utf-8"))
    expected_sections = len(seed.get("sections") or [])
    expected_assets = len(seed.get("assets") or [])
    section_count = conn.execute("SELECT COUNT(*) FROM theory_sections").fetchone()[0]
    asset_count = conn.execute("SELECT COUNT(*) FROM theory_assets").fetchone()[0]
    if section_count >= expected_sections and asset_count >= expected_assets:
        print(f"Database already has {section_count} theory sections and {asset_count} assets. Skipping theory import.", flush=True)
        return

    print(f"Importing theory seed: {expected_sections} sections, {expected_assets} assets.", flush=True)
    conn.execute("TRUNCATE TABLE theory_assets, theory_sections, theory_topics, theory_categories RESTART IDENTITY CASCADE")

    for row in seed.get("categories") or []:
        conn.execute(
            """
            INSERT INTO theory_categories (id, slug, title, description, sort_order, created_at)
            VALUES (%s, %s, %s, %s, %s, %s)
            ON CONFLICT (id) DO UPDATE SET
                slug = EXCLUDED.slug,
                title = EXCLUDED.title,
                description = EXCLUDED.description,
                sort_order = EXCLUDED.sort_order,
                created_at = EXCLUDED.created_at
            """,
            (row["id"], row["slug"], row["title"], row.get("description"), row.get("sort_order", 0), row.get("created_at")),
        )

    for row in seed.get("topics") or []:
        conn.execute(
            """
            INSERT INTO theory_topics (id, category_id, slug, title, description, topic_type, sort_order, source_url, created_at)
            VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s)
            ON CONFLICT (id) DO UPDATE SET
                category_id = EXCLUDED.category_id,
                slug = EXCLUDED.slug,
                title = EXCLUDED.title,
                description = EXCLUDED.description,
                topic_type = EXCLUDED.topic_type,
                sort_order = EXCLUDED.sort_order,
                source_url = EXCLUDED.source_url,
                created_at = EXCLUDED.created_at
            """,
            (
                row["id"],
                row["category_id"],
                row["slug"],
                row["title"],
                row.get("description"),
                row.get("topic_type", "topic"),
                row.get("sort_order", 0),
                row.get("source_url"),
                row.get("created_at"),
            ),
        )

    for row in seed.get("sections") or []:
        conn.execute(
            """
            INSERT INTO theory_sections (
                id, topic_id, slug, title, description, comment_html, content_html, content_text,
                video_url, embed_url, chapter_num, sort_order, source_url, created_at
            )
            VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
            ON CONFLICT (id) DO UPDATE SET
                topic_id = EXCLUDED.topic_id,
                slug = EXCLUDED.slug,
                title = EXCLUDED.title,
                description = EXCLUDED.description,
                comment_html = EXCLUDED.comment_html,
                content_html = EXCLUDED.content_html,
                content_text = EXCLUDED.content_text,
                video_url = EXCLUDED.video_url,
                embed_url = EXCLUDED.embed_url,
                chapter_num = EXCLUDED.chapter_num,
                sort_order = EXCLUDED.sort_order,
                source_url = EXCLUDED.source_url,
                created_at = EXCLUDED.created_at
            """,
            (
                row["id"],
                row["topic_id"],
                row["slug"],
                row["title"],
                row.get("description"),
                row.get("comment_html"),
                row.get("content_html", ""),
                row.get("content_text", ""),
                row.get("video_url"),
                row.get("embed_url"),
                row.get("chapter_num"),
                row.get("sort_order", 0),
                row.get("source_url"),
                row.get("created_at"),
            ),
        )

    for row in seed.get("assets") or []:
        conn.execute(
            """
            INSERT INTO theory_assets (id, section_id, asset_type, asset_url, alt_text, caption, sort_order, created_at)
            VALUES (%s, %s, %s, %s, %s, %s, %s, %s)
            ON CONFLICT (id) DO UPDATE SET
                section_id = EXCLUDED.section_id,
                asset_type = EXCLUDED.asset_type,
                asset_url = EXCLUDED.asset_url,
                alt_text = EXCLUDED.alt_text,
                caption = EXCLUDED.caption,
                sort_order = EXCLUDED.sort_order,
                created_at = EXCLUDED.created_at
            """,
            (
                row["id"],
                row["section_id"],
                row.get("asset_type", "image"),
                row["asset_url"],
                row.get("alt_text"),
                row.get("caption"),
                row.get("sort_order", 0),
                row.get("created_at"),
            ),
        )

    for table in ("theory_categories", "theory_topics", "theory_sections", "theory_assets"):
        conn.execute(
            f"""
            SELECT setval(
                pg_get_serial_sequence('{table}', 'id'),
                COALESCE((SELECT MAX(id) FROM {table}), 1),
                true
            )
            """
        )
    conn.commit()
    print("Theory seed import complete.", flush=True)


def ensure_question_theory_links(conn: psycopg.Connection) -> None:
    conn.execute(
        """
        UPDATE questions q
        SET theory_section_id = s.id,
            source_rule_slug = s.slug
        FROM theory_sections s
        JOIN theory_topics t ON t.id = s.topic_id
        WHERE t.slug = 'rules'
          AND s.chapter_num IS NOT NULL
          AND NULLIF(SUBSTRING(TRIM(COALESCE(q.section::text, '')) FROM '^\\d+'), '')::INT = s.chapter_num
          AND (q.theory_section_id IS NULL OR q.source_rule_slug IS NULL)
        """
    )
    conn.commit()


def main() -> None:
    if not DATABASE_URL:
        raise SystemExit("DATABASE_URL is required")

    raw_data = json.loads(QUESTIONS_FILE.read_text(encoding="utf-8"))
    questions = flatten_questions(raw_data)
    expected_count = len(prepare_questions(questions))

    with psycopg.connect(DATABASE_URL) as conn:
        ensure_schema(conn)
        question_count = conn.execute("SELECT COUNT(*) FROM questions").fetchone()[0]
        if question_count >= expected_count:
            import_theory_seed(conn)
            ensure_ticket_metadata(conn)
            ensure_question_theory_links(conn)
            print(f"Database already has {question_count} questions. Skipping question import.", flush=True)
            return

        if os.getenv("SKIP_QUESTION_IMPORT", "").strip().lower() in {"1", "true", "yes"}:
            print("SKIP_QUESTION_IMPORT is enabled. Skipping question import.", flush=True)
            return

        imported = import_questions(conn, questions)
        import_theory_seed(conn)
        ensure_ticket_metadata(conn)
        ensure_question_theory_links(conn)
        print(f"Database bootstrap complete. Imported {imported} questions.", flush=True)


if __name__ == "__main__":
    main()
