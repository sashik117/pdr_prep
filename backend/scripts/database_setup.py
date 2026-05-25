#!/usr/bin/env python3
from __future__ import annotations

import json
import os
from pathlib import Path
from typing import Any

import psycopg
from dotenv import load_dotenv

load_dotenv()

BASE_DIR = Path(__file__).resolve().parent
PROJECT_ROOT = BASE_DIR.parent
RAW_DATABASE_URL = os.environ.get("DATABASE_URL")
DATABASE_URL = (
    f"{RAW_DATABASE_URL}{'&' if '?' in RAW_DATABASE_URL else '?'}sslmode=require"
    if RAW_DATABASE_URL
    and os.getenv("DATABASE_SSL", "").strip().lower() in {"1", "true", "yes", "require"}
    and "sslmode=" not in RAW_DATABASE_URL
    else RAW_DATABASE_URL
)
QUESTIONS_FILE = PROJECT_ROOT / "data" / "questions" / "pdr_final_category.json"
SCHEMA_FILE = PROJECT_ROOT / "create_tables.sql"
BATCH_SIZE = 500


COMMON_SECTIONS = list(range(1, 40))
CATEGORY_SECTION_RULES = {
    "A": list(range(1, 44)),
    "A1": list(range(1, 44)),
    "B": COMMON_SECTIONS + list(range(44, 48)),
    "B1": COMMON_SECTIONS + list(range(44, 48)),
    "C": COMMON_SECTIONS + list(range(48, 52)),
    "C1": COMMON_SECTIONS + list(range(48, 52)),
    "D": COMMON_SECTIONS + list(range(52, 56)),
    "D1": COMMON_SECTIONS + list(range(52, 56)),
    "T": COMMON_SECTIONS + list(range(60, 64)),
    "BE": COMMON_SECTIONS + list(range(56, 60)),
    "C1E": COMMON_SECTIONS + list(range(56, 60)),
    "CE": COMMON_SECTIONS + list(range(56, 60)),
    "D1E": COMMON_SECTIONS + list(range(56, 60)),
    "DE": COMMON_SECTIONS + list(range(56, 60)),
}


def ensure_schema(conn: psycopg.Connection) -> None:
    if not SCHEMA_FILE.exists():
        return
    statements = [statement.strip() for statement in SCHEMA_FILE.read_text(encoding="utf-8").split(";") if statement.strip()]
    for statement in statements:
        conn.execute(statement)
    conn.commit()


def flatten_questions(data: list[dict[str, Any]]) -> list[dict[str, Any]]:
    if not data:
        return []
    if "розділи" not in data[0] and "sections" not in data[0]:
        return data

    flat: list[dict[str, Any]] = []
    for category_block in data:
        fallback_category = category_block.get("категорія") or category_block.get("category")
        sections = category_block.get("розділи", []) or category_block.get("sections", [])
        for section in sections:
            questions = section.get("питання", []) or section.get("questions", [])
            for question in questions:
                if not question.get("категорія"):
                    question["категорія"] = fallback_category
                flat.append(question)
    return flat


def normalize_question(item: dict[str, Any]) -> dict[str, Any]:
    correct_ans = item.get("правильна_відповідь") or item.get("correct_ans") or 0
    try:
        correct_ans = int(correct_ans)
    except (TypeError, ValueError):
        correct_ans = 0

    options = item.get("варіанти") or item.get("options") or []
    if not isinstance(options, list):
        options = []

    images = item.get("картинки") or item.get("images") or []
    if not isinstance(images, list):
        images = []

    return {
        "id": int(item["id"]),
        "section": str(item.get("розділ") or item.get("section") or ""),
        "section_name": item.get("назва_розділу") or item.get("section_name") or "",
        "num_in_section": item.get("номер_в_розділі") or item.get("num_in_section"),
        "category": item.get("категорія") or item.get("category"),
        "difficulty": item.get("складність") or item.get("difficulty") or "medium",
        "explanation": item.get("пояснення") or item.get("explanation") or "",
        "question_text": item.get("текст_питання") or item.get("question_text") or "",
        "options": options,
        "correct_ans": correct_ans,
        "images": images,
        "page": item.get("сторінка") or item.get("page"),
    }


def prepare_questions(questions: list[dict[str, Any]]) -> list[dict[str, Any]]:
    clean = []
    for question in questions:
        normalized = normalize_question(question)
        if normalized["question_text"] and normalized["options"] and normalized["correct_ans"] > 0:
            clean.append(normalized)
    return clean


def import_questions(conn: psycopg.Connection, questions: list[dict[str, Any]]) -> int:
    clean = prepare_questions(questions)

    inserted = 0
    columns = [
        "id",
        "section",
        "section_name",
        "num_in_section",
        "category",
        "difficulty",
        "explanation",
        "question_text",
        "options",
        "correct_ans",
        "images",
        "page",
    ]
    row_placeholder = "(%s, %s, %s, %s, %s, %s, %s, %s, %s::jsonb, %s, %s::jsonb, %s)"
    conflict_updates = ", ".join(f"{column} = EXCLUDED.{column}" for column in columns if column != "id")

    with conn.cursor() as cursor:
        for start in range(0, len(clean), BATCH_SIZE):
            batch = clean[start : start + BATCH_SIZE]
            values: list[Any] = []
            for row in batch:
                values.extend(
                    [
                        row["id"],
                        row["section"],
                        row["section_name"],
                        row["num_in_section"],
                        row["category"],
                        row["difficulty"],
                        row["explanation"],
                        row["question_text"],
                        json.dumps(row["options"], ensure_ascii=False),
                        row["correct_ans"],
                        json.dumps(row["images"], ensure_ascii=False),
                        row["page"],
                    ]
                )

            cursor.execute(
                f"""
                INSERT INTO questions ({", ".join(columns)})
                VALUES {", ".join([row_placeholder] * len(batch))}
                ON CONFLICT (id) DO UPDATE SET {conflict_updates}
                """,
                values,
            )
            conn.commit()
            inserted += len(batch)
            print(f"Imported {inserted}/{len(clean)} questions", flush=True)
    return inserted


def main() -> None:
    if not DATABASE_URL:
        raise SystemExit("DATABASE_URL not found in .env")
    if not QUESTIONS_FILE.exists():
        raise SystemExit(f"Questions file not found: {QUESTIONS_FILE}")

    raw_data = json.loads(QUESTIONS_FILE.read_text(encoding="utf-8"))
    questions = flatten_questions(raw_data)

    with psycopg.connect(DATABASE_URL) as conn:
        ensure_schema(conn)
        imported = import_questions(conn, questions)
        print(f"Done. Imported {imported} questions.")


if __name__ == "__main__":
    main()
