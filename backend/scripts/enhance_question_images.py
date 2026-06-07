#!/usr/bin/env python3
from __future__ import annotations

import argparse
import json
from dataclasses import dataclass
from pathlib import Path
from typing import Any

import cv2
import numpy as np
from PIL import Image, ImageDraw, ImageEnhance, ImageFont


BASE_DIR = Path(__file__).resolve().parents[1]
PUBLIC_DIR = BASE_DIR / "public"
QUESTIONS_FILE = BASE_DIR / "data" / "questions" / "pdr_final_category.json"
IMAGE_MAP_FILE = BASE_DIR / "data" / "questions" / "question_image_map.json"
RUNTIME_DIR = BASE_DIR / "runtime" / "image_enhancement"
ENHANCED_SUFFIX = "-enhanced"


@dataclass(frozen=True)
class ImageTarget:
    question_id: int
    section: str
    public_path: str
    source_path: Path
    output_public_path: str
    output_path: Path


def load_json(path: Path) -> Any:
    return json.loads(path.read_text(encoding="utf-8"))


def write_json(path: Path, data: Any) -> None:
    path.write_text(json.dumps(data, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")


def question_section(question: dict[str, Any]) -> str:
    return str(question.get("розділ") or question.get("section") or "").strip()


def question_id(question: dict[str, Any]) -> int | None:
    try:
        return int(question.get("id"))
    except (TypeError, ValueError):
        return None


def question_images(question: dict[str, Any]) -> list[str]:
    images = question.get("картинки") or question.get("images") or []
    if not isinstance(images, list):
        return []
    return [str(image) for image in images if isinstance(image, str) and image.startswith("/images/questions/")]


def iter_questions(data: Any) -> list[dict[str, Any]]:
    questions: list[dict[str, Any]] = []

    def walk(value: Any) -> None:
        if isinstance(value, dict):
            if "id" in value and ("картинки" in value or "images" in value):
                questions.append(value)
            for child in value.values():
                walk(child)
        elif isinstance(value, list):
            for child in value:
                walk(child)

    walk(data)
    return questions


def is_enhanced(path: str) -> bool:
    return ENHANCED_SUFFIX in Path(path).stem


def output_public_path(public_path: str) -> str:
    path = Path(public_path)
    return str(path.with_name(f"{path.stem}{ENHANCED_SUFFIX}.png")).replace("\\", "/")


def public_to_file(public_path: str) -> Path:
    return PUBLIC_DIR / public_path.lstrip("/")


def collect_targets(
    *,
    section: str,
    question_ids: set[int] | None,
    limit: int | None,
    only_tiny: int | None,
) -> list[ImageTarget]:
    data = load_json(QUESTIONS_FILE)
    targets: list[ImageTarget] = []
    seen: set[str] = set()

    for question in iter_questions(data):
        qid = question_id(question)
        if qid is None:
            continue
        if question_section(question) != section:
            continue
        if question_ids and qid not in question_ids:
            continue

        for public_path in question_images(question):
            if is_enhanced(public_path) or public_path in seen:
                continue
            source_path = public_to_file(public_path)
            if not source_path.exists():
                continue
            if only_tiny:
                try:
                    with Image.open(source_path) as image:
                        if max(image.size) > only_tiny:
                            continue
                except OSError:
                    continue

            next_public_path = output_public_path(public_path)
            targets.append(
                ImageTarget(
                    question_id=qid,
                    section=section,
                    public_path=public_path,
                    source_path=source_path,
                    output_public_path=next_public_path,
                    output_path=public_to_file(next_public_path),
                )
            )
            seen.add(public_path)

            if limit and len(targets) >= limit:
                return targets

    return targets


def enhance_one(input_path: Path, output_path: Path) -> None:
    image = Image.open(input_path).convert("RGBA")
    rgb_image = image.convert("RGB")
    alpha = image.getchannel("A")

    width, height = rgb_image.size
    target_size = (width * 2, height * 2)
    upscaled = rgb_image.resize(target_size, Image.Resampling.LANCZOS)

    cv_image = cv2.cvtColor(np.array(upscaled), cv2.COLOR_RGB2BGR)
    blurred = cv2.GaussianBlur(cv_image, (0, 0), sigmaX=1.5)
    sharpened = cv2.addWeighted(cv_image, 1.35, blurred, -0.35, 0)

    lab = cv2.cvtColor(sharpened, cv2.COLOR_BGR2Lab)
    lightness, channel_a, channel_b = cv2.split(lab)
    clahe = cv2.createCLAHE(clipLimit=1.4, tileGridSize=(8, 8))
    lightness = clahe.apply(lightness)
    result_cv = cv2.cvtColor(cv2.merge([lightness, channel_a, channel_b]), cv2.COLOR_Lab2BGR)

    result = Image.fromarray(cv2.cvtColor(result_cv, cv2.COLOR_BGR2RGB))
    result = ImageEnhance.Color(result).enhance(1.04)
    result = ImageEnhance.Contrast(result).enhance(1.03)

    if alpha:
        result = result.convert("RGBA")
        result.putalpha(alpha.resize(target_size, Image.Resampling.LANCZOS))

    output_path.parent.mkdir(parents=True, exist_ok=True)
    result.save(output_path, format="PNG", optimize=True)


def ensure_outputs(targets: list[ImageTarget]) -> None:
    for target in targets:
        enhance_one(target.source_path, target.output_path)


def make_preview(targets: list[ImageTarget], preview_path: Path) -> None:
    if not targets:
        return

    rows: list[Image.Image] = []
    font = ImageFont.load_default()
    label_height = 24
    gutter = 18
    cell_width = 260
    cell_height = 220
    preview_output_dir = preview_path.parent / "preview_outputs"

    for target in targets:
        temp_output = preview_output_dir / target.output_path.name
        enhance_one(target.source_path, temp_output)
        original = Image.open(target.source_path).convert("RGB")
        enhanced = Image.open(temp_output).convert("RGB")

        row = Image.new("RGB", (cell_width * 2 + gutter, cell_height + label_height), "white")
        draw = ImageDraw.Draw(row)
        draw.text((4, 4), f"q-{target.question_id} original", fill=(20, 30, 45), font=font)
        draw.text((cell_width + gutter + 4, 4), "enhanced preview", fill=(20, 30, 45), font=font)

        for image, x in ((original, 0), (enhanced, cell_width + gutter)):
            image.thumbnail((cell_width - 12, cell_height - 12), Image.Resampling.LANCZOS)
            y = label_height + max(0, (cell_height - image.height) // 2)
            x_inner = x + max(0, (cell_width - image.width) // 2)
            row.paste(image, (x_inner, y))

        rows.append(row)

    preview = Image.new("RGB", (rows[0].width, sum(row.height for row in rows)), "white")
    y_offset = 0
    for row in rows:
        preview.paste(row, (0, y_offset))
        y_offset += row.height

    preview_path.parent.mkdir(parents=True, exist_ok=True)
    preview.save(preview_path, quality=92)


def replace_question_refs(value: Any, replacements: dict[str, str]) -> int:
    changed = 0

    def patch_question(question: dict[str, Any]) -> None:
        nonlocal changed
        for key in ("картинки", "images"):
            images = question.get(key)
            if not isinstance(images, list):
                continue
            next_images = [replacements.get(str(image), image) for image in images]
            if next_images != images:
                question[key] = next_images
                changed += 1

    def walk(node: Any) -> None:
        if isinstance(node, dict):
            if "id" in node and ("картинки" in node or "images" in node):
                patch_question(node)
            for child in node.values():
                walk(child)
        elif isinstance(node, list):
            for child in node:
                walk(child)

    walk(value)
    return changed


def update_image_map(replacements: dict[str, str]) -> int:
    if not IMAGE_MAP_FILE.exists():
        return 0
    image_map = load_json(IMAGE_MAP_FILE)
    changed = 0
    if isinstance(image_map, list):
        for entry in image_map:
            if not isinstance(entry, dict):
                continue
            target = str(entry.get("target") or "")
            if target in replacements:
                entry.setdefault("original_target", target)
                entry["target"] = replacements[target]
                entry["enhancement"] = "lanczos-clahe-unsharp"
                changed += 1
    if changed:
        write_json(IMAGE_MAP_FILE, image_map)
    return changed


def apply_targets(targets: list[ImageTarget]) -> dict[str, int]:
    ensure_outputs(targets)
    replacements = {target.public_path: target.output_public_path for target in targets}

    data = load_json(QUESTIONS_FILE)
    question_changes = replace_question_refs(data, replacements)
    write_json(QUESTIONS_FILE, data)
    map_changes = update_image_map(replacements)

    report = {
        "mode": "apply",
        "enhancement": "lanczos-clahe-unsharp",
        "processed": len(targets),
        "question_reference_changes": question_changes,
        "image_map_changes": map_changes,
        "outputs": [
            {
                "question_id": target.question_id,
                "source": target.public_path,
                "target": target.output_public_path,
            }
            for target in targets
        ],
    }
    report_path = QUESTIONS_FILE.parent / f"section{targets[0].section}_enhancement_report.json"
    write_json(report_path, report)
    return {
        "processed": len(targets),
        "question_changes": question_changes,
        "image_map_changes": map_changes,
    }


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Enhance referenced PDR question images without overwriting originals.")
    parser.add_argument("--section", required=True, help="Question section number, for example 33.")
    parser.add_argument("--question-ids", type=int, nargs="*", default=None, help="Limit processing to specific question ids.")
    parser.add_argument("--limit", type=int, default=None, help="Limit number of referenced images.")
    parser.add_argument("--only-tiny", type=int, default=220, help="Only process images whose longest side is <= this value. Use 0 to disable.")
    parser.add_argument("--preview", action="store_true", help="Create enhanced files and a visual preview, but do not update JSON references.")
    parser.add_argument("--apply", action="store_true", help="Create enhanced files and update JSON references.")
    return parser.parse_args()


def main() -> None:
    args = parse_args()
    if args.preview == args.apply:
        raise SystemExit("Choose exactly one mode: --preview or --apply")

    targets = collect_targets(
        section=str(args.section),
        question_ids=set(args.question_ids or []) or None,
        limit=args.limit,
        only_tiny=args.only_tiny or None,
    )
    if not targets:
        raise SystemExit("No matching referenced images found.")

    if args.preview:
        preview_path = RUNTIME_DIR / f"section-{args.section}-preview.jpg"
        make_preview(targets, preview_path)
        print(json.dumps({"mode": "preview", "targets": len(targets), "preview": str(preview_path)}, ensure_ascii=False, indent=2))
        return

    result = apply_targets(targets)
    print(json.dumps({"mode": "apply", **result}, ensure_ascii=False, indent=2))


if __name__ == "__main__":
    main()
