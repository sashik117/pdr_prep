from __future__ import annotations

import argparse
import shutil
from datetime import datetime
from pathlib import Path

from PIL import Image, ImageEnhance, ImageFilter, ImageOps


BASE_DIR = Path(__file__).resolve().parents[1]
DEFAULT_TARGET_DIR = BASE_DIR / "public" / "images" / "questions" / "section-33-dorozhni-znaky"
DEFAULT_BACKUP_ROOT = BASE_DIR / "runtime" / "image_backups"
SUPPORTED_EXTENSIONS = {".jpg", ".jpeg", ".png", ".webp"}

try:
    RESAMPLE_LANCZOS = Image.Resampling.LANCZOS
except AttributeError:  # pragma: no cover - Pillow < 9
    RESAMPLE_LANCZOS = Image.LANCZOS


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description="Safely upscale and sharpen question images without changing public paths."
    )
    parser.add_argument(
        "--target-dir",
        type=Path,
        default=DEFAULT_TARGET_DIR,
        help="Folder with question images to enhance.",
    )
    parser.add_argument(
        "--min-long-edge",
        type=int,
        default=512,
        help="Upscale images whose longest side is smaller than this value.",
    )
    parser.add_argument(
        "--max-scale",
        type=float,
        default=6.0,
        help="Maximum resize multiplier for tiny images.",
    )
    parser.add_argument(
        "--skip-longer-than",
        type=int,
        default=900,
        help="Skip very large images; they are usually already usable.",
    )
    parser.add_argument(
        "--quality",
        type=int,
        default=92,
        help="JPEG/WebP output quality.",
    )
    parser.add_argument(
        "--backup",
        action="store_true",
        help="Copy originals to backend/runtime/image_backups before overwriting.",
    )
    parser.add_argument("--dry-run", action="store_true", help="Print planned changes without writing files.")
    return parser.parse_args()


def iter_images(target_dir: Path) -> list[Path]:
    return sorted(
        path
        for path in target_dir.rglob("*")
        if path.is_file() and path.suffix.lower() in SUPPORTED_EXTENSIONS
    )


def backup_file(path: Path, target_dir: Path, backup_dir: Path) -> None:
    relative = path.relative_to(target_dir)
    destination = backup_dir / relative
    destination.parent.mkdir(parents=True, exist_ok=True)
    shutil.copy2(path, destination)


def calculate_size(width: int, height: int, min_long_edge: int, max_scale: float) -> tuple[int, int, float]:
    long_edge = max(width, height)
    if long_edge <= 0 or long_edge >= min_long_edge:
        return width, height, 1.0
    scale = min(max_scale, min_long_edge / long_edge)
    return max(1, round(width * scale)), max(1, round(height * scale)), scale


def enhance_image(image: Image.Image, *, min_long_edge: int, max_scale: float) -> tuple[Image.Image, float]:
    image = ImageOps.exif_transpose(image)
    if image.mode not in {"RGB", "RGBA"}:
        image = image.convert("RGB")

    original_width, original_height = image.size
    next_width, next_height, scale = calculate_size(original_width, original_height, min_long_edge, max_scale)
    if scale > 1.0:
        image = image.resize((next_width, next_height), RESAMPLE_LANCZOS)

    if image.mode == "RGBA":
        alpha = image.getchannel("A")
        rgb = Image.new("RGB", image.size, "white")
        rgb.paste(image, mask=alpha)
        image = rgb

    image = ImageOps.autocontrast(image, cutoff=0.5)
    image = ImageEnhance.Contrast(image).enhance(1.05)
    image = ImageEnhance.Sharpness(image).enhance(1.12 if scale <= 1.0 else 1.25)
    image = image.filter(ImageFilter.UnsharpMask(radius=1.1, percent=115 if scale <= 1.0 else 145, threshold=3))
    return image, scale


def save_image(image: Image.Image, destination: Path, *, quality: int) -> None:
    suffix = destination.suffix.lower()
    tmp_destination = destination.with_name(f"{destination.stem}.enhanced.tmp{destination.suffix}")

    save_kwargs: dict[str, object] = {"optimize": True}
    if suffix in {".jpg", ".jpeg"}:
        save_kwargs.update({"quality": quality, "subsampling": 0, "progressive": True})
    elif suffix == ".webp":
        save_kwargs.update({"quality": quality, "method": 6})

    image.save(tmp_destination, **save_kwargs)
    tmp_destination.replace(destination)


def main() -> None:
    args = parse_args()
    target_dir = args.target_dir.resolve()
    if not target_dir.exists():
        raise SystemExit(f"Target folder does not exist: {target_dir}")

    backup_dir = DEFAULT_BACKUP_ROOT / f"{target_dir.name}-{datetime.now().strftime('%Y%m%d-%H%M%S')}"
    processed = 0
    resized = 0
    skipped_large = 0

    for image_path in iter_images(target_dir):
        with Image.open(image_path) as image:
            width, height = image.size
            if max(width, height) > args.skip_longer_than:
                skipped_large += 1
                continue

            enhanced, scale = enhance_image(
                image,
                min_long_edge=args.min_long_edge,
                max_scale=args.max_scale,
            )

        if args.dry_run:
            print(f"would enhance {image_path.name}: {width}x{height} -> {enhanced.width}x{enhanced.height}")
            continue

        if args.backup:
            backup_file(image_path, target_dir, backup_dir)

        save_image(enhanced, image_path, quality=args.quality)
        processed += 1
        if scale > 1.0:
            resized += 1
        print(f"enhanced {image_path.name}: {width}x{height} -> {enhanced.width}x{enhanced.height}", flush=True)

    if args.dry_run:
        print("Dry run complete.")
        return

    print(f"Processed images: {processed}")
    print(f"Resized images: {resized}")
    print(f"Skipped large images: {skipped_large}")
    if args.backup:
        print(f"Backup folder: {backup_dir}")


if __name__ == "__main__":
    main()
