from __future__ import annotations

import argparse
import base64
import json
import os
import re
import sys
from pathlib import Path
from urllib.parse import urljoin, urlparse

import psycopg
import requests
from bs4 import BeautifulSoup, Comment, Tag
from dotenv import load_dotenv
from psycopg.rows import dict_row

from scripts.parsers.theory_sources import THEORY_CATEGORY_SEEDS

load_dotenv()

ROOT_DIR = Path(__file__).resolve().parents[2]
BASE_DIR = ROOT_DIR / "backend"
DB_URL = os.environ["DATABASE_URL"]
SITE_ROOT = "https://green-way.com.ua"
UPLOAD_ROOT = BASE_DIR / "uploads" / "theory"
HANDBOOK_UPLOAD_ROOT = BASE_DIR / "uploads" / "handbook"
MEDIA_MAP_ROOT = BASE_DIR / "uploads" / "maps"
UPLOAD_ROOT.mkdir(parents=True, exist_ok=True)
HANDBOOK_UPLOAD_ROOT.mkdir(parents=True, exist_ok=True)
MEDIA_MAP_ROOT.mkdir(parents=True, exist_ok=True)
RULES_MEDIA_MAP_PATH = HANDBOOK_UPLOAD_ROOT / "rules_media_map.json"
PLACEHOLDER_PATH = HANDBOOK_UPLOAD_ROOT / "placeholder.png"
PLACEHOLDER_URL = "/uploads/handbook/placeholder.png"

BRAND_REPLACEMENTS = {
    "GREEN-WAY": "DrivePrep",
    "Green Way": "DrivePrep",
    "Green-Way": "DrivePrep",
    "green-way.com.ua": "DrivePrep",
    "info@green-way.com.ua": "pdr.preparation@gmail.com",
    "support@pdr.com": "pdr.preparation@gmail.com",
}

REMOVE_TEXT_PATTERNS = (
    "Запитати викладача",
    "Коментарі користувачів",
    "Додати до обраного",
    "Перейти до обраного",
    "Експрес-тест",
    "Увійти",
    "Реєстрація",
    "Нагадати пароль",
    "Ваш коментар опубліковано",
)

ACADEMY_COURSES = [
    {
        "topic_slug": "academy-driving-basics",
        "category_slug": "academy",
        "title": "Основи водіння",
        "description": "Повний курс із базових навичок руху, термінів, ситуацій на дорозі та першої системної підготовки.",
        "source_url": "https://green-way.com.ua/uk/obuchenie/course/898",
    },
    {
        "topic_slug": "academy-road-safety",
        "category_slug": "academy",
        "title": "Безпека на дорозі",
        "description": "Поглиблений курс із правил, прогнозування ризиків, поведінки в потоці та безпечних сценаріїв для водія.",
        "source_url": "https://green-way.com.ua/uk/obuchenie/course/680",
    },
    {
        "topic_slug": "academy-technical-part",
        "category_slug": "academy",
        "title": "Технічна частина",
        "description": "Курс для глибшого розуміння технічних аспектів транспорту, контрольних тем і прикладних нюансів підготовки.",
        "source_url": "https://green-way.com.ua/uk/obuchenie/course/1100",
    },
]

LIBRARY_TOPICS = [
    {
        "topic_slug": "library-driving-manual",
        "category_slug": "library",
        "title": "Водіння авто",
        "description": "Практичний підручник із водіння автомобіля, маневрів, виїзду в місто та дорожніх сценаріїв.",
        "source_url": "https://green-way.com.ua/uk/dovidniki/pidruchnyk-z-vodinnja",
    },
    {
        "topic_slug": "library-car-structure",
        "category_slug": "library",
        "title": "Будова авто",
        "description": "Підручник із будови автомобіля, вузлів, агрегатів, технічних систем і базових принципів експлуатації.",
        "source_url": "https://green-way.com.ua/uk/dovidniki/pidruchnyk-po-vlashtuvannju-avtomobilja",
    },
    {
        "topic_slug": "library-medical-aid",
        "category_slug": "library",
        "title": "Медична допомога",
        "description": "Довідник із першої допомоги, дій у надзвичайних ситуаціях і безпеки водія та пасажирів.",
        "source_url": "https://green-way.com.ua/uk/dovidniki/medychna-dopomoga",
    },
    {
        "topic_slug": "library-legal-help",
        "category_slug": "library",
        "title": "Ваш адвокат",
        "description": "Поради щодо правових ситуацій, ДТП, поширених порушень і важливих юридичних дій для водія.",
        "source_url": "https://green-way.com.ua/uk/dovidniki/vash-advokat",
    },
]


def db():
    return psycopg.connect(DB_URL, row_factory=dict_row)


def log(message: str) -> None:
    print(message, flush=True)


def make_session() -> requests.Session:
    session = requests.Session()
    session.headers.update(
        {
            "User-Agent": "DrivePrep Content Importer/1.0",
            "Accept-Language": "uk-UA,uk;q=0.9,en;q=0.8",
        }
    )
    return session


def slugify(value: str) -> str:
    value = re.sub(r"[^a-zA-Z0-9а-яА-ЯіїєґІЇЄҐ]+", "-", value or "", flags=re.U)
    value = value.strip("-").lower()
    return value or "section"


def normalize_text(value: str) -> str:
    return re.sub(r"\s+", " ", (value or "").replace("\xa0", " ")).strip()


def preferred_title(menu_title: str | None, payload_title: str | None) -> str:
    menu = normalize_text(menu_title or "")
    payload = normalize_text(payload_title or "")
    if not payload:
        return menu
    if not menu:
        return payload
    if payload.casefold() == menu.casefold():
        return payload
    if payload.casefold() in {"вступ", "ознайомитися з курсом"} and menu:
        return menu
    if len(payload) < 6 and menu:
        return menu
    return payload


def extract_numeric_order(value: str) -> tuple[int, ...]:
    numbers = [int(match) for match in re.findall(r"\d+", value or "")]
    return tuple(numbers)


def section_sort_key(label: str, url: str) -> tuple[tuple[int, ...], str]:
    url_path = urlparse(url).path
    numeric = extract_numeric_order(url_path) or extract_numeric_order(label)
    if numeric:
        return numeric, normalize_text(label).casefold()
    return (10_000,), normalize_text(label).casefold()


def dedupe_section_links(links: list[tuple[str, str]]) -> list[tuple[str, str]]:
    unique: list[tuple[str, str]] = []
    seen_urls: set[str] = set()
    seen_signatures: set[tuple[tuple[int, ...], str]] = set()
    for text, url in links:
        normalized_text = normalize_text(text)
        if not normalized_text or url in seen_urls:
            continue
        signature = (extract_numeric_order(urlparse(url).path), normalized_text.casefold())
        if signature in seen_signatures:
            continue
        seen_urls.add(url)
        seen_signatures.add(signature)
        unique.append((normalized_text, url))
    return sorted(unique, key=lambda item: section_sort_key(item[0], item[1]))


def infer_chapter_num(label: str, url: str, fallback: int) -> int:
    numeric = extract_numeric_order(urlparse(url).path) or extract_numeric_order(label)
    if numeric:
        return int(numeric[-1])
    return fallback


def make_distinct_title(title: str, url: str, seen_titles: dict[str, int]) -> str:
    base_title = normalize_text(title)
    if not base_title:
        return title
    count = seen_titles.get(base_title.casefold(), 0) + 1
    seen_titles[base_title.casefold()] = count
    if count == 1:
        return base_title
    page_numbers = extract_numeric_order(urlparse(url).path)
    suffix = page_numbers[-1] if page_numbers else count
    return f"{base_title} — частина {suffix}"


def is_quiz_like_page(title: str, content_text: str) -> bool:
    haystack = normalize_text(f"{title} {content_text}").casefold()
    markers = (
        "контрольні питання",
        "розмірковуємо над запитанням",
        "залишилося часу",
        "правильна відповідь",
        "показати відповідь",
    )
    return any(marker in haystack for marker in markers)


def replace_branding(value: str) -> str:
    output = value
    for source, target in BRAND_REPLACEMENTS.items():
        output = output.replace(source, target)
    return output


def fetch_soup(session: requests.Session, url: str, retries: int = 4) -> BeautifulSoup:
    last_error: Exception | None = None
    for attempt in range(retries):
        try:
            response = session.get(url, timeout=20)
            response.raise_for_status()
            response.encoding = "utf-8"
            return BeautifulSoup(response.text, "html.parser")
        except Exception as error:  # pragma: no cover - network robustness
            last_error = error
            if attempt == retries - 1:
                break
    raise RuntimeError(f"Failed to fetch {url}: {last_error}")


def absolute_url(url: str) -> str:
    if not url:
        return ""
    return url if url.startswith("http") else urljoin(SITE_ROOT, url)


def ensure_handbook_placeholder() -> None:
    if PLACEHOLDER_PATH.exists() and PLACEHOLDER_PATH.stat().st_size > 0:
        return
    PLACEHOLDER_PATH.write_bytes(
        base64.b64decode(
            "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVQIHWP4////fwAJ+wP9KobjigAAAABJRU5ErkJggg=="
        )
    )


def parse_rule_marker(paragraph: Tag, fallback_section: int, fallback_item: int) -> tuple[str, int, str]:
    marker = ""
    clip_path = normalize_text(paragraph.get("data-clipboard-text") or "")
    clip_fragment = ""
    if clip_path:
        clip_fragment = clip_path.rstrip("/").split("/")[-1]
        if clip_fragment.startswith("punkt-"):
            clip_fragment = clip_fragment[len("punkt-"):]
    marker_span = paragraph.select_one(".text span[id]")
    if marker_span:
        marker = normalize_text(marker_span.get("id") or "")
    if not marker:
        paragraph_id = normalize_text(paragraph.get("id") or "")
        match = re.search(r"paragraph[_-](.+)$", paragraph_id)
        if match:
            marker = match.group(1).replace("_", "-")
    numeric_bits = [bit for bit in re.split(r"[^0-9]+", marker) if bit]
    section_num = fallback_section if fallback_section == 35 else (int(numeric_bits[0]) if numeric_bits else fallback_section)
    if fallback_section == 35 and clip_fragment:
        item_token = slugify(clip_fragment).replace("-", "_")
    elif numeric_bits:
        item_token = "_".join(numeric_bits)
    elif clip_fragment:
        item_token = slugify(clip_fragment).replace("-", "_")
    else:
        item_token = f"{fallback_section}_{fallback_item}"
    marker_key = marker or clip_fragment or f"{section_num}-{fallback_item}"
    return marker_key, section_num, item_token


def make_rules_asset_filename(section_num: int, item_token: str, source_url: str, index: int) -> str:
    path = urlparse(absolute_url(source_url)).path
    ext = Path(path).suffix.lower() or ".jpg"
    if len(ext) > 6:
        ext = ".jpg"

    stem = Path(path).stem
    if "/znaki/" in path:
        official = re.sub(r"[^0-9.]+", "", stem).strip(".")
        official = official.replace(".", "_") or item_token
        return f"sign_{official}{ext}"
    if "/razmetka/" in path:
        if re.fullmatch(r"\d+(?:\.\d+)*", stem):
            official = stem.replace(".", "_")
            return f"marking_{official}{ext}"

    return f"section_{section_num}_item_{item_token}_{index:02d}{ext}"


def download_rules_asset(session: requests.Session, source_url: str, section_num: int, item_token: str, index: int) -> str:
    ensure_handbook_placeholder()
    if not source_url:
        return PLACEHOLDER_URL
    absolute = absolute_url(source_url)
    filename = make_rules_asset_filename(section_num, item_token, absolute, index)
    target = HANDBOOK_UPLOAD_ROOT / filename
    if target.exists() and target.stat().st_size > 0:
        return f"/uploads/handbook/{filename}"
    for attempt in range(3):
        try:
            response = session.get(absolute, timeout=20)
            response.raise_for_status()
            target.write_bytes(response.content)
            return f"/uploads/handbook/{filename}"
        except Exception:
            if attempt == 2:
                return PLACEHOLDER_URL
    return PLACEHOLDER_URL


def sanitize_rule_paragraph_html(
    session: requests.Session,
    paragraph: Tag,
    fallback_section: int,
    fallback_item: int,
) -> tuple[str, str, list[dict[str, str]], str | None, dict[str, object]]:
    paragraph_soup = BeautifulSoup(str(paragraph), "html.parser")
    clone = paragraph_soup.find()
    if not clone:
        return "", "", [], None, {}

    marker_key, section_num, item_token = parse_rule_marker(clone, fallback_section, fallback_item)
    clip_path = normalize_text(clone.get("data-clipboard-text") or "")
    clone["id"] = f"rule-item-{item_token}"

    for tag in clone.select(
        "script, style, .info-pdd.expert, .info-pdd.expert.history, .buttons, .like_block, .addtofav_desc, .addtofav_description"
    ):
        tag.decompose()

    embed_url: str | None = None
    for video in clone.select(".video"):
        holder = video.select_one("[data-src]")
        video_code = normalize_text(holder.get("data-src") if holder else "")
        if not video_code:
            video.decompose()
            continue
        iframe = paragraph_soup.new_tag(
            "iframe",
            src=f"https://www.youtube.com/embed/{video_code}",
            title="Відео до теми",
            loading="lazy",
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share",
            allowfullscreen=True,
        )
        iframe["class"] = ["aspect-video", "w-full", "rounded-2xl", "border", "border-slate-200", "dark:border-slate-700"]
        video.clear()
        video["class"] = ["mt-4"]
        video.append(iframe)
        if not embed_url:
            embed_url = str(iframe.get("src") or "")

    assets: list[dict[str, str]] = []
    mapping_assets: list[str] = []
    for image_index, image in enumerate(clone.select(".img-pdd img, img"), start=1):
        raw_src = image.get("data-src") or image.get("data-original") or image.get("src") or ""
        local_url = download_rules_asset(session, raw_src, section_num, item_token, image_index)
        image["src"] = local_url
        image.attrs.pop("srcset", None)
        image.attrs.pop("data-src", None)
        image.attrs.pop("data-original", None)
        image.attrs.pop("style", None)
        image["loading"] = "lazy"
        image["class"] = ["w-full", "rounded-2xl", "border", "border-slate-200", "bg-white", "object-contain", "dark:border-slate-700", "dark:bg-slate-950"]
        alt_text = normalize_text(image.get("alt") or image.get("title") or "")
        assets.append(
            {
                "asset_url": local_url,
                "alt_text": alt_text,
                "caption": alt_text,
            }
        )
        mapping_assets.append(local_url)

    for image_block in clone.select(".img-pdd"):
        image_block["class"] = ["mt-4", "grid", "gap-3"]

    for anchor in clone.select("a"):
        href = anchor.get("href") or ""
        anchor_text = normalize_text(anchor.get_text(" ", strip=True))
        if any(pattern.lower() in anchor_text.lower() for pattern in REMOVE_TEXT_PATTERNS):
            anchor.decompose()
            continue
        if "green-way.com.ua" in href or href.startswith("/uk/"):
            anchor["href"] = "#"
        if not anchor_text and not anchor.select("img"):
            anchor.unwrap()

    html_value = replace_branding(str(clone))
    html_value = re.sub(r">\s+<", "><", html_value)
    text_value = replace_branding(normalize_text(clone.get_text(" ", strip=True)))
    mapping_payload = {
        "paragraph_key": marker_key,
        "item_token": item_token,
        "section_num": section_num,
        "source_fragment": clip_path,
        "asset_urls": mapping_assets or [PLACEHOLDER_URL],
    }
    return html_value, text_value, assets, embed_url, mapping_payload


def make_asset_basename(scope_slug: str, index: int, hint: str | None = None) -> str:
    normalized_hint = slugify(normalize_text(hint or ""))[:48]
    if normalized_hint:
        return f"{scope_slug}-{normalized_hint}-{index:03d}"
    return f"{scope_slug}-image-{index:03d}"


def derive_image_hint(image: Tag) -> str:
    direct_hint = normalize_text(image.get("alt") or image.get("title") or "")
    if direct_hint:
        return direct_hint

    parent = image.parent if isinstance(image.parent, Tag) else None
    if parent:
        parent_text = normalize_text(parent.get_text(" ", strip=True))
        if parent_text:
            return parent_text[:80]

        previous = parent.find_previous(["h2", "h3", "h4", "p", "li"])
        if previous:
            previous_text = normalize_text(previous.get_text(" ", strip=True))
            if previous_text:
                return previous_text[:80]

        following = parent.find_next(["h2", "h3", "h4", "p", "li"])
        if following:
            following_text = normalize_text(following.get_text(" ", strip=True))
            if following_text:
                return following_text[:80]

    return ""


def topic_root_slug(scope_slug: str) -> str:
    return re.sub(r"-\d{2,3}$", "", scope_slug or "")


def derive_generic_media_target(scope_slug: str, source_url: str, index: int, ext: str) -> tuple[Path, str, str]:
    root_slug = topic_root_slug(scope_slug)
    path = urlparse(absolute_url(source_url)).path
    numbers = extract_numeric_order(path)

    if root_slug.startswith("academy-"):
        course_match = re.search(r"/course/(\d+)/(\d+)", path)
        course_id = course_match.group(1) if course_match else "0000"
        lecture_num = course_match.group(2) if course_match else str(numbers[-1] if numbers else index)
        folder = UPLOAD_ROOT / "academy" / f"course_{course_id}"
        filename = f"academy_course_{course_id}_lecture_{lecture_num}_{index:02d}{ext}"
        public_url = f"/uploads/theory/academy/course_{course_id}/{filename}"
        return folder, filename, public_url

    if root_slug == "video-lectures":
        course_match = re.search(r"/course/(\d+)/(\d+)", path)
        course_id = course_match.group(1) if course_match else "video"
        lecture_num = course_match.group(2) if course_match else str(numbers[-1] if numbers else index)
        folder = UPLOAD_ROOT / "video-lectures"
        filename = f"academy_course_{course_id}_lecture_{lecture_num}_{index:02d}{ext}"
        public_url = f"/uploads/theory/video-lectures/{filename}"
        return folder, filename, public_url

    if root_slug.startswith("library-"):
        topic_token = root_slug.removeprefix("library-").replace("-", "_")
        section_num = numbers[-1] if numbers else 1
        folder = UPLOAD_ROOT / "library" / topic_token
        filename = f"library_{topic_token}_section_{section_num}_{index:02d}{ext}"
        public_url = f"/uploads/theory/library/{topic_token}/{filename}"
        return folder, filename, public_url

    if root_slug == "driving-license":
        part_num = numbers[-1] if numbers else 1
        folder = UPLOAD_ROOT / "driving-license"
        filename = f"driving_license_part_{part_num}_{index:02d}{ext}"
        public_url = f"/uploads/theory/driving-license/{filename}"
        return folder, filename, public_url

    if root_slug == "penalty-table":
        folder = UPLOAD_ROOT / "penalty-table"
        filename = f"penalty_table_{index:02d}{ext}"
        public_url = f"/uploads/theory/penalty-table/{filename}"
        return folder, filename, public_url

    folder = UPLOAD_ROOT / root_slug
    filename = f"{make_asset_basename(root_slug, index)}{ext}"
    public_url = f"/uploads/theory/{root_slug}/{filename}"
    return folder, filename, public_url


def download_asset(session: requests.Session, url: str, scope_slug: str, index: int, hint: str | None = None) -> str | None:
    if not url:
        return None
    absolute = absolute_url(url)
    parsed = urlparse(absolute)
    ext = Path(parsed.path).suffix.lower() or ".jpg"
    if len(ext) > 6:
        ext = ".jpg"
    folder, filename, public_url = derive_generic_media_target(scope_slug, absolute, index, ext)
    folder.mkdir(parents=True, exist_ok=True)
    target = folder / filename
    if target.exists() and target.stat().st_size > 0:
        return public_url
    for attempt in range(3):
        try:
            response = session.get(absolute, timeout=20)
            response.raise_for_status()
            target.write_bytes(response.content)
            return public_url
        except Exception:
            if attempt == 2:
                return None
    return None


def remove_noise(node: Tag) -> None:
    selectors = [
        "script",
        "style",
        "noscript",
        "form",
        "button",
        ".express-test-top",
        ".nav-block",
        ".left-menu",
        ".left-menu-background",
        ".left-menu-mob-background",
        ".comment_question",
        ".like_block",
        ".addtofav_desc",
        ".addtofav_description",
        ".send",
        ".buttons",
        ".modal",
        ".how_it_works_vidblock",
        ".video",
        ".aspect-ratio",
    ]
    for selector in selectors:
        for tag in node.select(selector):
            tag.decompose()
    for element in node.find_all(string=lambda text: isinstance(text, Comment)):
        element.extract()


def clean_node_html(session: requests.Session, node: Tag, scope_slug: str) -> tuple[str, str, list[dict[str, str]], str | None]:
    soup = BeautifulSoup(str(node), "html.parser")
    root = soup.find()
    if not root:
        return "", "", [], None

    remove_noise(root)

    comment_blocks = root.select(".info-pdd.expert, .info-pdd.expert.history")
    for block in comment_blocks:
        block.decompose()

    assets: list[dict[str, str]] = []
    embed_url: str | None = None

    for index, iframe in enumerate(root.select("iframe"), start=1):
        raw_src = iframe.get("data-src") or iframe.get("src") or ""
        if not raw_src or "googletagmanager.com" in raw_src or raw_src.startswith("javascript:"):
            iframe.decompose()
            continue
        src = absolute_url(raw_src)
        if not src.startswith("http"):
            iframe.decompose()
            continue
        if not embed_url and src:
            embed_url = src
        iframe.decompose()

    for index, image in enumerate(root.select("img"), start=1):
        src = image.get("data-src") or image.get("data-original") or image.get("src") or ""
        if src.startswith("data:image/"):
            src = image.get("data-src") or image.get("data-original") or ""
        hint = derive_image_hint(image)
        local_url = download_asset(session, src, scope_slug, index, hint)
        if local_url:
            image["src"] = local_url
            image.attrs.pop("srcset", None)
            image.attrs.pop("data-src", None)
            image.attrs.pop("data-original", None)
            image["loading"] = "lazy"
            image["class"] = ["w-full", "rounded-lg", "object-contain"]
            image.attrs.pop("style", None)
            assets.append(
                {
                    "asset_url": local_url,
                    "alt_text": normalize_text(image.get("alt") or hint or ""),
                    "caption": normalize_text(image.get("title") or image.get("alt") or hint or ""),
                }
            )
        else:
            image.decompose()

    for hr in root.select("hr"):
        hr.decompose()

    for anchor in root.select("a"):
        text = normalize_text(anchor.get_text(" ", strip=True))
        href = anchor.get("href") or ""
        if any(pattern.lower() in text.lower() for pattern in REMOVE_TEXT_PATTERNS):
            anchor.decompose()
            continue
        if "green-way.com.ua" in href or href.startswith("/uk/") or href.startswith("/dovidniki/") or href.startswith("/test-pdd/"):
            anchor["href"] = "#"
        if not text and not anchor.select("img"):
            anchor.unwrap()

    html_value = replace_branding(str(root))
    html_value = re.sub(r">\s+<", "><", html_value)
    text_value = replace_branding(normalize_text(root.get_text(" ", strip=True)))
    return html_value, text_value, assets, embed_url


def extract_rule_page(session: requests.Session, url: str, scope_slug: str) -> dict[str, object]:
    soup = fetch_soup(session, url)
    content = soup.select_one("main .container.paragraphs.listing.menu-header-margin .col-sm-12")
    title = normalize_text(soup.find("h1").get_text(" ", strip=True) if soup.find("h1") else "")
    if not content:
        raise RuntimeError(f"Cannot find content for {url}")

    section_match = re.search(r"rozdil-(\d+)", url)
    section_num = int(section_match.group(1)) if section_match else 0
    content_parts: list[str] = []
    content_text_parts: list[str] = []
    all_assets: list[dict[str, str]] = []
    media_map: dict[str, dict[str, object]] = {}
    embed_url: str | None = None

    paragraphs = content.select(".paragraph")
    if not paragraphs:
        raise RuntimeError(f"No rule paragraphs found for {url}")

    for paragraph_index, paragraph in enumerate(paragraphs, start=1):
        html_value, text_value, assets, paragraph_embed, paragraph_map = sanitize_rule_paragraph_html(
            session,
            paragraph,
            section_num or paragraph_index,
            paragraph_index,
        )
        if text_value and not any(pattern.lower() in text_value.lower() for pattern in REMOVE_TEXT_PATTERNS):
            content_parts.append(html_value)
            content_text_parts.append(text_value)
            all_assets.extend(assets)
            if paragraph_map.get("paragraph_key"):
                media_map[str(paragraph_map["paragraph_key"])] = paragraph_map
            if not embed_url and paragraph_embed:
                embed_url = paragraph_embed

    return {
        "title": title,
        "description": normalize_text(content_text_parts[0] if content_text_parts else title)[:280],
        "content_html": "".join(content_parts),
        "content_text": normalize_text(" ".join(content_text_parts)),
        "comment_html": "",
        "embed_url": embed_url,
        "assets": all_assets,
        "media_map": media_map,
    }


def extract_generic_page(session: requests.Session, url: str, scope_slug: str) -> dict[str, object]:
    soup = fetch_soup(session, url)
    title = normalize_text(soup.find("h1").get_text(" ", strip=True) if soup.find("h1") else "")
    selectors = [
        "main .col-sm-12.lesson-content",
        "main .container.paragraphs.listing.menu-header-margin .col-sm-12",
        "main .container.education.lesson .col-sm-12.lesson-content",
        "main .container.paragraphs.listing",
        "main .container",
    ]
    content = None
    for selector in selectors:
        content = soup.select_one(selector)
        if content:
            break
    if not content:
        raise RuntimeError(f"Cannot find content for {url}")

    cloned = BeautifulSoup(str(content), "html.parser").find()
    if not cloned:
        raise RuntimeError(f"Cannot clone content for {url}")

    first_h1 = cloned.find("h1")
    if first_h1:
        first_h1.decompose()

    for comment_block in cloned.select(".info-pdd.expert, .info-pdd.expert.history"):
        comment_block.decompose()

    html_value, text_value, assets, embed_url = clean_node_html(session, cloned, scope_slug)
    return {
        "title": title,
        "description": normalize_text(text_value)[:280],
        "content_html": html_value,
        "content_text": text_value,
        "comment_html": "",
        "embed_url": embed_url,
        "assets": assets,
    }


def upsert_category(conn, slug: str, title: str, description: str, sort_order: int) -> int:
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


def upsert_topic(conn, category_id: int, slug: str, title: str, description: str, topic_type: str, sort_order: int, source_url: str) -> int:
    row = conn.execute(
        """
        INSERT INTO theory_topics (category_id, slug, title, description, topic_type, sort_order, source_url)
        VALUES (%s, %s, %s, %s, %s, %s, %s)
        ON CONFLICT (slug) DO UPDATE
        SET category_id = EXCLUDED.category_id,
            title = EXCLUDED.title,
            description = EXCLUDED.description,
            topic_type = EXCLUDED.topic_type,
            sort_order = EXCLUDED.sort_order,
            source_url = EXCLUDED.source_url
        RETURNING id
        """,
        (category_id, slug, title, description, topic_type, sort_order, source_url),
    ).fetchone()
    return int(row["id"])


def upsert_section(
    conn,
    topic_id: int,
    slug: str,
    title: str,
    description: str,
    content_html: str,
    content_text: str,
    comment_html: str,
    video_url: str | None,
    embed_url: str | None,
    chapter_num: int | None,
    sort_order: int,
    source_url: str,
    assets: list[dict[str, str]],
) -> int:
    row = conn.execute(
        """
        INSERT INTO theory_sections (
            topic_id, slug, title, description, comment_html, content_html, content_text,
            video_url, embed_url, chapter_num, sort_order, source_url
        )
        VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
        ON CONFLICT (slug) DO UPDATE
        SET topic_id = EXCLUDED.topic_id,
            title = EXCLUDED.title,
            description = EXCLUDED.description,
            comment_html = EXCLUDED.comment_html,
            content_html = EXCLUDED.content_html,
            content_text = EXCLUDED.content_text,
            video_url = EXCLUDED.video_url,
            embed_url = EXCLUDED.embed_url,
            chapter_num = EXCLUDED.chapter_num,
            sort_order = EXCLUDED.sort_order,
            source_url = EXCLUDED.source_url
        RETURNING id
        """,
        (
            topic_id,
            slug,
            title,
            description,
            comment_html or None,
            content_html,
            content_text,
            video_url,
            embed_url,
            chapter_num,
            sort_order,
            source_url,
        ),
    ).fetchone()
    section_id = int(row["id"])
    conn.execute("DELETE FROM theory_assets WHERE section_id = %s", (section_id,))
    for index, asset in enumerate(assets, start=1):
        conn.execute(
            """
            INSERT INTO theory_assets (section_id, asset_type, asset_url, alt_text, caption, sort_order)
            VALUES (%s, 'image', %s, %s, %s, %s)
            """,
            (
                section_id,
                asset.get("asset_url"),
                asset.get("alt_text") or None,
                asset.get("caption") or None,
                index,
            ),
        )
    return section_id


def reset_theory(conn) -> None:
    conn.execute("TRUNCATE TABLE theory_assets, theory_sections, theory_topics, theory_categories RESTART IDENTITY CASCADE")
    conn.execute("TRUNCATE TABLE handbook_data RESTART IDENTITY")
    conn.commit()


def lock_theory_tables(conn) -> None:
    conn.execute(
        """
        LOCK TABLE
            theory_assets,
            theory_sections,
            theory_topics,
            theory_categories,
            handbook_data
        IN ACCESS EXCLUSIVE MODE
        """
    )


def clear_category_content(conn, category_id: int) -> None:
    conn.execute(
        """
        DELETE FROM theory_assets
        WHERE section_id IN (
            SELECT s.id
            FROM theory_sections s
            JOIN theory_topics t ON t.id = s.topic_id
            WHERE t.category_id = %s
        )
        """,
        (category_id,),
    )
    conn.execute(
        """
        DELETE FROM theory_sections
        WHERE topic_id IN (
            SELECT id FROM theory_topics WHERE category_id = %s
        )
        """,
        (category_id,),
    )
    conn.execute("DELETE FROM theory_topics WHERE category_id = %s", (category_id,))


def import_rules(session: requests.Session, conn) -> None:
    ensure_handbook_placeholder()
    category_id = upsert_category(
        conn,
        "rules",
        "??????? ?????????? ????",
        "???????? ???? ??? ?? ???????? ?? ???????, ???????????? ?? ??????? ??????????.",
        1,
    )
    clear_category_content(conn, category_id)
    topic_id = upsert_topic(
        conn,
        category_id,
        "rules",
        "??????? ?????????? ????",
        "??????? ??????? ??? ?? ?????????? ??????????? DrivePrep.",
        "topic",
        1,
        "https://green-way.com.ua/uk/dovidniki/pdr/rozdil-1",
    )
    index_soup = fetch_soup(session, "https://green-way.com.ua/uk/dovidniki/pdr/rozdil-1")
    links: list[str] = []
    for anchor in index_soup.select("main a[href]"):
        href = anchor.get("href") or ""
        full = absolute_url(href)
        if not href.startswith("/uk/dovidniki/pdr/rozdil-"):
            continue
        chapter_numbers = extract_numeric_order(urlparse(full).path)
        chapter_number = chapter_numbers[-1] if chapter_numbers else None
        if chapter_number is None or chapter_number < 1 or chapter_number > 35:
            continue
        if full not in links:
            links.append(full)
    links = sorted(links, key=lambda value: extract_numeric_order(urlparse(value).path) or (999,))
    log(f"[rules] sections discovered: {len(links)}")

    rules_media_map: dict[str, dict[str, object]] = {}
    for index, url in enumerate(links, start=1):
        try:
            payload = extract_rule_page(session, url, f"rules-{index:02d}")
        except Exception as error:
            log(f"[rules] skip page {url}: {error}")
            continue
        log(f"[rules] import {index}/{len(links)} {url}")
        upsert_section(
            conn,
            topic_id,
            f"rules-{index:02d}",
            str(payload["title"]),
            str(payload["description"]),
            str(payload["content_html"]),
            str(payload["content_text"]),
            str(payload["comment_html"]),
            None,
            payload.get("embed_url"),
            index,
            index,
            url,
            list(payload["assets"]),
        )
        rules_media_map[f"rules-{index:02d}"] = {
            "section_slug": f"rules-{index:02d}",
            "section_title": str(payload["title"]),
            "source_url": url,
            "paragraphs": payload.get("media_map", {}),
        }

    RULES_MEDIA_MAP_PATH.write_text(
        json.dumps(rules_media_map, ensure_ascii=False, indent=2),
        encoding="utf-8",
    )


def extract_section_links(session: requests.Session, root_url: str) -> list[tuple[str, str]]:
    soup = fetch_soup(session, root_url)
    links: list[tuple[str, str]] = []
    for anchor in soup.select("main a[href]"):
        href = anchor.get("href") or ""
        text = normalize_text(anchor.get_text(" ", strip=True))
        if not href.startswith("/uk/"):
            continue
        full = absolute_url(href)
        if full.startswith(root_url.rstrip("/") + "/") and text:
            candidate = (text, full)
            if candidate not in links:
                links.append(candidate)
    return dedupe_section_links(links)


def import_library(session: requests.Session, conn) -> None:
    category_id = upsert_category(
        conn,
        "library",
        "Бібліотека",
        "Довідники з водіння, будови авто, медичної допомоги, правових питань і практичних порад для водіїв.",
        2,
    )
    clear_category_content(conn, category_id)
    for sort_order, item in enumerate(LIBRARY_TOPICS, start=1):
        log(f"[library] topic {item['topic_slug']}")
        topic_id = upsert_topic(
            conn,
            category_id,
            item["topic_slug"],
            item["title"],
            item["description"],
            "topic",
            sort_order,
            item["source_url"],
        )
        section_links = extract_section_links(session, item["source_url"])
        page_links = []
        seen_urls = set()
        for text, url in section_links:
            if "списком" in text.lower() or text.lower().startswith("читати"):
                continue
            if url in seen_urls:
                continue
            seen_urls.add(url)
            page_links.append((text, url))
        if not page_links:
            page_links = [(item["title"], item["source_url"])]
        log(f"[library] {item['topic_slug']} sections discovered: {len(page_links)}")
        for index, (menu_title, url) in enumerate(page_links, start=1):
            try:
                payload = extract_generic_page(session, url, f"{item['topic_slug']}-{index:02d}")
            except Exception as error:
                log(f"[library] skip page {url}: {error}")
                continue
            log(f"[library] import {item['topic_slug']} {index}/{len(page_links)} {url}")
            title = preferred_title(menu_title, str(payload["title"]))
            description = normalize_text(str(payload["description"]) or title)[:280]
            chapter_num = infer_chapter_num(menu_title, url, index)
            upsert_section(
                conn,
                topic_id,
                f"{item['topic_slug']}-{index:02d}",
                title,
                description,
                str(payload["content_html"]),
                str(payload["content_text"]),
                str(payload["comment_html"]),
                None,
                payload.get("embed_url"),
                chapter_num,
                index,
                url,
                list(payload["assets"]),
            )
        conn.commit()


def import_driving_license(session: requests.Session, conn) -> None:
    category_id = upsert_category(
        conn,
        "driving-license",
        "Отримання посвідчення",
        "Структурований довідник про теоретичний і практичний іспити, документи, вартість і повторні спроби.",
        3,
    )
    clear_category_content(conn, category_id)
    topic_id = upsert_topic(
        conn,
        category_id,
        "driving-license",
        "Отримання посвідчення",
        "Усе про іспити, документи, маршрути, обмін посвідчення та підготовку до сервісного центру.",
        "topic",
        1,
        "https://green-way.com.ua/uk/dovidniki/driving_license",
    )
    links = [
        ("Все про складання теоретичного іспиту в СЦ", "https://green-way.com.ua/uk/dovidniki/driving_license/part-1"),
        ("Все про складання практичного іспиту в СЦ", "https://green-way.com.ua/uk/dovidniki/driving_license/part-2"),
        ("Все про обмін посвідчення водія через 2 роки", "https://green-way.com.ua/uk/dovidniki/driving_license/part-3"),
    ]
    log(f"[driving-license] sections discovered: {len(links)}")
    for index, (menu_title, url) in enumerate(links, start=1):
        try:
            payload = extract_generic_page(session, url, f"driving-license-{index:02d}")
        except Exception as error:
            log(f"[driving-license] skip page {url}: {error}")
            continue
        log(f"[driving-license] import {index}/{len(links)} {url}")
        title = preferred_title(menu_title, str(payload["title"]))
        description = normalize_text(str(payload["description"]) or title)[:280]
        chapter_num = infer_chapter_num(menu_title, url, index)
        upsert_section(
            conn,
            topic_id,
            f"driving-license-{index:02d}",
            title,
            description,
            str(payload["content_html"]),
            str(payload["content_text"]),
            str(payload["comment_html"]),
            None,
            payload.get("embed_url"),
            chapter_num,
            index,
            url,
            list(payload["assets"]),
        )
    conn.commit()


def import_penalties(session: requests.Session, conn) -> None:
    category_id = upsert_category(
        conn,
        "penalty-table",
        "Таблиця штрафів",
        "Актуальні санкції та штрафи ПДР у впорядкованому форматі для швидкого пошуку і повторення.",
        7,
    )
    clear_category_content(conn, category_id)
    topic_id = upsert_topic(
        conn,
        category_id,
        "penalty-table",
        "Таблиця штрафів",
        "Оновлена таблиця штрафів та санкцій для водіїв і пішоходів.",
        "topic",
        1,
        "https://green-way.com.ua/uk/test-pdd/information/penalty_information",
    )
    try:
        payload = extract_generic_page(session, "https://green-way.com.ua/uk/test-pdd/information/penalty_information", "penalty-table")
    except Exception as error:
        log(f"[penalty-table] skip main page: {error}")
        return
    log("[penalty-table] import main section")
    upsert_section(
        conn,
        topic_id,
        "penalty-table-main",
        str(payload["title"]),
        str(payload["description"]),
        str(payload["content_html"]),
        str(payload["content_text"]),
        str(payload["comment_html"]),
        None,
        payload.get("embed_url"),
        1,
        1,
        "https://green-way.com.ua/uk/test-pdd/information/penalty_information",
        list(payload["assets"]),
    )
    conn.commit()


def import_academy(session: requests.Session, conn) -> list[dict[str, object]]:
    category_id = upsert_category(
        conn,
        "academy",
        "Академія",
        "Premium-курси з поясненнями, ілюстраціями, локальними матеріалами та відеовставками для послідовного навчання.",
        4,
    )
    clear_category_content(conn, category_id)
    video_candidates: list[dict[str, object]] = []
    for sort_order, course in enumerate(ACADEMY_COURSES, start=1):
        log(f"[academy] topic {course['topic_slug']}")
        topic_id = upsert_topic(
            conn,
            category_id,
            course["topic_slug"],
            course["title"],
            course["description"],
            "premium_course",
            sort_order,
            course["source_url"],
        )
        lesson_links = extract_section_links(session, course["source_url"])
        if len(lesson_links) <= 1:
            lesson_soup = fetch_soup(session, lesson_links[0][1] if lesson_links else course["source_url"])
            lesson_links = []
            course_prefix = course["source_url"].rstrip("/") + "/"
            for anchor in lesson_soup.select("div.left-menu a[href], main a[href]"):
                href = absolute_url(anchor.get("href") or "")
                text = normalize_text(anchor.get_text(" ", strip=True))
                if href.startswith(course_prefix) and text:
                    candidate = (text, href)
                    if candidate not in lesson_links:
                        lesson_links.append(candidate)
        filtered_links = []
        seen = set()
        for text, url in dedupe_section_links(lesson_links):
            lowered = normalize_text(text).casefold()
            if "контроль" in lowered or "quiz" in lowered or url in seen:
                continue
            seen.add(url)
            filtered_links.append((text, url))
        log(f"[academy] {course['topic_slug']} lessons discovered: {len(filtered_links)}")
        imported_signatures: set[tuple[str, str]] = set()
        seen_titles: dict[str, int] = {}
        for index, (menu_title, url) in enumerate(filtered_links, start=1):
            try:
                payload = extract_generic_page(session, url, f"{course['topic_slug']}-{index:02d}")
            except Exception as error:
                log(f"[academy] skip page {url}: {error}")
                continue
            if is_quiz_like_page(str(payload["title"]), str(payload["content_text"])):
                log(f"[academy] skip quiz page {url}")
                continue
            title = preferred_title(menu_title, str(payload["title"]))
            content_signature = (
                normalize_text(title).casefold(),
                normalize_text(str(payload["content_text"]))[:500].casefold(),
            )
            if content_signature in imported_signatures:
                log(f"[academy] skip duplicate page {url}")
                continue
            imported_signatures.add(content_signature)
            title = make_distinct_title(title, url, seen_titles)
            log(f"[academy] import {course['topic_slug']} {index}/{len(filtered_links)} {url}")
            description = normalize_text(str(payload["description"]) or title)[:280]
            upsert_section(
                conn,
                topic_id,
                f"{course['topic_slug']}-{index:02d}",
                title,
                description,
                str(payload["content_html"]),
                str(payload["content_text"]),
                str(payload["comment_html"]),
                None,
                payload.get("embed_url"),
                index,
                index,
                url,
                list(payload["assets"]),
            )
            if payload.get("embed_url"):
                video_candidates.append(
                    {
                        "title": title,
                        "description": description,
                        "content_html": payload["content_html"],
                        "content_text": payload["content_text"],
                        "comment_html": payload["comment_html"],
                        "embed_url": payload["embed_url"],
                        "assets": payload["assets"],
                        "source_url": url,
                    }
                )
        conn.commit()
    return video_candidates


def import_video_lectures(conn, video_candidates: list[dict[str, object]]) -> None:
    category_id = upsert_category(
        conn,
        "video-lectures",
        "Відеолекції",
        "Окремий Premium-розділ із відеолекціями та стислими конспектами до найважливіших тем підготовки.",
        5,
    )
    clear_category_content(conn, category_id)
    topic_id = upsert_topic(
        conn,
        category_id,
        "video-lectures",
        "Відеолекції",
        "Добірка лекцій із відеовставками та конспектами для швидкого повторення матеріалу.",
        "video",
        1,
        "https://green-way.com.ua/uk/obuchenie",
    )
    log(f"[video-lectures] candidates: {len(video_candidates[:24])}")
    for index, payload in enumerate(video_candidates[:24], start=1):
        log(f"[video-lectures] import {index}/{min(len(video_candidates), 24)} {payload['title']}")
        upsert_section(
            conn,
            topic_id,
            f"video-lectures-{index:02d}",
            str(payload["title"]),
            str(payload["description"]),
            str(payload["content_html"]),
            str(payload["content_text"]),
            str(payload["comment_html"]),
            None,
            str(payload["embed_url"]),
            index,
            index,
            str(payload["source_url"]),
            list(payload["assets"]),
        )
    conn.commit()


def import_difficult_questions(conn) -> None:
    category_id = upsert_category(
        conn,
        "difficult-questions",
        "Робота над помилками мільйонів",
        "Найскладніші питання ПДР, на яких користувачі помиляються найчастіше, з поясненнями та швидким повторенням.",
        6,
    )
    clear_category_content(conn, category_id)
    topic_id = upsert_topic(
        conn,
        category_id,
        "difficult-questions",
        "Робота над помилками мільйонів",
        "Добірка складних запитань із поясненнями та правильною відповіддю.",
        "topic",
        1,
        "https://green-way.com.ua/uk/test-pdd/top-difficult",
    )
    rows = conn.execute(
        """
        WITH question_stats AS (
            SELECT
                q.id,
                q.question_text,
                q.options,
                q.correct_ans,
                COALESCE(q.explanation_html, q.explanation, '') AS explanation_html,
                q.images,
                COALESCE(
                    SUM(CASE WHEN ua.is_correct = FALSE THEN 1 ELSE 0 END)::float / NULLIF(COUNT(ua.id), 0),
                    0
                ) AS fail_ratio,
                COUNT(ua.id) AS attempts
            FROM questions q
            LEFT JOIN user_answers ua ON ua.question_id = q.id
            GROUP BY q.id
        )
        SELECT *
        FROM question_stats
        ORDER BY fail_ratio DESC, attempts DESC, id
        LIMIT 100
        """
    ).fetchall()
    if not rows:
        return
    log(f"[difficult-questions] rows discovered: {len(rows)}")
    html_parts = []
    text_parts = []
    for index, row in enumerate(rows, start=1):
        options = row["options"] or []
        correct_index = int(row["correct_ans"] or 0)
        normalized_options = []
        for option in options:
            if isinstance(option, dict):
                normalized_options.append(replace_branding(str(option.get("text") or option.get("option_text") or "")))
            else:
                normalized_options.append(replace_branding(str(option)))
        options_html = "".join(
            f"<li><strong>{'Правильна відповідь:' if idx == correct_index else 'Варіант:'}</strong> {option}</li>"
            for idx, option in enumerate(normalized_options)
        )
        explanation_html = replace_branding(str(row["explanation_html"] or ""))
        html_parts.append(
            f"""
            <section class="rounded-3xl border border-slate-200 bg-white p-5">
              <h3>{index}. {replace_branding(str(row['question_text']))}</h3>
              <ul>{options_html}</ul>
              {f'<div class="mt-3">{explanation_html}</div>' if explanation_html else ''}
            </section>
            """
        )
        text_parts.append(f"{index}. {normalize_text(str(row['question_text']))}")
    upsert_section(
        conn,
        topic_id,
        "difficult-questions-main",
        "Робота над помилками мільйонів",
        "100 найскладніших запитань для повторення й глибшого опрацювання.",
        "".join(html_parts),
        " ".join(text_parts),
        "",
        None,
        None,
        1,
        1,
        "https://green-way.com.ua/uk/test-pdd/top-difficult",
        [],
    )
    conn.commit()


def write_json_file(path: Path, payload: object) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(payload, ensure_ascii=False, indent=2), encoding="utf-8")


def export_generic_media_maps(conn) -> None:
    section_rows = conn.execute(
        """
        SELECT
            c.slug AS category_slug,
            t.slug AS topic_slug,
            s.slug AS section_slug,
            s.title,
            s.source_url,
            s.embed_url,
            a.asset_url,
            a.caption
        FROM theory_sections s
        JOIN theory_topics t ON t.id = s.topic_id
        JOIN theory_categories c ON c.id = t.category_id
        LEFT JOIN theory_assets a ON a.section_id = s.id
        ORDER BY c.slug, t.slug, s.sort_order, a.sort_order
        """
    ).fetchall()

    academy_map: dict[str, dict[str, object]] = {}
    library_map: dict[str, dict[str, object]] = {}
    signs_map: dict[str, dict[str, object]] = {}
    markings_map: dict[str, dict[str, object]] = {}

    for row in section_rows:
        category_slug = str(row["category_slug"])
        topic_slug = str(row["topic_slug"])
        section_slug = str(row["section_slug"])
        title = str(row["title"])
        source_url = str(row["source_url"] or "")
        embed_url = row["embed_url"]
        asset_url = row["asset_url"]
        caption = row["caption"]

        if category_slug == "academy":
            entry = academy_map.setdefault(
                section_slug,
                {
                    "topic_slug": topic_slug,
                    "title": title,
                    "source_url": source_url,
                    "embed_url": embed_url,
                    "asset_urls": [],
                },
            )
            if asset_url:
                entry["asset_urls"].append(asset_url)

        if category_slug == "library":
            entry = library_map.setdefault(
                section_slug,
                {
                    "topic_slug": topic_slug,
                    "title": title,
                    "source_url": source_url,
                    "asset_urls": [],
                },
            )
            if asset_url:
                entry["asset_urls"].append(asset_url)

        if section_slug.startswith("rules-") and asset_url:
            filename = Path(str(asset_url)).name
            match = re.match(r"sign_(\d+(?:_\d+)*)\.", filename)
            if match:
                signs_map[match.group(1)] = {
                    "asset_url": asset_url,
                    "title": title,
                    "caption": caption,
                    "section_slug": section_slug,
                    "source_url": source_url,
                }

        if section_slug.startswith("rules-") and asset_url:
            filename = Path(str(asset_url)).name
            match = re.match(r"marking_(\d+(?:_\d+)*)\.", filename)
            if match:
                markings_map[match.group(1)] = {
                    "asset_url": asset_url,
                    "title": title,
                    "caption": caption,
                    "section_slug": section_slug,
                    "source_url": source_url,
                }

    write_json_file(MEDIA_MAP_ROOT / "academy_media_map.json", academy_map)
    write_json_file(MEDIA_MAP_ROOT / "library_media_map.json", library_map)
    write_json_file(MEDIA_MAP_ROOT / "signs_media_map.json", dict(sorted(signs_map.items())))
    write_json_file(MEDIA_MAP_ROOT / "markings_media_map.json", dict(sorted(markings_map.items())))


def cleanup_unused_uploaded_files(conn) -> None:
    used_files: set[Path] = {PLACEHOLDER_PATH, RULES_MEDIA_MAP_PATH}
    for path in MEDIA_MAP_ROOT.glob("*.json"):
        used_files.add(path)

    asset_rows = conn.execute(
        "SELECT asset_url FROM theory_assets WHERE asset_url LIKE '/uploads/%'"
    ).fetchall()
    for row in asset_rows:
        asset_url = str(row["asset_url"] or "")
        if asset_url.startswith("/uploads/theory/"):
            used_files.add(BASE_DIR / asset_url.lstrip("/").replace("/", os.sep))
        elif asset_url.startswith("/uploads/handbook/"):
            used_files.add(BASE_DIR / asset_url.lstrip("/").replace("/", os.sep))

    for root in [UPLOAD_ROOT, HANDBOOK_UPLOAD_ROOT]:
        for path in root.rglob("*"):
            if path.is_file() and path not in used_files:
                path.unlink()
        for path in sorted(root.rglob("*"), reverse=True):
            if path.is_dir():
                try:
                    path.rmdir()
                except OSError:
                    pass


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Import DrivePrep content from Green-Way sources")
    parser.add_argument("--reset", action="store_true", help="Clear theory tables before import")
    parser.add_argument(
        "--only",
        nargs="+",
        choices=["rules", "library", "driving-license", "penalty-table", "academy", "video-lectures", "difficult-questions"],
        help="Import only selected content groups",
    )
    return parser.parse_args()


def main() -> None:
    args = parse_args()
    selected = set(args.only or ["rules", "library", "driving-license", "penalty-table", "academy", "video-lectures", "difficult-questions"])
    session = make_session()
    with db() as conn:
        if args.reset:
            log("[import] reset theory tables")
            reset_theory(conn)
        lock_theory_tables(conn)
        for index, category in enumerate(THEORY_CATEGORY_SEEDS, start=1):
            upsert_category(conn, category["slug"], category["title"], category["description"], index)
        conn.commit()

        video_candidates: list[dict[str, object]] = []
        if "rules" in selected:
            import_rules(session, conn)
            conn.commit()
        if "library" in selected:
            import_library(session, conn)
            conn.commit()
        if "driving-license" in selected:
            import_driving_license(session, conn)
            conn.commit()
        if "penalty-table" in selected:
            import_penalties(session, conn)
            conn.commit()
        if "academy" in selected:
            video_candidates = import_academy(session, conn)
            conn.commit()
        if "video-lectures" in selected:
            if not video_candidates:
                academy_category = conn.execute("SELECT id FROM theory_categories WHERE slug = 'academy'").fetchone()
                if academy_category:
                    video_candidates = [
                        {
                            "title": row["title"],
                            "description": row["description"],
                            "content_html": row["content_html"],
                            "content_text": row["content_text"],
                            "comment_html": row["comment_html"] or "",
                            "embed_url": row["embed_url"],
                            "assets": conn.execute(
                                "SELECT asset_url, alt_text, caption FROM theory_assets WHERE section_id = %s ORDER BY sort_order",
                                (row["id"],),
                            ).fetchall(),
                            "source_url": row["source_url"],
                        }
                        for row in conn.execute(
                            """
                            SELECT s.*
                            FROM theory_sections s
                            JOIN theory_topics t ON t.id = s.topic_id
                            WHERE t.category_id = %s AND s.embed_url IS NOT NULL
                            ORDER BY s.sort_order
                            """,
                            (academy_category["id"],),
                        ).fetchall()
                    ]
            import_video_lectures(conn, video_candidates)
            conn.commit()
        if "difficult-questions" in selected:
            import_difficult_questions(conn)
            conn.commit()
        export_generic_media_maps(conn)
        cleanup_unused_uploaded_files(conn)

    sys.stdout.reconfigure(encoding="utf-8")
    print(json.dumps({"status": "ok", "message": "DrivePrep content import completed", "selected": sorted(selected)}, ensure_ascii=False))


if __name__ == "__main__":
    main()
