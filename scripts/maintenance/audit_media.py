from __future__ import annotations

import json
import re
import subprocess
import sys
from pathlib import Path
from typing import Any

ROOT = Path(__file__).resolve().parents[2]
HTML_REF_RE = re.compile(r"""(?:src|href)=["']([^"']+)["']""", re.IGNORECASE)


def load_json(path: Path) -> Any:
    return json.loads(path.read_text(encoding="utf-8"))


def local_path_from_url(url: str) -> Path | None:
    clean = str(url or "").strip().split("?", 1)[0]
    if not clean or clean.startswith(("http://", "https://", "data:")):
        return None
    if clean.startswith("/images/"):
        return ROOT / "backend/public/images" / clean.removeprefix("/images/")
    if clean.startswith("/uploads/"):
        return ROOT / "backend/uploads" / clean.removeprefix("/uploads/")
    return None


def collect_refs() -> list[tuple[str, str, Path]]:
    refs: list[tuple[str, str, Path]] = []

    seed_path = ROOT / "backend/data/theory/theory_seed.json"
    if seed_path.exists():
        seed = load_json(seed_path)
        for asset in seed.get("assets", []):
            url = str(asset.get("asset_url") or "")
            path = local_path_from_url(url)
            if path:
                refs.append(("theory_seed.assets", url, path))
        for section in seed.get("sections", []):
            slug = section.get("slug") or section.get("id") or "section"
            for field in ("content_html", "comment_html"):
                html = str(section.get(field) or "")
                for url in HTML_REF_RE.findall(html):
                    path = local_path_from_url(url)
                    if path:
                        refs.append((f"theory_seed.{slug}.{field}", url, path))

    map_paths = list((ROOT / "backend/uploads/maps").glob("*.json"))
    handbook_map = ROOT / "backend/uploads/handbook/rules_media_map.json"
    if handbook_map.exists():
        map_paths.append(handbook_map)

    def walk_map(source: str, value: Any) -> None:
        if isinstance(value, dict):
            for key, item in value.items():
                if key in {"asset_url", "asset_urls"}:
                    values = item if isinstance(item, list) else [item]
                    for url in values:
                        path = local_path_from_url(str(url))
                        if path:
                            refs.append((source, str(url), path))
                else:
                    walk_map(source, item)
        elif isinstance(value, list):
            for item in value:
                walk_map(source, item)

    for map_path in map_paths:
        walk_map(str(map_path.relative_to(ROOT)), load_json(map_path))

    questions_dir = ROOT / "backend/data/questions"
    for question_path in questions_dir.glob("pdr_final*.json"):
        data = load_json(question_path)
        if not isinstance(data, list):
            continue
        for question in data:
            images = question.get("????????") or question.get("images") or []
            if isinstance(images, str):
                images = [images]
            for image in images:
                name = Path(str(image).strip().split("?", 1)[0]).name
                if name:
                    refs.append((str(question_path.relative_to(ROOT)), str(image), ROOT / "frontend/public/images/questions_img" / name))
    return refs


def docker_context_covers_upload(path: Path) -> bool:
    rel = path.relative_to(ROOT).as_posix()
    name = path.name
    if rel.startswith("backend/uploads/theory/"):
        return True
    if rel.startswith("backend/uploads/maps/"):
        return True
    if rel.startswith("backend/uploads/handbook/vodiy/"):
        return True
    if rel == "backend/uploads/handbook/rules_media_map.json":
        return True
    if rel == "backend/uploads/handbook/placeholder.png":
        return True
    if rel.startswith("backend/uploads/handbook/") and name.startswith("sign_") and name.lower().endswith((".svg", ".png")):
        return True
    if rel.startswith("backend/uploads/handbook/") and name.startswith("marking_") and name.lower().endswith(".png"):
        return True
    if rel.startswith("backend/uploads/handbook/") and name.startswith("section_") and name.lower().endswith((".jpg", ".jpeg", ".png", ".gif", ".svg")):
        return True
    return False


def git_tracked_paths() -> set[str]:
    try:
        output = subprocess.check_output(["git", "ls-files"], cwd=ROOT, text=True)
    except Exception:
        return set()
    return {Path(line).as_posix() for line in output.splitlines() if line.strip()}


def main() -> int:
    refs = collect_refs()
    missing = [(source, url, path) for source, url, path in refs if not path.exists()]
    print(f"media refs checked={len(refs)} missing={len(missing)}")
    for source, url, path in missing[:100]:
        print(f"MISSING	{source}	{url}	{path}")
    if len(missing) > 100:
        print(f"... and {len(missing) - 100} more")

    uploads = {path for _, _, path in refs if "backend" in path.parts and "uploads" in path.parts and path.exists()}
    size_mb = sum(path.stat().st_size for path in uploads) / 1024 / 1024
    tracked = git_tracked_paths()
    not_tracked = [path for path in uploads if path.relative_to(ROOT).as_posix() not in tracked]
    docker_not_covered = [path for path in uploads if not docker_context_covers_upload(path)]
    print(f"upload media files={len(uploads)} size_mb={size_mb:.2f} not_tracked={len(not_tracked)} docker_not_covered={len(docker_not_covered)}")
    if not_tracked:
        print("note: bulky upload media is intentionally not fully tracked; Docker context must include required backend/uploads media")
    for path in docker_not_covered[:100]:
        print(f"DOCKER_NOT_COVERED\t{path}")
    if len(docker_not_covered) > 100:
        print(f"... and {len(docker_not_covered) - 100} more")
    return 1 if missing or docker_not_covered else 0


if __name__ == "__main__":
    raise SystemExit(main())
