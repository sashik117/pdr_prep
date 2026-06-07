from __future__ import annotations

import json
import os
import shutil
from pathlib import Path
from typing import Any


BASE_DIR = Path(__file__).resolve().parents[1]
QUESTIONS_FILE = BASE_DIR / "data" / "questions" / "pdr_final_category.json"
IMAGE_MAP_FILE = BASE_DIR / "data" / "questions" / "question_image_map.json"
TARGET_DIR = BASE_DIR / "public" / "images" / "questions" / "section-33-dorozhni-znaky"
PUBLIC_PREFIX = "/images/questions/section-33-dorozhni-znaky"

DEFAULT_SOURCE_DIR = Path(r"D:\Apps\pdr_parsing\update\extracted_signs")


def iter_question_groups(data: list[dict[str, Any]]):
    for category in data:
        for section in category.get("розділи", []) or []:
            for question in section.get("питання", []) or []:
                yield category, section, question


def load_json(path: Path) -> Any:
    return json.loads(path.read_text(encoding="utf-8"))


def write_json(path: Path, payload: Any) -> None:
    path.write_text(json.dumps(payload, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")


def main() -> None:
    source_dir = Path(os.environ.get("SECTION33_SIGNS_SOURCE", DEFAULT_SOURCE_DIR))
    if not source_dir.exists():
        raise SystemExit(f"Source folder does not exist: {source_dir}")
    if not QUESTIONS_FILE.exists():
        raise SystemExit(f"Questions seed not found: {QUESTIONS_FILE}")

    data = load_json(QUESTIONS_FILE)
    TARGET_DIR.mkdir(parents=True, exist_ok=True)

    updated = 0
    copied = 0
    missing_source: list[dict[str, Any]] = []
    mapped_entries: list[dict[str, str]] = []

    for _, _, question in iter_question_groups(data):
        if str(question.get("розділ") or question.get("section") or "") != "33":
            continue

        question_id = str(question.get("id") or "").strip()
        number_raw = question.get("номер_в_розділі") or question.get("num_in_section") or question.get("question_number")
        try:
            number = int(number_raw)
        except (TypeError, ValueError):
            continue

        source_file = source_dir / f"sign_33_{number:03d}.jpeg"
        if not source_file.exists():
            missing_source.append(
                {
                    "question_id": question_id,
                    "num_in_section": str(number),
                    "text": str(question.get("текст_питання") or question.get("question_text") or "")[:120],
                    "existing_images": question.get("картинки") or question.get("images") or [],
                }
            )
            continue

        target_name = f"q-{question_id}-01-sign_33_{number:03d}.jpeg"
        target_file = TARGET_DIR / target_name
        if not target_file.exists() or target_file.stat().st_size != source_file.stat().st_size:
            shutil.copy2(source_file, target_file)
            copied += 1

        public_path = f"{PUBLIC_PREFIX}/{target_name}"
        question["картинки"] = [public_path]
        question["images"] = [public_path]
        mapped_entries.append(
            {
                "question_id": question_id,
                "section": "33",
                "num_in_section": str(number),
                "source": str(source_file),
                "target": public_path,
            }
        )
        updated += 1

    write_json(QUESTIONS_FILE, data)

    image_map = []
    if IMAGE_MAP_FILE.exists():
        current_map = load_json(IMAGE_MAP_FILE)
        if isinstance(current_map, list):
            image_map = [
                item
                for item in current_map
                if not (str(item.get("section")) == "33" and str(item.get("target", "")).startswith(PUBLIC_PREFIX))
            ]
    image_map.extend(mapped_entries)
    image_map.sort(key=lambda item: (int(str(item.get("section", "0")).split(".")[0] or 0), int(item.get("question_id") or 0), item.get("target", "")))
    write_json(IMAGE_MAP_FILE, image_map)

    print(f"Source folder: {source_dir}")
    print(f"Updated section 33 questions: {updated}")
    print(f"Copied image files: {copied}")
    print(f"Questions without extracted sign image: {len(missing_source)}")
    if missing_source:
        report_path = BASE_DIR / "data" / "questions" / "section33_missing_sign_images.json"
        write_json(report_path, missing_source)
        print(f"Missing report: {report_path}")


if __name__ == "__main__":
    main()
