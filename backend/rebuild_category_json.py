#!/usr/bin/env python3
from __future__ import annotations

import json
from pathlib import Path

BASE_DIR = Path(__file__).resolve().parent
SOURCE_FILE = BASE_DIR / "pdr_final.json"
TARGET_FILE = BASE_DIR / "pdr_final_category.json"

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


def main() -> None:
    questions = json.loads(SOURCE_FILE.read_text(encoding="utf-8"))
    by_section: dict[int, list[dict]] = {}
    for question in questions:
        section = int(question["СЂРѕР·РґС–Р»"])
        by_section.setdefault(section, []).append(question)

    grouped = []
    for category, sections in CATEGORY_SECTION_RULES.items():
        category_sections = []
        for section in sections:
            items = by_section.get(section, [])
            if not items:
                continue
            category_sections.append(
                {
                    "section": str(section),
                    "section_name": items[0]["РЅР°Р·РІР°_СЂРѕР·РґС–Р»Сѓ"],
                    "question_count": len(items),
                    "questions": [
                        {
                            "id": item["id"],
                            "section": item["СЂРѕР·РґС–Р»"],
                            "section_name": item["РЅР°Р·РІР°_СЂРѕР·РґС–Р»Сѓ"],
                            "num_in_section": item["РЅРѕРјРµСЂ_РІ_СЂРѕР·РґС–Р»С–"],
                            "question_text": item["С‚РµРєСЃС‚_РїРёС‚Р°РЅРЅСЏ"],
                            "options": item["РІР°СЂС–Р°РЅС‚Рё"],
                            "correct_ans": item["РїСЂР°РІРёР»СЊРЅР°_РІС–РґРїРѕРІС–РґСЊ"],
                            "images": item["РєР°СЂС‚РёРЅРєРё"],
                            "page": item["СЃС‚РѕСЂС–РЅРєР°"],
                            "category": category,
                        }
                        for item in items
                    ],
                }
            )
        grouped.append({"category": category, "sections": category_sections})

    TARGET_FILE.write_text(json.dumps(grouped, ensure_ascii=False, indent=2), encoding="utf-8")
    print(f"Rebuilt {TARGET_FILE.name} with {len(grouped)} categories.")


if __name__ == "__main__":
    main()
