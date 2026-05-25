from __future__ import annotations

import os
import re
from pathlib import Path
from urllib.parse import urljoin, urlparse

import psycopg
import requests
from bs4 import BeautifulSoup, Comment, Tag
from dotenv import load_dotenv
from psycopg.rows import dict_row


BASE_DIR = Path(__file__).resolve().parents[1]
UPLOAD_ROOT = BASE_DIR / "uploads" / "handbook" / "vodiy"

SECTIONS = [
    {
        "chapter": 33,
        "slug": "rules-33",
        "title": "33. Дорожні знаки",
        "description": "Офіційні групи дорожніх знаків із короткими поясненнями та зображеннями біля кожного номера.",
        "source_url": "https://vodiy.ua/pdr/33/",
    },
    {
        "chapter": 34,
        "slug": "rules-34",
        "title": "34. Дорожня розмітка",
        "description": "Горизонтальна та вертикальна розмітка з поясненнями, кольорами й прикладами позначень.",
        "source_url": "https://vodiy.ua/pdr/34/",
    },
]


def normalize_text(value: object) -> str:
    return re.sub(r"\s+", " ", str(value or "").replace("\xa0", " ")).strip()


def make_session() -> requests.Session:
    session = requests.Session()
    session.headers.update(
        {
            "User-Agent": "DrivePrep Content Importer/1.0",
            "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
            "Accept-Language": "uk-UA,uk;q=0.9,en;q=0.8",
        }
    )
    return session


def classify_image(src: str, title: str = "", alt: str = "") -> str:
    signature = f"{src} {title} {alt}".casefold()
    if "/uploads/signs/" in signature or "sign_" in signature or "/znaky/" in signature:
        return "sign"
    if "/uploads/marking/" in signature or "marking_" in signature or "/rozmitka/" in signature or "розмітка" in signature:
        return "marking"
    return "illustration"


def number_token(value: str, fallback: str) -> str:
    match = re.search(r"\d+(?:[._-]\d+)*", value or "")
    if not match:
        return fallback
    return match.group(0).replace(".", "_").replace("-", "_")


def asset_name(src: str, kind: str, title: str = "", alt: str = "") -> str:
    parsed = urlparse(src)
    ext = Path(parsed.path).suffix.lower()
    if ext not in {".png", ".jpg", ".jpeg", ".webp", ".svg"}:
        ext = ".png"

    stem_source = " ".join([title, alt, Path(parsed.path).stem])
    if kind == "sign":
        return f"sign_{number_token(stem_source, Path(parsed.path).stem)}{ext}"
    if kind == "marking":
        return f"marking_{number_token(stem_source, Path(parsed.path).stem)}{ext}"
    safe_stem = re.sub(r"[^a-zA-Z0-9_-]+", "_", Path(parsed.path).stem).strip("_") or "image"
    return f"vodiy_{safe_stem}{ext}"


def download_asset(session: requests.Session, src: str, kind: str, title: str = "", alt: str = "") -> str:
    absolute_url = urljoin("https://vodiy.ua", src)
    folder = UPLOAD_ROOT / ("signs" if kind == "sign" else "marking" if kind == "marking" else "media")
    folder.mkdir(parents=True, exist_ok=True)
    file_name = asset_name(absolute_url, kind, title, alt)
    path = folder / file_name

    if not path.exists() or path.stat().st_size == 0:
        response = session.get(absolute_url, timeout=30)
        response.raise_for_status()
        path.write_bytes(response.content)

    relative = path.relative_to(BASE_DIR / "uploads").as_posix()
    return f"/uploads/{relative}"


def clean_fragment(node: Tag, session: requests.Session, image_paths: list[str], seen_assets: set[str]) -> None:
    for comment in node.find_all(string=lambda value: isinstance(value, Comment)):
        comment.extract()

    for bad in node.select("script, style, noscript, iframe, form, button"):
        bad.decompose()

    for tag in node.find_all(True):
        if tag.name == "img":
            raw_src = normalize_text(tag.get("src") or tag.get("data-src") or tag.get("data-lazy-src"))
            if not raw_src:
                tag.decompose()
                continue
            kind = classify_image(raw_src, normalize_text(tag.get("title")), normalize_text(tag.get("alt")))
            local_url = download_asset(
                session,
                raw_src,
                kind,
                normalize_text(tag.get("title")),
                normalize_text(tag.get("alt")),
            )
            tag["src"] = local_url
            tag["data-media-kind"] = kind
            tag["loading"] = "lazy"
            tag["decoding"] = "async"
            tag["alt"] = normalize_text(tag.get("alt")) or ("Дорожній знак" if kind == "sign" else "Дорожня розмітка")
            for attr in ("width", "height", "style", "class", "color", "bgcolor", "align"):
                tag.attrs.pop(attr, None)
            if local_url not in seen_assets:
                seen_assets.add(local_url)
                image_paths.append(local_url)
            continue

        if tag.name == "a":
            href = normalize_text(tag.get("href"))
            if href:
                tag["href"] = href
            for attr in ("style", "class", "target", "rel", "onclick"):
                tag.attrs.pop(attr, None)
            continue

        for attr in ("style", "class", "width", "height", "color", "bgcolor", "align", "onclick"):
            tag.attrs.pop(attr, None)

    for paragraph in list(node.find_all(["p", "div"])):
        if not normalize_text(paragraph.get_text(" ", strip=True)) and not paragraph.find("img"):
            paragraph.decompose()


def first_heading(body: Tag) -> tuple[str, Tag | None]:
    for child in body.find_all(["p", "h2", "h3", "h4"], recursive=False):
        text = normalize_text(child.get_text(" ", strip=True)).rstrip(".")
        if not text:
            continue
        if len(text) <= 90:
            return text, child
        return "", None
    return "", None


def extract_content(session: requests.Session, section: dict[str, object]) -> tuple[str, str, list[str]]:
    response = session.get(str(section["source_url"]), timeout=30)
    response.raise_for_status()
    response.encoding = "utf-8"
    soup = BeautifulSoup(response.text, "html.parser")
    elems = soup.select_one("#elems")
    if not elems:
        raise RuntimeError(f"Не знайшов основний блок #elems на {section['source_url']}")

    out = BeautifulSoup("", "html.parser")
    wrapper = out.new_tag("div")
    wrapper["data-source"] = "vodiy-pdr"
    out.append(wrapper)

    image_paths: list[str] = []
    seen_assets: set[str] = set()

    intro = out.new_tag("p")
    intro.string = (
        "Матеріал зібрано у зручному форматі: зображення залишені поруч із номером знака або розмітки, "
        "щоб ви могли швидко звіряти позначення під час читання."
    )
    wrapper.append(intro)

    for block in elems.find_all("div", class_="text_box", recursive=False):
        number = normalize_text(block.select_one(".number").get_text(" ", strip=True) if block.select_one(".number") else "")
        spans = block.find_all("span", recursive=False)
        payload = spans[-1] if spans else block
        body = payload.find("body") or payload

        fragment = BeautifulSoup(str(body), "html.parser")
        content_root = fragment.body or fragment
        clean_fragment(content_root, session, image_paths, seen_assets)

        heading, heading_node = first_heading(content_root)
        if heading_node and heading:
            heading_node.decompose()

        section_node = out.new_tag("section")
        section_node["data-vodiy-block"] = "true"
        title = out.new_tag("h3")
        title.string = f"{number}. {heading}".strip() if heading else number
        section_node.append(title)

        for child in list(content_root.contents):
            if isinstance(child, str) and not child.strip():
                continue
            child_fragment = BeautifulSoup(str(child), "html.parser")
            for parsed_child in list(child_fragment.contents):
                section_node.append(parsed_child)

        wrapper.append(section_node)

    html = str(wrapper)
    text = normalize_text(BeautifulSoup(html, "html.parser").get_text(" ", strip=True))
    return html, text, image_paths


def ensure_rules_topic(conn) -> int:
    category_id = conn.execute(
        """
        INSERT INTO theory_categories (slug, title, description, sort_order)
        VALUES ('rules', 'Правила дорожнього руху', 'Офіційні правила з поясненнями, ілюстраціями та зручними розділами.', 1)
        ON CONFLICT (slug) DO UPDATE
        SET title = EXCLUDED.title,
            description = EXCLUDED.description,
            sort_order = EXCLUDED.sort_order
        RETURNING id
        """
    ).fetchone()["id"]

    topic_id = conn.execute(
        """
        INSERT INTO theory_topics (category_id, slug, title, description, topic_type, sort_order, source_url)
        VALUES (%s, 'rules', 'Правила дорожнього руху', 'ПДР за розділами з адаптованою навігацією та локальними ілюстраціями.', 'topic', 1, 'https://vodiy.ua/pdr/')
        ON CONFLICT (slug) DO UPDATE
        SET category_id = EXCLUDED.category_id,
            title = EXCLUDED.title,
            description = EXCLUDED.description,
            topic_type = EXCLUDED.topic_type,
            sort_order = EXCLUDED.sort_order,
            source_url = EXCLUDED.source_url
        RETURNING id
        """,
        (category_id,),
    ).fetchone()["id"]
    return int(topic_id)


def upsert_theory_section(
    conn,
    topic_id: int,
    section: dict[str, object],
    content_html: str,
    content_text: str,
    image_paths: list[str],
) -> int:
    row = conn.execute(
        """
        INSERT INTO theory_sections (
            topic_id, slug, title, description, comment_html, content_html, content_text,
            video_url, embed_url, chapter_num, sort_order, source_url
        )
        VALUES (%s, %s, %s, %s, NULL, %s, %s, NULL, NULL, %s, %s, %s)
        ON CONFLICT (slug) DO UPDATE
        SET topic_id = EXCLUDED.topic_id,
            title = EXCLUDED.title,
            description = EXCLUDED.description,
            content_html = EXCLUDED.content_html,
            content_text = EXCLUDED.content_text,
            chapter_num = EXCLUDED.chapter_num,
            sort_order = EXCLUDED.sort_order,
            source_url = EXCLUDED.source_url
        RETURNING id
        """,
        (
            topic_id,
            section["slug"],
            section["title"],
            section["description"],
            content_html,
            content_text,
            section["chapter"],
            section["chapter"],
            section["source_url"],
        ),
    ).fetchone()
    section_id = int(row["id"])

    conn.execute("DELETE FROM theory_assets WHERE section_id = %s", (section_id,))
    for index, asset_url in enumerate(image_paths, start=1):
        conn.execute(
            """
            INSERT INTO theory_assets (section_id, asset_type, asset_url, alt_text, caption, sort_order)
            VALUES (%s, 'image', %s, %s, NULL, %s)
            """,
            (section_id, asset_url, section["title"], index),
        )
    return section_id


def update_question_links(conn, chapter: int, section_id: int, slug: str) -> int:
    result = conn.execute(
        """
        UPDATE questions
        SET theory_section_id = %s,
            source_rule_slug = %s
        WHERE NULLIF(SUBSTRING(TRIM(COALESCE(section::text, '')) FROM '^\\d+'), '')::INT = %s
        """,
        (section_id, slug, chapter),
    )
    return int(result.rowcount or 0)


def refresh_all_rule_question_links(conn) -> int:
    result = conn.execute(
        """
        UPDATE questions q
        SET theory_section_id = s.id,
            source_rule_slug = s.slug
        FROM theory_sections s
        JOIN theory_topics t ON t.id = s.topic_id
        WHERE t.slug = 'rules'
          AND s.chapter_num IS NOT NULL
          AND NULLIF(SUBSTRING(TRIM(COALESCE(q.section::text, '')) FROM '^\\d+'), '')::INT = s.chapter_num
        """
    )
    return int(result.rowcount or 0)


def remove_legacy_sign_subsections(conn, topic_id: int) -> int:
    legacy_rows = conn.execute(
        """
        SELECT id
        FROM theory_sections
        WHERE topic_id = %s
          AND chapter_num > 34
          AND (
            source_url ILIKE '%%green-way.com.ua/%%/pdr/rozdil-35%%'
            OR title ILIKE '%%Знаки пріоритету%%'
          )
        """,
        (topic_id,),
    ).fetchall()
    legacy_ids = [int(row["id"]) for row in legacy_rows]
    if not legacy_ids:
        return 0

    conn.execute(
        """
        UPDATE questions
        SET theory_section_id = NULL,
            source_rule_slug = NULL
        WHERE theory_section_id = ANY(%s)
        """,
        (legacy_ids,),
    )
    conn.execute("DELETE FROM theory_assets WHERE section_id = ANY(%s)", (legacy_ids,))
    conn.execute("DELETE FROM theory_sections WHERE id = ANY(%s)", (legacy_ids,))
    return len(legacy_ids)


def remove_partial_handbook_rows(conn) -> None:
    conn.execute(
        """
        DELETE FROM handbook_data
        WHERE source_slug = ANY(%s)
           OR source_url = ANY(%s)
        """,
        (
            [str(section["slug"]) for section in SECTIONS],
            [str(section["source_url"]) for section in SECTIONS],
        ),
    )


def main() -> None:
    load_dotenv(BASE_DIR / ".env")
    db_url = os.environ["DATABASE_URL"]
    UPLOAD_ROOT.mkdir(parents=True, exist_ok=True)
    session = make_session()

    imported: list[tuple[int, str, int, int]] = []
    with psycopg.connect(db_url, row_factory=dict_row) as conn:
        topic_id = ensure_rules_topic(conn)
        remove_partial_handbook_rows(conn)
        for section in SECTIONS:
            content_html, content_text, image_paths = extract_content(session, section)
            section_id = upsert_theory_section(conn, topic_id, section, content_html, content_text, image_paths)
            question_count = update_question_links(conn, int(section["chapter"]), section_id, str(section["slug"]))
            imported.append((int(section["chapter"]), str(section["title"]), len(image_paths), question_count))

        removed = remove_legacy_sign_subsections(conn, topic_id)
        refreshed = refresh_all_rule_question_links(conn)
        conn.commit()

    for chapter, title, assets, question_count in imported:
        print(f"{chapter}: {title} — {assets} зображень, {question_count} питань прив'язано")
    print(f"Оновлено прив'язки питань до розділів ПДР: {refreshed}")
    if removed:
        print(f"Прибрано застарілих дубльованих підрозділів знаків: {removed}")


if __name__ == "__main__":
    main()
