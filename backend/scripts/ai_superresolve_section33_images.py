from __future__ import annotations

import argparse
import json
from pathlib import Path
from urllib.request import Request, urlopen

import cv2
from PIL import Image, ImageEnhance, ImageOps


BASE_DIR = Path(__file__).resolve().parents[1]
PROJECT_ROOT = BASE_DIR.parent
QUESTIONS_FILE = BASE_DIR / "data" / "questions" / "pdr_final_category.json"
IMAGE_MAP_FILE = BASE_DIR / "data" / "questions" / "question_image_map.json"
PUBLIC_ROOT = BASE_DIR / "public"
QUESTION_IMAGE_PREFIX = "/images/questions/section-33-dorozhni-znaky/"
MODEL_DIR = BASE_DIR / "runtime" / "sr_models"
MODEL_PATH = MODEL_DIR / "FSRCNN_x4.pb"
MODEL_URL = "https://github.com/Saafke/FSRCNN_Tensorflow/raw/master/models/FSRCNN_x4.pb"


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Create AI super-resolution variants for tiny section 33 question images.")
    parser.add_argument("--max-long-edge", type=int, default=200)
    parser.add_argument("--quality", type=int, default=94)
    parser.add_argument("--force", action="store_true")
    return parser.parse_args()


def load_json(path: Path):
    return json.loads(path.read_text(encoding="utf-8"))


def write_json(path: Path, payload) -> None:
    path.write_text(json.dumps(payload, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")


def ensure_model() -> None:
    if MODEL_PATH.exists() and MODEL_PATH.stat().st_size > 0:
        return
    MODEL_DIR.mkdir(parents=True, exist_ok=True)
    request = Request(MODEL_URL, headers={"User-Agent": "Mozilla/5.0"})
    with urlopen(request, timeout=120) as response:
        MODEL_PATH.write_bytes(response.read())


def public_to_disk(public_path: str) -> Path:
    return PUBLIC_ROOT / public_path.lstrip("/")


def ai_target_path(public_path: str) -> str:
    path = Path(public_path)
    return str(path.with_name(f"{path.stem}-ai4x{path.suffix}")).replace("\\", "/")


def should_process(public_path: str, max_long_edge: int) -> bool:
    if not public_path.startswith(QUESTION_IMAGE_PREFIX) or public_path.endswith("-ai4x.jpeg"):
        return False
    disk_path = public_to_disk(public_path)
    if not disk_path.exists():
        return False
    with Image.open(disk_path) as image:
        return max(image.size) <= max_long_edge


def superresolve_image(source: Path, destination: Path, sr, quality: int) -> None:
    image = cv2.imread(str(source), cv2.IMREAD_COLOR)
    if image is None:
        raise RuntimeError(f"Could not read image: {source}")
    result = sr.upsample(image)
    result = cv2.cvtColor(result, cv2.COLOR_BGR2RGB)
    pil_image = Image.fromarray(result)
    pil_image = ImageOps.autocontrast(pil_image, cutoff=0.2)
    pil_image = ImageEnhance.Sharpness(pil_image).enhance(1.04)
    destination.parent.mkdir(parents=True, exist_ok=True)
    pil_image.save(destination, quality=quality, optimize=True, progressive=True, subsampling=0)


def iter_section33_questions(data):
    for category in data:
        for section in category.get("розділи", []) or []:
            for question in section.get("питання", []) or []:
                if str(question.get("розділ") or question.get("section") or "") == "33":
                    yield question


def update_image_map(replacements: dict[str, str]) -> None:
    if not IMAGE_MAP_FILE.exists():
        return
    image_map = load_json(IMAGE_MAP_FILE)
    if not isinstance(image_map, list):
        return
    for entry in image_map:
        target = str(entry.get("target") or "")
        if target in replacements:
            entry["target"] = replacements[target]
            entry["ai_source"] = target
            entry["enhancement"] = "opencv-fsrcnn-x4"
    write_json(IMAGE_MAP_FILE, image_map)


def main() -> None:
    args = parse_args()
    ensure_model()

    sr = cv2.dnn_superres.DnnSuperResImpl_create()
    sr.readModel(str(MODEL_PATH))
    sr.setModel("fsrcnn", 4)

    data = load_json(QUESTIONS_FILE)
    replacements: dict[str, str] = {}
    processed = 0
    skipped_existing = 0

    for question in iter_section33_questions(data):
        images = question.get("картинки") or question.get("images") or []
        if not isinstance(images, list):
            continue
        next_images: list[str] = []
        for public_path in images:
            public_path = str(public_path)
            if not should_process(public_path, args.max_long_edge):
                next_images.append(public_path)
                continue
            target_public_path = ai_target_path(public_path)
            source = public_to_disk(public_path)
            destination = public_to_disk(target_public_path)
            if destination.exists() and not args.force:
                skipped_existing += 1
            else:
                superresolve_image(source, destination, sr, args.quality)
                processed += 1
            replacements[public_path] = target_public_path
            next_images.append(target_public_path)
        question["картинки"] = next_images
        question["images"] = next_images

    write_json(QUESTIONS_FILE, data)
    update_image_map(replacements)

    report = {
        "processed": processed,
        "skipped_existing": skipped_existing,
        "replaced_references": len(replacements),
        "max_long_edge": args.max_long_edge,
        "model": "opencv-fsrcnn-x4",
    }
    report_path = BASE_DIR / "data" / "questions" / "section33_ai_superresolution_report.json"
    write_json(report_path, report)
    print(json.dumps(report, ensure_ascii=False, indent=2))


if __name__ == "__main__":
    main()
