from __future__ import annotations

import os
import re
from pathlib import Path
from typing import Any

from dotenv import load_dotenv
from parsers.theory_sources import THEORY_CATEGORY_SEEDS

load_dotenv()

BASE_DIR = Path(__file__).resolve().parents[1]
IS_PRODUCTION = os.getenv("NODE_ENV", "").strip().lower() == "production"
RUN_STARTUP_MAINTENANCE = os.getenv("RUN_STARTUP_MAINTENANCE", "true").strip().lower() not in {"0", "false", "no"}

RAW_DB_URL = (os.getenv("DATABASE_URL") or os.getenv("POSTGRES_URI") or "").strip()
if not RAW_DB_URL:
    raise RuntimeError("DATABASE_URL or POSTGRES_URI is required")
DB_URL = (
    f"{RAW_DB_URL}{'&' if '?' in RAW_DB_URL else '?'}sslmode=require"
    if os.getenv("DATABASE_SSL", "").strip().lower() in {"1", "true", "yes", "require"} and "sslmode=" not in RAW_DB_URL
    else RAW_DB_URL
)
DATABASE_SCHEMA = os.getenv("DATABASE_SCHEMA", "").strip()

JWT_SECRET = os.getenv("JWT_SECRET", "change-me-in-production")
JWT_REMEMBER_DAYS = int(os.getenv("JWT_REMEMBER_DAYS", "90"))
JWT_SESSION_DAYS = int(os.getenv("JWT_SESSION_DAYS", "1"))

FRONTEND_URL = os.getenv("FRONTEND_URL", "http://localhost:5173")
BACKEND_PUBLIC_URL = os.getenv("BACKEND_PUBLIC_URL", f"http://localhost:{os.getenv('PORT', '8000')}")
PORT = int(os.getenv("PORT", "8000"))

SUPPORT_EMAIL = "pdr.preparation@gmail.com"
SUPPORT_NAME = "DrivePrep Support"

ADMIN_EMAILS = {
    item.strip().lower()
    for item in os.getenv("ADMIN_EMAILS", SUPPORT_EMAIL).split(",")
    if item.strip()
}
ADMIN_USERNAME = os.getenv("ADMIN_USERNAME", "admin").strip() or "admin"
ADMIN_PASSWORD = os.getenv("ADMIN_PASSWORD", "").strip()
ADMIN_PASSWORD_HASH = os.getenv("ADMIN_PASSWORD_HASH", "").strip()
PROMO_ADMIN_KEY = os.getenv("PROMO_ADMIN_KEY", "").strip()

SMTP_HOST = os.getenv("SMTP_HOST", "smtp.gmail.com").strip()
SMTP_PORT = int(os.getenv("SMTP_PORT", "587").strip())
SMTP_USER = os.getenv("SMTP_USER", "").strip()
SMTP_PASS = "".join(os.getenv("SMTP_PASS", "").split())
SMTP_TIMEOUT = float(os.getenv("SMTP_TIMEOUT", "6"))
SMTP_SECURE = os.getenv("SMTP_SECURE", "false").strip().lower() in {"1", "true", "yes", "ssl"}

RESEND_API_KEY = os.getenv("RESEND_API_KEY", "").strip()
EMAIL_PROVIDER = os.getenv("EMAIL_PROVIDER", "resend" if RESEND_API_KEY else "smtp").strip().lower()
EMAIL_FROM = os.getenv("EMAIL_FROM", "DrivePrep <onboarding@resend.dev>").strip()

LIQPAY_PUBLIC_KEY = os.getenv("LIQPAY_PUBLIC_KEY", "")
LIQPAY_PRIVATE_KEY = os.getenv("LIQPAY_PRIVATE_KEY", "")
PAYMENT_MODE = os.getenv("PAYMENT_MODE", "mock" if not LIQPAY_PUBLIC_KEY or not LIQPAY_PRIVATE_KEY else "liqpay").strip().lower()
ALLOW_MOCK_PAYMENTS = os.getenv("ALLOW_MOCK_PAYMENTS", "false").strip().lower() in {"1", "true", "yes"}
MONO_JAR_URL = (os.getenv("MONO_JAR_URL") or os.getenv("VITE_MONO_JAR_URL") or "").strip()
MONO_JAR_CARD = "".join((os.getenv("MONO_JAR_CARD") or os.getenv("VITE_MONO_JAR_CARD") or "").split())

UPLOAD_DIR = BASE_DIR / "uploads" / "avatars"
FRONTEND_DIST_DIR = BASE_DIR.parent / "frontend" / "dist"
PUBLIC_STATIC_IMAGES_DIR = BASE_DIR / "public" / "images"
RUNTIME_DIR = BASE_DIR / "runtime"
THEORY_PARSE_STATUS_FILE = RUNTIME_DIR / "theory_parse_status.json"
THEORY_PARSE_LOG_FILE = RUNTIME_DIR / "theory_parse.log"
PUBLIC_IMAGES_DIR = (
    FRONTEND_DIST_DIR / "images" / "questions_img"
    if IS_PRODUCTION
    else BASE_DIR.parent / "frontend" / "public" / "images" / "questions_img"
)

UPLOAD_DIR.mkdir(parents=True, exist_ok=True)
PUBLIC_STATIC_IMAGES_DIR.mkdir(parents=True, exist_ok=True)

USERNAME_RE = re.compile(r"^[a-z][a-z0-9_]{2,31}$")
BROKEN_OPTION_RE = re.compile(r"(?:^|[.!?])\s*\d{1,3}[.)]?\s*[A-ZА-ЯІЇЄҐ]")
EMBEDDED_OPTION_RE = re.compile(r"\s+(?:1|A|А)[.)]\s+")
QUESTION_UI_MARKERS = ("Ілюстрація до питання", "Аналіз ситуації")
IMAGE_REQUIRED_MARKERS = (
    "зображений дорожній знак",
    "зображений знак",
    "зображено дорожній знак",
    "зображено знак",
    "на малюнку",
    "на рисунку",
    "на зображенні",
    "ілюстрація до питання",
)

COMMON_SECTIONS = list(range(1, 40))
CATEGORY_SECTION_RULES = {
    "A": list(range(1, 44)),
    "A1": list(range(1, 44)),
    "B": COMMON_SECTIONS + list(range(44, 48)),
    "B1": COMMON_SECTIONS + list(range(44, 48)),
    "C": COMMON_SECTIONS + list(range(48, 52)),
    "C1": COMMON_SECTIONS + list(range(48, 52)),
    "D": COMMON_SECTIONS + list(range(52, 56)),
    "D1": COMMON_SECTIONS + list(range(52, 56)),
    "T": COMMON_SECTIONS + list(range(60, 64)),
    "BE": COMMON_SECTIONS + list(range(56, 60)),
    "C1E": COMMON_SECTIONS + list(range(56, 60)),
    "CE": COMMON_SECTIONS + list(range(56, 60)),
    "D1E": COMMON_SECTIONS + list(range(56, 60)),
    "DE": COMMON_SECTIONS + list(range(56, 60)),
}
CATEGORY_ALIASES = {
    "A / A1": "A",
    "B / B1": "B",
    "C / C1": "C",
    "D / D1": "D",
    "BE / C1E / CE / D1E / DE": "BE",
}

MVS_TICKET_COUNT = 30
MVS_BLOCKS = {
    "pdr": {
        "label": "ПДР",
        "count": 10,
        "sections": [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 24, 25, 26, 27, 28, 29, 30, 32, 33, 34, 39],
    },
    "safety": {"label": "Безпека", "count": 4, "sections": [35, 36, 38]},
    "vehicle": {"label": "Будова", "count": 4, "sections": [31]},
    "medicine": {"label": "Домедична допомога", "count": 2, "sections": [37]},
}
MVS_CATEGORY_BLOCKS = {
    "A": {"pdr": [40, 42], "vehicle": [41], "safety": [43]},
    "A1": {"pdr": [40, 42], "vehicle": [41], "safety": [43]},
    "B": {"pdr": [44, 46], "vehicle": [45], "safety": [47]},
    "B1": {"pdr": [44, 46], "vehicle": [45], "safety": [47]},
    "C": {"pdr": [48, 50], "vehicle": [49], "safety": [51]},
    "C1": {"pdr": [48, 50], "vehicle": [49], "safety": [51]},
    "D": {"pdr": [52, 54], "vehicle": [], "safety": [55]},
    "D1": {"pdr": [52, 54], "vehicle": [], "safety": [55]},
    "BE": {"pdr": [56, 58], "vehicle": [57], "safety": [59]},
    "C1E": {"pdr": [56, 58], "vehicle": [57], "safety": [59]},
    "CE": {"pdr": [56, 58], "vehicle": [57], "safety": [59]},
    "D1E": {"pdr": [56, 58], "vehicle": [57], "safety": [59]},
    "DE": {"pdr": [56, 58], "vehicle": [57], "safety": [59]},
    "T": {"pdr": [60, 62], "vehicle": [61], "safety": [63]},
}

FRAME_SHOP: dict[str, dict[str, Any]] = {
    "fire": {"price": 0, "achievement_id": "streak_28", "label": "Вогняна"},
    "sun": {"price": 0, "achievement_id": "streak_90", "label": "Сонячна"},
    "gold": {"price": 0, "achievement_id": "thousand", "label": "Золота"},
    "diamond": {"price": 0, "achievement_id": "perfect_20", "label": "Діамантова"},
    "speed": {"price": 0, "achievement_id": "marathon_100", "label": "Швидкість"},
    "crown": {"price": 0, "achievement_id": "pro_driver", "label": "Корона"},
    "galaxy": {"price": 0, "achievement_id": "legend", "label": "Галактика"},
    "platinum": {"price": 0, "achievement_id": "exam_perfect", "label": "Платина"},
    "mint": {"price": 6, "achievement_id": None, "label": "М'ятна"},
    "sunset": {"price": 9, "achievement_id": None, "label": "Захід сонця"},
    "neon": {"price": 12, "achievement_id": None, "label": "Неон"},
    "aurora": {"price": 15, "achievement_id": None, "label": "Аврора"},
}

HANDBOOK_TOPICS: list[dict[str, Any]] = [
    {
        "key": "rules",
        "title": "Правила дорожнього руху",
        "category": "rules",
        "chapters": [
            {"chapter_num": index + 1, "title": title}
            for index, title in enumerate(
                [
                    "Загальні положення",
                    "Обов’язки і права водіїв механічних транспортних засобів",
                    "Рух транспортних засобів із спеціальними сигналами",
                    "Обов’язки і права пішоходів",
                    "Обов’язки і права пасажирів",
                    "Вимоги до велосипедистів",
                    "Вимоги до осіб, які керують гужовим транспортом, і погоничам тварин",
                    "Регулювання дорожнього руху",
                    "Попереджувальні сигнали",
                    "Початок руху та зміна його напрямку",
                    "Розташування транспортних засобів на дорозі",
                    "Швидкість руху",
                    "Дистанція, інтервал, зустрічний роз’їзд",
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
            )
        ],
    },
    {"key": "road-signs", "title": "Дорожні знаки", "category": "signs", "chapters": []},
    {"key": "road-markings", "title": "Дорожня розмітка", "category": "markings", "chapters": []},
    {"key": "regulator", "title": "Регулювальник", "category": "regulator", "chapters": []},
    {"key": "traffic-light", "title": "Світлофор", "category": "traffic-light", "chapters": []},
]

HANDBOOK_TOPIC_CATEGORY_MAP: dict[str, str] = {
    topic["key"]: str(topic.get("category") or topic["key"])
    for topic in HANDBOOK_TOPICS
}

THEORY_CATEGORY_FALLBACKS: list[dict[str, Any]] = [dict(item) for item in THEORY_CATEGORY_SEEDS]
MULTI_TOPIC_CATEGORY_SLUGS = {"library", "academy"}

PREMIUM_PLANS: dict[str, dict[str, Any]] = {
    "1": {"code": "1", "slug": "monthly", "title": "Premium на 1 місяць", "months": 1},
    "3": {"code": "3", "slug": "quarterly", "title": "Premium на 3 місяці", "months": 3},
    "6": {"code": "6", "slug": "half_year", "title": "Premium на 6 місяців", "months": 6},
    "12": {"code": "12", "slug": "yearly", "title": "Premium на 1 рік", "months": 12},
}
PREMIUM_PLAN_ALIASES: dict[str, str] = {
    "1": "1",
    "monthly": "1",
    "month": "1",
    "3": "3",
    "quarterly": "3",
    "quarter": "3",
    "6": "6",
    "half_year": "6",
    "half-year": "6",
    "12": "12",
    "yearly": "12",
    "year": "12",
}

DEFAULT_IMPORT_FILE = BASE_DIR / "data" / "questions" / "pdr_final_fixed.json"
PROMO_SETTINGS_FILE = BASE_DIR / "config" / "promo_settings.json"
PREMIUM_FEATURES_FILE = BASE_DIR / "config" / "premium_features.json"
PREMIUM_SETTINGS_FILE = BASE_DIR / "config" / "premium_settings.json"

DEFAULT_PROMO_SETTINGS: dict[str, Any] = {
    "is_active": False,
    "started_at": None,
    "never_ends": False,
    "duration_days": 15,
    "promo_prices": {"1": 159, "3": 469, "6": 950, "12": 1900},
    "regular_prices": {"1": 300, "3": 900, "6": 1800, "12": 3600},
}

DEFAULT_PREMIUM_FEATURES: list[dict[str, Any]] = [
    {
        "id": "mvs_exam",
        "title": "Іспит МВС",
        "description": "Імітація офіційного білета: 20 питань за блоками ПДР, безпека, будова та медицина.",
        "is_enabled": True,
        "sort_order": 1,
    },
    {
        "id": "unlimited_tickets",
        "title": "Усі білети без обмежень",
        "description": "Повний доступ до тренувальних білетів кожної категорії без ліміту переглядів.",
        "is_enabled": True,
        "sort_order": 2,
    },
    {
        "id": "section_practice",
        "title": "Практика по розділах",
        "description": "Окреме тренування слабких тем із банку питань DrivePrep.",
        "is_enabled": True,
        "sort_order": 3,
    },
    {
        "id": "saved_questions",
        "title": "Збережені запитання",
        "description": "Персональний список важливих питань для швидкого повторення.",
        "is_enabled": True,
        "sort_order": 4,
    },
    {
        "id": "deep_analytics",
        "title": "Розширена аналітика",
        "description": "Прогрес, помилки, серії навчання та історія проходжень в одному кабінеті.",
        "is_enabled": True,
        "sort_order": 5,
    },
    {
        "id": "priority_support",
        "title": "Пріоритетна підтримка",
        "description": "Швидші відповіді в чаті підтримки для користувачів Premium.",
        "is_enabled": True,
        "sort_order": 6,
    },
]

DEFAULT_PREMIUM_SETTINGS: dict[str, Any] = {
    "premium_enabled": True,
}
