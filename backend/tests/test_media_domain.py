from __future__ import annotations

from pathlib import Path

from domain.media import filter_available_assets, local_asset_exists, remove_unavailable_media_tags


def test_local_asset_exists_resolves_uploads_and_images(tmp_path: Path) -> None:
    public_images = tmp_path / "public" / "images"
    uploads = tmp_path / "uploads"
    (public_images / "theory").mkdir(parents=True)
    (uploads / "theory").mkdir(parents=True)
    (public_images / "theory" / "sign.png").write_text("ok", encoding="utf-8")
    (uploads / "theory" / "lecture.jpg").write_text("ok", encoding="utf-8")

    assert local_asset_exists("/images/theory/sign.png", public_images_dir=public_images, uploads_dir=uploads)
    assert local_asset_exists("/uploads/theory/lecture.jpg?cache=1", public_images_dir=public_images, uploads_dir=uploads)
    assert not local_asset_exists("/uploads/theory/missing.jpg", public_images_dir=public_images, uploads_dir=uploads)
    assert local_asset_exists("https://example.com/image.jpg", public_images_dir=public_images, uploads_dir=uploads)


def test_filter_available_assets_trims_and_drops_missing_files(tmp_path: Path) -> None:
    public_images = tmp_path / "public" / "images"
    uploads = tmp_path / "uploads"
    (uploads / "theory").mkdir(parents=True)
    (uploads / "theory" / "ok.jpg").write_text("ok", encoding="utf-8")

    assets = [
        {"asset_url": " /uploads/theory/ok.jpg ", "caption": "available"},
        {"asset_url": "/uploads/theory/missing.jpg", "caption": "missing"},
    ]

    filtered = filter_available_assets(assets, public_images_dir=public_images, uploads_dir=uploads)

    assert filtered == [{"asset_url": "/uploads/theory/ok.jpg", "caption": "available"}]


def test_remove_unavailable_media_tags_keeps_existing_and_removes_missing(tmp_path: Path) -> None:
    public_images = tmp_path / "public" / "images"
    uploads = tmp_path / "uploads"
    (uploads / "theory").mkdir(parents=True)
    (uploads / "theory" / "ok.jpg").write_text("ok", encoding="utf-8")

    html = (
        '<p>before</p><img src="/uploads/theory/missing.jpg"><br>'
        '<img src="/uploads/theory/ok.jpg"><p>after</p>'
    )

    cleaned = remove_unavailable_media_tags(html, public_images_dir=public_images, uploads_dir=uploads)

    assert "/uploads/theory/missing.jpg" not in cleaned
    assert "/uploads/theory/ok.jpg" in cleaned
    assert "<p>before</p>" in cleaned
    assert "<p>after</p>" in cleaned
