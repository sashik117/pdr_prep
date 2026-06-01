#!/usr/bin/env python3
"""
Скрипт для заміни watermark "vodiy.ua" на "DRIVEPREP" на фотках ПДР.
Назви файлів і порядок зберігаються повністю.

Використання:
  python3 remove_watermark.py --input ./photos --output ./photos_clean
  python3 remove_watermark.py --input ./photos --output ./photos_clean --inplace
  python3 remove_watermark.py --test one_photo.jpg
"""

import cv2
import numpy as np
from PIL import Image, ImageDraw, ImageFont
import argparse
import os
import sys
from pathlib import Path

# ─── Налаштування ────────────────────────────────────────────────────────────
WM_HEIGHT     = 60
WM_WIDTH      = 180
WHITE_THRESH  = 170
DILATE_ITER   = 2
INPAINT_R     = 5

NEW_TEXT      = "DRIVEPREP"
FONT_SIZE     = 17
TEXT_X        = 6
TEXT_Y        = 8
TEXT_ALPHA    = 140   # 0=прозорий, 255=повністю видно

JPEG_QUALITY  = 95
SUPPORTED     = {".jpg", ".jpeg", ".png", ".webp", ".bmp"}
# ─────────────────────────────────────────────────────────────────────────────


def load_font(size):
    """Завантажує шрифт — спочатку шукає Arial/жирні шрифти, fallback на default."""
    candidates = [
        # Windows
        "C:/Windows/Fonts/arialbd.ttf",   # Arial Bold
        "C:/Windows/Fonts/arial.ttf",
        "C:/Windows/Fonts/calibrib.ttf",  # Calibri Bold
        "C:/Windows/Fonts/verdanab.ttf",  # Verdana Bold
        # Mac
        "/System/Library/Fonts/Helvetica.ttc",
        "/Library/Fonts/Arial Bold.ttf",
        # Linux
        "/usr/share/fonts/truetype/google-fonts/Poppins-Bold.ttf",
        "/usr/share/fonts/truetype/liberation/LiberationSans-Bold.ttf",
        "/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf",
    ]
    for path in candidates:
        if os.path.exists(path):
            try:
                return ImageFont.truetype(path, size)
            except Exception:
                continue
    # Якщо нічого не знайдено — PIL default (без розміру)
    return ImageFont.load_default()


def process_image(img_cv):
    h, w = img_cv.shape[:2]

    # Крок 1: прибираємо старий watermark через inpainting
    zone_h = min(WM_HEIGHT, h)
    zone_w = min(WM_WIDTH, w)
    region_rgb = cv2.cvtColor(img_cv[:zone_h, :zone_w], cv2.COLOR_BGR2RGB)
    white_mask = np.all(region_rgb > WHITE_THRESH, axis=2).astype(np.uint8) * 255
    kernel = np.ones((4, 4), np.uint8)
    dilated = cv2.dilate(white_mask, kernel, iterations=DILATE_ITER)
    full_mask = np.zeros((h, w), dtype=np.uint8)
    full_mask[:zone_h, :zone_w] = dilated
    cleaned = cv2.inpaint(img_cv, full_mask, inpaintRadius=INPAINT_R, flags=cv2.INPAINT_TELEA)

    # Крок 2: додаємо DRIVEPREP напівпрозорим білим
    img_pil = Image.fromarray(cv2.cvtColor(cleaned, cv2.COLOR_BGR2RGB)).convert("RGBA")
    txt_layer = Image.new("RGBA", img_pil.size, (0, 0, 0, 0))
    draw = ImageDraw.Draw(txt_layer)
    font = load_font(FONT_SIZE)
    draw.text((TEXT_X, TEXT_Y), NEW_TEXT, font=font, fill=(255, 255, 255, TEXT_ALPHA))
    combined = Image.alpha_composite(img_pil, txt_layer).convert("RGB")

    return cv2.cvtColor(np.array(combined), cv2.COLOR_RGB2BGR)


def save_image(img_cv, path):
    ext = path.suffix.lower()
    if ext in {".jpg", ".jpeg"}:
        cv2.imwrite(str(path), img_cv, [cv2.IMWRITE_JPEG_QUALITY, JPEG_QUALITY])
    elif ext == ".png":
        cv2.imwrite(str(path), img_cv, [cv2.IMWRITE_PNG_COMPRESSION, 9])
    else:
        cv2.imwrite(str(path), img_cv)


def process_folder(input_dir, output_dir, inplace=False):
    input_path = Path(input_dir)

    if not input_path.exists():
        print(f"❌ Папка не існує: {input_dir}")
        sys.exit(1)

    # Сортуємо за назвою — порядок стабільний і передбачуваний
    files = sorted(
        [f for f in input_path.iterdir() if f.suffix.lower() in SUPPORTED],
        key=lambda f: f.name
    )

    if not files:
        print(f"⚠️  У папці '{input_dir}' не знайдено фоток ({', '.join(SUPPORTED)})")
        sys.exit(0)

    if not inplace:
        out_path = Path(output_dir)
        out_path.mkdir(parents=True, exist_ok=True)

    ok, errors = 0, 0
    total = len(files)

    print(f"🔍 Знайдено фоток: {total}")
    print(f"📁 {'Перезапис оригіналів (--inplace)' if inplace else f'Збереження в: {output_dir}'}")
    print("-" * 50)

    for i, file in enumerate(files, 1):
        try:
            img = cv2.imread(str(file))
            if img is None:
                raise ValueError("Не вдалося відкрити файл")

            result = process_image(img)

            # Та ж сама назва файлу
            save_path = file if inplace else Path(output_dir) / file.name
            save_image(result, save_path)

            print(f"[{i:3d}/{total}] ✅  {file.name}")
            ok += 1

        except Exception as e:
            print(f"[{i:3d}/{total}] ❌  {file.name} — {e}")
            errors += 1

    print("-" * 50)
    print(f"✅ Готово: {ok}/{total}  |  ❌ Помилок: {errors}")


def main():
    parser = argparse.ArgumentParser(description="Заміна watermark vodiy.ua → DRIVEPREP")
    parser.add_argument("--input",   required=False, help="Папка з оригінальними фотками")
    parser.add_argument("--output",  default="./photos_clean", help="Папка для результатів (default: ./photos_clean)")
    parser.add_argument("--inplace", action="store_true", help="Перезаписати оригінали (без копії!)")
    parser.add_argument("--test",    metavar="FILE", help="Обробити одну фотку для перевірки")
    args = parser.parse_args()

    if args.test:
        file = Path(args.test)
        img = cv2.imread(str(file))
        if img is None:
            print(f"❌ Не вдалося відкрити: {args.test}")
            sys.exit(1)
        result = process_image(img)
        out_file = file.parent / (file.stem + "_driveprep" + file.suffix)
        save_image(result, out_file)
        print(f"✅ Збережено: {out_file}")
        return

    if not args.input:
        parser.print_help()
        sys.exit(1)

    if args.inplace:
        confirm = input("⚠️  --inplace перезапише оригінали! Продовжити? [y/N]: ")
        if confirm.lower() != "y":
            print("Скасовано.")
            sys.exit(0)

    process_folder(args.input, args.output, args.inplace)


if __name__ == "__main__":
    main()