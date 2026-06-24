#!/usr/bin/env python3
from __future__ import annotations

import argparse
import json
import re
import shutil
from pathlib import Path
from typing import Any


ROOT = Path(__file__).resolve().parents[2]
QUESTIONS_FILE = ROOT / "backend" / "data" / "questions" / "pdr_final_category.json"
SOURCE_DIR = ROOT / "frontend" / "public" / "images" / "questions_img"
TARGET_ROOT = ROOT / "backend" / "public" / "images" / "questions"
MAP_FILE = ROOT / "backend" / "data" / "questions" / "question_image_map.json"

SECTION_KEY = "розділ"
SECTION_NAME_KEY = "назва_розділу"
QUESTIONS_KEY = "питання"
IMAGES_KEY = "картинки"


def slugify(value: Any, fallback: str) -> str:
    text = str(value or "").strip().lower()
    replacements = {
        "є": "ie",
        "і": "i",
        "ї": "i",
        "ґ": "g",
        "а": "a",
        "б": "b",
        "в": "v",
        "г": "h",
        "д": "d",
        "е": "e",
        "ж": "zh",
        "з": "z",
        "и": "y",
        "й": "i",
        "к": "k",
        "л": "l",
        "м": "m",
        "н": "n",
        "о": "o",
        "п": "p",
        "р": "r",
        "с": "s",
        "т": "t",
        "у": "u",
        "ф": "f",
        "х": "kh",
        "ц": "ts",
        "ч": "ch",
        "ш": "sh",
        "щ": "shch",
        "ь": "",
        "ю": "iu",
        "я": "ia",
    }
    for source, target in replacements.items():
        text = text.replace(source, target)
    text = re.sub(r"[^a-z0-9]+", "-", text).strip("-")
    return text or fallback


def section_folder(question: dict[str, Any]) -> str:
    raw_section = str(question.get(SECTION_KEY) or question.get("section") or "unknown").strip()
    section_number = re.match(r"\d+", raw_section)
    section_part = section_number.group(0).zfill(2) if section_number else slugify(raw_section, "unknown")
    title = question.get(SECTION_NAME_KEY) or question.get("section_name") or f"section-{section_part}"
    return f"section-{section_part}-{slugify(title, f'section-{section_part}')}"


def source_path_for(image_ref: str) -> Path | None:
    clean = str(image_ref or "").strip()
    if not clean:
        return None
    if clean.startswith("/images/questions/"):
        candidate = ROOT / "backend" / "public" / clean.removeprefix("/images/")
        return candidate if candidate.exists() else None
    if clean.startswith("/images/questions_img/"):
        clean = clean.removeprefix("/images/questions_img/")
    elif clean.startswith("/"):
        clean = Path(clean).name
    return SOURCE_DIR / Path(clean).name


def normalize_question_images(question: dict[str, Any], *, dry_run: bool) -> tuple[int, int, list[dict[str, str]]]:
    images = question.get(IMAGES_KEY)
    if images is None:
        images = question.get("images")
    if not isinstance(images, list) or not images:
        return 0, 0, []

    question_id = str(question.get("id") or "").strip() or "unknown"
    folder = section_folder(question)
    target_dir = TARGET_ROOT / folder
    new_images: list[str] = []
    copied = 0
    missing = 0
    mappings: list[dict[str, str]] = []

    for index, image_ref in enumerate(images, start=1):
        source_path = source_path_for(str(image_ref))
        if not source_path or not source_path.exists():
            missing += 1
            new_images.append(str(image_ref))
            continue

        suffix = source_path.suffix.lower() or ".jpeg"
        target_name = f"q-{question_id}-{index:02d}-{source_path.stem}{suffix}"
        target_path = target_dir / target_name
        public_path = f"/images/questions/{folder}/{target_name}"
        if not dry_run:
            target_dir.mkdir(parents=True, exist_ok=True)
            if not target_path.exists() or target_path.stat().st_size != source_path.stat().st_size:
                shutil.copy2(source_path, target_path)
                copied += 1
        new_images.append(public_path)
        mappings.append(
            {
                "question_id": question_id,
                "section": str(question.get(SECTION_KEY) or question.get("section") or ""),
                "source": str(image_ref),
                "target": public_path,
            }
        )

    if not dry_run:
        question[IMAGES_KEY] = new_images
        question["images"] = new_images
    return copied, missing, mappings


def iter_questions(data: Any):
    if isinstance(data, list) and data and isinstance(data[0], dict) and QUESTIONS_KEY in data[0].get("розділи", [{}])[0]:
        for category in data:
            for section in category.get("розділи", []) or []:
                for question in section.get(QUESTIONS_KEY, []) or []:
                    yield question
        return
    if isinstance(data, list):
        for question in data:
            if isinstance(question, dict):
                yield question


def main() -> None:
    parser = argparse.ArgumentParser(description="Organize question images into backend/public/images/questions and update seed paths.")
    parser.add_argument("--dry-run", action="store_true", help="Only print stats, do not write files.")
    args = parser.parse_args()

    data = json.loads(QUESTIONS_FILE.read_text(encoding="utf-8"))
    total = with_images = copied = missing = 0
    mappings: list[dict[str, str]] = []
    section_stats: dict[str, dict[str, int]] = {}

    for question in iter_questions(data):
        total += 1
        section = str(question.get(SECTION_KEY) or question.get("section") or "")
        stats = section_stats.setdefault(section, {"total": 0, "with_images": 0, "missing": 0})
        stats["total"] += 1
        images = question.get(IMAGES_KEY) if question.get(IMAGES_KEY) is not None else question.get("images")
        if isinstance(images, list) and images:
            with_images += 1
            stats["with_images"] += 1
        copied_count, missing_count, question_mappings = normalize_question_images(question, dry_run=args.dry_run)
        copied += copied_count
        missing += missing_count
        stats["missing"] += missing_count
        mappings.extend(question_mappings)

    if not args.dry_run:
        QUESTIONS_FILE.write_text(json.dumps(data, ensure_ascii=False, indent=2), encoding="utf-8")
        MAP_FILE.write_text(json.dumps(mappings, ensure_ascii=False, indent=2), encoding="utf-8")

    print(f"questions: {total}")
    print(f"questions with images: {with_images}")
    print(f"copied images: {copied}")
    print(f"missing source images: {missing}")
    section_33 = {key: value for key, value in section_stats.items() if str(key).startswith("33")}
    if section_33:
        print("section 33:")
        for key, value in sorted(section_33.items()):
            print(f"  {key}: {value}")


if __name__ == "__main__":
    main()
