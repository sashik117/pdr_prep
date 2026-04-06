#!/usr/bin/env python3
"""
database_setup.py — міграція pdr_final.json → PostgreSQL (Supabase)

Запуск:
  python database_setup.py

Змінні оточення (або .env):
  DATABASE_URL=postgresql://user:password@host:port/dbname
"""

import json
import os
import sys
import psycopg2
import psycopg2.extras
from pathlib import Path
from dotenv import load_dotenv

load_dotenv()

DATABASE_URL = os.environ.get("DATABASE_URL")
if not DATABASE_URL:
    print("❌ Не знайдено DATABASE_URL у .env файлі")
    print("   Створіть backend/.env:")
    print("   DATABASE_URL=postgresql://user:pass@host:port/dbname")
    sys.exit(1)

JSON_FILE = Path(__file__).parent / "pdr_final.json"
if not JSON_FILE.exists():
    print(f"❌ Файл не знайдено: {JSON_FILE}")
    print("   Покладіть pdr_final.json в папку backend/")
    sys.exit(1)

BATCH_SIZE = 100


def create_table(cur):
    cur.execute("""
        CREATE TABLE IF NOT EXISTS questions (
            id              INT PRIMARY KEY,
            section         TEXT NOT NULL,
            section_name    TEXT,
            num_in_section  INT,
            question_text   TEXT NOT NULL,
            options         JSONB NOT NULL DEFAULT '[]',
            correct_ans     INT,
            images          JSONB NOT NULL DEFAULT '[]',
            page            INT
        )
    """)
    # Індекси для швидкого пошуку
    cur.execute("CREATE INDEX IF NOT EXISTS idx_questions_section ON questions(section)")
    cur.execute("CREATE INDEX IF NOT EXISTS idx_questions_text ON questions USING gin(to_tsvector('simple', question_text))")
    print("✅ Таблиця questions готова")


def load_data():
    print(f"📂 Читаємо: {JSON_FILE}")
    with open(JSON_FILE, encoding="utf-8") as f:
        data = json.load(f)
    print(f"   Питань у файлі: {len(data)}")
    return data


def map_question(item: dict) -> dict:
    """
    Маппінг з українських ключів pdr_final.json → колонки БД.
    Підтримує обидва формати: старий (українські ключі) та новий (англійські).
    """
    # Новий формат (англійські ключі)
    if "question_number" in item or "text" in item:
        options = []
        raw_opts = item.get("options", [])
        if isinstance(raw_opts, list):
            for opt in raw_opts:
                if isinstance(opt, dict):
                    options.append(opt.get("text", ""))
                else:
                    options.append(str(opt))

        correct_ans = None
        ca = item.get("correct_answer", "")
        if ca:
            label_to_num = {"A": 1, "B": 2, "C": 3, "D": 4, "E": 5, "F": 6}
            if isinstance(ca, str) and ca.upper() in label_to_num:
                correct_ans = label_to_num[ca.upper()]
            elif isinstance(ca, int):
                correct_ans = ca

        return {
            "id": item.get("id") or item.get("question_number"),
            "section": str(item.get("section", "1")),
            "section_name": item.get("topic", ""),
            "num_in_section": item.get("section_q_num") or item.get("question_number"),
            "question_text": item.get("text", ""),
            "options": options,
            "correct_ans": correct_ans,
            "images": item.get("image_url", []) if isinstance(item.get("image_url"), list)
                      else ([item["image_url"]] if item.get("image_url") else []),
            "page": item.get("page"),
        }

    # Старий формат (українські ключі) — твій pdr_final.json
    варіанти = item.get("варіанти", [])
    if not isinstance(варіанти, list):
        варіанти = []

    картинки = item.get("картинки", [])
    if not isinstance(картинки, list):
        картинки = []

    correct_ans = item.get("правильна_відповідь")
    if correct_ans is not None:
        try:
            correct_ans = int(correct_ans)
        except (ValueError, TypeError):
            correct_ans = None

    return {
        "id": item["id"],
        "section": str(item.get("розділ", "1")),
        "section_name": item.get("назва_розділу", ""),
        "num_in_section": item.get("номер_в_розділі"),
        "question_text": item.get("текст_питання", ""),
        "options": варіанти,
        "correct_ans": correct_ans,
        "images": картинки,
        "page": item.get("сторінка"),
    }


def insert_batch(cur, batch: list):
    psycopg2.extras.execute_values(
        cur,
        """
        INSERT INTO questions
            (id, section, section_name, num_in_section, question_text, options, correct_ans, images, page)
        VALUES %s
        ON CONFLICT (id) DO UPDATE SET
            section       = EXCLUDED.section,
            section_name  = EXCLUDED.section_name,
            question_text = EXCLUDED.question_text,
            options       = EXCLUDED.options,
            correct_ans   = EXCLUDED.correct_ans,
            images        = EXCLUDED.images
        """,
        [(
            q["id"],
            q["section"],
            q["section_name"],
            q["num_in_section"],
            q["question_text"],
            json.dumps(q["options"], ensure_ascii=False),
            q["correct_ans"],
            json.dumps(q["images"], ensure_ascii=False),
            q["page"],
        ) for q in batch],
    )


def main():
    print("=" * 55)
    print("  PDR DB MIGRATION — pdr_final.json → PostgreSQL")
    print("=" * 55)

    data = load_data()

    print(f"\n🔌 Підключення до БД...")
    conn = psycopg2.connect(DATABASE_URL)
    cur = conn.cursor()

    create_table(cur)
    conn.commit()

    # Конвертуємо всі питання
    questions = []
    errors = []
    for i, item in enumerate(data):
        try:
            q = map_question(item)
            if not q["question_text"] or not q["options"]:
                errors.append(f"  #{i+1}: порожній текст або варіанти")
                continue
            questions.append(q)
        except Exception as e:
            errors.append(f"  #{i+1}: {e}")

    if errors:
        print(f"\n⚠️  Пропущено {len(errors)} записів:")
        for e in errors[:5]:
            print(e)

    print(f"\n📥 Вставляємо {len(questions)} питань порціями по {BATCH_SIZE}...")
    inserted = 0
    for start in range(0, len(questions), BATCH_SIZE):
        batch = questions[start:start + BATCH_SIZE]
        insert_batch(cur, batch)
        conn.commit()
        inserted += len(batch)
        pct = round(inserted / len(questions) * 100)
        print(f"  [{pct:3d}%] {inserted}/{len(questions)}", end="\r")

    print()
    conn.close()

    print(f"\n{'='*55}")
    print(f"✅ Успішно завантажено: {inserted} питань")
    if errors:
        print(f"⚠️  Пропущено: {len(errors)}")
    print(f"\n💡 Перевірте результат:")
    print(f"   SELECT COUNT(*) FROM questions;")
    print(f"   SELECT section, COUNT(*) FROM questions GROUP BY section ORDER BY section::float;")
    print(f"{'='*55}")

    # Якщо є картинки
    imgs_path = Path(__file__).parent.parent / "frontend" / "public" / "images" / "pdr"
    print(f"\n🖼  Картинки мають лежати в:")
    print(f"   {imgs_path}")
    print(f"   Якщо є output/images/ від парсера — скопіюйте їх туди.")


if __name__ == "__main__":
    main()