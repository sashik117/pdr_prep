#!/usr/bin/env python3
from __future__ import annotations

import argparse
import json
import sys
import urllib.request
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
MODEL_PATH = BASE_DIR / "scripts" / "models" / "EDSR_x4.pb"
RUNTIME_DIR = BASE_DIR / "runtime" / "image_enhancement"

EDSR_URL = "https://raw.githubusercontent.com/Saafke/EDSR_Tensorflow/master/models/EDSR_x4.pb"
ENHANCED_SUFFIX = "-edsr"


@dataclass(frozen=True)
class ImageTarget:
    question_id: int
    section: str
    public_path: str
    source_path: Path
    output_public_path: str
    output_path: Path


def download_model() -> None:
    MODEL_PATH.parent.mkdir(parents=True, exist_ok=True)
    if MODEL_PATH.exists():
        print(f"[model] already exists: {MODEL_PATH}")
        return
    print(f"[model] downloading EDSR x4 model to {MODEL_PATH}")
    urllib.request.urlretrieve(EDSR_URL, MODEL_PATH)
    print("[model] done")


def load_sr_model() -> Any:
    if not hasattr(cv2, "dnn_superres"):
        raise RuntimeError("OpenCV dnn_superres is missing. Install opencv-contrib-python or opencv-contrib-python-headless.")
    if not MODEL_PATH.exists():
        raise RuntimeError(f"EDSR model not found. Run: python backend/scripts/enhance_question_images.py --download-model")
    sr = cv2.dnn_superres.DnnSuperResImpl_create()
    sr.readModel(str(MODEL_PATH))
    sr.setModel("edsr", 4)
    return sr


def load_json(path: Path) -> Any:
    return json.loads(path.read_text(encoding="utf-8"))


def write_json(path: Path, data: Any) -> None:
    path.write_text(json.dumps(data, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")


def iter_questions(data: Any) -> list[dict[str, Any]]:
    questions: list[dict[str, Any]] = []

    def walk(node: Any) -> None:
        if isinstance(node, dict):
            if "id" in node and ("картинки" in node or "images" in node):
                questions.append(node)
            for child in node.values():
                walk(child)
        elif isinstance(node, list):
            for child in node:
                walk(child)

    walk(data)
    return questions


def question_id(question: dict[str, Any]) -> int | None:
    try:
        return int(question.get("id"))
    except (TypeError, ValueError):
        return None


def question_section(question: dict[str, Any]) -> str:
    return str(question.get("розділ") or question.get("section") or "").strip()


def question_images(question: dict[str, Any]) -> list[str]:
    images = question.get("картинки") or question.get("images") or []
    if not isinstance(images, list):
        return []
    return [str(image) for image in images if isinstance(image, str) and image.startswith("/images/questions/")]


def public_to_file(public_path: str) -> Path:
    return PUBLIC_DIR / public_path.lstrip("/")


def is_enhanced(public_path: str) -> bool:
    return ENHANCED_SUFFIX in Path(public_path).stem


def output_public_path(public_path: str) -> str:
    path = Path(public_path)
    return str(path.with_name(f"{path.stem}{ENHANCED_SUFFIX}.png")).replace("\\", "/")


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
        if qid is None or question_section(question) != section:
            continue
        if question_ids and qid not in question_ids:
            continue

        for public_path in question_images(question):
            if public_path in seen or is_enhanced(public_path):
                continue
            source_path = public_to_file(public_path)
            if not source_path.exists():
                continue
            if only_tiny:
                with Image.open(source_path) as image:
                    if max(image.size) > only_tiny:
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


def enhance_one(input_path: Path, output_path: Path, sr_model: Any) -> None:
    cv_original = cv2.imread(str(input_path), cv2.IMREAD_COLOR)
    if cv_original is None:
        raise ValueError(f"Cannot read image: {input_path}")

    upscaled = sr_model.upsample(cv_original)

    blur = cv2.GaussianBlur(upscaled, (0, 0), sigmaX=0.8)
    sharpened = cv2.addWeighted(upscaled, 1.22, blur, -0.22, 0)

    sign = Image.fromarray(cv2.cvtColor(sharpened, cv2.COLOR_BGR2RGB))
    sign = ImageEnhance.Color(sign).enhance(1.06)

    sign_width, sign_height = sign.size
    canvas_width = max(sign_width + 32, int(sign_width / 0.58))
    canvas_height = max(sign_height + 32, int(canvas_width * 2 / 3))
    if sign_height + 32 > canvas_height:
        canvas_height = sign_height + 32

    canvas = Image.new("RGB", (canvas_width, canvas_height), "white")
    canvas.paste(sign, ((canvas_width - sign_width) // 2, (canvas_height - sign_height) // 2))

    output_path.parent.mkdir(parents=True, exist_ok=True)
    canvas.save(output_path, format="PNG", optimize=True)


def make_preview(targets: list[ImageTarget], preview_path: Path, sr_model: Any) -> None:
    rows: list[Image.Image] = []
    font = ImageFont.load_default()
    label_height = 24
    gutter = 18
    cell_width = 300
    cell_height = 230
    preview_output_dir = preview_path.parent / "preview_outputs"
    preview_output_dir.mkdir(parents=True, exist_ok=True)

    for target in targets:
        temp_output = preview_output_dir / target.output_path.name
        enhance_one(target.source_path, temp_output, sr_model)

        original = Image.open(target.source_path).convert("RGB")
        enhanced = Image.open(temp_output).convert("RGB")

        row = Image.new("RGB", (cell_width * 2 + gutter, cell_height + label_height), "white")
        draw = ImageDraw.Draw(row)
        draw.text((4, 4), f"q-{target.question_id} original", fill=(20, 30, 45), font=font)
        draw.text((cell_width + gutter + 4, 4), "EDSR preview", fill=(20, 30, 45), font=font)

        for image, x_offset in ((original, 0), (enhanced, cell_width + gutter)):
            image.thumbnail((cell_width - 12, cell_height - 12), Image.Resampling.LANCZOS)
            x = x_offset + max(0, (cell_width - image.width) // 2)
            y = label_height + max(0, (cell_height - image.height) // 2)
            row.paste(image, (x, y))
        rows.append(row)

    preview = Image.new("RGB", (rows[0].width, sum(row.height for row in rows)), "white")
    y_offset = 0
    for row in rows:
        preview.paste(row, (0, y_offset))
        y_offset += row.height
    preview_path.parent.mkdir(parents=True, exist_ok=True)
    preview.save(preview_path, quality=92)


def replace_question_refs(data: Any, replacements: dict[str, str]) -> int:
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

    walk(data)
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
                entry["enhancement"] = "edsr-x4"
                changed += 1
    if changed:
        write_json(IMAGE_MAP_FILE, image_map)
    return changed


def apply_targets(targets: list[ImageTarget], sr_model: Any) -> dict[str, int]:
    for target in targets:
        enhance_one(target.source_path, target.output_path, sr_model)

    replacements = {target.public_path: target.output_public_path for target in targets}
    data = load_json(QUESTIONS_FILE)
    question_changes = replace_question_refs(data, replacements)
    write_json(QUESTIONS_FILE, data)
    map_changes = update_image_map(replacements)

    report = {
        "mode": "apply",
        "enhancement": "edsr-x4",
        "processed": len(targets),
        "question_reference_changes": question_changes,
        "image_map_changes": map_changes,
        "outputs": [
            {"question_id": target.question_id, "source": target.public_path, "target": target.output_public_path}
            for target in targets
        ],
    }
    write_json(QUESTIONS_FILE.parent / f"section{targets[0].section}_edsr_report.json", report)
    return {"processed": len(targets), "question_changes": question_changes, "image_map_changes": map_changes}


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Enhance referenced PDR question images with EDSR x4.")
    parser.add_argument("--download-model", action="store_true", help="Download EDSR_x4.pb model into backend/scripts/models.")
    parser.add_argument("--section", help="Question section number, for example 33.")
    parser.add_argument("--ids", "--question-ids", dest="question_ids", type=int, nargs="*", default=None)
    parser.add_argument("--limit", type=int, default=None)
    parser.add_argument("--only-tiny", type=int, default=220, help="Only process images whose longest side is <= this value. Use 0 to disable.")
    parser.add_argument("--preview", action="store_true")
    parser.add_argument("--apply", action="store_true")
    return parser.parse_args()


def main() -> None:
    args = parse_args()
    if args.download_model:
        download_model()
        return
    if not args.section:
        raise SystemExit("Provide --section, for example --section 33")
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

    sr_model = load_sr_model()
    if args.preview:
        preview_path = RUNTIME_DIR / f"section-{args.section}-edsr-preview.jpg"
        make_preview(targets, preview_path, sr_model)
        print(json.dumps({"mode": "preview", "targets": len(targets), "preview": str(preview_path)}, ensure_ascii=False, indent=2))
        return

    result = apply_targets(targets, sr_model)
    print(json.dumps({"mode": "apply", **result}, ensure_ascii=False, indent=2))


if __name__ == "__main__":
    main()
