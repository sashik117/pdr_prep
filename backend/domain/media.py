from __future__ import annotations

import re
from pathlib import Path
from typing import Any

_MEDIA_TAG_RE = re.compile(r"""<(?:img|source)\b[^>]*(?:src|srcset)=["']([^"']+)["'][^>]*>\s*(?:<br\s*/?>)?""", re.IGNORECASE)
_PLACEHOLDER_URL = "/uploads/handbook/placeholder.png"


def local_asset_exists(asset_url: Any, *, public_images_dir: Path, uploads_dir: Path) -> bool:
    url = str(asset_url or "").strip()
    if not url:
        return False
    if url.startswith(("http://", "https://", "data:")):
        return True

    clean_url = url.split("?", 1)[0]
    if clean_url.startswith("/images/"):
        return (public_images_dir / clean_url.removeprefix("/images/")).exists()
    if clean_url.startswith("/uploads/"):
        return (uploads_dir / clean_url.removeprefix("/uploads/")).exists()
    return True


def filter_available_assets(
    assets: list[dict[str, Any]],
    *,
    public_images_dir: Path,
    uploads_dir: Path,
) -> list[dict[str, Any]]:
    available: list[dict[str, Any]] = []
    for asset in assets:
        asset_url = str(asset.get("asset_url") or "").strip()
        if not local_asset_exists(asset_url, public_images_dir=public_images_dir, uploads_dir=uploads_dir):
            continue
        available.append({**asset, "asset_url": asset_url})
    return available


def remove_unavailable_media_tags(
    html: Any,
    *,
    public_images_dir: Path,
    uploads_dir: Path,
) -> str | None:
    if html is None:
        return None
    content = str(html)

    def replace(match: re.Match[str]) -> str:
        tag = match.group(0)
        url = match.group(1)
        if local_asset_exists(url, public_images_dir=public_images_dir, uploads_dir=uploads_dir):
            return tag
        if local_asset_exists(_PLACEHOLDER_URL, public_images_dir=public_images_dir, uploads_dir=uploads_dir):
            return tag.replace(url, _PLACEHOLDER_URL, 1)
        return ""

    return _MEDIA_TAG_RE.sub(replace, content)
