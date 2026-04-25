from __future__ import annotations

import json
import os
import random
import re
import shutil
import smtplib
import string
from collections import defaultdict
from uuid import uuid4
from datetime import date, datetime, timedelta
from email.mime.multipart import MIMEMultipart
from email.mime.text import MIMEText
from pathlib import Path
from typing import Any, Optional

import bcrypt
import jwt
import psycopg
from dotenv import load_dotenv
from fastapi import Depends, FastAPI, File, Header, HTTPException, Query, UploadFile, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from psycopg.rows import dict_row
from pydantic import BaseModel, Field

load_dotenv()

BASE_DIR = Path(__file__).resolve().parent
DB_URL = os.environ["DATABASE_URL"]
JWT_SECRET = os.getenv("JWT_SECRET", "change-me-in-production")
JWT_REMEMBER_DAYS = int(os.getenv("JWT_REMEMBER_DAYS", "90"))
JWT_SESSION_DAYS = int(os.getenv("JWT_SESSION_DAYS", "1"))
FRONTEND_URL = os.getenv("FRONTEND_URL", "http://localhost:5173")
SUPPORT_EMAIL = "pdr.preparation@gmail.com"
SUPPORT_NAME = "PDRPrep Support"
ADMIN_EMAILS = {
    item.strip().lower()
    for item in os.getenv("ADMIN_EMAILS", SUPPORT_EMAIL).split(",")
    if item.strip()
}
SMTP_HOST = os.getenv("SMTP_HOST", "smtp.gmail.com")
SMTP_PORT = int(os.getenv("SMTP_PORT", "587"))
SMTP_USER = os.getenv("SMTP_USER", "")
SMTP_PASS = os.getenv("SMTP_PASS", "")
PORT = int(os.getenv("PORT", "8000"))
UPLOAD_DIR = BASE_DIR / "uploads" / "avatars"
UPLOAD_DIR.mkdir(parents=True, exist_ok=True)
PUBLIC_IMAGES_DIR = BASE_DIR.parent / "frontend" / "public" / "images" / "questions_img"
DEFAULT_IMPORT_FILE = BASE_DIR / "pdr_final_fixed.json"
USERNAME_RE = re.compile(r"^[a-z][a-z0-9_]{2,31}$")

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
BROKEN_OPTION_RE = re.compile(r"(?:^|[.!?])\s*\d{1,3}[.)]?\s*[A-ZА-ЯІЇЄҐ]")
QUESTION_UI_MARKERS = ("Ілюстрація до питання", "Аналіз ситуації")
FRAME_SHOP: dict[str, dict[str, Any]] = {
    "fire": {"price": 0, "achievement_id": "streak_28", "label": "Вогняна"},
    "sun": {"price": 0, "achievement_id": "streak_90", "label": "Сонячна"},
    "gold": {"price": 0, "achievement_id": "correct_1000", "label": "Золота"},
    "diamond": {"price": 0, "achievement_id": "perfect_20", "label": "Діамантова"},
    "speed": {"price": 0, "achievement_id": "marathon_100", "label": "Швидкість"},
    "crown": {"price": 0, "achievement_id": "hundred_tests", "label": "Корона"},
    "galaxy": {"price": 0, "achievement_id": "correct_5000", "label": "Галактика"},
    "platinum": {"price": 0, "achievement_id": "exam_perfect", "label": "Платина"},
    "mint": {"price": 6, "achievement_id": None, "label": "М'ятна"},
    "sunset": {"price": 9, "achievement_id": None, "label": "Захід сонця"},
    "neon": {"price": 12, "achievement_id": None, "label": "Неон"},
    "aurora": {"price": 15, "achievement_id": None, "label": "Аврора"},
}

app = FastAPI(title="PDRPrep API", version="3.0.0")
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        FRONTEND_URL,
        "http://localhost:5173",
        "http://localhost:5174",
        "http://localhost:3000",
        "http://127.0.0.1:5173",
        "http://127.0.0.1:5174",
        "http://127.0.0.1:3000",
    ],
    allow_origin_regex=r"https?://(localhost|127\.0\.0\.1)(:\d+)?$",
    allow_credentials=True,
    allow_methods=["GET", "POST", "PATCH", "DELETE", "OPTIONS"],
    allow_headers=["*"],
)
app.mount("/uploads", StaticFiles(directory=str(BASE_DIR / "uploads")), name="uploads")
if PUBLIC_IMAGES_DIR.exists():
    app.mount("/images/questions_img", StaticFiles(directory=str(PUBLIC_IMAGES_DIR)), name="questions_img")


class RealtimeHub:
    def __init__(self) -> None:
        self._connections: dict[str, set[WebSocket]] = defaultdict(set)

    async def connect(self, email: str, websocket: WebSocket) -> None:
        await websocket.accept()
        self._connections[email.strip().lower()].add(websocket)

    def disconnect(self, email: str, websocket: WebSocket) -> None:
        normalized = email.strip().lower()
        sockets = self._connections.get(normalized)
        if not sockets:
            return
        sockets.discard(websocket)
        if not sockets:
            self._connections.pop(normalized, None)

    async def emit(self, email: str, event: str, payload: Optional[dict[str, Any]] = None) -> None:
        normalized = email.strip().lower()
        sockets = list(self._connections.get(normalized, set()))
        stale: list[WebSocket] = []
        for socket in sockets:
            try:
                await socket.send_json({"event": event, "payload": payload or {}})
            except Exception:
                stale.append(socket)
        for socket in stale:
            self.disconnect(normalized, socket)


realtime_hub = RealtimeHub()


def db():
    return psycopg.connect(DB_URL, row_factory=dict_row)


def ensure_schema() -> None:
    sql_path = BASE_DIR / "create_tables.sql"
    if not sql_path.exists():
        return

    raw_sql = sql_path.read_text(encoding="utf-8")
    statements = [statement.strip() for statement in raw_sql.split(";") if statement.strip()]
    with db() as conn:
        for statement in statements:
            conn.execute(statement)
        conn.commit()


def ensure_runtime_migrations() -> None:
    statements = [
        "ALTER TABLE users ADD COLUMN IF NOT EXISTS surname TEXT",
        "ALTER TABLE users ADD COLUMN IF NOT EXISTS username TEXT",
        "ALTER TABLE users ADD COLUMN IF NOT EXISTS email_verified BOOLEAN NOT NULL DEFAULT FALSE",
        "ALTER TABLE users ADD COLUMN IF NOT EXISTS avatar_version INT NOT NULL DEFAULT 0",
        "ALTER TABLE users ADD COLUMN IF NOT EXISTS purchased_frames JSONB NOT NULL DEFAULT '[]'::jsonb",
        "ALTER TABLE users ADD COLUMN IF NOT EXISTS spent_stars INT NOT NULL DEFAULT 0",
        "ALTER TABLE users ADD COLUMN IF NOT EXISTS featured_achievements JSONB NOT NULL DEFAULT '[]'::jsonb",
        "ALTER TABLE users ADD COLUMN IF NOT EXISTS email_visible BOOLEAN NOT NULL DEFAULT TRUE",
        "ALTER TABLE users ADD COLUMN IF NOT EXISTS theme_preference TEXT NOT NULL DEFAULT 'system'",
        "ALTER TABLE users ADD COLUMN IF NOT EXISTS font_size INT NOT NULL DEFAULT 16",
        "ALTER TABLE users ADD COLUMN IF NOT EXISTS sound_enabled BOOLEAN NOT NULL DEFAULT TRUE",
        "ALTER TABLE users ADD COLUMN IF NOT EXISTS push_enabled BOOLEAN NOT NULL DEFAULT FALSE",
        "ALTER TABLE users ADD COLUMN IF NOT EXISTS is_blocked BOOLEAN NOT NULL DEFAULT FALSE",
        "ALTER TABLE users ADD COLUMN IF NOT EXISTS manual_star_adjustment INT NOT NULL DEFAULT 0",
        "ALTER TABLE users ADD COLUMN IF NOT EXISTS username_change_count INT NOT NULL DEFAULT 0",
        "ALTER TABLE users ADD COLUMN IF NOT EXISTS username_last_changed_at TIMESTAMP",
        "ALTER TABLE users ADD COLUMN IF NOT EXISTS streak_restores_left INT NOT NULL DEFAULT 3",
        "ALTER TABLE users ADD COLUMN IF NOT EXISTS streak_restores_month TEXT",
        "CREATE INDEX IF NOT EXISTS idx_users_username ON users(username)",
        """
        DO $$
        BEGIN
            IF EXISTS (
                SELECT 1
                FROM information_schema.columns
                WHERE table_name = 'users' AND column_name = 'email_confirmed'
            ) THEN
                EXECUTE '
                    UPDATE users
                    SET email_verified = true
                    WHERE COALESCE(email_verified, false) = false
                      AND COALESCE(email_confirmed, false) = true
                ';
            END IF;
        END $$;
        """,
        """
        UPDATE users
        SET username = LOWER(REGEXP_REPLACE(COALESCE(username, SPLIT_PART(email, '@', 1)), '[^a-zA-Z0-9_]+', '', 'g'))
        WHERE username IS NULL OR BTRIM(username) = ''
        """,
        """
        DO $$
        DECLARE
            duplicate_record RECORD;
        BEGIN
            FOR duplicate_record IN
                SELECT username
                FROM users
                WHERE username IS NOT NULL AND BTRIM(username) <> ''
                GROUP BY username
                HAVING COUNT(*) > 1
            LOOP
                UPDATE users
                SET username = CONCAT(username, '_', id)
                WHERE username = duplicate_record.username;
            END LOOP;
        END $$;
        """,
        "CREATE UNIQUE INDEX IF NOT EXISTS uq_users_username ON users (LOWER(username))",
        """
        DO $$
        BEGIN
            IF EXISTS (
                SELECT 1
                FROM information_schema.columns
                WHERE table_name = 'messages' AND column_name = 'read'
            ) AND NOT EXISTS (
                SELECT 1
                FROM information_schema.columns
                WHERE table_name = 'messages' AND column_name = 'is_read'
            ) THEN
                ALTER TABLE messages RENAME COLUMN read TO is_read;
            END IF;
        END $$;
        """,
        "ALTER TABLE messages ADD COLUMN IF NOT EXISTS from_name TEXT",
        "ALTER TABLE messages ADD COLUMN IF NOT EXISTS type TEXT NOT NULL DEFAULT 'text'",
        "ALTER TABLE messages ADD COLUMN IF NOT EXISTS result_data JSONB NOT NULL DEFAULT '{}'::jsonb",
        "ALTER TABLE messages ADD COLUMN IF NOT EXISTS is_read BOOLEAN NOT NULL DEFAULT FALSE",
        "ALTER TABLE friendships ADD COLUMN IF NOT EXISTS addressee_seen_at TIMESTAMP",
        """
        DO $$
        BEGIN
            IF EXISTS (
                SELECT 1
                FROM information_schema.columns
                WHERE table_name = 'messages'
                  AND column_name = 'result_data'
                  AND udt_name <> 'jsonb'
            ) THEN
                ALTER TABLE messages
                ALTER COLUMN result_data TYPE jsonb
                USING CASE
                    WHEN result_data IS NULL OR BTRIM(result_data::text) = '' THEN '{}'::jsonb
                    ELSE result_data::jsonb
                END;
            END IF;
        END $$;
        """,
        "ALTER TABLE battles ADD COLUMN IF NOT EXISTS challenger_name TEXT",
        "ALTER TABLE battles ADD COLUMN IF NOT EXISTS opponent_name TEXT",
        "ALTER TABLE battles ADD COLUMN IF NOT EXISTS status TEXT NOT NULL DEFAULT 'pending'",
        "ALTER TABLE battles ADD COLUMN IF NOT EXISTS category TEXT NOT NULL DEFAULT 'B'",
        "ALTER TABLE battles ADD COLUMN IF NOT EXISTS question_ids JSONB NOT NULL DEFAULT '[]'::jsonb",
        "ALTER TABLE battles ADD COLUMN IF NOT EXISTS challenger_answers JSONB NOT NULL DEFAULT '{}'::jsonb",
        "ALTER TABLE battles ADD COLUMN IF NOT EXISTS opponent_answers JSONB NOT NULL DEFAULT '{}'::jsonb",
        "ALTER TABLE battles ADD COLUMN IF NOT EXISTS challenger_score INT NOT NULL DEFAULT 0",
        "ALTER TABLE battles ADD COLUMN IF NOT EXISTS opponent_score INT NOT NULL DEFAULT 0",
        "ALTER TABLE battles ADD COLUMN IF NOT EXISTS challenger_time INT NOT NULL DEFAULT 0",
        "ALTER TABLE battles ADD COLUMN IF NOT EXISTS opponent_time INT NOT NULL DEFAULT 0",
        "ALTER TABLE battles ADD COLUMN IF NOT EXISTS winner_email TEXT",
        "ALTER TABLE battles ADD COLUMN IF NOT EXISTS challenger_seen_at TIMESTAMP",
        "ALTER TABLE battles ADD COLUMN IF NOT EXISTS opponent_seen_at TIMESTAMP",
        "ALTER TABLE battles ADD COLUMN IF NOT EXISTS expires_at TIMESTAMP",
        "ALTER TABLE battles ADD COLUMN IF NOT EXISTS finished_at TIMESTAMP",
        """
        DO $$
        BEGIN
            IF EXISTS (
                SELECT 1
                FROM information_schema.columns
                WHERE table_name = 'battles'
                  AND column_name = 'question_ids'
                  AND udt_name <> 'jsonb'
            ) THEN
                ALTER TABLE battles
                ALTER COLUMN question_ids TYPE jsonb
                USING CASE
                    WHEN question_ids IS NULL OR BTRIM(question_ids::text) = '' THEN '[]'::jsonb
                    ELSE question_ids::jsonb
                END;
            END IF;
        END $$;
        """,
        """
        DO $$
        BEGIN
            IF EXISTS (
                SELECT 1
                FROM information_schema.columns
                WHERE table_name = 'battles'
                  AND column_name = 'challenger_answers'
                  AND udt_name <> 'jsonb'
            ) THEN
                ALTER TABLE battles
                ALTER COLUMN challenger_answers TYPE jsonb
                USING CASE
                    WHEN challenger_answers IS NULL OR BTRIM(challenger_answers::text) = '' THEN '{}'::jsonb
                    ELSE challenger_answers::jsonb
                END;
            END IF;
        END $$;
        """,
        """
        DO $$
        BEGIN
            IF EXISTS (
                SELECT 1
                FROM information_schema.columns
                WHERE table_name = 'battles'
                  AND column_name = 'opponent_answers'
                  AND udt_name <> 'jsonb'
            ) THEN
                ALTER TABLE battles
                ALTER COLUMN opponent_answers TYPE jsonb
                USING CASE
                    WHEN opponent_answers IS NULL OR BTRIM(opponent_answers::text) = '' THEN '{}'::jsonb
                    ELSE opponent_answers::jsonb
                END;
            END IF;
        END $$;
        """,
    ]

    with db() as conn:
        for statement in statements:
            conn.execute(statement)
        conn.commit()


@app.on_event("startup")
def on_startup() -> None:
    ensure_schema()
    ensure_runtime_migrations()


def _clean_text(value: Any) -> str:
    text = str(value or "").replace("\r", " ").replace("\n", " ").strip()
    for marker in QUESTION_UI_MARKERS:
        text = text.replace(marker, " ")
    return re.sub(r"\s+", " ", text).strip()


def _normalize_category(category: Optional[str]) -> Optional[str]:
    if not category:
        return None
    raw = category.strip().upper()
    return CATEGORY_ALIASES.get(raw, raw)


def _category_sections(category: Optional[str]) -> list[int]:
    normalized = _normalize_category(category)
    return CATEGORY_SECTION_RULES.get(normalized or "", [])


def _section_number_sql(column: str) -> str:
    return f"NULLIF(SUBSTRING(TRIM(COALESCE({column}::text, '')) FROM '^\\d+'), '')::INT"


def _append_category_condition(conds: list[str], params: list[Any], category: Optional[str], prefix: str = "") -> None:
    sections = _category_sections(category)
    if not sections:
        return
    column = f"{prefix}section" if prefix else "section"
    conds.append(f"{_section_number_sql(column)} = ANY(%s)")
    params.append(sections)


def _coerce_json_list(value: Any) -> list[Any]:
    if isinstance(value, list):
        return value
    if isinstance(value, str):
        try:
            parsed = json.loads(value)
            return parsed if isinstance(parsed, list) else []
        except Exception:
            return []
    return []


def _coerce_json_dict(value: Any) -> dict[str, Any]:
    if isinstance(value, dict):
        return value
    if isinstance(value, str):
        try:
            parsed = json.loads(value)
            return parsed if isinstance(parsed, dict) else {}
        except Exception:
            return {}
    return {}


def _server_today() -> date:
    return datetime.now().astimezone().date()


def _is_admin_email(email: Optional[str]) -> bool:
    normalized = (email or "").strip().lower()
    return normalized in ADMIN_EMAILS


def _current_month_key(today: Optional[date] = None) -> str:
    current = today or _server_today()
    return current.strftime("%Y-%m")


def _normalize_restore_state(user: dict[str, Any], today: Optional[date] = None) -> tuple[int, str]:
    current = today or _server_today()
    month_key = _current_month_key(current)
    restores_left = int(user.get("streak_restores_left") or 0)
    saved_month = str(user.get("streak_restores_month") or "")
    if saved_month != month_key:
        restores_left = 3
    return restores_left, month_key


def _streak_snapshot(user: dict[str, Any], today: Optional[date] = None) -> dict[str, Any]:
    current = today or _server_today()
    last_activity = user.get("last_activity")
    streak_days = int(user.get("streak_days") or 0)
    restores_left, month_key = _normalize_restore_state(user, current)

    if not last_activity:
        status = "inactive"
        display_streak = 0
        missed_days = 0
    else:
        delta_days = (current - last_activity).days
        missed_days = max(0, delta_days - 1)
        if delta_days <= 0:
            status = "active"
            display_streak = streak_days
        elif delta_days == 1:
            status = "inactive"
            display_streak = streak_days
        elif delta_days == 2 and restores_left > 0:
            status = "restorable"
            display_streak = streak_days
        else:
            status = "lost"
            display_streak = 0

    return {
        "status": status,
        "days": display_streak,
        "restores_left": restores_left,
        "month_key": month_key,
        "missed_days": missed_days,
    }


def _earned_stars(conn: psycopg.Connection, user_id: int) -> int:
    row = conn.execute(
        """
        SELECT COUNT(*) AS count
        FROM test_results
        WHERE user_id = %s AND total > 0 AND correct = total
        """,
        (user_id,),
    ).fetchone()
    return int((row or {}).get("count") or 0)


def _purchased_frames(user: dict[str, Any]) -> list[str]:
    return [str(item) for item in _coerce_json_list(user.get("purchased_frames")) if str(item).strip()]


def _total_stars(conn: psycopg.Connection, user: dict[str, Any]) -> int:
    return max(0, _earned_stars(conn, user["id"]) + int(user.get("manual_star_adjustment") or 0))


def _available_stars(conn: psycopg.Connection, user: dict[str, Any]) -> int:
    return max(0, _total_stars(conn, user) - int(user.get("spent_stars") or 0))


def _passed_tests_count(conn: psycopg.Connection, user_id: int) -> int:
    row = conn.execute(
        """
        SELECT COUNT(*) AS count
        FROM test_results
        WHERE user_id = %s
          AND total > 0
          AND ROUND((correct::numeric / total::numeric) * 100) >= 80
        """,
        (user_id,),
    ).fetchone()
    return int((row or {}).get("count") or 0)


def _frame_shop_payload(user: dict[str, Any], earned_achievement_ids: list[str], available_stars: int) -> list[dict[str, Any]]:
    purchased = set(_purchased_frames(user))
    items: list[dict[str, Any]] = []
    for frame_id, meta in FRAME_SHOP.items():
        achievement_id = meta.get("achievement_id")
        unlocked = frame_id == "default" or frame_id in purchased or (achievement_id in earned_achievement_ids if achievement_id else False)
        items.append(
            {
                "id": frame_id,
                "label": meta["label"],
                "price": int(meta.get("price") or 0),
                "achievement_id": achievement_id,
                "unlocked": unlocked,
                "can_purchase": not unlocked and not achievement_id,
                "purchased": frame_id in purchased,
            }
        )
    return items


def _sanitize_question_row(row: dict[str, Any]) -> dict[str, Any]:
    options = [_clean_text(option) for option in (row.get("options") or []) if _clean_text(option)]
    images = [str(image) for image in (row.get("images") or []) if str(image).strip()]
    return {
        **row,
        "section": str(row.get("section") or ""),
        "section_name": _clean_text(row.get("section_name")),
        "question_text": _clean_text(row.get("question_text")),
        "difficulty": _clean_text(row.get("difficulty")) or "medium",
        "explanation": _clean_text(row.get("explanation")),
        "options": options,
        "images": images,
    }


def _question_is_usable(row: dict[str, Any]) -> bool:
    question = _sanitize_question_row(row)
    options = question.get("options") or []
    correct_ans = int(question.get("correct_ans") or 0)
    if not question.get("question_text") or len(options) < 2:
        return False
    if correct_ans < 1 or correct_ans > len(options):
        return False
    if any(BROKEN_OPTION_RE.search(option) for option in options):
        return False
    return True


def _dedupe_and_filter_questions(rows: list[dict[str, Any]], count: Optional[int] = None) -> list[dict[str, Any]]:
    prepared: list[dict[str, Any]] = []
    seen_ids: set[Any] = set()
    seen_texts: set[str] = set()

    for row in rows:
        if not _question_is_usable(row):
            continue
        question = _sanitize_question_row(row)
        qid = question.get("id")
        text_key = question.get("question_text", "").casefold()
        if qid in seen_ids or text_key in seen_texts:
            continue
        seen_ids.add(qid)
        seen_texts.add(text_key)
        prepared.append(question)
        if count and len(prepared) >= count:
            break
    return prepared


def _user_public(user: dict[str, Any]) -> dict[str, Any]:
    username = (user.get("username") or "").strip().lower() or None
    full_name = " ".join(part for part in [user.get("name"), user.get("surname")] if part)
    featured_achievements = _coerce_json_list(user.get("featured_achievements"))
    purchased_frames = _purchased_frames(user)
    streak = _streak_snapshot(user)
    username_change_count = int(user.get("username_change_count") or 0)
    username_last_changed_at = user.get("username_last_changed_at")
    username_change_available_at = None
    username_change_blocked = False
    if username_change_count >= 2 and username_last_changed_at:
        unlock_at = username_last_changed_at + timedelta(days=7)
        username_change_blocked = datetime.now() < unlock_at
        username_change_available_at = unlock_at.isoformat()
    return {
        "id": user["id"],
        "name": user["name"],
        "surname": user.get("surname"),
        "username": username,
        "nickname": f"@{username}" if username else None,
        "full_name": full_name or user["name"],
        "email": user["email"],
        "avatar_url": user.get("avatar_url"),
        "avatar_version": int(user.get("avatar_version") or 0),
        "bio": user.get("bio"),
        "active_frame": user.get("active_frame"),
        "purchased_frames": purchased_frames,
        "email_visible": bool(user.get("email_visible", True)),
        "theme_preference": user.get("theme_preference") or "system",
        "font_size": int(user.get("font_size") or 16),
        "sound_enabled": bool(user.get("sound_enabled", True)),
        "push_enabled": bool(user.get("push_enabled", False)),
        "is_admin": _is_admin_email(user.get("email")),
        "is_blocked": bool(user.get("is_blocked", False)),
        "featured_achievements": [str(item) for item in featured_achievements if item],
        "username_change_count": username_change_count,
        "username_change_available_at": username_change_available_at,
        "username_change_blocked": username_change_blocked,
        "streak_days": streak["days"],
        "streak_status": streak["status"],
        "streak_restores_left": streak["restores_left"],
        "marathon_best": user.get("marathon_best", 0),
        "total_tests": user.get("total_tests", 0),
        "total_correct": user.get("total_correct", 0),
        "total_answers": user.get("total_answers", 0),
        "created_at": str(user.get("created_at") or ""),
    }


def _normalize_username(value: Optional[str]) -> Optional[str]:
    if value is None:
        return None
    username = value.strip().lower()
    if username.startswith("@"):
        username = username[1:]
    return username or None


def _is_email_verified(user: Optional[dict[str, Any]]) -> bool:
    if not user:
        return False
    if "email_verified" in user and user.get("email_verified") is not None:
        return bool(user.get("email_verified"))
    return bool(user.get("email_confirmed"))


def _validate_username(value: str) -> str:
    username = _normalize_username(value) or ""
    if not USERNAME_RE.fullmatch(username):
        raise HTTPException(400, "Username має містити лише латиницю, цифри або _, від 3 до 32 символів")
    return username


def _resolve_user_by_login(conn: psycopg.Connection, identifier: str) -> Optional[dict[str, Any]]:
    normalized = identifier.strip().lower()
    if "@" in normalized and not normalized.startswith("@"):
        row = conn.execute("SELECT * FROM users WHERE email = %s", (normalized,)).fetchone()
    else:
        username = _normalize_username(normalized)
        row = conn.execute("SELECT * FROM users WHERE LOWER(username) = %s", (username,)).fetchone() if username else None
    return dict(row) if row else None


def _resolve_user_by_handle(conn: psycopg.Connection, handle: str) -> Optional[dict[str, Any]]:
    normalized = handle.strip()
    if not normalized:
        return None
    if "@" in normalized and not normalized.startswith("@"):
        row = conn.execute("SELECT * FROM users WHERE email = %s", (normalized.lower(),)).fetchone()
    else:
        username = _normalize_username(normalized)
        row = conn.execute("SELECT * FROM users WHERE LOWER(username) = %s", (username,)).fetchone() if username else None
    return dict(row) if row else None


def _resolve_social_user_by_handle(
    conn: psycopg.Connection,
    handle: str,
    requester: Optional[dict[str, Any]] = None,
) -> Optional[dict[str, Any]]:
    resolved = _resolve_user_by_handle(conn, handle)
    if not resolved:
        return None
    if _is_admin_email(resolved.get("email")):
        requester_email = (requester or {}).get("email")
        if not _is_admin_email(requester_email):
            return None
    return resolved


def hash_password(password: str) -> str:
    return bcrypt.hashpw(password.encode(), bcrypt.gensalt()).decode()


def check_password(password: str, hashed: str) -> bool:
    return bcrypt.checkpw(password.encode(), hashed.encode())


def create_token(user_id: int, remember_me: bool = True) -> str:
    days = JWT_REMEMBER_DAYS if remember_me else JWT_SESSION_DAYS
    payload = {"sub": str(user_id), "exp": datetime.utcnow() + timedelta(days=days)}
    return jwt.encode(payload, JWT_SECRET, algorithm="HS256")


def get_current_user(authorization: Optional[str] = Header(default=None)) -> dict[str, Any]:
    if not authorization or not authorization.startswith("Bearer "):
        raise HTTPException(401, "Потрібна авторизація")

    token = authorization[7:]
    try:
        payload = jwt.decode(token, JWT_SECRET, algorithms=["HS256"])
        user_id = int(payload["sub"])
    except jwt.ExpiredSignatureError as exc:
        raise HTTPException(401, "Сесія завершилася, увійдіть знову") from exc
    except Exception as exc:
        raise HTTPException(401, "Невалідний токен") from exc

    with db() as conn:
        user = conn.execute("SELECT * FROM users WHERE id = %s", (user_id,)).fetchone()
    if not user:
        raise HTTPException(401, "Користувача не знайдено")
    payload = dict(user)
    if payload.get("is_blocked") and not _is_admin_email(payload.get("email")):
        raise HTTPException(403, "Акаунт заблоковано")
    return payload


def get_optional_user(authorization: Optional[str] = Header(default=None)) -> Optional[dict[str, Any]]:
    if not authorization:
        return None
    try:
        return get_current_user(authorization)
    except HTTPException:
        return None


def require_admin(user=Depends(get_current_user)) -> dict[str, Any]:
    if not _is_admin_email(user.get("email")):
        raise HTTPException(403, "Потрібні права адміністратора")
    return user


def _resolve_user_from_token(token: str) -> Optional[dict[str, Any]]:
    try:
        payload = jwt.decode(token, JWT_SECRET, algorithms=["HS256"])
        user_id = int(payload["sub"])
    except Exception:
        return None
    with db() as conn:
        user = conn.execute("SELECT * FROM users WHERE id = %s", (user_id,)).fetchone()
    if not user:
        return None
    user_payload = dict(user)
    if user_payload.get("is_blocked") and not _is_admin_email(user_payload.get("email")):
        return None
    return user_payload


@app.websocket("/ws")
async def websocket_bridge(websocket: WebSocket, token: str = Query(default="")):
    user = _resolve_user_from_token(token)
    if not user:
        await websocket.close(code=4401)
        return

    await realtime_hub.connect(user["email"], websocket)
    try:
        while True:
            await websocket.receive_text()
    except WebSocketDisconnect:
        realtime_hub.disconnect(user["email"], websocket)


def send_email(to_email: str, subject: str, body: str) -> bool:
    if not SMTP_USER:
        print(f"[EMAIL MOCK] {to_email}: {subject}")
        return False
    try:
        message = MIMEMultipart()
        message["From"] = SMTP_USER
        message["To"] = to_email
        message["Subject"] = subject
        message.attach(MIMEText(body, "html"))
        with smtplib.SMTP(SMTP_HOST, SMTP_PORT) as smtp:
            smtp.starttls()
            smtp.login(SMTP_USER, SMTP_PASS)
            smtp.sendmail(SMTP_USER, to_email, message.as_string())
        return True
    except Exception as exc:
        print(f"[EMAIL ERROR] {exc}")
        return False


def gen_code(length: int = 6) -> str:
    return "".join(random.choices(string.digits, k=length))


def _friend_counterpart(friendship: dict[str, Any], current_user_id: int) -> tuple[int, str]:
    if friendship["requester_id"] == current_user_id:
        return friendship["addressee_id"], "outgoing"
    return friendship["requester_id"], "incoming"


def _serialize_question_ids(question_ids: list[int]) -> str:
    return json.dumps(question_ids, ensure_ascii=False)


def _serialize_json(data: Any) -> str:
    return json.dumps(data, ensure_ascii=False)


def _answer_label_to_index(answer: Optional[str], question: dict[str, Any]) -> int:
    if not answer:
        return 0
    options = question.get("options") or []
    labels = ["A", "B", "C", "D", "E", "F"]
    for index in range(len(options)):
        if labels[index] == answer:
            return index + 1
    return 0


def _battle_role(battle: dict[str, Any], email: str) -> Optional[str]:
    normalized = email.strip().lower()
    if battle["challenger_email"].lower() == normalized:
        return "challenger"
    if battle["opponent_email"].lower() == normalized:
        return "opponent"
    return None


def _pick_winner(battle: dict[str, Any]) -> Optional[str]:
    challenger_score = int(battle.get("challenger_score") or 0)
    opponent_score = int(battle.get("opponent_score") or 0)
    challenger_time = int(battle.get("challenger_time") or 0)
    opponent_time = int(battle.get("opponent_time") or 0)

    if challenger_score > opponent_score:
        return battle["challenger_email"]
    if opponent_score > challenger_score:
        return battle["opponent_email"]
    if challenger_time and opponent_time:
        if challenger_time < opponent_time:
            return battle["challenger_email"]
        if opponent_time < challenger_time:
            return battle["opponent_email"]
    return None


def _battle_deadline_seconds(battle: dict[str, Any]) -> Optional[int]:
    expires_at = battle.get("expires_at")
    if not expires_at:
        return None
    remaining = int((expires_at - datetime.utcnow()).total_seconds())
    return max(0, remaining)


def _battle_seen_column(role: Optional[str]) -> Optional[str]:
    if role == "challenger":
        return "challenger_seen_at"
    if role == "opponent":
        return "opponent_seen_at"
    return None


def _battle_invite_seen(battle: dict[str, Any], role: Optional[str]) -> bool:
    column = _battle_seen_column(role)
    return bool(column and battle.get(column))


def _mark_battle_seen(conn: psycopg.Connection, battle: dict[str, Any], role: Optional[str]) -> dict[str, Any]:
    column = _battle_seen_column(role)
    if not column or battle.get(column):
        return battle
    conn.execute(f"UPDATE battles SET {column} = NOW() WHERE id = %s", (battle["id"],))
    battle[column] = datetime.utcnow()
    return battle


def _finalize_battle_state(conn: psycopg.Connection, battle: dict[str, Any]) -> dict[str, Any]:
    battle["question_ids"] = _coerce_json_list(battle.get("question_ids"))
    battle["challenger_answers"] = _coerce_json_dict(battle.get("challenger_answers"))
    battle["opponent_answers"] = _coerce_json_dict(battle.get("opponent_answers"))
    expires_at = battle.get("expires_at")
    if battle.get("status") != "active" or not expires_at or expires_at > datetime.utcnow():
        return battle

    battle["status"] = "finished"
    battle["winner_email"] = _pick_winner(battle)
    conn.execute(
        """
        UPDATE battles
        SET status = %s,
            winner_email = %s
        WHERE id = %s
        """,
        (battle["status"], battle["winner_email"], battle["id"]),
    )
    return battle


def _prepare_import_question(item: dict[str, Any]) -> dict[str, Any]:
    raw_options = item.get("options") or item.get("РІР°СЂС–Р°РЅС‚Рё") or []
    options: list[str] = []
    for option in raw_options:
        if isinstance(option, dict):
            text = _clean_text(option.get("text"))
        else:
            text = _clean_text(option)
        if text:
            options.append(text)

    images = item.get("images") or item.get("РєР°СЂС‚РёРЅРєРё") or []
    if not images and item.get("image_url"):
        images = [item.get("image_url")]

    correct_ans = item.get("correct_ans") or item.get("РїСЂР°РІРёР»СЊРЅР°_РІС–РґРїРѕРІС–РґСЊ")
    correct_answer = str(item.get("correct_answer") or "").strip().upper()
    if not correct_ans and correct_answer:
        labels = ["A", "B", "C", "D", "E", "F"]
        if correct_answer in labels:
            correct_ans = labels.index(correct_answer) + 1

    raw_category = item.get("category") or item.get("РєР°С‚РµРіРѕСЂС–СЏ")
    if not raw_category:
        raw_categories = item.get("РєР°С‚РµРіРѕСЂС–С—") or []
        if isinstance(raw_categories, list) and raw_categories:
            raw_category = raw_categories[0]

    return {
        "id": int(item["id"]),
        "section": str(item.get("section") or item.get("РЎРµР·РґС–Р»") or item.get("РЎРѕР·РґС–Р»") or item.get("РЎР·РѕРґС–Р»") or item.get("РЎРґРѕР·РґС–Р»") or item.get("РЎСЂРѕР·РґС–Р»") or item.get("СЂРѕР·РґС–Р»") or ""),
        "section_name": _clean_text(item.get("section_name") or item.get("РЅР°Р·РІР°_СЂРѕР·РґС–Р»Сѓ")),
        "num_in_section": item.get("num_in_section") or item.get("РЅРѕРјРµСЂ_РІ_СЂРѕР·РґС–Р»С–"),
        "category": _normalize_category(raw_category),
        "difficulty": _clean_text(item.get("difficulty") or item.get("СЃРєР»Р°РґРЅС–СЃС‚СЊ")) or "medium",
        "explanation": _clean_text(item.get("explanation") or item.get("РїРѕСЏСЃРЅРµРЅРЅСЏ")),
        "question_text": _clean_text(item.get("question_text") or item.get("С‚РµРєСЃС‚_РїРёС‚Р°РЅРЅСЏ")),
        "options": options,
        "correct_ans": int(correct_ans or 0),
        "images": [str(image) for image in images if str(image).strip()],
        "page": item.get("page") or item.get("СЃС‚РѕСЂС–РЅРєР°"),
    }


class RegisterRequest(BaseModel):
    name: str
    surname: str
    username: str
    email: str
    password: str


class LoginRequest(BaseModel):
    identifier: str
    password: str
    remember_me: bool = True


class VerifyEmailRequest(BaseModel):
    email: str
    code: str


class ForgotPasswordRequest(BaseModel):
    email: str


class ResetPasswordRequest(BaseModel):
    email: str
    code: str
    new_password: str


class ResendVerificationRequest(BaseModel):
    email: str


class UpdateProfileRequest(BaseModel):
    name: Optional[str] = None
    surname: Optional[str] = None
    username: Optional[str] = None
    bio: Optional[str] = None
    active_frame: Optional[str] = None
    email_visible: Optional[bool] = None
    featured_achievements: Optional[list[str]] = None
    theme_preference: Optional[str] = None
    font_size: Optional[int] = None
    sound_enabled: Optional[bool] = None
    push_enabled: Optional[bool] = None


class AnswerSubmit(BaseModel):
    question_id: int
    selected_index: int
    is_correct: bool
    time_ms: Optional[int] = None


class TestResultSubmit(BaseModel):
    section: Optional[str] = None
    mode: str
    total: int
    correct: int
    time_seconds: int
    answers: list[AnswerSubmit] = Field(default_factory=list)


class MarathonScoreSubmit(BaseModel):
    score: int


class FriendInviteRequest(BaseModel):
    username: str


class MessageCreateRequest(BaseModel):
    to_user: str
    content: str
    type: str = "text"
    result_data: dict[str, Any] = Field(default_factory=dict)


class BattleCreateRequest(BaseModel):
    opponent_user: str
    category: str = "B"
    question_count: int = Field(default=10, ge=5, le=20)


class BattleSubmitRequest(BaseModel):
    answers: dict[str, str]
    time_seconds: int = Field(ge=0)


class BattleDecisionRequest(BaseModel):
    action: str = "decline"


class SupportMessageCreateRequest(BaseModel):
    content: str


class FramePurchaseRequest(BaseModel):
    frame_id: str


class AdminSupportReplyRequest(BaseModel):
    content: str


class AdminUserUpdateRequest(BaseModel):
    is_blocked: Optional[bool] = None
    total_tests: Optional[int] = None
    total_correct: Optional[int] = None
    total_answers: Optional[int] = None
    marathon_best: Optional[int] = None
    streak_days: Optional[int] = None
    manual_star_adjustment: Optional[int] = None


class AdminAchievementUpdateRequest(BaseModel):
    achievement_id: str
    remove: bool = False


class AdminQuestionUpdateRequest(BaseModel):
    question_text: Optional[str] = None
    explanation: Optional[str] = None
    difficulty: Optional[str] = None
    section_name: Optional[str] = None
    options: Optional[list[str]] = None
    images: Optional[list[str]] = None
    correct_ans: Optional[int] = None


ACHIEVEMENTS_DEF = [
    ("first_step", 1, "Перший виїзд", "Пройти перший тест", "tests", 1),
    ("rookie", 2, "Новачок", "Пройти 10 тестів", "tests", 10),
    ("driver", 3, "Водій", "Пройти 50 тестів", "tests", 50),
    ("pro_driver", 4, "Профі", "Пройти 100 тестів", "tests", 100),
    ("hundred", 1, "Сотня", "100 правильних відповідей", "correct", 100),
    ("five_hundred", 2, "П'ятисотня", "500 правильних відповідей", "correct", 500),
    ("thousand", 3, "Тисячник", "1000 правильних відповідей", "correct", 1000),
    ("legend", 4, "Легенда", "5000 правильних відповідей", "correct", 5000),
    ("streak_3", 1, "Розігрів", "3 дні підряд", "streak", 3),
    ("streak_7", 2, "Темп", "7 днів підряд", "streak", 7),
    ("streak_28", 3, "Вогонь", "28 днів підряд", "streak", 28),
    ("marathon_10", 1, "Бігун", "10 у марафоні", "marathon", 10),
    ("marathon_50", 2, "Спринтер", "50 у марафоні", "marathon", 50),
    ("marathon_100", 3, "Блискавка", "100 у марафоні", "marathon", 100),
    ("perfect_1", 1, "Без помилок", "Перший ідеальний тест", "perfect", 1),
    ("perfect_5", 2, "Відмінник", "5 ідеальних тестів", "perfect", 5),
]


def _check_achievements(conn: psycopg.Connection, user_id: int) -> list[dict[str, Any]]:
    earned = {
        row["achievement_id"]
        for row in conn.execute(
            "SELECT achievement_id FROM user_achievements WHERE user_id = %s",
            (user_id,),
        ).fetchall()
    }
    user = dict(conn.execute("SELECT * FROM users WHERE id = %s", (user_id,)).fetchone())
    perfect_tests = conn.execute(
        """
        SELECT COUNT(*) AS count
        FROM test_results
        WHERE user_id = %s AND total > 0 AND correct = total
        """,
        (user_id,),
    ).fetchone()["count"]

    created: list[dict[str, Any]] = []
    for achievement_id, tier, name, description, category, threshold in ACHIEVEMENTS_DEF:
        if achievement_id in earned:
            continue

        should_create = False
        if category == "tests":
            should_create = (user.get("total_tests") or 0) >= threshold
        elif category == "correct":
            should_create = (user.get("total_correct") or 0) >= threshold
        elif category == "streak":
            should_create = (user.get("streak_days") or 0) >= threshold
        elif category == "marathon":
            should_create = (user.get("marathon_best") or 0) >= threshold
        elif category == "perfect":
            should_create = perfect_tests >= threshold

        if not should_create:
            continue

        conn.execute(
            """
            INSERT INTO user_achievements
                (user_id, achievement_id, achievement_name, achievement_desc, tier, category)
            VALUES (%s, %s, %s, %s, %s, %s)
            ON CONFLICT (user_id, achievement_id) DO NOTHING
            """,
            (user_id, achievement_id, name, description, tier, category),
        )
        created.append(
            {
                "id": achievement_id,
                "name": name,
                "description": description,
                "tier": tier,
            }
        )
    return created


@app.get("/")
def root():
    return {"status": "ok", "version": "3.0.0"}


@app.post("/auth/register")
def register(req: RegisterRequest):
    email = req.email.strip().lower()
    name = req.name.strip()
    surname = req.surname.strip()
    if len(req.password) < 6:
        raise HTTPException(400, "Пароль має містити щонайменше 6 символів")
    if not re.match(r"[^@]+@[^@]+\.[^@]+", email):
        raise HTTPException(400, "Невалідний email")

    if not name:
        raise HTTPException(400, "Вкажіть ім'я")
    if not surname:
        raise HTTPException(400, "Вкажіть прізвище")
    username = _validate_username(req.username)

    code = gen_code()
    with db() as conn:
        existing = conn.execute(
            "SELECT id, email_verified FROM users WHERE email = %s",
            (email,),
        ).fetchone()
        username_owner = conn.execute(
            "SELECT id, email FROM users WHERE LOWER(username) = %s",
            (username,),
        ).fetchone()
        password_hash = hash_password(req.password)
        if username_owner and username_owner["email"] != email:
            raise HTTPException(409, "Цей нікнейм вже зайнятий")
        if existing and _is_email_verified(dict(existing)):
            raise HTTPException(409, "Ця пошта вже зареєстрована")
        if existing:
            conn.execute(
                """
                UPDATE users
                SET name = %s, surname = %s, username = %s, password_hash = %s, email_code = %s
                WHERE email = %s
                """,
                (name, surname, username, password_hash, code, email),
            )
        else:
            conn.execute(
                """
                INSERT INTO users (name, surname, username, email, password_hash, email_code, email_verified)
                VALUES (%s, %s, %s, %s, %s, %s, false)
                """,
                (name, surname, username, email, password_hash, code),
            )
        conn.commit()

    sent = send_email(
        email,
        "Код підтвердження PDRPrep",
        f"<p>Ваш код підтвердження: <b style='font-size:24px'>{code}</b></p>",
    )
    payload: dict[str, Any] = {"message": "Код підтвердження надіслано на email"}
    if not sent:
        payload["dev_code"] = code
    return payload


@app.post("/auth/verify-email")
def verify_email(req: VerifyEmailRequest):
    email = req.email.strip().lower()
    with db() as conn:
        user = conn.execute(
            "SELECT * FROM users WHERE email = %s",
            (email,),
        ).fetchone()
        if not user or user["email_code"] != req.code.strip():
            raise HTTPException(400, "Невірний код")
        conn.execute(
            """
            UPDATE users
            SET email_verified = true, email_code = null
            WHERE email = %s
            """,
            (email,),
        )
        conn.commit()
        verified = conn.execute("SELECT * FROM users WHERE email = %s", (email,)).fetchone()
    token = create_token(verified["id"], remember_me=True)
    return {"token": token, "user": _user_public(dict(verified))}


@app.post("/auth/login")
def login(req: LoginRequest):
    identifier = req.identifier.strip()
    with db() as conn:
        user = _resolve_user_by_login(conn, identifier)
    is_email_login = "@" in identifier and not identifier.strip().startswith("@")
    if not user:
        raise HTTPException(401, "Такого E-mail не існує" if is_email_login else "Такого нікнейму не існує")
    if not check_password(req.password, user["password_hash"]):
        raise HTTPException(401, "Невірний пароль")
    if user.get("is_blocked") and not _is_admin_email(user.get("email")):
        raise HTTPException(403, "Акаунт заблоковано")
    if not _is_email_verified(user):
        raise HTTPException(403, "Спочатку підтвердіть email")
    token = create_token(user["id"], remember_me=req.remember_me)
    return {"token": token, "user": _user_public(dict(user))}


@app.post("/auth/resend-verification")
def resend_verification(req: ResendVerificationRequest):
    email = req.email.strip().lower()
    with db() as conn:
        user = conn.execute(
            "SELECT id, email_verified FROM users WHERE email = %s",
            (email,),
        ).fetchone()
        if not user:
            raise HTTPException(404, "Такого E-mail не існує")
        if _is_email_verified(dict(user)):
            return {"message": "Email уже підтверджено"}
        code = gen_code()
        conn.execute("UPDATE users SET email_code = %s WHERE email = %s", (code, email))
        conn.commit()

    sent = send_email(
        email,
        "Новий код підтвердження PDRPrep",
        f"<p>Ваш новий код: <b style='font-size:24px'>{code}</b></p>",
    )
    payload: dict[str, Any] = {"message": "Новий код надіслано на email"}
    if not sent:
        payload["dev_code"] = code
    return payload


@app.post("/auth/forgot-password")
def forgot_password(req: ForgotPasswordRequest):
    email = req.email.strip().lower()
    with db() as conn:
        user = conn.execute("SELECT id FROM users WHERE email = %s", (email,)).fetchone()
        if not user:
            raise HTTPException(404, "Такого E-mail не існує")
        code = gen_code()
        conn.execute(
            """
            UPDATE users
            SET reset_code = %s, reset_code_exp = %s
            WHERE email = %s
            """,
            (code, datetime.utcnow() + timedelta(minutes=15), email),
        )
        conn.commit()

    sent = send_email(
        email,
        "Скидання пароля PDRPrep",
        f"<p>Ваш код для скидання: <b style='font-size:24px'>{code}</b></p>",
    )
    payload: dict[str, Any] = {"message": "Код надіслано на email"}
    if not sent:
        payload["dev_code"] = code
    return payload


@app.post("/auth/reset-password")
def reset_password(req: ResetPasswordRequest):
    email = req.email.strip().lower()
    if len(req.new_password) < 6:
        raise HTTPException(400, "Пароль має містити щонайменше 6 символів")

    with db() as conn:
        user = conn.execute(
            "SELECT reset_code, reset_code_exp FROM users WHERE email = %s",
            (email,),
        ).fetchone()
        if not user or user["reset_code"] != req.code.strip():
            raise HTTPException(400, "Невірний код")
        if not user["reset_code_exp"] or user["reset_code_exp"] < datetime.utcnow():
            raise HTTPException(400, "Код застарів")
        conn.execute(
            """
            UPDATE users
            SET password_hash = %s, reset_code = null, reset_code_exp = null
            WHERE email = %s
            """,
            (hash_password(req.new_password), email),
        )
        conn.commit()
    return {"message": "Пароль змінено успішно"}


@app.get("/auth/me")
def auth_me(user=Depends(get_current_user)):
    return _user_public(user)


@app.patch("/users/me")
def update_profile(req: UpdateProfileRequest, user=Depends(get_current_user)):
    fields: list[str] = []
    params: list[Any] = []
    if req.name is not None:
        fields.append("name = %s")
        params.append(req.name.strip() or user["name"])
    if req.surname is not None:
        fields.append("surname = %s")
        params.append(req.surname.strip() or None)
    if req.username is not None:
        username = _validate_username(req.username)
        current_username = _normalize_username(user.get("username"))
        if username != current_username:
            with db() as conn:
                existing = conn.execute(
                    "SELECT id FROM users WHERE LOWER(username) = %s AND id <> %s",
                    (username, user["id"]),
                ).fetchone()
            if existing:
                raise HTTPException(409, "Цей нікнейм вже зайнятий")
            change_count = int(user.get("username_change_count") or 0)
            last_changed_at = user.get("username_last_changed_at")
            if change_count >= 2 and last_changed_at:
                unlock_at = last_changed_at + timedelta(days=7)
                if datetime.now() < unlock_at:
                    raise HTTPException(429, "Наступна зміна доступна через 7 днів")
            fields.append("username = %s")
            params.append(username)
            fields.append("username_change_count = COALESCE(username_change_count, 0) + 1")
            fields.append("username_last_changed_at = %s")
            params.append(datetime.now())
    if req.bio is not None:
        fields.append("bio = %s")
        params.append(req.bio.strip() or None)
    if req.active_frame is not None:
        frame_id = (req.active_frame or "").strip() or "default"
        if frame_id != "default":
            with db() as conn:
                user_row = dict(conn.execute("SELECT * FROM users WHERE id = %s", (user["id"],)).fetchone())
                achievements = conn.execute(
                    "SELECT achievement_id FROM user_achievements WHERE user_id = %s",
                    (user["id"],),
                ).fetchall()
            purchased = set(_purchased_frames(user_row))
            earned_achievement_ids = {str(row["achievement_id"]) for row in achievements}
            meta = FRAME_SHOP.get(frame_id)
            unlocked = bool(meta) and (
                frame_id in purchased
                or (meta.get("achievement_id") in earned_achievement_ids if meta else False)
            )
            if not unlocked:
                raise HTTPException(400, "Ця рамка ще не відкрита")
        fields.append("active_frame = %s")
        params.append(frame_id)
    if req.theme_preference is not None:
        theme = req.theme_preference.strip().lower()
        if theme not in {"light", "dark", "system"}:
            raise HTTPException(400, "Невірна тема")
        fields.append("theme_preference = %s")
        params.append(theme)
    if req.font_size is not None:
        font_size = max(14, min(20, int(req.font_size)))
        fields.append("font_size = %s")
        params.append(font_size)
    if req.sound_enabled is not None:
        fields.append("sound_enabled = %s")
        params.append(bool(req.sound_enabled))
    if req.push_enabled is not None:
        fields.append("push_enabled = %s")
        params.append(bool(req.push_enabled))
    if req.email_visible is not None:
        fields.append("email_visible = %s")
        params.append(bool(req.email_visible))
    if req.featured_achievements is not None:
        normalized_featured: list[str] = []
        seen_featured: set[str] = set()
        for item in req.featured_achievements:
            value = (item or "").strip()
            if not value or value in seen_featured:
                continue
            seen_featured.add(value)
            normalized_featured.append(value)
            if len(normalized_featured) >= 4:
                break
        fields.append("featured_achievements = %s")
        params.append(json.dumps(normalized_featured, ensure_ascii=False))
    if not fields:
        return _user_public(user)

    params.append(user["id"])
    with db() as conn:
        conn.execute(f"UPDATE users SET {', '.join(fields)} WHERE id = %s", params)
        conn.commit()
        updated = conn.execute("SELECT * FROM users WHERE id = %s", (user["id"],)).fetchone()
    return _user_public(dict(updated))


@app.post("/users/me/avatar")
def upload_avatar(file: UploadFile = File(...), user=Depends(get_current_user)):
    if not file.content_type or not file.content_type.startswith("image/"):
        raise HTTPException(400, "Можна завантажити тільки зображення")

    ext = Path(file.filename or "avatar.png").suffix.lower() or ".png"
    if ext not in {".png", ".jpg", ".jpeg", ".webp"}:
        ext = ".png"
    for old_file in UPLOAD_DIR.glob(f"user_{user['id']}_*"):
        try:
            old_file.unlink()
        except OSError:
            pass
    filename = f"user_{user['id']}_{uuid4().hex}{ext}"
    target = UPLOAD_DIR / filename
    with target.open("wb") as output:
        shutil.copyfileobj(file.file, output)

    avatar_url = f"/uploads/avatars/{filename}"
    with db() as conn:
        conn.execute(
            "UPDATE users SET avatar_url = %s, avatar_version = COALESCE(avatar_version, 0) + 1 WHERE id = %s",
            (avatar_url, user["id"]),
        )
        conn.commit()
        updated = conn.execute("SELECT avatar_url, avatar_version FROM users WHERE id = %s", (user["id"],)).fetchone()
    version = int(updated["avatar_version"] or 0)
    return {"avatar_url": f"{updated['avatar_url']}?v={version}", "avatar_version": version}


@app.get("/users/{user_id}/profile")
def get_user_profile(user_id: int, viewer=Depends(get_optional_user)):
    with db() as conn:
        user = conn.execute("SELECT * FROM users WHERE id = %s", (user_id,)).fetchone()
        if not user:
            raise HTTPException(404, "Користувача не знайдено")
        passed_tests = _passed_tests_count(conn, user_id)
        achievements = conn.execute(
            "SELECT * FROM user_achievements WHERE user_id = %s ORDER BY earned_at DESC",
            (user_id,),
        ).fetchall()
    user_dict = dict(user)
    if _is_admin_email(user_dict.get("email")):
        viewer_email = (viewer or {}).get("email")
        if not _is_admin_email(viewer_email) and viewer_email != user_dict.get("email"):
            raise HTTPException(404, "Користувача не знайдено")
    payload = _user_public(user_dict)
    if not payload.get("email_visible"):
        payload["email"] = None
    return {
        **payload,
        "passed_tests": passed_tests,
        "total_wrong": max(0, int(user_dict.get("total_answers", 0) or 0) - int(user_dict.get("total_correct", 0) or 0)),
        "achievements": [dict(achievement) for achievement in achievements],
    }


@app.get("/users/by-username/{username}/profile")
def get_user_profile_by_username(username: str, viewer=Depends(get_optional_user)):
    normalized = _normalize_username(username)
    if not normalized:
        raise HTTPException(404, "Користувача не знайдено")
    with db() as conn:
        user = conn.execute("SELECT * FROM users WHERE LOWER(username) = %s", (normalized,)).fetchone()
        if not user:
            raise HTTPException(404, "Користувача не знайдено")
        passed_tests = _passed_tests_count(conn, user["id"])
        achievements = conn.execute(
            "SELECT * FROM user_achievements WHERE user_id = %s ORDER BY earned_at DESC",
            (user["id"],),
        ).fetchall()
    user_dict = dict(user)
    if _is_admin_email(user_dict.get("email")):
        viewer_email = (viewer or {}).get("email")
        if not _is_admin_email(viewer_email) and viewer_email != user_dict.get("email"):
            raise HTTPException(404, "Користувача не знайдено")
    payload = _user_public(user_dict)
    if not payload.get("email_visible"):
        payload["email"] = None
    return {
        **payload,
        "passed_tests": passed_tests,
        "total_wrong": max(0, int(user_dict.get("total_answers", 0) or 0) - int(user_dict.get("total_correct", 0) or 0)),
        "achievements": [dict(achievement) for achievement in achievements],
    }


@app.get("/questions")
def get_questions(
    section: Optional[str] = None,
    category: Optional[str] = None,
    topic: Optional[str] = None,
    limit: int = Query(default=20, ge=1, le=200),
    offset: int = Query(default=0, ge=0),
    search: Optional[str] = None,
    ids: Optional[str] = None,
):
    conds: list[str] = []
    params: list[Any] = []
    if section:
        conds.append("section = %s")
        params.append(section)
    if topic:
        conds.append("section_name = %s")
        params.append(topic)
    if search:
        conds.append("question_text ILIKE %s")
        params.append(f"%{search}%")
    if ids:
        parsed_ids = [int(value) for value in ids.split(",") if value.strip().isdigit()]
        if parsed_ids:
            conds.append("id = ANY(%s)")
            params.append(parsed_ids)
    _append_category_condition(conds, params, category)

    where = f"WHERE {' AND '.join(conds)}" if conds else ""
    with db() as conn:
        rows = conn.execute(f"SELECT * FROM questions {where} ORDER BY id", params).fetchall()
    prepared = _dedupe_and_filter_questions([dict(row) for row in rows])
    return {"total": len(prepared), "items": prepared[offset : offset + limit]}


@app.get("/questions/random")
def get_random_questions(
    count: int = Query(default=20, ge=1, le=200),
    section: Optional[str] = None,
    category: Optional[str] = None,
    topic: Optional[str] = None,
    exclude_ids: str = "",
    difficult_only: bool = False,
    seed: Optional[str] = None,
    user=Depends(get_optional_user),
):
    conds: list[str] = []
    params: list[Any] = []
    if section:
        conds.append("q.section = %s")
        params.append(section)
    if topic:
        conds.append("q.section_name = %s")
        params.append(topic)
    _append_category_condition(conds, params, category, prefix="q.")
    if exclude_ids.strip():
        parsed = [int(value) for value in exclude_ids.split(",") if value.strip().isdigit()]
        if parsed:
            conds.append("q.id <> ALL(%s)")
            params.append(parsed)
    if difficult_only:
        if not user:
            return []
        conds.append(
            """
            q.id IN (
                SELECT question_id
                FROM user_answers
                WHERE user_id = %s AND is_correct = false
            )
            """
        )
        params.append(user["id"])

    where = f"WHERE {' AND '.join(conds)}" if conds else ""
    order_sql = "ORDER BY md5(q.id::text || %s)" if seed else "ORDER BY RANDOM()"
    query_params = params + ([seed] if seed else []) + [max(count * 30, 150)]
    with db() as conn:
        rows = conn.execute(
            f"SELECT * FROM questions q {where} {order_sql} LIMIT %s",
            query_params,
        ).fetchall()
    prepared = _dedupe_and_filter_questions([dict(row) for row in rows], count=count)
    return prepared[:count]


@app.get("/questions/{question_id}")
def get_question(question_id: int):
    with db() as conn:
        row = conn.execute("SELECT * FROM questions WHERE id = %s", (question_id,)).fetchone()
    if not row:
        raise HTTPException(404, "Питання не знайдено")
    return _sanitize_question_row(dict(row))


@app.get("/sections")
def get_sections(category: Optional[str] = None):
    conds: list[str] = []
    params: list[Any] = []
    _append_category_condition(conds, params, category)
    where = f"WHERE {' AND '.join(conds)}" if conds else ""
    section_order_sql = _section_number_sql("section")
    with db() as conn:
        rows = conn.execute(
            f"""
            SELECT section, section_name, COUNT(*) AS count, {section_order_sql} AS section_order
            FROM questions
            {where}
            GROUP BY section, section_name
            ORDER BY section_order NULLS LAST, section
            """,
            params,
        ).fetchall()
    return [
        {
            "section": row["section"],
            "section_name": row["section_name"],
            "count": row["count"],
        }
        for row in rows
    ]


@app.post("/questions/import")
def import_questions(payload: list[dict[str, Any]], user=Depends(get_optional_user)):
    if not payload:
        raise HTTPException(400, "Немає питань для імпорту")

    prepared_rows = []
    for item in payload:
        prepared = _prepare_import_question(item)
        if not prepared["question_text"] or len(prepared["options"]) < 2 or prepared["correct_ans"] < 1:
            continue
        prepared_rows.append(prepared)

    if not prepared_rows:
        raise HTTPException(400, "Усі записи невалідні")

    with db() as conn:
        with conn.cursor() as cursor:
            cursor.executemany(
                """
                INSERT INTO questions (
                    id, section, section_name, num_in_section, category, difficulty,
                    explanation, question_text, options, correct_ans, images, page
                )
                VALUES (
                    %(id)s, %(section)s, %(section_name)s, %(num_in_section)s, %(category)s, %(difficulty)s,
                    %(explanation)s, %(question_text)s, %(options)s::jsonb, %(correct_ans)s, %(images)s::jsonb, %(page)s
                )
                ON CONFLICT (id) DO UPDATE SET
                    section = EXCLUDED.section,
                    section_name = EXCLUDED.section_name,
                    num_in_section = EXCLUDED.num_in_section,
                    category = EXCLUDED.category,
                    difficulty = EXCLUDED.difficulty,
                    explanation = EXCLUDED.explanation,
                    question_text = EXCLUDED.question_text,
                    options = EXCLUDED.options,
                    correct_ans = EXCLUDED.correct_ans,
                    images = EXCLUDED.images,
                    page = EXCLUDED.page
                """,
                [
                    {
                        **row,
                        "options": _serialize_json(row["options"]),
                        "images": _serialize_json(row["images"]),
                    }
                    for row in prepared_rows
                ],
            )
        conn.commit()
    imported_by = user["email"] if user else "anonymous"
    return {"imported": len(prepared_rows), "imported_by": imported_by}


@app.post("/questions/import-bundled")
def import_bundled_questions(user=Depends(get_optional_user)):
    if not DEFAULT_IMPORT_FILE.exists():
        raise HTTPException(404, f"Файл не знайдено: {DEFAULT_IMPORT_FILE.name}")
    payload = json.loads(DEFAULT_IMPORT_FILE.read_text(encoding="utf-8"))
    questions = payload if isinstance(payload, list) else payload.get("questions", [])
    if not isinstance(questions, list):
        raise HTTPException(400, "Невалідний формат bundled JSON")
    return import_questions(questions, user)


@app.post("/progress/test-result")
def submit_test_result(data: TestResultSubmit, user=Depends(get_current_user)):
    today = _server_today()
    with db() as conn:
        result_id = conn.execute(
            """
            INSERT INTO test_results (user_id, section, mode, total, correct, time_seconds)
            VALUES (%s, %s, %s, %s, %s, %s)
            RETURNING id
            """,
            (user["id"], data.section, data.mode, data.total, data.correct, data.time_seconds),
        ).fetchone()["id"]

        if data.answers:
            with conn.cursor() as cursor:
                cursor.executemany(
                    """
                    INSERT INTO user_answers (user_id, question_id, selected_index, is_correct, time_ms)
                    VALUES (%s, %s, %s, %s, %s)
                    """,
                    [
                        (user["id"], answer.question_id, answer.selected_index, answer.is_correct, answer.time_ms)
                        for answer in data.answers
                    ],
                )

        current = conn.execute(
            "SELECT last_activity, streak_days, streak_restores_left, streak_restores_month FROM users WHERE id = %s",
            (user["id"],),
        ).fetchone()
        last_activity = current["last_activity"]
        streak_days = int(current["streak_days"] or 0)
        restores_left, month_key = _normalize_restore_state(dict(current), today)
        streak_restored = False
        if last_activity != today:
            yesterday = today - timedelta(days=1)
            if last_activity == yesterday:
                streak_days = streak_days + 1
            elif last_activity == today - timedelta(days=2) and restores_left > 0:
                streak_days = streak_days + 1
                restores_left -= 1
                streak_restored = True
            else:
                streak_days = 1
            conn.execute(
                "UPDATE users SET last_activity = %s, streak_days = %s, streak_restores_left = %s, streak_restores_month = %s WHERE id = %s",
                (today, streak_days, restores_left, month_key, user["id"]),
            )

        conn.execute(
            """
            UPDATE users
            SET total_tests = total_tests + 1,
                total_correct = total_correct + %s,
                total_answers = total_answers + %s
            WHERE id = %s
            """,
            (data.correct, data.total, user["id"]),
        )
        new_achievements = _check_achievements(conn, user["id"])
        updated_user = dict(conn.execute("SELECT * FROM users WHERE id = %s", (user["id"],)).fetchone())
        total_stars = _available_stars(conn, updated_user)
        conn.commit()

    return {
        "result_id": result_id,
        "streak": streak_days,
        "streak_status": "active",
        "streak_restored": streak_restored,
        "streak_restores_left": restores_left,
        "earned_star": data.total > 0 and data.correct == data.total,
        "total_stars": int(total_stars or 0),
        "new_achievements": new_achievements,
    }


@app.post("/progress/marathon-score")
def submit_marathon(data: MarathonScoreSubmit, user=Depends(get_current_user)):
    with db() as conn:
        current = conn.execute("SELECT marathon_best FROM users WHERE id = %s", (user["id"],)).fetchone()
        old_best = int(current["marathon_best"] or 0)
        new_best = max(old_best, data.score)
        conn.execute("UPDATE users SET marathon_best = %s WHERE id = %s", (new_best, user["id"]))
        new_achievements = _check_achievements(conn, user["id"])
        conn.commit()
    return {
        "marathon_best": new_best,
        "is_new_record": new_best > old_best,
        "new_achievements": new_achievements,
    }


@app.post("/progress/streak-restore")
def restore_streak(user=Depends(get_current_user)):
    today = _server_today()
    with db() as conn:
        current = dict(conn.execute("SELECT * FROM users WHERE id = %s", (user["id"],)).fetchone())
        streak = _streak_snapshot(current, today)
        if streak["status"] != "restorable":
            raise HTTPException(400, "Немає сірого вогника для відновлення")
        last_activity = current.get("last_activity")
        if not last_activity or (today - last_activity).days != 2:
            raise HTTPException(400, "Відновлення зараз недоступне")

        restores_left = max(0, streak["restores_left"] - 1)
        conn.execute(
            """
            UPDATE users
            SET streak_restores_left = %s,
                streak_restores_month = %s,
                last_activity = %s
            WHERE id = %s
            """,
            (restores_left, streak["month_key"], today - timedelta(days=1), user["id"]),
        )
        conn.commit()
        updated = dict(conn.execute("SELECT * FROM users WHERE id = %s", (user["id"],)).fetchone())

    refreshed = _streak_snapshot(updated, today)
    return {
        "streak_days": refreshed["days"],
        "streak_status": refreshed["status"],
        "streak_restores_left": refreshed["restores_left"],
    }


@app.get("/progress/stats")
def get_stats(user=Depends(get_current_user)):
    with db() as conn:
        user_row = dict(conn.execute("SELECT * FROM users WHERE id = %s", (user["id"],)).fetchone())
        streak = _streak_snapshot(user_row)
        section_order_sql = _section_number_sql("q.section")
        by_section = conn.execute(
            """
            SELECT q.section, q.section_name,
                   COUNT(*) FILTER (WHERE ua.is_correct = true) AS correct,
                   COUNT(*) AS total
            FROM user_answers ua
            JOIN questions q ON q.id = ua.question_id
            WHERE ua.user_id = %s
            GROUP BY q.section, q.section_name
            ORDER BY """
            + section_order_sql
            + """
                     NULLS LAST, q.section
            """,
            (user["id"],),
        ).fetchall()
        recent_tests = conn.execute(
            """
            SELECT *
            FROM test_results
            WHERE user_id = %s
            ORDER BY created_at DESC
            LIMIT 20
            """,
            (user["id"],),
        ).fetchall()
        difficult = conn.execute(
            """
            SELECT question_id, COUNT(*) AS wrong_count
            FROM user_answers
            WHERE user_id = %s AND is_correct = false
            GROUP BY question_id
            ORDER BY wrong_count DESC
            LIMIT 50
            """,
            (user["id"],),
        ).fetchall()
        achievements = conn.execute(
            """
            SELECT *
            FROM user_achievements
            WHERE user_id = %s
            ORDER BY earned_at DESC
            """,
            (user["id"],),
        ).fetchall()
        passed_tests = _passed_tests_count(conn, user["id"])
        total_stars = _total_stars(conn, user_row)
        activity_days = conn.execute(
            """
            SELECT DISTINCT DATE(answered_at)::text AS day
            FROM user_answers
            WHERE user_id = %s
              AND answered_at > NOW() - INTERVAL '90 days'
            ORDER BY day
            """,
            (user["id"],),
        ).fetchall()
        earned_achievement_ids = [str(row["achievement_id"]) for row in achievements]
        available_stars = _available_stars(conn, user_row)

    return {
        "user": _user_public(user_row),
        "total_tests": user_row.get("total_tests", 0),
        "total_correct": user_row.get("total_correct", 0),
        "total_answers": user_row.get("total_answers", 0),
        "total_wrong": max(0, int(user_row.get("total_answers", 0) or 0) - int(user_row.get("total_correct", 0) or 0)),
        "passed_tests": passed_tests,
        "streak_days": streak["days"],
        "streak_status": streak["status"],
        "streak_restores_left": streak["restores_left"],
        "marathon_best": user_row.get("marathon_best", 0),
        "total_stars": int(available_stars or 0),
        "available_stars": available_stars,
        "by_section": [dict(row) for row in by_section],
        "recent_tests": [dict(row) for row in recent_tests],
        "difficult_question_ids": [row["question_id"] for row in difficult],
        "achievements": [dict(row) for row in achievements],
        "activity_days": sorted({str(row["day"]) for row in activity_days}),
        "frame_shop": _frame_shop_payload(user_row, earned_achievement_ids, available_stars),
    }


@app.get("/progress/results")
def get_progress_results(user=Depends(get_current_user)):
    with db() as conn:
        rows = conn.execute(
            """
            SELECT id, section, mode, total, correct, time_seconds, created_at
            FROM test_results
            WHERE user_id = %s
            ORDER BY created_at DESC
            LIMIT 365
            """,
            (user["id"],),
        ).fetchall()

    results = []
    for row in rows:
        item = dict(row)
        total = int(item.get("total") or 0)
        correct = int(item.get("correct") or 0)
        score_percent = round((correct / total) * 100) if total > 0 else 0
        results.append(
            {
                **item,
                "score_percent": score_percent,
                "passed": score_percent >= 80,
                "created_at": str(item.get("created_at") or ""),
            }
        )
    return results


@app.get("/achievements")
def get_achievements(user=Depends(get_optional_user)):
    earned: dict[str, Any] = {}
    if user:
        with db() as conn:
            rows = conn.execute(
                "SELECT achievement_id, earned_at FROM user_achievements WHERE user_id = %s",
                (user["id"],),
            ).fetchall()
            earned = {row["achievement_id"]: row["earned_at"] for row in rows}

    return [
        {
            "id": achievement_id,
            "tier": tier,
            "name": name,
            "description": description,
            "category": category,
            "threshold": threshold,
            "earned": achievement_id in earned,
            "earned_at": str(earned[achievement_id]) if achievement_id in earned else None,
        }
        for achievement_id, tier, name, description, category, threshold in ACHIEVEMENTS_DEF
    ]


@app.get("/leaderboard")
def leaderboard():
    with db() as conn:
        rows = conn.execute(
            """
            SELECT u.id, u.name, u.surname, u.username, u.email, u.avatar_url, u.avatar_version, u.active_frame,
                   u.total_correct, u.total_tests, u.total_answers, u.marathon_best, u.streak_days,
                   COALESCE((
                     SELECT COUNT(*)
                     FROM test_results tr
                     WHERE tr.user_id = u.id
                       AND tr.total > 0
                       AND ROUND((tr.correct::numeric / tr.total::numeric) * 100) >= 80
                   ), 0) AS passed_tests
            FROM users u
            WHERE u.email_verified = true
              AND LOWER(u.email) <> ALL(%s)
            ORDER BY u.total_correct DESC, u.total_tests DESC, u.created_at ASC
            LIMIT 50
            """
            ,
            (list(ADMIN_EMAILS),)
        ).fetchall()
    return [dict(row) for row in rows]


@app.get("/friends")
def get_friends(user=Depends(get_current_user)):
    with db() as conn:
        conn.execute(
            """
            UPDATE friendships
            SET addressee_seen_at = NOW()
            WHERE addressee_id = %s
              AND status = 'pending'
              AND addressee_seen_at IS NULL
            """,
            (user["id"],),
        )
        friendships = conn.execute(
            """
            SELECT *
            FROM friendships
            WHERE requester_id = %s OR addressee_id = %s
            ORDER BY created_at DESC
            """,
            (user["id"], user["id"]),
        ).fetchall()

        accepted: list[dict[str, Any]] = []
        incoming: list[dict[str, Any]] = []
        outgoing: list[dict[str, Any]] = []

        for friendship in friendships:
            row = dict(friendship)
            counterpart_id, direction = _friend_counterpart(row, user["id"])
            counterpart = conn.execute(
                "SELECT id, name, surname, username, email, avatar_url, avatar_version, active_frame, streak_days, total_tests, total_correct, total_answers, marathon_best FROM users WHERE id = %s",
                (counterpart_id,),
            ).fetchone()
            if not counterpart:
                continue
            unread = conn.execute(
                """
                SELECT COUNT(*) AS count
                FROM messages
                WHERE to_email = %s AND from_email = %s AND is_read = false
                """,
                (user["email"], counterpart["email"]),
            ).fetchone()["count"]
            last_message = conn.execute(
                """
                SELECT content, type, created_at
                FROM messages
                WHERE (to_email = %s AND from_email = %s)
                   OR (to_email = %s AND from_email = %s)
                ORDER BY created_at DESC
                LIMIT 1
                """,
                (user["email"], counterpart["email"], counterpart["email"], user["email"]),
            ).fetchone()
            payload = {
                "id": row["id"],
                "status": row["status"],
                "created_at": str(row["created_at"]),
                "direction": direction,
                "user": dict(counterpart),
                "unread_count": unread,
                "last_message": dict(last_message) if last_message else None,
            }
            if row["status"] == "accepted":
                accepted.append(payload)
            elif direction == "incoming":
                incoming.append(payload)
            else:
                outgoing.append(payload)
        conn.commit()

    return {"friends": accepted, "incoming": incoming, "outgoing": outgoing}


@app.post("/friends/invite")
async def invite_friend(req: FriendInviteRequest, user=Depends(get_current_user)):
    handle = req.username.strip()
    target_username = _normalize_username(handle)
    if target_username == _normalize_username(user.get("username")):
        raise HTTPException(400, "Не можна додати себе в друзі")

    with db() as conn:
        target = _resolve_social_user_by_handle(conn, handle, user)
        if not target:
            raise HTTPException(404, "Користувача з таким email не знайдено")
        if target.get("is_blocked"):
            raise HTTPException(403, "Цей користувач тимчасово недоступний")

        existing = conn.execute(
            """
            SELECT *
            FROM friendships
            WHERE LEAST(requester_id, addressee_id) = LEAST(%s, %s)
              AND GREATEST(requester_id, addressee_id) = GREATEST(%s, %s)
            """,
            (user["id"], target["id"], user["id"], target["id"]),
        ).fetchone()
        if existing:
            existing = dict(existing)
            if existing["status"] == "accepted":
                return {
                    "message": "Ви вже в друзях",
                    "friendship_id": existing["id"],
                    "status": "accepted",
                }
            if existing["addressee_id"] == user["id"]:
                requester = conn.execute("SELECT email FROM users WHERE id = %s", (existing["requester_id"],)).fetchone()
                conn.execute(
                    """
                    UPDATE friendships
                    SET status = 'accepted', responded_at = NOW()
                    WHERE id = %s
                    """,
                    (existing["id"],),
                )
                conn.commit()
                payload = {
                    "message": "Запрошення було вхідним, тому друга одразу додано",
                    "friendship_id": existing["id"],
                    "status": "accepted",
                }
                if requester:
                    await realtime_hub.emit(requester["email"], "friends_updated", {})
                await realtime_hub.emit(user["email"], "friends_updated", {})
                return payload
            return {
                "message": "Запрошення вже надіслано і ще очікує підтвердження",
                "friendship_id": existing["id"],
                "status": "pending",
            }

        friendship = conn.execute(
            """
            INSERT INTO friendships (requester_id, addressee_id, status)
            VALUES (%s, %s, 'pending')
            RETURNING *
            """,
            (user["id"], target["id"]),
        ).fetchone()
        conn.commit()
    await realtime_hub.emit(target["email"], "friend_request", {"from_email": user["email"]})
    return {"message": "Запрошення надіслано", "friendship_id": friendship["id"]}


@app.post("/friends/{friendship_id}/accept")
async def accept_friend(friendship_id: int, user=Depends(get_current_user)):
    with db() as conn:
        friendship = conn.execute(
            "SELECT * FROM friendships WHERE id = %s",
            (friendship_id,),
        ).fetchone()
        if not friendship:
            raise HTTPException(404, "Запрошення не знайдено")
        if friendship["addressee_id"] != user["id"]:
            raise HTTPException(403, "Немає доступу до цього запрошення")
        conn.execute(
            """
            UPDATE friendships
            SET status = 'accepted', responded_at = NOW()
            WHERE id = %s
            """,
            (friendship_id,),
        )
        requester = conn.execute("SELECT email FROM users WHERE id = %s", (friendship["requester_id"],)).fetchone()
        conn.commit()
    if requester:
        await realtime_hub.emit(requester["email"], "friends_updated", {})
    await realtime_hub.emit(user["email"], "friends_updated", {})
    return {"message": "Друга додано"}


@app.delete("/friends/{friendship_id}")
def remove_friend(friendship_id: int, user=Depends(get_current_user)):
    with db() as conn:
        friendship = conn.execute("SELECT * FROM friendships WHERE id = %s", (friendship_id,)).fetchone()
        if not friendship:
            raise HTTPException(404, "Запис не знайдено")
        if user["id"] not in {friendship["requester_id"], friendship["addressee_id"]}:
            raise HTTPException(403, "Немає доступу")
        conn.execute("DELETE FROM friendships WHERE id = %s", (friendship_id,))
        conn.commit()
    return {"message": "Запис видалено"}


@app.get("/messages")
def get_messages(partner_email: Optional[str] = None, user=Depends(get_current_user)):
    with db() as conn:
        if partner_email:
            partner = _resolve_social_user_by_handle(conn, partner_email, user)
            if not partner:
                raise HTTPException(404, "Користувача не знайдено")
            normalized = partner["email"].strip().lower()
            rows = conn.execute(
                """
                SELECT *
                FROM messages
                WHERE (to_email = %s AND from_email = %s)
                   OR (to_email = %s AND from_email = %s)
                ORDER BY created_at ASC
                """,
                (user["email"], normalized, normalized, user["email"]),
            ).fetchall()
            conn.execute(
                """
                UPDATE messages
                SET is_read = true
                WHERE to_email = %s AND from_email = %s AND is_read = false
                """,
                (user["email"], normalized),
            )
            conn.commit()
            return [
                {
                    **dict(row),
                    "result_data": _coerce_json_dict(row.get("result_data")),
                    "is_read": bool(row.get("is_read")),
                }
                for row in rows
            ]

        rows = conn.execute(
            """
            SELECT *
            FROM messages
            WHERE to_email = %s OR from_email = %s
            ORDER BY created_at DESC
            LIMIT 100
            """,
            (user["email"], user["email"]),
        ).fetchall()
    return [
        {
            **dict(row),
            "result_data": _coerce_json_dict(row.get("result_data")),
            "is_read": bool(row.get("is_read")),
        }
        for row in rows
    ]


@app.post("/messages")
async def send_message(req: MessageCreateRequest, user=Depends(get_current_user)):
    handle = req.to_user.strip()
    if _normalize_username(handle) == _normalize_username(user.get("username")):
        raise HTTPException(400, "Не можна писати самому собі")
    if req.type not in {"text", "result_share"}:
        raise HTTPException(400, "Невірний тип повідомлення")
    if req.type == "text" and not req.content.strip():
        raise HTTPException(400, "Повідомлення не може бути порожнім")

    with db() as conn:
        friend = _resolve_social_user_by_handle(conn, handle, user)
        if not friend:
            raise HTTPException(404, "Користувача не знайдено")
        friendship = conn.execute(
            """
            SELECT *
            FROM friendships
            WHERE status = 'accepted'
              AND LEAST(requester_id, addressee_id) = LEAST(%s, %s)
              AND GREATEST(requester_id, addressee_id) = GREATEST(%s, %s)
            """,
            (user["id"], friend["id"], user["id"], friend["id"]),
        ).fetchone()
        if not friendship:
            raise HTTPException(403, "Повідомлення можна надсилати тільки друзям")
        message = conn.execute(
            """
            INSERT INTO messages (to_email, from_email, from_name, content, type, result_data)
            VALUES (%s, %s, %s, %s, %s, %s::jsonb)
            RETURNING *
            """,
            (
                friend["email"],
                user["email"],
                user["name"],
                req.content.strip() or "Запрошення до батлу",
                req.type,
                _serialize_json(req.result_data),
            ),
        ).fetchone()
        conn.commit()
    payload = {
        **dict(message),
        "result_data": _coerce_json_dict(message.get("result_data")),
        "is_read": bool(message.get("is_read")),
    }
    await realtime_hub.emit(friend["email"], "friend_message", {"from_email": user["email"]})
    await realtime_hub.emit(user["email"], "friend_message", {"from_email": user["email"]})
    return payload


@app.get("/support/messages")
def get_support_messages(user=Depends(get_current_user)):
    with db() as conn:
        rows = conn.execute(
            """
            SELECT *
            FROM messages
            WHERE (to_email = %s AND from_email = %s)
               OR (to_email = %s AND from_email = %s)
            ORDER BY created_at ASC
            """,
            (user["email"], SUPPORT_EMAIL, SUPPORT_EMAIL, user["email"]),
        ).fetchall()
        conn.execute(
            """
            UPDATE messages
            SET is_read = true
            WHERE to_email = %s AND from_email = %s AND is_read = false
            """,
            (user["email"], SUPPORT_EMAIL),
        )
        conn.commit()
    return [
        {
            **dict(row),
            "result_data": _coerce_json_dict(row.get("result_data")),
            "is_read": bool(row.get("is_read")),
        }
        for row in rows
    ]


@app.post("/support/messages")
async def send_support_message(req: SupportMessageCreateRequest, user=Depends(get_current_user)):
    content = req.content.strip()
    if not content:
        raise HTTPException(400, "Повідомлення не може бути порожнім")
    with db() as conn:
        message = conn.execute(
            """
            INSERT INTO messages (to_email, from_email, from_name, content, type, result_data)
            VALUES (%s, %s, %s, %s, 'text', '{}'::jsonb)
            RETURNING *
            """,
            (SUPPORT_EMAIL, user["email"], user["name"], content),
        ).fetchone()
        conn.commit()
    payload = {
        **dict(message),
        "result_data": _coerce_json_dict(message.get("result_data")),
        "is_read": bool(message.get("is_read")),
    }
    await realtime_hub.emit(SUPPORT_EMAIL, "support_message", {"from_email": user["email"]})
    await realtime_hub.emit(user["email"], "support_message", {"from_email": user["email"]})
    return payload


@app.get("/notifications/summary")
def get_notifications_summary(user=Depends(get_current_user)):
    with db() as conn:
        friend_requests = int(
            conn.execute(
                """
                SELECT COUNT(*) AS count
                FROM friendships
                WHERE addressee_id = %s
                  AND status = 'pending'
                  AND addressee_seen_at IS NULL
                """,
                (user["id"],),
            ).fetchone()["count"]
        )
        unread_friend_messages = int(
            conn.execute(
                """
                SELECT COUNT(*) AS count
                FROM messages
                WHERE to_email = %s
                  AND is_read = false
                  AND from_email <> %s
                  AND from_email <> %s
                """,
                (user["email"], SUPPORT_EMAIL, user["email"]),
            ).fetchone()["count"]
        )
        battle_invites = int(
            conn.execute(
                """
                SELECT COUNT(*) AS count
                FROM battles
                WHERE opponent_email = %s
                  AND status = 'pending'
                  AND opponent_seen_at IS NULL
                """,
                (user["email"],),
            ).fetchone()["count"]
        )
        support_unread = int(
            conn.execute(
                """
                SELECT COUNT(*) AS count
                FROM messages
                WHERE to_email = %s AND from_email = %s AND is_read = false
                """,
                (user["email"], SUPPORT_EMAIL),
            ).fetchone()["count"]
        )
    return {
        "friends": friend_requests + unread_friend_messages,
        "battles": battle_invites,
        "support": support_unread,
    }


@app.get("/admin/support/conversations")
def admin_support_conversations(admin=Depends(require_admin)):
    with db() as conn:
        rows = conn.execute(
            """
            SELECT
                CASE
                    WHEN from_email = %s THEN to_email
                    ELSE from_email
                END AS counterpart_email,
                MAX(created_at) AS last_message_at
            FROM messages
            WHERE to_email = %s OR from_email = %s
            GROUP BY counterpart_email
            ORDER BY last_message_at DESC
            """,
            (SUPPORT_EMAIL, SUPPORT_EMAIL, SUPPORT_EMAIL),
        ).fetchall()
        conversations: list[dict[str, Any]] = []
        for row in rows:
            counterpart_email = row["counterpart_email"]
            if not counterpart_email or counterpart_email == SUPPORT_EMAIL:
                continue
            counterpart = conn.execute(
                """
                SELECT id, name, surname, username, email, avatar_url, avatar_version,
                       total_tests, total_correct, total_answers, is_blocked, created_at
                FROM users
                WHERE email = %s
                """,
                (counterpart_email,),
            ).fetchone()
            if not counterpart:
                continue
            preview = conn.execute(
                """
                SELECT content, created_at, from_email
                FROM messages
                WHERE (to_email = %s AND from_email = %s)
                   OR (to_email = %s AND from_email = %s)
                ORDER BY created_at DESC
                LIMIT 1
                """,
                (SUPPORT_EMAIL, counterpart_email, counterpart_email, SUPPORT_EMAIL),
            ).fetchone()
            unread = conn.execute(
                """
                SELECT COUNT(*) AS count
                FROM messages
                WHERE to_email = %s
                  AND from_email = %s
                  AND is_read = false
                """,
                (SUPPORT_EMAIL, counterpart_email),
            ).fetchone()["count"]
            conversations.append(
                {
                    "user": _user_public(dict(counterpart)),
                    "last_message": dict(preview) if preview else None,
                    "unread_count": int(unread or 0),
                    "last_message_at": str(row["last_message_at"] or ""),
                }
            )
    return conversations


@app.get("/admin/support/conversations/{user_id}")
def admin_support_thread(user_id: int, admin=Depends(require_admin)):
    with db() as conn:
        target = conn.execute("SELECT * FROM users WHERE id = %s", (user_id,)).fetchone()
        if not target:
            raise HTTPException(404, "Користувача не знайдено")
        rows = conn.execute(
            """
            SELECT *
            FROM messages
            WHERE (to_email = %s AND from_email = %s)
               OR (to_email = %s AND from_email = %s)
            ORDER BY created_at ASC
            """,
            (SUPPORT_EMAIL, target["email"], target["email"], SUPPORT_EMAIL),
        ).fetchall()
        conn.execute(
            """
            UPDATE messages
            SET is_read = true
            WHERE to_email = %s
              AND from_email = %s
              AND is_read = false
            """,
            (SUPPORT_EMAIL, target["email"]),
        )
        conn.commit()
    return {
        "user": _user_public(dict(target)),
        "messages": [
            {
                **dict(row),
                "result_data": _coerce_json_dict(row.get("result_data")),
                "is_read": bool(row.get("is_read")),
            }
            for row in rows
        ],
    }


@app.post("/admin/support/conversations/{user_id}")
async def admin_support_reply(user_id: int, req: AdminSupportReplyRequest, admin=Depends(require_admin)):
    content = req.content.strip()
    if not content:
        raise HTTPException(400, "Повідомлення не може бути порожнім")
    with db() as conn:
        target = conn.execute("SELECT * FROM users WHERE id = %s", (user_id,)).fetchone()
        if not target:
            raise HTTPException(404, "Користувача не знайдено")
        message = conn.execute(
            """
            INSERT INTO messages (to_email, from_email, from_name, content, type, result_data)
            VALUES (%s, %s, %s, %s, 'text', %s::jsonb)
            RETURNING *
            """,
            (
                target["email"],
                SUPPORT_EMAIL,
                SUPPORT_NAME,
                content,
                json.dumps({"sender_role": "support"}, ensure_ascii=False),
            ),
        ).fetchone()
        conn.commit()
    await realtime_hub.emit(target["email"], "support_reply", {"from_email": SUPPORT_EMAIL})
    await realtime_hub.emit(SUPPORT_EMAIL, "support_reply", {"to_email": target["email"]})
    return {
        **dict(message),
        "result_data": _coerce_json_dict(message.get("result_data")),
        "is_read": bool(message.get("is_read")),
    }


@app.get("/admin/users")
def admin_users(admin=Depends(require_admin)):
    with db() as conn:
        rows = conn.execute(
            """
            SELECT *
            FROM users
            ORDER BY created_at DESC
            """
        ).fetchall()
        achievements_by_user = {
            row["user_id"]: int(row["count"] or 0)
            for row in conn.execute(
                """
                SELECT user_id, COUNT(*) AS count
                FROM user_achievements
                GROUP BY user_id
                """
            ).fetchall()
        }
        payload: list[dict[str, Any]] = []
        for row in rows:
            user_row = dict(row)
            payload.append(
                {
                    **_user_public(user_row),
                    "achievement_count": achievements_by_user.get(user_row["id"], 0),
                    "manual_star_adjustment": int(user_row.get("manual_star_adjustment") or 0),
                    "total_stars": _total_stars(conn, user_row),
                    "available_stars": _available_stars(conn, user_row),
                }
            )
    return payload


@app.get("/admin/users/{user_id}/audit")
def admin_user_audit(user_id: int, admin=Depends(require_admin)):
    with db() as conn:
        target = conn.execute("SELECT * FROM users WHERE id = %s", (user_id,)).fetchone()
        if not target:
            raise HTTPException(404, "Користувача не знайдено")
        user_row = dict(target)
        achievements = conn.execute(
            "SELECT * FROM user_achievements WHERE user_id = %s ORDER BY earned_at DESC",
            (user_id,),
        ).fetchall()
        tests = conn.execute(
            """
            SELECT id, section, mode, total, correct, time_seconds, created_at
            FROM test_results
            WHERE user_id = %s
            ORDER BY created_at DESC
            LIMIT 30
            """,
            (user_id,),
        ).fetchall()
        battles = conn.execute(
            """
            SELECT *
            FROM battles
            WHERE challenger_email = %s OR opponent_email = %s
            ORDER BY created_at DESC
            LIMIT 30
            """,
            (user_row["email"], user_row["email"]),
        ).fetchall()
        messages = conn.execute(
            """
            SELECT id, to_email, from_email, from_name, content, type, is_read, created_at, result_data
            FROM messages
            WHERE to_email = %s OR from_email = %s
            ORDER BY created_at DESC
            LIMIT 50
            """,
            (user_row["email"], user_row["email"]),
        ).fetchall()
        total_stars = _total_stars(conn, user_row)
        available_stars = _available_stars(conn, user_row)
    return {
        "user": {
            **_user_public(user_row),
            "manual_star_adjustment": int(user_row.get("manual_star_adjustment") or 0),
            "total_stars": total_stars,
            "available_stars": available_stars,
        },
        "achievements": [dict(row) for row in achievements],
        "tests": [dict(row) for row in tests],
        "battles": [
            {
                **dict(row),
                "question_ids": _coerce_json_list(row.get("question_ids")),
                "challenger_answers": _coerce_json_dict(row.get("challenger_answers")),
                "opponent_answers": _coerce_json_dict(row.get("opponent_answers")),
            }
            for row in battles
        ],
        "messages": [
            {
                **dict(row),
                "result_data": _coerce_json_dict(row.get("result_data")),
            }
            for row in messages
        ],
    }


@app.patch("/admin/users/{user_id}")
def admin_update_user(user_id: int, req: AdminUserUpdateRequest, admin=Depends(require_admin)):
    with db() as conn:
        target = conn.execute("SELECT * FROM users WHERE id = %s", (user_id,)).fetchone()
        if not target:
            raise HTTPException(404, "Користувача не знайдено")
        if _is_admin_email(target["email"]) and req.is_blocked:
            raise HTTPException(400, "Адміна не можна заблокувати")
        fields: list[str] = []
        params: list[Any] = []
        for key in ("total_tests", "total_correct", "total_answers", "marathon_best", "streak_days", "manual_star_adjustment"):
            value = getattr(req, key)
            if value is None:
                continue
            fields.append(f"{key} = %s")
            params.append(max(0, int(value)))
        if req.is_blocked is not None:
            fields.append("is_blocked = %s")
            params.append(bool(req.is_blocked))
        if not fields:
            return _user_public(dict(target))
        params.append(user_id)
        conn.execute(f"UPDATE users SET {', '.join(fields)} WHERE id = %s", params)
        conn.commit()
        updated = dict(conn.execute("SELECT * FROM users WHERE id = %s", (user_id,)).fetchone())
    return _user_public(updated)


@app.delete("/admin/users/{user_id}")
def admin_delete_user(user_id: int, admin=Depends(require_admin)):
    with db() as conn:
        target = conn.execute("SELECT * FROM users WHERE id = %s", (user_id,)).fetchone()
        if not target:
            raise HTTPException(404, "Користувача не знайдено")
        if _is_admin_email(target["email"]):
            raise HTTPException(400, "Адміністратора не можна видалити")
        conn.execute("DELETE FROM users WHERE id = %s", (user_id,))
        conn.commit()
    return {"message": "Користувача видалено"}


@app.post("/admin/users/{user_id}/reset-password")
def admin_reset_user_password(user_id: int, admin=Depends(require_admin)):
    with db() as conn:
        target = conn.execute("SELECT * FROM users WHERE id = %s", (user_id,)).fetchone()
        if not target:
            raise HTTPException(404, "Користувача не знайдено")
        code = gen_code()
        conn.execute(
            """
            UPDATE users
            SET reset_code = %s, reset_code_exp = %s
            WHERE id = %s
            """,
            (code, datetime.utcnow() + timedelta(minutes=30), user_id),
        )
        conn.commit()
    sent = send_email(
        target["email"],
        "Скидання пароля PDRPrep",
        f"<p>Адміністратор надіслав відновлення доступу. Ваш код: <b style='font-size:24px'>{code}</b></p>",
    )
    payload: dict[str, Any] = {"message": "Лист на відновлення пароля надіслано"}
    if not sent:
        payload["dev_code"] = code
    return payload


@app.post("/admin/users/{user_id}/achievements")
def admin_update_user_achievements(user_id: int, req: AdminAchievementUpdateRequest, admin=Depends(require_admin)):
    achievement_id = req.achievement_id.strip()
    if not achievement_id:
        raise HTTPException(400, "Потрібен achievement_id")
    meta = next((item for item in ACHIEVEMENTS_DEF if item[0] == achievement_id), None)
    name = meta[2] if meta else achievement_id
    description = meta[3] if meta else "Ручне досягнення від адміністратора"
    tier = meta[1] if meta else 1
    category = meta[4] if meta else "manual"
    with db() as conn:
        target = conn.execute("SELECT id FROM users WHERE id = %s", (user_id,)).fetchone()
        if not target:
            raise HTTPException(404, "Користувача не знайдено")
        if req.remove:
            conn.execute(
                "DELETE FROM user_achievements WHERE user_id = %s AND achievement_id = %s",
                (user_id, achievement_id),
            )
        else:
            conn.execute(
                """
                INSERT INTO user_achievements (user_id, achievement_id, achievement_name, achievement_desc, tier, category)
                VALUES (%s, %s, %s, %s, %s, %s)
                ON CONFLICT (user_id, achievement_id) DO NOTHING
                """,
                (user_id, achievement_id, name, description, tier, category),
            )
        conn.commit()
        rows = conn.execute(
            "SELECT * FROM user_achievements WHERE user_id = %s ORDER BY earned_at DESC",
            (user_id,),
        ).fetchall()
    return [dict(row) for row in rows]


@app.get("/admin/questions")
def admin_search_questions(
    search: str = Query(default=""),
    section: str = Query(default=""),
    limit: int = Query(default=40, ge=1, le=100),
    admin=Depends(require_admin),
):
    with db() as conn:
        rows = conn.execute(
            """
            SELECT id, section, section_name, difficulty, question_text, explanation, options, images, correct_ans
            FROM questions
            WHERE (%s = '' OR section = %s OR section_name = %s)
              AND (
                   %s = ''
               OR question_text ILIKE %s
               OR section_name ILIKE %s
               OR explanation ILIKE %s
              )
            ORDER BY id
            LIMIT %s
            """,
            (
                section.strip(),
                section.strip(),
                section.strip(),
                search.strip(),
                f"%{search.strip()}%",
                f"%{search.strip()}%",
                f"%{search.strip()}%",
                limit,
            ),
        ).fetchall()
    return [_sanitize_question_row(dict(row)) for row in rows]


@app.get("/admin/questions/sections")
def admin_question_sections(admin=Depends(require_admin)):
    with db() as conn:
        rows = conn.execute(
            """
            SELECT section, section_name, COUNT(*) AS count
            FROM questions
            GROUP BY section, section_name
            ORDER BY NULLIF(SUBSTRING(TRIM(COALESCE(section::text, '')) FROM '^\d+'), '')::INT NULLS LAST, section
            """
        ).fetchall()
    return [dict(row) for row in rows]


@app.patch("/admin/questions/{question_id}")
def admin_update_question(question_id: int, req: AdminQuestionUpdateRequest, admin=Depends(require_admin)):
    fields: list[str] = []
    params: list[Any] = []
    if req.question_text is not None:
        fields.append("question_text = %s")
        params.append(req.question_text.strip())
    if req.explanation is not None:
        fields.append("explanation = %s")
        params.append(req.explanation.strip())
    if req.difficulty is not None:
        fields.append("difficulty = %s")
        params.append(req.difficulty.strip().lower() or "medium")
    if req.section_name is not None:
        fields.append("section_name = %s")
        params.append(req.section_name.strip())
    if req.options is not None:
        options = [_clean_text(option) for option in req.options if _clean_text(option)]
        if len(options) < 2:
            raise HTTPException(400, "Потрібно щонайменше 2 варіанти відповіді")
        fields.append("options = %s::jsonb")
        params.append(json.dumps(options, ensure_ascii=False))
    if req.images is not None:
        fields.append("images = %s::jsonb")
        params.append(json.dumps([str(item).strip() for item in req.images if str(item).strip()], ensure_ascii=False))
    if req.correct_ans is not None:
        fields.append("correct_ans = %s")
        params.append(int(req.correct_ans))
    if not fields:
        raise HTTPException(400, "Немає полів для оновлення")
    params.append(question_id)
    with db() as conn:
        updated = conn.execute("SELECT id FROM questions WHERE id = %s", (question_id,)).fetchone()
        if not updated:
            raise HTTPException(404, "Питання не знайдено")
        conn.execute(f"UPDATE questions SET {', '.join(fields)} WHERE id = %s", params)
        conn.commit()
        row = conn.execute(
            "SELECT id, section, section_name, difficulty, question_text, explanation, options, images, correct_ans FROM questions WHERE id = %s",
            (question_id,),
        ).fetchone()
    return _sanitize_question_row(dict(row))


@app.post("/frames/purchase")
def purchase_frame(req: FramePurchaseRequest, user=Depends(get_current_user)):
    frame_id = req.frame_id.strip()
    meta = FRAME_SHOP.get(frame_id)
    if not meta or frame_id == "default":
        raise HTTPException(404, "Рамку не знайдено")
    if meta.get("achievement_id"):
        raise HTTPException(400, "Ця рамка відкривається тільки через досягнення")

    with db() as conn:
        user_row = dict(conn.execute("SELECT * FROM users WHERE id = %s", (user["id"],)).fetchone())
        purchased = _purchased_frames(user_row)
        if frame_id in purchased:
            return {
                "message": "Рамка вже відкрита",
                "purchased_frames": purchased,
                "available_stars": _available_stars(conn, user_row),
            }
        price = int(meta.get("price") or 0)
        stars = _available_stars(conn, user_row)
        if stars < price:
            raise HTTPException(400, "Недостатньо зірок для покупки цієї рамки")
        purchased.append(frame_id)
        conn.execute(
            """
            UPDATE users
            SET purchased_frames = %s::jsonb,
                spent_stars = COALESCE(spent_stars, 0) + %s
            WHERE id = %s
            """,
            (json.dumps(purchased, ensure_ascii=False), price, user["id"]),
        )
        conn.commit()
        updated = dict(conn.execute("SELECT * FROM users WHERE id = %s", (user["id"],)).fetchone())
        achievements = conn.execute(
            "SELECT achievement_id FROM user_achievements WHERE user_id = %s",
            (user["id"],),
        ).fetchall()
        available_stars = _available_stars(conn, updated)
    return {
        "message": "Рамку відкрито",
        "purchased_frames": _purchased_frames(updated),
        "available_stars": available_stars,
        "frame_shop": _frame_shop_payload(updated, [str(row["achievement_id"]) for row in achievements], available_stars),
    }


@app.get("/battles")
def get_battles(user=Depends(get_current_user)):
    with db() as conn:
        rows = conn.execute(
            """
            SELECT *
            FROM battles
            WHERE challenger_email = %s OR opponent_email = %s
            ORDER BY created_at DESC
            """,
            (user["email"], user["email"]),
        ).fetchall()
        battles = []
        for row in rows:
            battle = _finalize_battle_state(conn, dict(row))
            role = _battle_role(battle, user["email"])
            if battle.get("status") == "pending":
                battle = _mark_battle_seen(conn, battle, role)
            opponent_email = battle["opponent_email"] if role == "challenger" else battle["challenger_email"]
            opponent_name = battle["opponent_name"] if role == "challenger" else battle["challenger_name"]
            opponent_user = conn.execute(
                "SELECT id, username, surname, avatar_url, avatar_version, active_frame FROM users WHERE email = %s",
                (opponent_email,),
            ).fetchone()
            my_submitted = bool(battle["challenger_answers"]) if role == "challenger" else bool(battle["opponent_answers"])
            battles.append(
                {
                    **battle,
                    "role": role,
                    "opponent_email": opponent_email,
                    "opponent_name": opponent_name,
                    "opponent_id": opponent_user["id"] if opponent_user else None,
                    "opponent_username": opponent_user["username"] if opponent_user else None,
                    "opponent_avatar_url": opponent_user["avatar_url"] if opponent_user else None,
                    "opponent_avatar_version": int(opponent_user["avatar_version"] or 0) if opponent_user else 0,
                    "opponent_active_frame": opponent_user["active_frame"] if opponent_user else None,
                    "my_submitted": my_submitted,
                    "invite_seen": _battle_invite_seen(battle, role),
                    "seconds_left": _battle_deadline_seconds(battle),
                    "created_at": str(battle.get("created_at") or ""),
                    "expires_at": str(battle.get("expires_at") or ""),
                    "finished_at": str(battle.get("finished_at") or ""),
                }
            )
        conn.commit()
    return battles


@app.post("/battles")
async def create_battle(req: BattleCreateRequest, user=Depends(get_current_user)):
    handle = req.opponent_user.strip()
    category = _normalize_category(req.category) or "B"
    if _normalize_username(handle) == _normalize_username(user.get("username")):
        raise HTTPException(400, "Не можна створити батл із собою")

    with db() as conn:
        opponent = _resolve_social_user_by_handle(conn, handle, user)
        if not opponent:
            raise HTTPException(404, "Опонента не знайдено")
        existing = conn.execute(
            """
            SELECT id
            FROM battles
            WHERE LEAST(challenger_email, opponent_email) = LEAST(%s, %s)
              AND GREATEST(challenger_email, opponent_email) = GREATEST(%s, %s)
              AND status IN ('pending', 'active')
            ORDER BY created_at DESC
            LIMIT 1
            """,
            (user["email"], opponent["email"], user["email"], opponent["email"]),
        ).fetchone()
        if existing:
            raise HTTPException(409, "У вас уже є активний або очікуючий батл із цим користувачем")
        question_rows = get_random_questions(count=req.question_count, category=category)
        question_ids = [row["id"] for row in question_rows]
        if len(question_ids) < req.question_count:
            raise HTTPException(400, "Недостатньо питань для цього батлу")
        battle = conn.execute(
            """
            INSERT INTO battles (
                challenger_email, challenger_name, opponent_email, opponent_name,
                status, category, question_ids, expires_at
            )
            VALUES (%s, %s, %s, %s, 'pending', %s, %s::jsonb, %s)
            RETURNING *
            """,
            (
                user["email"],
                user["name"],
                opponent["email"],
                opponent["name"],
                category,
                _serialize_question_ids(question_ids),
                datetime.utcnow() + timedelta(days=7),
            ),
        ).fetchone()
        friendship = conn.execute(
            """
            SELECT id
            FROM friendships
            WHERE status = 'accepted'
              AND LEAST(requester_id, addressee_id) = LEAST(%s, %s)
              AND GREATEST(requester_id, addressee_id) = GREATEST(%s, %s)
            """,
            (user["id"], opponent["id"], user["id"], opponent["id"]),
        ).fetchone()
        if friendship:
            conn.execute(
                """
                INSERT INTO messages (to_email, from_email, from_name, content, type, result_data)
                VALUES (%s, %s, %s, %s, 'result_share', %s::jsonb)
                """,
                (
                    opponent["email"],
                    user["email"],
                    user["name"],
                    "Запрошення на батл",
                    _serialize_json({"kind": "battle_invite", "battle_id": battle["id"], "category": category}),
                ),
            )
        conn.commit()
    await realtime_hub.emit(opponent["email"], "battle_invite", {"battle_id": battle["id"]})
    await realtime_hub.emit(user["email"], "battle_invite", {"battle_id": battle["id"]})
    return dict(battle)


@app.post("/battles/{battle_id}/accept")
async def accept_battle(battle_id: int, user=Depends(get_current_user)):
    with db() as conn:
        battle = conn.execute("SELECT * FROM battles WHERE id = %s", (battle_id,)).fetchone()
        if not battle:
            raise HTTPException(404, "Батл не знайдено")
        if battle["opponent_email"].lower() != user["email"].lower():
            raise HTTPException(403, "Тільки опонент може прийняти батл")
        if battle["status"] != "pending":
            return {"message": "Батл уже активний"}
        expires_at = datetime.utcnow() + timedelta(minutes=10)
        conn.execute("UPDATE battles SET status = 'active', expires_at = %s WHERE id = %s", (expires_at, battle_id))
        conn.commit()
    await realtime_hub.emit(battle["challenger_email"], "battle_active", {"battle_id": battle_id})
    await realtime_hub.emit(battle["opponent_email"], "battle_active", {"battle_id": battle_id})
    return {"message": "Батл активовано", "expires_at": expires_at.isoformat()}


@app.post("/battles/{battle_id}/decline")
async def decline_battle(battle_id: int, user=Depends(get_current_user)):
    with db() as conn:
        battle = conn.execute("SELECT * FROM battles WHERE id = %s", (battle_id,)).fetchone()
        if not battle:
            raise HTTPException(404, "Батл не знайдено")
        if battle["opponent_email"].lower() != user["email"].lower():
            raise HTTPException(403, "Тільки опонент може відхилити батл")
        if battle["status"] != "pending":
            raise HTTPException(409, "Можна відхилити лише очікуючий батл")
        conn.execute("UPDATE battles SET status = 'declined', opponent_seen_at = NOW() WHERE id = %s", (battle_id,))
        conn.commit()
    await realtime_hub.emit(battle["challenger_email"], "battle_declined", {"battle_id": battle_id})
    await realtime_hub.emit(battle["opponent_email"], "battle_declined", {"battle_id": battle_id})
    return {"message": "Батл відхилено"}


@app.post("/battles/{battle_id}/cancel")
async def cancel_battle(battle_id: int, user=Depends(get_current_user)):
    with db() as conn:
        battle = conn.execute("SELECT * FROM battles WHERE id = %s", (battle_id,)).fetchone()
        if not battle:
            raise HTTPException(404, "Батл не знайдено")
        if battle["challenger_email"].lower() != user["email"].lower():
            raise HTTPException(403, "Тільки ініціатор може скасувати виклик")
        if battle["status"] != "pending":
            raise HTTPException(409, "Скасувати можна лише очікуючий виклик")
        conn.execute("UPDATE battles SET status = 'declined', challenger_seen_at = NOW() WHERE id = %s", (battle_id,))
        conn.commit()
    await realtime_hub.emit(battle["challenger_email"], "battle_cancelled", {"battle_id": battle_id})
    await realtime_hub.emit(battle["opponent_email"], "battle_cancelled", {"battle_id": battle_id})
    return {"message": "Виклик скасовано"}


@app.get("/battles/{battle_id}")
def get_battle(battle_id: int, user=Depends(get_current_user)):
    with db() as conn:
        battle = conn.execute("SELECT * FROM battles WHERE id = %s", (battle_id,)).fetchone()
        if not battle:
            raise HTTPException(404, "Батл не знайдено")
        battle_dict = _finalize_battle_state(conn, dict(battle))
        role = _battle_role(battle_dict, user["email"])
        if not role:
            raise HTTPException(403, "Немає доступу до батлу")
        if battle_dict.get("status") == "pending":
            battle_dict = _mark_battle_seen(conn, battle_dict, role)
        question_ids = battle_dict.get("question_ids") or []
        questions = []
        if question_ids:
            rows = conn.execute(
                "SELECT * FROM questions WHERE id = ANY(%s) ORDER BY id",
                (question_ids,),
            ).fetchall()
            by_id = {row["id"]: _sanitize_question_row(dict(row)) for row in rows}
            questions = [by_id[qid] for qid in question_ids if qid in by_id]
        opponent_email = battle_dict["opponent_email"] if role == "challenger" else battle_dict["challenger_email"]
        opponent_user = conn.execute(
            "SELECT id, username, avatar_url, avatar_version, active_frame FROM users WHERE email = %s",
            (opponent_email,),
        ).fetchone()
        challenger_user = conn.execute(
            "SELECT username FROM users WHERE email = %s",
            (battle_dict["challenger_email"],),
        ).fetchone()
        opponent_identity = conn.execute(
            "SELECT username FROM users WHERE email = %s",
            (battle_dict["opponent_email"],),
        ).fetchone()
        conn.commit()

    my_answers = battle_dict["challenger_answers"] if role == "challenger" else battle_dict["opponent_answers"]
    return {
        **battle_dict,
        "role": role,
        "questions": questions,
        "opponent_username": opponent_user["username"] if opponent_user else None,
        "opponent_id": opponent_user["id"] if opponent_user else None,
        "opponent_avatar_url": opponent_user["avatar_url"] if opponent_user else None,
        "opponent_avatar_version": int(opponent_user["avatar_version"] or 0) if opponent_user else 0,
        "opponent_active_frame": opponent_user["active_frame"] if opponent_user else None,
        "winner_username": challenger_user["username"] if battle_dict.get("winner_email") == battle_dict["challenger_email"] and challenger_user else (
            opponent_identity["username"] if battle_dict.get("winner_email") == battle_dict["opponent_email"] and opponent_identity else None
        ),
        "my_submitted": bool(my_answers),
        "invite_seen": _battle_invite_seen(battle_dict, role),
        "seconds_left": _battle_deadline_seconds(battle_dict),
        "created_at": str(battle_dict.get("created_at") or ""),
        "expires_at": str(battle_dict.get("expires_at") or ""),
        "finished_at": str(battle_dict.get("finished_at") or ""),
    }


@app.post("/battles/{battle_id}/submit")
async def submit_battle_answers(battle_id: int, req: BattleSubmitRequest, user=Depends(get_current_user)):
    with db() as conn:
        battle = conn.execute("SELECT * FROM battles WHERE id = %s", (battle_id,)).fetchone()
        if not battle:
            raise HTTPException(404, "Батл не знайдено")
        battle_dict = _finalize_battle_state(conn, dict(battle))
        role = _battle_role(battle_dict, user["email"])
        if not role:
            raise HTTPException(403, "Немає доступу до батлу")
        if battle_dict["status"] == "finished":
            raise HTTPException(409, "Батл уже завершено")
        if battle_dict.get("expires_at") and battle_dict["expires_at"] <= datetime.utcnow():
            raise HTTPException(409, "Час на батл вже вийшов")

        if role == "challenger" and battle_dict.get("challenger_answers"):
            raise HTTPException(409, "Ви вже завершили цей батл")
        if role == "opponent" and battle_dict.get("opponent_answers"):
            raise HTTPException(409, "Ви вже завершили цей батл")

        question_ids = battle_dict.get("question_ids") or []
        rows = conn.execute("SELECT * FROM questions WHERE id = ANY(%s)", (question_ids,)).fetchall()
        questions_by_id = {str(row["id"]): dict(row) for row in rows}

        score = 0
        normalized_answers: dict[str, str] = {}
        for question_id in question_ids:
            key = str(question_id)
            answer = req.answers.get(key)
            if answer is None:
                continue
            question = questions_by_id.get(key)
            if not question:
                continue
            normalized_answers[key] = answer
            if _answer_label_to_index(answer, question) == int(question.get("correct_ans") or 0):
                score += 1

        if role == "challenger":
            battle_dict["challenger_answers"] = normalized_answers
            battle_dict["challenger_score"] = score
            battle_dict["challenger_time"] = req.time_seconds
        else:
            battle_dict["opponent_answers"] = normalized_answers
            battle_dict["opponent_score"] = score
            battle_dict["opponent_time"] = req.time_seconds

        both_done = bool(battle_dict["challenger_answers"]) and bool(battle_dict["opponent_answers"])
        battle_dict["status"] = "finished" if both_done else "active"
        battle_dict["finished_at"] = datetime.utcnow() if both_done else battle_dict.get("finished_at")
        if not both_done:
            battle_dict["expires_at"] = min(
                battle_dict["expires_at"] or (datetime.utcnow() + timedelta(minutes=10)),
                datetime.utcnow() + timedelta(seconds=60),
            )
        battle_dict["winner_email"] = _pick_winner(battle_dict) if both_done else None

        conn.execute(
            """
            UPDATE battles
            SET status = %s,
                challenger_answers = %s::jsonb,
                opponent_answers = %s::jsonb,
                challenger_score = %s,
                opponent_score = %s,
                challenger_time = %s,
                opponent_time = %s,
                winner_email = %s,
                expires_at = %s,
                finished_at = %s
            WHERE id = %s
            """,
            (
                battle_dict["status"],
                _serialize_json(battle_dict["challenger_answers"]),
                _serialize_json(battle_dict["opponent_answers"]),
                battle_dict["challenger_score"],
                battle_dict["opponent_score"],
                battle_dict["challenger_time"],
                battle_dict["opponent_time"],
                battle_dict["winner_email"],
                battle_dict["expires_at"],
                battle_dict["finished_at"],
                battle_id,
            ),
        )
        conn.commit()

    await realtime_hub.emit(battle_dict["challenger_email"], "battle_update", {"battle_id": battle_id})
    await realtime_hub.emit(battle_dict["opponent_email"], "battle_update", {"battle_id": battle_id})
    return {
        "status": battle_dict["status"],
        "score": score,
        "winner_email": battle_dict["winner_email"],
        "seconds_left": _battle_deadline_seconds(battle_dict),
    }


if __name__ == "__main__":
    import uvicorn

    uvicorn.run("main:app", host="0.0.0.0", port=PORT, reload=False)



