"""
import_handbook.py — PDR Handbook Importer v3.0
================================================
Диференційований парсинг за темами:
  • rules          — 35 розділів, чистий текст без дублювань
  • road-signs     — 7 груп знаків (один запис у БД = одна група)
  • road-markings  — 2 групи розмітки (горизонтальна / вертикальна)
  • regulator      — одна сторінка, обов'язково зберігає всі зображення
  • traffic-light  — одна сторінка, обов'язково зберігає всі зображення

Запуск:
    python import_handbook.py --reset --download-images
    python import_handbook.py --topic road-signs --download-images
"""
from __future__ import annotations

import argparse
import json
import os
import re
import time
from pathlib import Path
from typing import Any
from urllib.parse import urljoin, urlparse, urlunparse
from uuid import uuid4

import psycopg
import requests
from bs4 import BeautifulSoup, NavigableString, Tag
from dotenv import load_dotenv

load_dotenv()

# ─── Config ─────────────────────────────────────────────────────────────────

BASE_DIR = Path(__file__).resolve().parent
DB_URL = os.environ["DATABASE_URL"]
UPLOAD_DIR = BASE_DIR / "uploads" / "handbook"
UPLOAD_DIR.mkdir(parents=True, exist_ok=True)

SOURCE_BASE = "https://pdr.infotech.gov.ua"
STORAGE_BASE = "https://web.testpdr.com/storage"

# Фрази, після яких парсинг треба зупинити
STOP_PHRASES = (
    "Рекомендована література",
    "Підписуйтесь на наші соціальні мережі",
    "Завантажте застосунок",
    "Виникли питання або пропозиції",
    "Пишіть на пошту",
    "Корисні посилання",
    "там щодня публікуються",
)

# Заголовки груп знаків у порядку, що відповідає сторінці /theory/road-signs
SIGN_GROUPS: list[dict[str, Any]] = [
    {
        "sort_order": 1,
        "section_title": "1. Попереджувальні знаки",
        "slug_suffix": "group-1-warning",
        "header_text_hint": "попереджувальні",
        "category_img_key": "PfJTgjeecmQeNQ5MVNyU42pVAezQNOstA5Bt5F8C",
        "description": (
            "Попереджувальні знаки інформують водіїв про наближення до небезпечної "
            "ділянки дороги і характер небезпеки. Під час руху по цій ділянці необхідно "
            "вжити заходів для безпечного проїзду."
        ),
    },
    {
        "sort_order": 2,
        "section_title": "2. Знаки пріоритету",
        "slug_suffix": "group-2-priority",
        "header_text_hint": "пріоритету",
        "category_img_key": "qbNpMRIyX9p9GF41bLtcQpLllXWEtb2pkVHSvIBu",
        "description": (
            "Знаки пріоритету встановлюють черговість проїзду перехресть, "
            "перехрещень проїзних частин або вузьких ділянок дороги."
        ),
    },
    {
        "sort_order": 3,
        "section_title": "3. Заборонні знаки",
        "slug_suffix": "group-3-prohibitory",
        "header_text_hint": "заборонні",
        "category_img_key": "IvdaogfIQ1BLqbflyjNK6tkddzG6bvBMXHQuZnjX",
        "description": (
            "Заборонні знаки запроваджують або скасовують певні обмеження в русі."
        ),
    },
    {
        "sort_order": 4,
        "section_title": "4. Наказові знаки",
        "slug_suffix": "group-4-mandatory",
        "header_text_hint": "наказові",
        "category_img_key": "CuDwGYZycjYUIodRuZ0Ga1yJFvkVshYPdZUyrSux",
        "description": (
            "Наказові знаки показують обов'язкові напрямки руху або дозволяють "
            "деяким категоріям учасників рух по проїзній частині чи окремих її "
            "ділянках, а також запроваджують або скасовують деякі обмеження."
        ),
    },
    {
        "sort_order": 5,
        "section_title": "5. Інформаційно-вказівні знаки",
        "slug_suffix": "group-5-informational",
        "header_text_hint": "інформаційно-вказівні",
        "category_img_key": "yGJbFWd2UUuM0vyDOyx8Brfmezc3YBjj7R6VSa5F",
        "description": (
            "Інформаційно-вказівні знаки запроваджують або скасовують певний режим "
            "руху, а також інформують учасників дорожнього руху про розташування "
            "населених пунктів, різних об'єктів, територій, де діють спеціальні правила."
        ),
    },
    {
        "sort_order": 6,
        "section_title": "6. Знаки сервісу",
        "slug_suffix": "group-6-service",
        "header_text_hint": "сервісу",
        "category_img_key": "i0Oc9Hh4D8nes9HYO8lzzz5qtvbxxi9mRj6rf9F6",
        "description": (
            "Знаки сервісу інформують учасників дорожнього руху про розташування "
            "об'єктів обслуговування."
        ),
    },
    {
        "sort_order": 7,
        "section_title": "7. Таблички до дорожніх знаків",
        "slug_suffix": "group-7-plates",
        "header_text_hint": "таблички",
        "category_img_key": "P5pS7aw0GtkvXDaRubQzrNK9eirO9yIMR5JJybcO",
        "description": (
            "Таблички до дорожніх знаків уточнюють або обмежують дію знаків, "
            "разом з якими вони встановлені."
        ),
    },
]

MARKING_GROUPS: list[dict[str, Any]] = [
    {
        "sort_order": 1,
        "section_title": "Горизонтальна розмітка",
        "slug_suffix": "horizontal",
        "header_text_hint": "горизонтальна",
        "category_img_key": "uXCvJZKygTb3fcPxeR5ytwnjL8mCNhj3D2KMSloo",
        "description": (
            "Лінії горизонтальної розмітки мають білий колір. "
            "Синій колір має лінія 1.33. Жовтий колір мають лінії 1.4, 1.10.1–1.10.3, "
            "1.17.1–1.17.3, 1.23, 1.25, а також лінії тимчасової розмітки. "
            "Червоно-білий колір мають лінії 1.14.2, 1.14.3, 1.15."
        ),
    },
    {
        "sort_order": 2,
        "section_title": "Вертикальна розмітка",
        "slug_suffix": "vertical",
        "header_text_hint": "вертикальна",
        "category_img_key": "vpQfrYuBNW2q19Poj2aRTlcMohSSZ8WLy3n3c08N",
        "description": (
            "Смуги вертикальної розмітки мають чорно-білий, жовто-червоний та "
            "червоно-білий кольори."
        ),
    },
]

RULE_SECTIONS = [
    "Загальні положення",
    "Обов'язки і права водіїв механічних транспортних засобів",
    "Рух транспортних засобів із спеціальними сигналами",
    "Обов'язки і права пішоходів",
    "Обов'язки і права пасажирів",
    "Вимоги до велосипедистів",
    "Вимоги до осіб, які керують гужовим транспортом, і погоничам тварин",
    "Регулювання дорожнього руху",
    "Попереджувальні сигнали",
    "Початок руху та зміна його напрямку",
    "Розташування транспортних засобів на дорозі",
    "Швидкість руху",
    "Дистанція, інтервал, зустрічний роз'їзд",
    "Обгін",
    "Зупинка і стоянка",
    "Проїзд перехресть",
    "Переваги маршрутних транспортних засобів",
    "Проїзд пішохідних переходів і зупинок транспортних засобів",
    "Користування зовнішніми світловими приладами",
    "Рух через залізничні переїзди",
    "Перевезення пасажирів",
    "Перевезення вантажу",
    "Буксирування і експлуатація транспортних складів",
    "Навчальна їзда",
    "Рух транспортних засобів у колонах",
    "Рух у житловій та пішохідній зоні",
    "Рух по автомагістралях і дорогах для автомобілів",
    "Рух по гірських дорогах і на крутих спусках",
    "Міжнародний рух",
    "Номерні, розпізнавальні знаки, написи і позначення",
    "Технічний стан транспортних засобів та їх обладнання",
    "Окремі питання дорожнього руху, що вимагають узгодження",
    "Дорожні знаки",
    "Дорожня розмітка",
    "Медицина",
]

# ─── Helpers ─────────────────────────────────────────────────────────────────

def db() -> psycopg.Connection:
    return psycopg.connect(DB_URL)


def clean_text(value: str) -> str:
    return re.sub(r"\s+", " ", (value or "").replace("\xa0", " ")).strip()


def slugify_url(url: str) -> str:
    parsed = urlparse(url)
    slug = parsed.path.strip("/").replace("/", "-")
    return slug or "handbook-entry"


def normalize_url(url: str) -> str:
    parsed = urlparse(url)
    return urlunparse((parsed.scheme, parsed.netloc, parsed.path.rstrip("/"), "", "", ""))


def should_stop(text: str) -> bool:
    normalized = clean_text(text)
    return any(phrase.lower() in normalized.lower() for phrase in STOP_PHRASES)


def make_session() -> requests.Session:
    session = requests.Session()
    session.headers.update({
        "User-Agent": "PDRPrep Handbook Importer/3.0 (+https://localhost)",
        "Accept-Language": "uk-UA,uk;q=0.9,en;q=0.8",
    })
    return session


def fetch_html(session: requests.Session, url: str, retries: int = 3) -> BeautifulSoup:
    for attempt in range(retries):
        try:
            resp = session.get(url, timeout=30)
            resp.raise_for_status()
            resp.encoding = "utf-8"
            return BeautifulSoup(resp.text, "html.parser")
        except Exception as exc:
            if attempt == retries - 1:
                raise
            print(f"  Retry {attempt + 1}/{retries} for {url}: {exc}")
            time.sleep(2 ** attempt)
    raise RuntimeError(f"Failed to fetch {url}")


def download_image(session: requests.Session, img_url: str, slug: str, index: int) -> str | None:
    """Завантажує одне зображення, повертає локальний шлях або None."""
    try:
        resp = session.get(img_url, timeout=30)
        resp.raise_for_status()
    except Exception as exc:
        print(f"  ⚠ Cannot download image {img_url}: {exc}")
        return None
    suffix = Path(urlparse(img_url).path).suffix or ".jpg"
    # Обмежуємо суфікс до відомих форматів
    if suffix.lower() not in {".jpg", ".jpeg", ".png", ".gif", ".webp", ".svg"}:
        suffix = ".jpg"
    filename = f"{slug}-{index}-{uuid4().hex[:8]}{suffix}"
    path = UPLOAD_DIR / filename
    path.write_bytes(resp.content)
    return f"/uploads/handbook/{filename}"


def rewrite_images(
    soup: BeautifulSoup,
    session: requests.Session,
    slug: str,
    base_url: str,
    download: bool,
) -> list[str]:
    """
    Замінює src усіх <img> на абсолютні URL (або локальні шляхи при download=True).
    Повертає список усіх шляхів до зображень.
    """
    stored: list[str] = []
    for idx, img in enumerate(soup.find_all("img"), start=1):
        src = img.get("src", "")
        if not src:
            continue
        absolute = urljoin(base_url, src)
        if download:
            local = download_image(session, absolute, slug, idx)
            if local:
                img["src"] = local
                stored.append(local)
            else:
                img["src"] = absolute
                stored.append(absolute)
        else:
            img["src"] = absolute
            stored.append(absolute)
    return stored


def strip_noise(soup: BeautifulSoup) -> None:
    """Видаляє скрипти, стилі, навігацію, footer, форми."""
    for sel in ("script", "style", "noscript", "header", "footer", "nav",
                "form", "[class*='social']", "[class*='share']",
                "[class*='cookie']", "[class*='banner']", "[class*='breadcrumb']"):
        for node in soup.select(sel):
            node.decompose()


def strip_external_links(soup: BeautifulSoup, keep_domain: str = SOURCE_BASE) -> None:
    """
    Замінює зовнішні посилання простим текстом.
    Внутрішні посилання (на pdr.infotech.gov.ua) залишає.
    """
    for a in soup.find_all("a", href=True):
        href = str(a.get("href", ""))
        if href.startswith(keep_domain) or href.startswith("/"):
            # Внутрішнє посилання — просто замінюємо на span без href
            span = BeautifulSoup(f"<span>{a.decode_contents()}</span>", "html.parser").span
            a.replace_with(span)
        else:
            # Зовнішнє — замінюємо на звичайний текст
            a.replace_with(a.get_text(" ", strip=True))


def insert_entry(
    conn: psycopg.Connection,
    *,
    topic_key: str,
    category: str,
    chapter_num: int | None,
    sort_order: int,
    section_title: str,
    source_url: str,
    source_slug: str,
    content_html: str,
    content_text: str,
    image_paths: list[str],
) -> None:
    conn.execute(
        """
        INSERT INTO handbook_data (
            topic_key, category, chapter_num, sort_order,
            section_title, source_url, source_slug,
            content_html, content_text, image_paths
        )
        VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s::jsonb)
        ON CONFLICT (source_url) DO UPDATE SET
            topic_key      = EXCLUDED.topic_key,
            category       = EXCLUDED.category,
            chapter_num    = EXCLUDED.chapter_num,
            sort_order     = EXCLUDED.sort_order,
            section_title  = EXCLUDED.section_title,
            source_slug    = EXCLUDED.source_slug,
            content_html   = EXCLUDED.content_html,
            content_text   = EXCLUDED.content_text,
            image_paths    = EXCLUDED.image_paths
        """,
        (
            topic_key, category, chapter_num, sort_order,
            section_title, source_url, source_slug,
            content_html, content_text,
            json.dumps(image_paths, ensure_ascii=False),
        ),
    )


# ─── Rules parser ────────────────────────────────────────────────────────────

def _remove_rule_number_duplicate(soup: BeautifulSoup, chapter_num: int) -> None:
    """
    На сторінці /theory/rules/N є заголовок виду «N. Назва розділу».
    Потім у тексті часто перший параграф повторює «N.» або «N. Назва».
    Видаляємо такий дублікат.
    """
    prefix_pattern = re.compile(rf"^\s*{re.escape(str(chapter_num))}\.\s*")
    for heading in soup.find_all(["h1", "h2", "h3"]):
        text = clean_text(heading.get_text(" ", strip=True))
        if prefix_pattern.match(text):
            heading.decompose()
            return  # видаляємо тільки перший заголовок


def parse_rules_entry(
    session: requests.Session,
    chapter_num: int,
    section_title: str,
    download: bool,
) -> tuple[str, str, list[str]]:
    """Парсить один розділ ПДР. Повертає (html, text, image_paths)."""
    url = f"{SOURCE_BASE}/theory/rules/{chapter_num}"
    soup = fetch_html(session, url)
    strip_noise(soup)

    # Шукаємо основний контент
    main = soup.select_one("main") or soup.body or soup
    _remove_rule_number_duplicate(main, chapter_num)

    # Знаходимо перший h1/h2 — починаємо збирати контент після нього
    heading = main.find(["h1", "h2"])
    blocks: list[str] = []
    texts: list[str] = []

    nodes_iter = heading.find_all_next() if isinstance(heading, Tag) else main.descendants
    for node in nodes_iter:
        if not isinstance(node, Tag):
            continue
        if node.name in {"script", "style", "nav", "footer", "header"}:
            continue
        # Перевірка стоп-фраз
        node_text = clean_text(node.get_text(" ", strip=True))
        if should_stop(node_text):
            break
        # Беремо тільки блокові / семантичні теги верхнього рівня відносно main
        if node.parent not in (main, heading.parent if isinstance(heading, Tag) else main):
            continue
        if node.name not in {"p", "ul", "ol", "table", "h3", "h4", "blockquote", "figure", "div"}:
            continue
        if not node_text and not node.find("img"):
            continue
        blocks.append(str(node))
        if node_text:
            texts.append(node_text)

    # Якщо нічого не зібрали — fallback до всього main
    if not blocks:
        for node in main.children:
            if not isinstance(node, Tag):
                continue
            node_text = clean_text(node.get_text(" ", strip=True))
            if should_stop(node_text):
                break
            if node.name in {"script", "style", "nav", "footer"}:
                continue
            blocks.append(str(node))
            if node_text:
                texts.append(node_text)

    content_soup = BeautifulSoup("".join(blocks), "html.parser")
    strip_external_links(content_soup)
    slug = f"theory-rules-{chapter_num}"
    image_paths = rewrite_images(content_soup, session, slug, url, download)

    # Видаляємо порожні вузли
    for node in content_soup.find_all(["p", "li", "div"]):
        if not clean_text(node.get_text(" ", strip=True)) and not node.find("img"):
            node.decompose()

    html = content_soup.decode()
    text = clean_text(content_soup.get_text(" ", strip=True))
    return html, text, image_paths


# ─── Signs / Markings grouped parser ─────────────────────────────────────────

def _find_sign_img_url(code: str, sign_type: str = "road-signs") -> str:
    """Повертає абсолютний URL зображення знаку/розмітки з CDN."""
    if sign_type == "road-signs":
        key = "RSS_" + code.replace(".", "_")
        return f"{STORAGE_BASE}/road-signs/original/{key}.png"
    else:
        key = "RMM_" + code.replace(".", "_")
        return f"{STORAGE_BASE}/road-markings/original/{key}.png"


def _collect_sign_codes_from_page(
    soup: BeautifulSoup,
    group_hint: str,
    next_hint: str | None,
) -> list[str]:
    """
    Збирає коди знаків між двома заголовками групи на сторінці /theory/road-signs.
    group_hint — ключове слово заголовка поточної групи (напр. 'попереджувальні').
    next_hint  — ключове слово заголовка наступної групи (або None для останньої).
    """
    codes: list[str] = []
    # Знаходимо секцію між заголовком-картинкою поточної та наступної групи
    # Структура сторінки: <img ...> (заголовок групи) потім <a href=".../X.Y">
    collecting = False
    for node in soup.find_all(True):
        # Заголовок групи — це <img> в блоці з текстом-хінтом
        if node.name == "img":
            src = node.get("src", "")
            parent_text = clean_text(node.parent.get_text(" ", strip=True)).lower() if node.parent else ""
            alt = clean_text(node.get("alt", "")).lower()
            if group_hint.lower() in parent_text or group_hint.lower() in src.lower():
                collecting = True
                continue
            if next_hint and (next_hint.lower() in parent_text or next_hint.lower() in src.lower()):
                if collecting:
                    break
        # Посилання на конкретний знак: /theory/road-signs/X.Y або /theory/road-markings/X.Y
        if collecting and node.name == "a":
            href = node.get("href", "")
            code_match = re.search(r"/(\d+(?:\.\d+)*)$", href)
            if code_match:
                code = code_match.group(1)
                if code not in codes:
                    codes.append(code)
    return codes


def _build_group_html(
    group: dict[str, Any],
    codes: list[str],
    sign_type: str,
    session: requests.Session,
    download: bool,
) -> tuple[str, str, list[str]]:
    """
    Будує HTML-контент для однієї групи знаків/розмітки.
    Кожен знак: <figure><img><figcaption>код</figcaption></figure>.
    Повертає (html, text, image_paths).
    """
    html_parts: list[str] = []
    text_parts: list[str] = []
    image_paths: list[str] = []

    # Опис групи
    html_parts.append(f"<p>{group['description']}</p>")
    text_parts.append(group["description"])

    # Галерея знаків
    html_parts.append('<div class="signs-grid">')
    slug = f"theory-{sign_type}-{group['slug_suffix']}"

    for idx, code in enumerate(codes, start=1):
        img_url = _find_sign_img_url(code, sign_type)
        detail_url = f"{SOURCE_BASE}/theory/{sign_type}/{code}"

        if download:
            local_path = download_image(session, img_url, slug, idx)
            src = local_path if local_path else img_url
            if local_path:
                image_paths.append(local_path)
            else:
                image_paths.append(img_url)
        else:
            src = img_url
            image_paths.append(img_url)

        html_parts.append(
            f'<figure class="sign-item">'
            f'<a href="{detail_url}" target="_blank" rel="noopener noreferrer">'
            f'<img src="{src}" alt="{code}" loading="lazy">'
            f'</a>'
            f'<figcaption>{code}</figcaption>'
            f'</figure>'
        )
        text_parts.append(code)

    html_parts.append("</div>")
    html = "\n".join(html_parts)
    text = clean_text(" ".join(text_parts))
    return html, text, image_paths


def parse_signs_groups(
    session: requests.Session,
    groups: list[dict[str, Any]],
    sign_type: str,  # "road-signs" или "road-markings"
    page_url: str,
    download: bool,
) -> list[tuple[dict[str, Any], str, str, list[str]]]:
    """
    Парсить сторінку знаків/розмітки і повертає список:
    [(group_meta, html, text, image_paths), ...] для кожної групи.
    """
    soup = fetch_html(session, page_url)
    results: list[tuple[dict[str, Any], str, str, list[str]]] = []

    for i, group in enumerate(groups):
        next_group = groups[i + 1] if i + 1 < len(groups) else None
        codes = _collect_sign_codes_from_page(
            soup,
            group_hint=group["header_text_hint"],
            next_hint=next_group["header_text_hint"] if next_group else None,
        )
        if not codes:
            # Fallback: збираємо всі посилання на знаки з потрібним префіксом
            prefix_digit = group["section_title"].split(".")[0].strip()
            codes = []
            for a in soup.find_all("a", href=True):
                href = str(a["href"])
                code_match = re.search(r"/(\d+(?:\.\d+)*)$", href)
                if code_match:
                    code = code_match.group(1)
                    # Перевіряємо, що перша цифра відповідає номеру групи
                    if code.startswith(prefix_digit + ".") or code == prefix_digit:
                        if code not in codes:
                            codes.append(code)

        print(f"  [{sign_type}] {group['section_title']}: {len(codes)} знаків")
        html, text, image_paths = _build_group_html(group, codes, sign_type, session, download)
        results.append((group, html, text, image_paths))

    return results


# ─── Regulator / Traffic-light parser ────────────────────────────────────────

def parse_rich_page(
    session: requests.Session,
    url: str,
    section_title: str,
    slug: str,
    download: bool,
) -> tuple[str, str, list[str]]:
    """
    Парсить сторінки регулювальника та світлофора.
    Обов'язково захоплює всі зображення.
    Видаляє навігаційні блоки та зовнішні посилання.
    """
    soup = fetch_html(session, url)
    strip_noise(soup)

    main = soup.select_one("main") or soup.body or soup

    # Знаходимо початковий заголовок
    heading = main.find(["h1", "h2"])

    blocks: list[str] = []
    texts: list[str] = []

    # Перебираємо всі вузли після заголовка
    def collect_from(root: Tag) -> None:
        started = heading is None
        for node in root.children:
            if not isinstance(node, Tag):
                continue
            if node.name in {"script", "style", "nav", "footer", "header", "form"}:
                continue
            node_text = clean_text(node.get_text(" ", strip=True))
            if should_stop(node_text):
                break
            # Пропускаємо вузли до заголовка (вони зазвичай — навігація/breadcrumbs)
            if not started:
                if node is heading or node == heading:
                    started = True
                continue
            # Якщо є зображення — беремо цей блок обов'язково
            has_img = bool(node.find("img"))
            if not node_text and not has_img:
                continue
            blocks.append(str(node))
            if node_text:
                texts.append(node_text)

    collect_from(main)

    # Якщо нічого не зібрали — fallback
    if not blocks:
        for node in main.children:
            if not isinstance(node, Tag):
                continue
            node_text = clean_text(node.get_text(" ", strip=True))
            if should_stop(node_text):
                break
            if node.name in {"script", "style", "nav"}:
                continue
            blocks.append(str(node))
            if node_text:
                texts.append(node_text)

    content_soup = BeautifulSoup("".join(blocks), "html.parser")
    strip_external_links(content_soup)
    image_paths = rewrite_images(content_soup, session, slug, url, download)

    # Видаляємо заголовки що дублюють section_title
    title_lower = section_title.lower()
    for h in content_soup.find_all(["h1", "h2"]):
        if clean_text(h.get_text(" ", strip=True)).lower() in {title_lower, title_lower + "."}:
            h.decompose()

    html = content_soup.decode()
    text = clean_text(content_soup.get_text(" ", strip=True))

    if not image_paths:
        # Якщо зображень не знайдено через парсер — ще раз шукаємо у вихідному soup
        print(f"  ⚠ No images found via content, scanning full soup for {url}")
        extra_imgs = soup.find_all("img")
        for idx, img in enumerate(extra_imgs, start=len(image_paths) + 1):
            src = img.get("src", "")
            if not src:
                continue
            absolute = urljoin(url, src)
            if download:
                local = download_image(session, absolute, slug, idx)
                final = local if local else absolute
            else:
                final = absolute
            image_paths.append(final)
            # Додаємо <img> до кінця контенту
            content_soup.append(
                BeautifulSoup(f'<img src="{final}" alt="" loading="lazy">', "html.parser").img
            )
        html = content_soup.decode()
        text = clean_text(content_soup.get_text(" ", strip=True))

    return html, text, image_paths


# ─── Import orchestration ────────────────────────────────────────────────────

def import_rules(
    session: requests.Session,
    conn: psycopg.Connection,
    download: bool,
) -> int:
    count = 0
    for idx, title in enumerate(RULE_SECTIONS):
        chapter_num = idx + 1
        section_title = f"{chapter_num}. {title}"
        source_url = f"{SOURCE_BASE}/theory/rules/{chapter_num}"
        source_slug = f"theory-rules-{chapter_num}"
        print(f"  Importing rules/{chapter_num}: {title}")
        try:
            html, text, image_paths = parse_rules_entry(
                session, chapter_num, section_title, download
            )
        except Exception as exc:
            print(f"  ✗ Error: {exc}")
            continue
        if len(text) < 30 and not image_paths:
            print(f"  ⚠ Skipping empty entry rules/{chapter_num}")
            continue
        insert_entry(
            conn,
            topic_key="rules",
            category="rules",
            chapter_num=chapter_num,
            sort_order=chapter_num,
            section_title=section_title,
            source_url=source_url,
            source_slug=source_slug,
            content_html=html,
            content_text=text,
            image_paths=image_paths,
        )
        count += 1
    return count


def import_signs(
    session: requests.Session,
    conn: psycopg.Connection,
    download: bool,
) -> int:
    page_url = f"{SOURCE_BASE}/theory/road-signs"
    print(f"  Fetching signs index: {page_url}")
    results = parse_signs_groups(session, SIGN_GROUPS, "road-signs", page_url, download)
    count = 0
    for group, html, text, image_paths in results:
        source_url = f"{SOURCE_BASE}/theory/road-signs#{group['slug_suffix']}"
        source_slug = f"theory-road-signs-{group['slug_suffix']}"
        insert_entry(
            conn,
            topic_key="road-signs",
            category="signs",
            chapter_num=None,
            sort_order=group["sort_order"],
            section_title=group["section_title"],
            source_url=source_url,
            source_slug=source_slug,
            content_html=html,
            content_text=text,
            image_paths=image_paths,
        )
        count += 1
    return count


def import_markings(
    session: requests.Session,
    conn: psycopg.Connection,
    download: bool,
) -> int:
    page_url = f"{SOURCE_BASE}/theory/road-markings"
    print(f"  Fetching markings index: {page_url}")
    results = parse_signs_groups(session, MARKING_GROUPS, "road-markings", page_url, download)
    count = 0
    for group, html, text, image_paths in results:
        source_url = f"{SOURCE_BASE}/theory/road-markings#{group['slug_suffix']}"
        source_slug = f"theory-road-markings-{group['slug_suffix']}"
        insert_entry(
            conn,
            topic_key="road-markings",
            category="markings",
            chapter_num=None,
            sort_order=group["sort_order"],
            section_title=group["section_title"],
            source_url=source_url,
            source_slug=source_slug,
            content_html=html,
            content_text=text,
            image_paths=image_paths,
        )
        count += 1
    return count


def import_regulator(
    session: requests.Session,
    conn: psycopg.Connection,
    download: bool,
) -> int:
    url = f"{SOURCE_BASE}/theory/regulator"
    slug = "theory-regulator"
    print(f"  Importing regulator: {url}")
    html, text, image_paths = parse_rich_page(session, url, "Регулювальник", slug, download)
    insert_entry(
        conn,
        topic_key="regulator",
        category="regulator",
        chapter_num=None,
        sort_order=1,
        section_title="Регулювальник",
        source_url=url,
        source_slug=slug,
        content_html=html,
        content_text=text,
        image_paths=image_paths,
    )
    print(f"  → {len(image_paths)} зображень збережено")
    return 1


def import_traffic_light(
    session: requests.Session,
    conn: psycopg.Connection,
    download: bool,
) -> int:
    url = f"{SOURCE_BASE}/theory/traffic-light"
    slug = "theory-traffic-light"
    print(f"  Importing traffic-light: {url}")
    html, text, image_paths = parse_rich_page(session, url, "Світлофор", slug, download)
    insert_entry(
        conn,
        topic_key="traffic-light",
        category="traffic-light",
        chapter_num=None,
        sort_order=1,
        section_title="Світлофор",
        source_url=url,
        source_slug=slug,
        content_html=html,
        content_text=text,
        image_paths=image_paths,
    )
    print(f"  → {len(image_paths)} зображень збережено")
    return 1


IMPORTERS: dict[str, Any] = {
    "rules": import_rules,
    "road-signs": import_signs,
    "road-markings": import_markings,
    "regulator": import_regulator,
    "traffic-light": import_traffic_light,
}


# ─── CLI entry point ─────────────────────────────────────────────────────────

def main() -> None:
    parser = argparse.ArgumentParser(
        description="Import official PDR theory into handbook_data (v3.0)",
    )
    parser.add_argument(
        "--topic",
        choices=list(IMPORTERS.keys()),
        help="Імпортувати тільки одну тему (rules / road-signs / road-markings / regulator / traffic-light)",
    )
    parser.add_argument(
        "--download-images",
        action="store_true",
        help="Завантажити зображення локально до /uploads/handbook",
    )
    parser.add_argument(
        "--reset",
        action="store_true",
        help="TRUNCATE handbook_data перед імпортом (видаляє всі попередні записи)",
    )
    args = parser.parse_args()

    topics_to_run = [args.topic] if args.topic else list(IMPORTERS.keys())
    session = make_session()
    total = 0

    with db() as conn:
        if args.reset:
            print("⚠  Очищення handbook_data (TRUNCATE)...")
            conn.execute("TRUNCATE TABLE handbook_data RESTART IDENTITY")
            conn.commit()
            print("✓  Таблицю очищено.\n")

        for topic in topics_to_run:
            print(f"\n── Тема: {topic} {'(з завантаженням зображень)' if args.download_images else ''}")
            importer = IMPORTERS[topic]
            try:
                count = importer(session, conn, args.download_images)
                conn.commit()
                total += count
                print(f"✓  {topic}: {count} записів додано/оновлено")
            except Exception as exc:
                print(f"✗  {topic}: критична помилка — {exc}")
                conn.rollback()

    print(f"\n═══ Готово: {total} записів у handbook_data ═══")


if __name__ == "__main__":
    main()