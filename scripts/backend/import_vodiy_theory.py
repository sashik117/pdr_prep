#!/usr/bin/env python3
from __future__ import annotations

import argparse
import json
import os
import re
import time
from dataclasses import dataclass
from datetime import datetime
from pathlib import Path
from typing import Any
from urllib.parse import urljoin, urlparse

import psycopg
import requests
from bs4 import BeautifulSoup, Comment, Tag
from dotenv import load_dotenv
from psycopg import sql
from psycopg.rows import dict_row


BASE_URL = "https://vodiy.ua"
PROJECT_ROOT = Path(__file__).resolve().parents[2]
BASE_DIR = PROJECT_ROOT / "backend"
PUBLIC_IMAGES_ROOT = BASE_DIR / "public" / "images" / "theory"
THEORY_SEED_FILE = BASE_DIR / "data" / "theory" / "theory_seed.json"

SIGN_CATEGORIES = [
    (1, "Попереджувальні знаки"),
    (2, "Знаки пріоритету"),
    (3, "Заборонні знаки"),
    (4, "Наказові знаки"),
    (5, "Інформаційно-вказівні знаки"),
    (6, "Знаки сервісу"),
    (7, "Таблички до дорожніх знаків"),
]

MARKING_CATEGORIES = [
    (1, "Горизонтальна розмітка"),
    (2, "Вертикальна розмітка"),
]


@dataclass(frozen=True)
class ChapterLink:
    href: str
    title: str
    chapter_id: int


@dataclass
class ParsedSection:
    slug: str
    title: str
    description: str
    content_html: str
    content_text: str
    images: list[str]
    sort_order: int
    source_url: str
    chapter_num: int | None = None


def normalize_text(value: object) -> str:
    return re.sub(r"\s+", " ", str(value or "").replace("\xa0", " ")).strip()


def slugify(value: object, fallback: str = "item") -> str:
    raw = normalize_text(value).lower()
    raw = raw.replace("№", "n")
    raw = re.sub(r"[^a-z0-9а-яіїєґ._-]+", "-", raw, flags=re.IGNORECASE).strip("-")
    return raw or fallback


def make_session() -> requests.Session:
    session = requests.Session()
    session.headers.update(
        {
            "User-Agent": "DrivePrep Theory Importer/2.0 (+https://driveprep-pdr.onrender.com)",
            "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8",
            "Accept-Language": "uk-UA,uk;q=0.9,en-US;q=0.8,en;q=0.7",
        }
    )
    return session


def parse_range_list(value: str | None) -> set[int] | None:
    if not value:
        return None
    result: set[int] = set()
    for part in value.split(","):
        token = part.strip()
        if not token:
            continue
        if "-" in token:
            left, right = token.split("-", 1)
            result.update(range(int(left), int(right) + 1))
        else:
            result.add(int(token))
    return result


def fetch_page(session: requests.Session, url: str, retries: int = 3) -> str:
    last_error: Exception | None = None
    for attempt in range(1, retries + 1):
        try:
            response = session.get(url, timeout=30)
            response.raise_for_status()
            response.encoding = "utf-8"
            return response.text
        except Exception as error:  # noqa: BLE001 - parser should retry any network/parser edge.
            last_error = error
            print(f"  Спроба {attempt}/{retries} не вдалася для {url}: {error}", flush=True)
            if attempt < retries:
                time.sleep(1.2 * attempt)
    raise RuntimeError(f"Не вдалося завантажити {url}") from last_error


def ensure_image_dirs() -> None:
    for name in ("signs", "marking", "questions", "pdr", "media"):
        (PUBLIC_IMAGES_ROOT / name).mkdir(parents=True, exist_ok=True)


def local_image_folder(url_path: str) -> str:
    lower = url_path.lower()
    if "/uploads/signs/" in lower or "/znaky/" in lower:
        return "signs"
    if "/uploads/marking/" in lower or "/rozmitka/" in lower:
        return "marking"
    if "/questions/pdr/" in lower:
        return "pdr"
    if "/questions/" in lower:
        return "questions"
    return "media"


def image_extension(path_value: str) -> str:
    suffix = Path(urlparse(path_value).path).suffix.lower()
    return suffix if suffix in {".png", ".jpg", ".jpeg", ".webp", ".svg", ".gif"} else ".png"


def safe_image_name(src: str, fallback: str = "image") -> str:
    parsed = urlparse(src)
    stem = Path(parsed.path).stem or fallback
    stem = stem.replace(".", "_")
    stem = re.sub(r"[^a-zA-Z0-9а-яА-ЯіїєґІЇЄҐ_-]+", "_", stem).strip("_") or fallback
    return f"{stem}{image_extension(src)}"


def download_image(
    session: requests.Session,
    image_url: str,
    *,
    folder: str | None = None,
    fallback_name: str = "image",
) -> str:
    src = normalize_text(image_url)
    if not src:
        return ""
    if src.startswith("data:"):
        return src

    absolute_url = src if src.startswith("http") else urljoin(BASE_URL, src)
    parsed = urlparse(absolute_url)
    if not parsed.path:
        return src

    target_folder = folder or local_image_folder(parsed.path)
    file_name = safe_image_name(absolute_url, fallback_name)
    target_dir = PUBLIC_IMAGES_ROOT / target_folder
    target_dir.mkdir(parents=True, exist_ok=True)
    target_path = target_dir / file_name

    if not target_path.exists() or target_path.stat().st_size == 0:
        response = session.get(absolute_url, timeout=30)
        response.raise_for_status()
        target_path.write_bytes(response.content)

    return f"/images/theory/{target_folder}/{file_name}"


def media_kind(src: str, alt: str = "", title: str = "", preferred_folder: str | None = None) -> str:
    if preferred_folder == "signs":
        return "sign"
    if preferred_folder == "marking":
        return "marking"
    signature = f"{src} {alt} {title}".casefold()
    if "/images/theory/signs/" in signature or "/signs/" in signature or "/znaky/" in signature or "sign" in signature or "знак" in signature:
        return "sign"
    if "/images/theory/marking/" in signature or "/marking/" in signature or "/rozmitka/" in signature or "marking" in signature or "розміт" in signature:
        return "marking"
    return "illustration"


def convert_href(href: str) -> str:
    value = normalize_text(href)
    if not value or value == "#":
        return ""

    absolute = urljoin(BASE_URL, value)
    parsed = urlparse(absolute)
    path = parsed.path.rstrip("/") + ("/" if parsed.path.endswith("/") else "")
    fragment = f"#{parsed.fragment}" if parsed.fragment else ""

    pdr_match = re.search(r"/pdr/(\d+)/?", path)
    if pdr_match:
        return f"/study/rules/{pdr_match.group(1)}{fragment}"

    sign_match = re.search(r"/znaky/(\d+)(?:/[^/]*)?/?", path)
    if sign_match:
        return f"/study/road-signs/{sign_match.group(1)}"

    marking_match = re.search(r"/rozmitka/(\d+)(?:/[^/]*)?/?", path)
    if marking_match:
        return f"/study/road-markings/{marking_match.group(1)}"

    if parsed.netloc.endswith("vodiy.ua"):
        return absolute
    return value


def clean_fragment(
    node: Tag,
    session: requests.Session,
    images: list[str],
    seen: set[str],
    *,
    preferred_folder: str | None = None,
) -> None:
    for comment in node.find_all(string=lambda value: isinstance(value, Comment)):
        comment.extract()

    for bad in node.select("script, style, noscript, form, button, .button_comment"):
        bad.decompose()

    for tag in node.find_all(True):
        if tag.name == "img":
            src = normalize_text(tag.get("src") or tag.get("data-src") or tag.get("data-lazy-src"))
            if not src:
                tag.decompose()
                continue

            local_url = download_image(
                session,
                src,
                folder=preferred_folder,
                fallback_name=normalize_text(tag.get("alt") or tag.get("title")) or "theory-image",
            )
            kind = media_kind(local_url, normalize_text(tag.get("alt")), normalize_text(tag.get("title")), preferred_folder)
            tag["src"] = local_url
            tag["data-media-kind"] = kind
            tag["loading"] = "lazy"
            tag["decoding"] = "async"
            tag["alt"] = normalize_text(tag.get("alt")) or ("Дорожній знак" if kind == "sign" else "Ілюстрація до теорії")
            if local_url not in seen:
                seen.add(local_url)
                images.append(local_url)

        if tag.name == "a":
            href = convert_href(str(tag.get("href") or ""))
            if href:
                tag["href"] = href
                if href.startswith("http"):
                    tag["target"] = "_blank"
                    tag["rel"] = "noopener noreferrer"
            else:
                tag.unwrap()
                continue

        keep_attrs = {"href", "target", "rel", "src", "alt", "loading", "decoding", "data-media-kind", "id", "name"}
        for attr in list(tag.attrs):
            if attr not in keep_attrs:
                tag.attrs.pop(attr, None)

    for empty in list(node.find_all(["p", "div", "span"])):
        if empty.name == "span" and empty.find("img"):
            continue
        if not normalize_text(empty.get_text(" ", strip=True)) and not empty.find(["img", "iframe"]):
            empty.decompose()


def text_from_html(html: str) -> str:
    return normalize_text(BeautifulSoup(html or "", "html.parser").get_text(" ", strip=True))


def first_line_title(content_root: Tag) -> str:
    for child in content_root.find_all(["h2", "h3", "h4", "p"], recursive=False):
        text = normalize_text(child.get_text(" ", strip=True)).rstrip(".")
        if text and len(text) <= 120:
            return text
    return ""


def chapter_links(session: requests.Session) -> list[ChapterLink]:
    html = fetch_page(session, f"{BASE_URL}/pdr/")
    soup = BeautifulSoup(html, "html.parser")
    links: list[ChapterLink] = []
    seen: set[int] = set()

    candidates = soup.select(".switch_contetn_1 ol li a") or soup.select("a[href*='/pdr/']")
    for link in candidates:
        href = str(link.get("href") or "")
        match = re.search(r"/pdr/(\d+)/?", href)
        if not match:
            continue
        chapter_id = int(match.group(1))
        if chapter_id in seen:
            continue
        title = normalize_text(link.get_text(" ", strip=True))
        if not title:
            title = f"Розділ {chapter_id}"
        seen.add(chapter_id)
        links.append(ChapterLink(urljoin(BASE_URL, href), title, chapter_id))

    links.sort(key=lambda item: item.chapter_id)
    return links


def parse_chapter(session: requests.Session, chapter: ChapterLink) -> ParsedSection:
    print(f"Парсю ПДР {chapter.chapter_id}: {chapter.title}", flush=True)
    soup = BeautifulSoup(fetch_page(session, chapter.href), "html.parser")
    text_boxes = soup.select("#elems .text_box")
    if not text_boxes:
        raise RuntimeError(f"Не знайшов блоки #elems .text_box на {chapter.href}")

    out = BeautifulSoup("", "html.parser")
    wrapper = out.new_tag("div")
    wrapper["data-source"] = "vodiy-pdr"
    out.append(wrapper)

    images: list[str] = []
    seen: set[str] = set()

    for box in text_boxes:
        number_node = box.select_one(".number")
        number = normalize_text(number_node.get_text(" ", strip=True) if number_node else "")
        if not number:
            number = str(len(wrapper.find_all("section")) + 1)

        spans = box.find_all("span", recursive=False)
        payload = spans[-1] if spans else box
        fragment = BeautifulSoup(str(payload), "html.parser")
        root = fragment.body or fragment

        comment_html = ""
        comment_node = root.select_one(".collapse")
        if comment_node:
            comment_fragment = BeautifulSoup(str(comment_node), "html.parser")
            comment_root = comment_fragment.body or comment_fragment
            clean_fragment(comment_root, session, images, seen)
            comment_html = "".join(str(child) for child in comment_root.contents).strip()
            comment_node.decompose()

        clean_fragment(root, session, images, seen)
        heading = first_line_title(root)

        section_node = out.new_tag("section")
        section_node["data-vodiy-block"] = "true"
        section_node["id"] = slugify(number, f"section-{number}")

        h3 = out.new_tag("h3")
        h3.string = f"{number}. {heading}".strip() if heading and not heading.startswith(number) else number
        section_node.append(h3)

        for child in list(root.contents):
            if isinstance(child, str) and not child.strip():
                continue
            child_fragment = BeautifulSoup(str(child), "html.parser")
            for parsed_child in list(child_fragment.contents):
                section_node.append(parsed_child)

        if comment_html:
            details = out.new_tag("details")
            details["data-theory-comment"] = "true"
            summary = out.new_tag("summary")
            summary.string = "Пояснення до пункту"
            details.append(summary)
            details_fragment = BeautifulSoup(comment_html, "html.parser")
            for parsed_child in list((details_fragment.body or details_fragment).contents):
                details.append(parsed_child)
            section_node.append(details)

        wrapper.append(section_node)

    html = str(wrapper)
    return ParsedSection(
        slug=f"rules-{chapter.chapter_id}",
        title=chapter.title if chapter.title.startswith(str(chapter.chapter_id)) else f"{chapter.chapter_id}. {chapter.title}",
        description=f"Розділ {chapter.chapter_id}. {chapter.title}",
        content_html=html,
        content_text=text_from_html(html),
        images=images,
        sort_order=chapter.chapter_id,
        source_url=chapter.href,
        chapter_num=chapter.chapter_id,
    )


def parse_mark_list(soup: BeautifulSoup) -> list[dict[str, str]]:
    items: list[dict[str, str]] = []
    seen: set[str] = set()
    for element in soup.select(".mark-inside li a"):
        href = str(element.get("href") or "")
        match = re.match(r"^([\d.]+)\/?$", href.strip())
        if not match:
            continue
        code = match.group(1)
        if code in seen:
            continue
        seen.add(code)
        image = element.find("img")
        mark = element.find("mark")
        spans = element.find_all("span")
        text = normalize_text(spans[-1].get_text(" ", strip=True) if spans else element.get_text(" ", strip=True))
        mark_text = normalize_text(mark.get_text(" ", strip=True) if mark else "")
        items.append(
            {
                "code": code,
                "label": mark_text or code,
                "description": text,
                "href": href,
                "img": str(image.get("src") or "") if image else "",
            }
        )
    return items


def detail_content(
    session: requests.Session,
    url: str,
    images: list[str],
    seen: set[str],
    *,
    preferred_folder: str | None = None,
) -> str:
    try:
        soup = BeautifulSoup(fetch_page(session, url), "html.parser")
    except Exception as error:  # noqa: BLE001
        print(f"  Деталі не завантажились для {url}: {error}", flush=True)
        return ""

    block = soup.select_one(".mark_markpage_block") or soup.select_one("#elems") or soup.body
    if not block:
        return ""
    fragment = BeautifulSoup(str(block), "html.parser")
    root = fragment.body or fragment
    clean_fragment(root, session, images, seen, preferred_folder=preferred_folder)
    return "".join(str(child) for child in root.contents).strip()


def parse_sign_category(session: requests.Session, category_id: int, title: str) -> ParsedSection:
    url = f"{BASE_URL}/znaky/{category_id}/"
    print(f"Парсю дорожні знаки {category_id}: {title}", flush=True)
    soup = BeautifulSoup(fetch_page(session, url), "html.parser")
    signs = parse_mark_list(soup)

    out = BeautifulSoup("", "html.parser")
    wrapper = out.new_tag("div")
    wrapper["data-source"] = "vodiy-signs"
    out.append(wrapper)

    intro = out.new_tag("p")
    intro.string = "Знаки подано з коротким описом і зображенням поруч, щоб їх було зручно повторювати на телефоні та комп’ютері."
    wrapper.append(intro)

    images: list[str] = []
    seen: set[str] = set()
    for sign in signs:
        article = out.new_tag("section")
        article["data-vodiy-block"] = "true"
        article["id"] = f"sign-{slugify(sign['code'])}"

        h3 = out.new_tag("h3")
        h3.string = f"Знак {sign['code']}"
        article.append(h3)

        if sign["img"]:
            local = download_image(session, sign["img"], folder="signs", fallback_name=f"sign-{sign['code']}")
            if local and local not in seen:
                seen.add(local)
                images.append(local)
            img = out.new_tag("img")
            img["src"] = local
            img["alt"] = f"Дорожній знак {sign['code']}"
            img["data-media-kind"] = "sign"
            img["loading"] = "lazy"
            img["decoding"] = "async"
            article.append(img)

        if sign["description"]:
            p = out.new_tag("p")
            p.string = sign["description"]
            article.append(p)

        content = detail_content(session, f"{BASE_URL}/znaky/{category_id}/{sign['code']}/", images, seen, preferred_folder="signs")
        if content:
            details_fragment = BeautifulSoup(content, "html.parser")
            for parsed_child in list((details_fragment.body or details_fragment).contents):
                article.append(parsed_child)
        wrapper.append(article)
        time.sleep(0.08)

    html = str(wrapper)
    return ParsedSection(
        slug=f"road-signs-{category_id}",
        title=f"{category_id}. {title}",
        description=f"Категорія {category_id}. {title}",
        content_html=html,
        content_text=text_from_html(html),
        images=images,
        sort_order=category_id,
        source_url=url,
    )


def parse_marking_category(session: requests.Session, category_id: int, title: str) -> ParsedSection:
    url = f"{BASE_URL}/rozmitka/{category_id}/"
    print(f"Парсю дорожню розмітку {category_id}: {title}", flush=True)
    soup = BeautifulSoup(fetch_page(session, url), "html.parser")
    markings = parse_mark_list(soup)

    out = BeautifulSoup("", "html.parser")
    wrapper = out.new_tag("div")
    wrapper["data-source"] = "vodiy-markings"
    out.append(wrapper)

    intro = out.new_tag("p")
    intro.string = "Розмітку подано за офіційними групами з локальними зображеннями та поясненнями до кожного позначення."
    wrapper.append(intro)

    images: list[str] = []
    seen: set[str] = set()
    for marking in markings:
        article = out.new_tag("section")
        article["data-vodiy-block"] = "true"
        article["id"] = f"marking-{slugify(marking['code'])}"

        h3 = out.new_tag("h3")
        h3.string = f"Розмітка {marking['code']}"
        article.append(h3)

        if marking["img"]:
            local = download_image(session, marking["img"], folder="marking", fallback_name=f"marking-{marking['code']}")
            if local and local not in seen:
                seen.add(local)
                images.append(local)
            img = out.new_tag("img")
            img["src"] = local
            img["alt"] = f"Дорожня розмітка {marking['code']}"
            img["data-media-kind"] = "marking"
            img["loading"] = "lazy"
            img["decoding"] = "async"
            article.append(img)

        if marking["description"]:
            p = out.new_tag("p")
            p.string = marking["description"]
            article.append(p)

        content = detail_content(session, f"{BASE_URL}/rozmitka/{category_id}/{marking['code']}/", images, seen, preferred_folder="marking")
        if content:
            details_fragment = BeautifulSoup(content, "html.parser")
            for parsed_child in list((details_fragment.body or details_fragment).contents):
                article.append(parsed_child)
        wrapper.append(article)
        time.sleep(0.08)

    html = str(wrapper)
    return ParsedSection(
        slug=f"road-markings-{category_id}",
        title=f"{category_id}. {title}",
        description=f"Категорія {category_id}. {title}",
        content_html=html,
        content_text=text_from_html(html),
        images=images,
        sort_order=category_id,
        source_url=url,
    )


def database_url() -> str:
    load_dotenv(BASE_DIR / ".env")
    raw = (os.environ.get("DATABASE_URL") or os.environ.get("POSTGRES_URI") or "").strip()
    if raw:
        os.environ.setdefault("DATABASE_URL", raw)
    if not raw:
        raise RuntimeError("DATABASE_URL або POSTGRES_URI не знайдено. Додайте змінну середовища.")
    if os.getenv("DATABASE_SSL", "").strip().lower() in {"1", "true", "yes", "require"} and "sslmode=" not in raw:
        return f"{raw}{'&' if '?' in raw else '?'}sslmode=require"
    return raw


def configure_schema(conn: psycopg.Connection) -> None:
    schema = os.getenv("DATABASE_SCHEMA", "").strip()
    if not schema:
        return
    if not schema.replace("_", "").isalnum() or schema[0].isdigit():
        raise RuntimeError("DATABASE_SCHEMA має містити лише літери, цифри та підкреслення і не може починатися з цифри")
    conn.execute(sql.SQL("CREATE SCHEMA IF NOT EXISTS {}").format(sql.Identifier(schema)))
    conn.execute(sql.SQL("SET search_path TO {}, public").format(sql.Identifier(schema)))


def upsert_category(conn: psycopg.Connection, slug: str, title: str, description: str, sort_order: int) -> int:
    row = conn.execute(
        """
        INSERT INTO theory_categories (slug, title, description, sort_order)
        VALUES (%s, %s, %s, %s)
        ON CONFLICT (slug) DO UPDATE
        SET title = EXCLUDED.title,
            description = EXCLUDED.description,
            sort_order = EXCLUDED.sort_order
        RETURNING id
        """,
        (slug, title, description, sort_order),
    ).fetchone()
    return int(row["id"])


def upsert_topic(
    conn: psycopg.Connection,
    *,
    category_id: int,
    slug: str,
    title: str,
    description: str,
    sort_order: int,
    source_url: str,
) -> int:
    row = conn.execute(
        """
        INSERT INTO theory_topics (category_id, slug, title, description, topic_type, sort_order, source_url)
        VALUES (%s, %s, %s, %s, 'topic', %s, %s)
        ON CONFLICT (slug) DO UPDATE
        SET category_id = EXCLUDED.category_id,
            title = EXCLUDED.title,
            description = EXCLUDED.description,
            topic_type = EXCLUDED.topic_type,
            sort_order = EXCLUDED.sort_order,
            source_url = EXCLUDED.source_url
        RETURNING id
        """,
        (category_id, slug, title, description, sort_order, source_url),
    ).fetchone()
    return int(row["id"])


def upsert_section(conn: psycopg.Connection, topic_id: int, section: ParsedSection) -> int:
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
            section.slug,
            section.title,
            section.description,
            section.content_html,
            section.content_text,
            section.chapter_num,
            section.sort_order,
            section.source_url,
        ),
    ).fetchone()
    section_id = int(row["id"])

    conn.execute("DELETE FROM theory_assets WHERE section_id = %s", (section_id,))
    for index, image in enumerate(section.images, start=1):
        conn.execute(
            """
            INSERT INTO theory_assets (section_id, asset_type, asset_url, alt_text, caption, sort_order)
            VALUES (%s, 'image', %s, %s, NULL, %s)
            """,
            (section_id, image, section.title, index),
        )
    return section_id


def refresh_question_links(conn: psycopg.Connection) -> int:
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


def remove_legacy_rules_duplicates(conn: psycopg.Connection) -> int:
    rows = conn.execute(
        """
        SELECT s.id
        FROM theory_sections s
        JOIN theory_topics t ON t.id = s.topic_id
        WHERE t.slug = 'rules'
          AND s.chapter_num BETWEEN 1 AND 34
          AND COALESCE(s.source_url, '') NOT ILIKE 'https://vodiy.ua/%'
        """
    ).fetchall()
    ids = [int(row["id"]) for row in rows]
    if not ids:
        return 0

    conn.execute(
        """
        UPDATE questions
        SET theory_section_id = NULL,
            source_rule_slug = NULL
        WHERE theory_section_id = ANY(%s)
        """,
        (ids,),
    )
    conn.execute("DELETE FROM theory_assets WHERE section_id = ANY(%s)", (ids,))
    conn.execute("DELETE FROM theory_sections WHERE id = ANY(%s)", (ids,))
    return len(ids)


def export_seed(conn: psycopg.Connection) -> None:
    payload: dict[str, Any] = {}
    for key, table in (
        ("categories", "theory_categories"),
        ("topics", "theory_topics"),
        ("sections", "theory_sections"),
        ("assets", "theory_assets"),
    ):
        rows = conn.execute(f"SELECT * FROM {table} ORDER BY id").fetchall()
        clean_rows: list[dict[str, Any]] = []
        for row in rows:
            item = dict(row)
            for field, value in list(item.items()):
                if isinstance(value, datetime):
                    item[field] = value.isoformat(sep=" ")
            clean_rows.append(item)
        payload[key] = clean_rows

    THEORY_SEED_FILE.parent.mkdir(parents=True, exist_ok=True)
    THEORY_SEED_FILE.write_text(json.dumps(payload, ensure_ascii=False), encoding="utf-8")
    print(f"Оновлено seed для Render: {THEORY_SEED_FILE}", flush=True)


def import_sections(parsed: dict[str, list[ParsedSection]], *, write_seed: bool, link_questions: bool) -> None:
    with psycopg.connect(database_url(), row_factory=dict_row) as conn:
        configure_schema(conn)
        rules_category = upsert_category(
            conn,
            "rules",
            "Правила дорожнього руху",
            "Офіційні правила з vodiy.ua у зручному форматі для навчання.",
            1,
        )
        signs_category = upsert_category(
            conn,
            "road-signs",
            "Дорожні знаки",
            "Усі групи дорожніх знаків із зображеннями та короткими поясненнями.",
            2,
        )
        markings_category = upsert_category(
            conn,
            "road-markings",
            "Дорожня розмітка",
            "Горизонтальна та вертикальна розмітка з офіційними поясненнями.",
            3,
        )

        topic_ids = {
            "rules": upsert_topic(
                conn,
                category_id=rules_category,
                slug="rules",
                title="Правила дорожнього руху",
                description="Офіційні розділи ПДР з локальними зображеннями та коректними переходами всередині теорії.",
                sort_order=1,
                source_url=f"{BASE_URL}/pdr/",
            ),
            "road-signs": upsert_topic(
                conn,
                category_id=signs_category,
                slug="road-signs",
                title="Дорожні знаки",
                description="Категорії дорожніх знаків із зображеннями, назвами та описами.",
                sort_order=1,
                source_url=f"{BASE_URL}/znaky/",
            ),
            "road-markings": upsert_topic(
                conn,
                category_id=markings_category,
                slug="road-markings",
                title="Дорожня розмітка",
                description="Категорії дорожньої розмітки з локальними ілюстраціями.",
                sort_order=1,
                source_url=f"{BASE_URL}/rozmitka/",
            ),
        }

        total_sections = 0
        total_images = 0
        for topic_slug, sections in parsed.items():
            for section in sections:
                upsert_section(conn, topic_ids[topic_slug], section)
                total_sections += 1
                total_images += len(section.images)

        removed_legacy = remove_legacy_rules_duplicates(conn)
        linked = refresh_question_links(conn) if link_questions else 0
        if write_seed:
            export_seed(conn)
        conn.commit()

    print(
        f"Готово: {total_sections} розділів, {total_images} зображень, "
        f"{linked} питань прив'язано до теорії, {removed_legacy} старих дублів прибрано.",
        flush=True,
    )


def parse_all(args: argparse.Namespace) -> dict[str, list[ParsedSection]]:
    ensure_image_dirs()
    session = make_session()
    selected_chapters = parse_range_list(args.chapters)
    parsed: dict[str, list[ParsedSection]] = {"rules": [], "road-signs": [], "road-markings": []}

    links = chapter_links(session)
    if selected_chapters is not None:
        links = [link for link in links if link.chapter_id in selected_chapters]
    if args.limit_chapters:
        links = links[: args.limit_chapters]

    for chapter in links:
        parsed["rules"].append(parse_chapter(session, chapter))
        time.sleep(args.delay)

    selected_sign_categories = parse_range_list(args.sign_categories)
    selected_marking_categories = parse_range_list(args.marking_categories)

    if not args.skip_signs:
        for category_id, title in SIGN_CATEGORIES:
            if selected_sign_categories is not None and category_id not in selected_sign_categories:
                continue
            parsed["road-signs"].append(parse_sign_category(session, category_id, title))
            time.sleep(args.delay)

    if not args.skip_markings:
        for category_id, title in MARKING_CATEGORIES:
            if selected_marking_categories is not None and category_id not in selected_marking_categories:
                continue
            parsed["road-markings"].append(parse_marking_category(session, category_id, title))
            time.sleep(args.delay)

    return parsed


def build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(description="Імпорт теорії ПДР з vodiy.ua у PostgreSQL DrivePrep.")
    parser.add_argument("--chapters", help="Список або діапазон розділів ПДР, наприклад 1,2,33-34. За замовчуванням усі.")
    parser.add_argument("--limit-chapters", type=int, default=0, help="Тестовий ліміт кількості розділів ПДР.")
    parser.add_argument("--skip-signs", action="store_true", help="Не імпортувати дорожні знаки.")
    parser.add_argument("--skip-markings", action="store_true", help="Не імпортувати дорожню розмітку.")
    parser.add_argument("--sign-categories", help="Список категорій знаків, наприклад 1,3-5. За замовчуванням усі.")
    parser.add_argument("--marking-categories", help="Список категорій розмітки, наприклад 1 або 1-2. За замовчуванням усі.")
    parser.add_argument("--dry-run", action="store_true", help="Спарсити дані без запису в базу.")
    parser.add_argument("--export-seed-only", action="store_true", help="Не парсити vodiy.ua, а лише експортувати поточну theory_* базу в seed для Render.")
    parser.add_argument("--no-question-links", action="store_true", help="Не оновлювати прив'язку питань до розділів теорії.")
    parser.add_argument("--write-seed", action="store_true", help="Після імпорту оновити backend/data/theory/theory_seed.json для Render.")
    parser.add_argument("--delay", type=float, default=0.35, help="Пауза між сторінками, щоб не бити vodiy.ua зайвими запитами.")
    return parser


def main() -> None:
    args = build_parser().parse_args()
    if args.export_seed_only:
        with psycopg.connect(database_url(), row_factory=dict_row) as conn:
            configure_schema(conn)
            export_seed(conn)
        return

    parsed = parse_all(args)
    counts = {key: len(value) for key, value in parsed.items()}
    print(f"Спарсено: {counts}", flush=True)
    if args.dry_run:
        print("Dry run: у базу нічого не записано.", flush=True)
        return
    import_sections(parsed, write_seed=args.write_seed, link_questions=not args.no_question_links)


if __name__ == "__main__":
    main()
