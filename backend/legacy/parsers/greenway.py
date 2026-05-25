"""
green-way.com.ua — повний парсер
Витягує: довідники, курси, топ-складні питання, фото
Зберігає все в output/ як JSON + завантажує зображення
"""

import asyncio
import aiohttp
import aiofiles
import json
import os
import re
import hashlib
from pathlib import Path
from urllib.parse import urljoin, urlparse
from bs4 import BeautifulSoup

# ──────────────────────────────────────────────
# КОНФІГ
# ──────────────────────────────────────────────
BASE_URL = "https://green-way.com.ua/uk"
OUTPUT_DIR = Path("greenway_output")
IMAGES_DIR = OUTPUT_DIR / "images"
DELAY = 1.2  # секунд між запитами (не спамимо сервер)

HEADERS = {
    "User-Agent": (
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
        "AppleWebKit/537.36 (KHTML, like Gecko) "
        "Chrome/124.0.0.0 Safari/537.36"
    ),
    "Accept-Language": "uk-UA,uk;q=0.9",
    "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
}

COURSES = [
    {"id": 680,  "slug": "course_680"},
    {"id": 898,  "slug": "course_898"},
    {"id": 1100, "slug": "course_1100"},
]

# ──────────────────────────────────────────────
# УТИЛІТИ
# ──────────────────────────────────────────────

def make_dirs():
    OUTPUT_DIR.mkdir(exist_ok=True)
    IMAGES_DIR.mkdir(exist_ok=True)

def save_json(data, filename: str):
    path = OUTPUT_DIR / filename
    with open(path, "w", encoding="utf-8") as f:
        json.dump(data, f, ensure_ascii=False, indent=2)
    print(f"  ✅ Збережено: {path}")

def img_filename(url: str) -> str:
    """Унікальне ім'я файлу зображення на основі URL"""
    ext = Path(urlparse(url).path).suffix or ".jpg"
    return hashlib.md5(url.encode()).hexdigest()[:12] + ext

async def fetch_html(session: aiohttp.ClientSession, url: str) -> str | None:
    try:
        async with session.get(url, headers=HEADERS, timeout=aiohttp.ClientTimeout(total=20)) as resp:
            if resp.status == 200:
                return await resp.text()
            elif resp.status == 404:
                return None
            else:
                print(f"  ⚠️  HTTP {resp.status} — {url}")
                return None
    except Exception as e:
        print(f"  ❌ Помилка {url}: {e}")
        return None

async def download_image(session: aiohttp.ClientSession, url: str) -> str | None:
    """Завантажує зображення, повертає локальний шлях"""
    if not url or url.startswith("data:"):
        return None
    full_url = url if url.startswith("http") else urljoin("https://green-way.com.ua", url)
    fname = img_filename(full_url)
    local_path = IMAGES_DIR / fname
    if local_path.exists():
        return str(local_path)
    try:
        async with session.get(full_url, headers=HEADERS, timeout=aiohttp.ClientTimeout(total=30)) as resp:
            if resp.status == 200:
                content = await resp.read()
                async with aiofiles.open(local_path, "wb") as f:
                    await f.write(content)
                return str(local_path)
    except Exception as e:
        print(f"  ❌ Фото {full_url}: {e}")
    return None

# ──────────────────────────────────────────────
# ПАРСЕРИ СТОРІНОК
# ──────────────────────────────────────────────

def parse_question_block(block: BeautifulSoup, session=None) -> dict:
    """Парсить один блок питання (текст + варіанти + правильна відповідь + фото)"""
    q = {}

    # Текст питання
    q_text_el = block.select_one(".question-text, .q-text, h3, .question__text, [class*='question']")
    q["text"] = q_text_el.get_text(strip=True) if q_text_el else block.get_text(strip=True)[:300]

    # Зображення питання
    img = block.select_one("img")
    q["image_url"] = img.get("src") or img.get("data-src") if img else None
    q["image_local"] = None  # заповниться при download_image

    # Варіанти відповідей
    answers = []
    for ans in block.select(".answer, .variant, li, [class*='answer'], [class*='variant']"):
        txt = ans.get_text(strip=True)
        if txt and len(txt) > 1:
            is_correct = bool(
                ans.get("class") and any(
                    c in " ".join(ans.get("class", [])) for c in ["correct", "right", "true"]
                )
            )
            answers.append({"text": txt, "correct": is_correct})
    q["answers"] = answers

    return q


async def scrape_dovidniki(session: aiohttp.ClientSession) -> dict:
    """Парсить сторінку довідників і всі підрозділи"""
    print("\n📚 Парсимо довідники...")
    result = {"sections": []}

    html = await fetch_html(session, f"{BASE_URL}/dovidniki")
    if not html:
        print("  ❌ Не вдалося отримати довідники")
        return result

    soup = BeautifulSoup(html, "html.parser")
    await asyncio.sleep(DELAY)

    # Знаходимо всі посилання на підрозділи довідників
    links = soup.select("a[href*='/dovidniki/']")
    seen = set()
    section_urls = []
    for a in links:
        href = a.get("href", "")
        full = urljoin("https://green-way.com.ua", href)
        if full not in seen:
            seen.add(full)
            section_urls.append({"title": a.get_text(strip=True), "url": full})

    print(f"  Знайдено підрозділів: {len(section_urls)}")

    for sec in section_urls:
        print(f"  → {sec['title']}")
        sec_html = await fetch_html(session, sec["url"])
        await asyncio.sleep(DELAY)
        if not sec_html:
            continue

        sec_soup = BeautifulSoup(sec_html, "html.parser")
        section_data = {
            "title": sec["title"],
            "url": sec["url"],
            "content": [],
            "images": [],
        }

        # Витягуємо весь текстовий контент
        main = sec_soup.select_one("main, .content, article, #content, .page-content")
        if main:
            # Параграфи тексту
            for p in main.select("p, h2, h3, h4, li"):
                txt = p.get_text(strip=True)
                if txt:
                    section_data["content"].append({"tag": p.name, "text": txt})

            # Зображення
            for img in main.select("img"):
                src = img.get("src") or img.get("data-src") or img.get("data-lazy-src")
                if src:
                    full_src = urljoin("https://green-way.com.ua", src)
                    local = await download_image(session, full_src)
                    section_data["images"].append({
                        "url": full_src,
                        "alt": img.get("alt", ""),
                        "local": local,
                    })

        result["sections"].append(section_data)

    return result


async def scrape_top_difficult(session: aiohttp.ClientSession) -> list:
    """Парсить топ складних питань"""
    print("\n🔥 Парсимо топ-складні питання...")
    questions = []

    html = await fetch_html(session, f"{BASE_URL}/test-pdd/top-difficult")
    if not html:
        return questions

    soup = BeautifulSoup(html, "html.parser")
    await asyncio.sleep(DELAY)

    # Шукаємо блоки питань — різні можливі селектори
    blocks = soup.select(
        ".question, .test-question, [class*='question'], .card, .item"
    )
    print(f"  Знайдено блоків: {len(blocks)}")

    for block in blocks:
        q = parse_question_block(block)
        if q.get("text") and len(q["text"]) > 5:
            # Завантажуємо фото питання
            if q.get("image_url"):
                q["image_local"] = await download_image(session, q["image_url"])
                await asyncio.sleep(0.3)
            questions.append(q)

    return questions


async def scrape_course(session: aiohttp.ClientSession, course_id: int, slug: str) -> dict:
    """Парсить увесь курс по сторінках /1, /2, ..."""
    print(f"\n📖 Парсимо курс {course_id}...")
    course = {
        "id": course_id,
        "slug": slug,
        "title": "",
        "pages": [],
    }

    page_num = 1
    while True:
        url = f"{BASE_URL}/obuchenie/course/{course_id}/{page_num}"
        print(f"  Сторінка {page_num}: {url}")

        html = await fetch_html(session, url)
        await asyncio.sleep(DELAY)

        if not html:
            print(f"  Стоп — сторінка {page_num} не знайдена")
            break

        soup = BeautifulSoup(html, "html.parser")

        # Заголовок курсу (беремо з першої сторінки)
        if page_num == 1:
            title_el = soup.select_one("h1, .course-title, [class*='title']")
            if title_el:
                course["title"] = title_el.get_text(strip=True)

        # Перевіряємо чи є контент на сторінці
        main = soup.select_one("main, .content, article, #content, .lesson, .course-content, .page-content")
        if not main:
            # Спробуємо body
            main = soup.body

        if not main:
            break

        page_data = {
            "page": page_num,
            "url": url,
            "content": [],
            "images": [],
            "questions": [],
        }

        # Текстовий контент
        for el in main.select("p, h2, h3, h4, h5, li, .text, [class*='text']"):
            txt = el.get_text(strip=True)
            if txt and len(txt) > 3:
                page_data["content"].append({"tag": el.name, "text": txt})

        # Зображення
        for img in main.select("img"):
            src = img.get("src") or img.get("data-src") or img.get("data-lazy-src")
            if src and "logo" not in src and "icon" not in src:
                full_src = urljoin("https://green-way.com.ua", src)
                local = await download_image(session, full_src)
                page_data["images"].append({
                    "url": full_src,
                    "alt": img.get("alt", ""),
                    "local": local,
                })
                await asyncio.sleep(0.2)

        # Питання на сторінці (якщо є)
        q_blocks = main.select(".question, [class*='question'], .test-item")
        for block in q_blocks:
            q = parse_question_block(block)
            if q.get("text") and len(q["text"]) > 5:
                if q.get("image_url"):
                    q["image_local"] = await download_image(session, q["image_url"])
                page_data["questions"].append(q)

        # Якщо сторінка порожня (немає ні тексту ні фото) — кінець курсу
        if not page_data["content"] and not page_data["images"] and not page_data["questions"]:
            print(f"  Порожня сторінка {page_num} — зупиняємось")
            break

        course["pages"].append(page_data)

        # Перевіряємо чи є кнопка "Наступна сторінка"
        next_btn = soup.select_one(
            "a[href*='/{}/{}']".format(course_id, page_num + 1)
        )
        # Або просто продовжуємо до 404
        page_num += 1

        # Захист від нескінченного циклу
        if page_num > 200:
            print("  Досягнуто ліміту 200 сторінок")
            break

    print(f"  Курс {course_id}: зібрано {len(course['pages'])} сторінок")
    return course


# ──────────────────────────────────────────────
# ГОЛОВНА ФУНКЦІЯ
# ──────────────────────────────────────────────

async def main():
    make_dirs()
    print("=" * 50)
    print("🚀 Старт парсингу green-way.com.ua")
    print("=" * 50)

    connector = aiohttp.TCPConnector(ssl=False)
    async with aiohttp.ClientSession(connector=connector) as session:

        # 1. Довідники
        dovidniki = await scrape_dovidniki(session)
        save_json(dovidniki, "dovidniki.json")

        # 2. Топ складні питання
        top_difficult = await scrape_top_difficult(session)
        save_json(top_difficult, "top_difficult.json")
        print(f"  Топ питань: {len(top_difficult)}")

        # 3. Курси
        all_courses = []
        for c in COURSES:
            course_data = await scrape_course(session, c["id"], c["slug"])
            save_json(course_data, f"course_{c['id']}.json")
            all_courses.append({
                "id": c["id"],
                "title": course_data["title"],
                "pages_count": len(course_data["pages"]),
            })

    # Загальний індекс
    index = {
        "dovidniki_sections": len(dovidniki.get("sections", [])),
        "top_difficult_questions": len(top_difficult),
        "courses": all_courses,
    }
    save_json(index, "_index.json")

    print("\n" + "=" * 50)
    print("✅ Парсинг завершено!")
    print(f"📁 Всі файли в: {OUTPUT_DIR.absolute()}")
    print("=" * 50)


if __name__ == "__main__":
    asyncio.run(main())