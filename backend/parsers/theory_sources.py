from __future__ import annotations

THEORY_SOURCE_ROOT = "https://green-way.com.ua/uk"
VODIY_SOURCE_ROOT = "https://vodiy.ua"

THEORY_SOURCE_MAP = {
    "rules": f"{VODIY_SOURCE_ROOT}/pdr/",
    "road-signs": f"{VODIY_SOURCE_ROOT}/znaky/",
    "road-markings": f"{VODIY_SOURCE_ROOT}/rozmitka/",
    "library": f"{THEORY_SOURCE_ROOT}/dovidniki",
    "driving-license": f"{THEORY_SOURCE_ROOT}/dovidniki/driving_license",
    "academy": f"{THEORY_SOURCE_ROOT}/obuchenie",
    "video-lectures": f"{THEORY_SOURCE_ROOT}/obuchenie",
    "penalty-table": f"{THEORY_SOURCE_ROOT}/test-pdd/information/penalty_information",
    "difficult-questions": f"{THEORY_SOURCE_ROOT}/test-pdd/top-difficult",
}

THEORY_CATEGORY_SEEDS = [
    {
        "slug": "rules",
        "title": "Правила дорожнього руху",
        "description": "Офіційні розділи ПДР з локальними ілюстраціями та зручною навігацією.",
        "sort_order": 1,
    },
    {
        "slug": "road-signs",
        "title": "Дорожні знаки",
        "description": "Групи дорожніх знаків із зображеннями та короткими поясненнями.",
        "sort_order": 2,
    },
    {
        "slug": "road-markings",
        "title": "Дорожня розмітка",
        "description": "Горизонтальна та вертикальна розмітка з офіційними поясненнями.",
        "sort_order": 3,
    },
    {
        "slug": "library",
        "title": "Бібліотека",
        "description": "Довідники з водіння, будови авто, медичної допомоги, правових питань і практичних порад для водіїв.",
        "sort_order": 4,
    },
    {
        "slug": "driving-license",
        "title": "Отримання посвідчення",
        "description": "Структурований довідник про теоретичний і практичний іспити, документи, вартість і повторні спроби.",
        "sort_order": 5,
    },
    {
        "slug": "academy",
        "title": "Академія",
        "description": "Premium-курси з ілюстраціями, локальними матеріалами та відеовставками для послідовного навчання.",
        "sort_order": 6,
    },
    {
        "slug": "video-lectures",
        "title": "Відеолекції",
        "description": "Окремий Premium-розділ із відеолекціями та стислими конспектами до найважливіших тем підготовки.",
        "sort_order": 7,
    },
    {
        "slug": "difficult-questions",
        "title": "Робота над помилками мільйонів",
        "description": "Найскладніші питання ПДР, на яких користувачі помиляються найчастіше, зі швидким повторенням.",
        "sort_order": 8,
    },
    {
        "slug": "penalty-table",
        "title": "Таблиця штрафів",
        "description": "Актуальні санкції та штрафи ПДР у впорядкованому форматі для швидкого пошуку і повторення.",
        "sort_order": 9,
    },
]
