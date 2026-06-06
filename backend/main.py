from __future__ import annotations

import json
import os
import re
import shutil
import subprocess
import sys
import threading
import base64
import hashlib
import hmac
from datetime import date, datetime, timedelta
from html import escape as html_escape
from pathlib import Path
from typing import Any, Optional
from uuid import uuid4

import bcrypt
import jwt
import psycopg
from psycopg import errors as psycopg_errors
from fastapi import Depends, FastAPI, File, Form, Header, HTTPException, Query, Request, UploadFile, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse, Response
from fastapi.staticfiles import StaticFiles
from core.bootstrap import ensure_runtime_migrations, ensure_schema_indexes, ensure_schema_tables
from core.config import (
    ADMIN_EMAILS,
    ADMIN_PASSWORD,
    ADMIN_PASSWORD_HASH,
    ADMIN_USERNAME,
    BACKEND_PUBLIC_URL,
    BASE_DIR,
    CATEGORY_ALIASES,
    DEFAULT_IMPORT_FILE,
    DEFAULT_PREMIUM_FEATURES,
    DEFAULT_PROMO_SETTINGS,
    EMBEDDED_OPTION_RE,
    FRAME_SHOP,
    FRONTEND_DIST_DIR,
    FRONTEND_URL,
    HANDBOOK_TOPIC_CATEGORY_MAP,
    HANDBOOK_TOPICS,
    IS_PRODUCTION,
    JWT_REMEMBER_DAYS,
    JWT_SECRET,
    JWT_SESSION_DAYS,
    LIQPAY_PRIVATE_KEY,
    LIQPAY_PUBLIC_KEY,
    MULTI_TOPIC_CATEGORY_SLUGS,
    MVS_TICKET_COUNT,
    PORT,
    PREMIUM_FEATURES_FILE,
    PREMIUM_PLAN_ALIASES,
    PREMIUM_PLANS,
    PROMO_ADMIN_KEY,
    PROMO_SETTINGS_FILE,
    PUBLIC_IMAGES_DIR,
    PUBLIC_STATIC_IMAGES_DIR,
    QUESTION_UI_MARKERS,
    RUNTIME_DIR,
    RUN_STARTUP_MAINTENANCE,
    SUPPORT_EMAIL,
    THEORY_CATEGORY_FALLBACKS,
    THEORY_PARSE_LOG_FILE,
    THEORY_PARSE_STATUS_FILE,
    UPLOAD_DIR,
)
from core.database import db
from domain.auth import (
    email_is_verified as domain_email_is_verified,
    normalize_username as domain_normalize_username,
)
from domain.questions import (
    clean_text as domain_clean_text,
    sanitize_question_row as domain_sanitize_question_row,
    strip_embedded_options_from_question as domain_strip_embedded_options_from_question,
)
from parsers.theory_sources import THEORY_SOURCE_MAP
from repositories.auth_repository import AuthRepository
from repositories.stars_repository import StarsRepository
from schemas.requests import (
    AdminAchievementUpdateRequest,
    AdminQuestionCreateRequest,
    AccessLimitRequest,
    AdminLoginRequest,
    AdminQuestionUpdateRequest,
    AdminSupportReplyRequest,
    AdminTheoryParseRequest,
    AdminTheorySectionUpdateRequest,
    AdminUserUpdateRequest,
    BattleCreateRequest,
    BattleSubmitRequest,
    ForgotPasswordRequest,
    FramePurchaseRequest,
    FriendInviteRequest,
    LoginRequest,
    MarathonScoreSubmit,
    MessageCreateRequest,
    PremiumCheckoutRequest,
    PremiumFeaturesUpdateRequest,
    PromoConfigRequest,
    RegisterRequest,
    ResendVerificationRequest,
    ResetPasswordRequest,
    SupportMessageCreateRequest,
    TestResultSubmit,
    UpdateProfileRequest,
    VerifyEmailRequest,
)
from schemas.battles import BattleSubmitResponse
from schemas.auth import AuthMessageResponse, AuthTokenResponse
from schemas.progress import ProgressResultResponse, ProgressStatsResponse, TestResultResponse
from schemas.questions import MvsExamResponse
from services.achievement_service import (
    check_achievements as check_achievements_use_case,
    list_achievement_progress as list_achievement_progress_use_case,
)
from services.battle_service import (
    accept_battle as accept_battle_use_case,
    cancel_battle as cancel_battle_use_case,
    create_battle as create_battle_use_case,
    decline_battle as decline_battle_use_case,
    get_battle_detail as get_battle_detail_use_case,
    list_battles as list_battles_use_case,
    submit_battle_answers as submit_battle_answers_use_case,
)
from services.email import email_delivery_response, gen_code, send_email
from services.errors import ServiceError
from services.auth_service import (
    get_session_user as get_session_user_use_case,
    login_user as login_user_use_case,
    register_user as register_user_use_case,
    request_password_reset as request_password_reset_use_case,
    resend_verification_code as resend_verification_code_use_case,
    reset_password as reset_password_use_case,
    verify_email as verify_email_use_case,
)
from services.progress_service import (
    get_progress_stats as get_progress_stats_use_case,
    list_progress_results as list_progress_results_use_case,
    restore_streak as restore_streak_use_case,
    submit_marathon_score as submit_marathon_score_use_case,
    submit_test_result as submit_test_result_use_case,
)
from services.profile_service import (
    clear_avatar as clear_avatar_use_case,
    get_public_profile_by_id as get_public_profile_by_id_use_case,
    get_public_profile_by_username as get_public_profile_by_username_use_case,
    update_avatar as update_avatar_use_case,
    update_profile as update_profile_use_case,
)
from services.payment_service import (
    activate_mock_payment as activate_mock_payment_use_case,
    create_premium_checkout as create_premium_checkout_use_case,
    get_payment_status as get_payment_status_use_case,
    handle_liqpay_callback as handle_liqpay_callback_use_case,
    list_admin_premium_orders as list_admin_premium_orders_use_case,
)
from services.friend_service import (
    accept_friend as accept_friend_use_case,
    invite_friend as invite_friend_use_case,
    list_friends as list_friends_use_case,
    remove_friend as remove_friend_use_case,
)
from services.message_service import (
    list_messages as list_messages_use_case,
    send_message as send_message_use_case,
)
from services.notification_service import get_notifications_summary as get_notifications_summary_use_case
from services.support_service import (
    get_admin_support_thread as get_admin_support_thread_use_case,
    list_user_support_messages as list_user_support_messages_use_case,
    list_admin_support_conversations as list_admin_support_conversations_use_case,
    send_admin_support_reply as send_admin_support_reply_use_case,
    send_user_support_message as send_user_support_message_use_case,
)
from services.admin_user_service import (
    create_admin_password_reset as create_admin_password_reset_use_case,
    delete_admin_user as delete_admin_user_use_case,
    get_admin_user_audit as get_admin_user_audit_use_case,
    list_admin_users as list_admin_users_use_case,
    update_admin_user as update_admin_user_use_case,
    update_admin_user_achievement as update_admin_user_achievement_use_case,
)
from services.admin_theory_service import (
    get_admin_theory_summary as get_admin_theory_summary_use_case,
    list_admin_theory_sections as list_admin_theory_sections_use_case,
    update_admin_theory_section as update_admin_theory_section_use_case,
)
from services.access_limit_service import (
    check_access_limit as check_access_limit_use_case,
    consume_access_limit as consume_access_limit_use_case,
)
from services.admin_question_service import (
    create_admin_question as create_admin_question_use_case,
    delete_admin_question as delete_admin_question_use_case,
    list_admin_question_sections as list_admin_question_sections_use_case,
    search_admin_questions as search_admin_questions_use_case,
    update_admin_question as update_admin_question_use_case,
)
from services.question_service import (
    get_question as get_question_use_case,
    import_questions as import_questions_use_case,
    list_questions as list_questions_use_case,
    list_sections as list_sections_use_case,
    random_questions as random_questions_use_case,
)
from services.frame_service import purchase_frame as purchase_frame_use_case
from services.handbook_service import (
    get_handbook_entry as get_handbook_entry_use_case,
    list_handbook_entries as list_handbook_entries_use_case,
    list_handbook_topics as list_handbook_topics_use_case,
    search_handbook_entries as search_handbook_entries_use_case,
)
from services.leaderboard_service import list_leaderboard as list_leaderboard_use_case
from services.realtime import RealtimeHub
from services.test_session_service import (
    build_mvs_exam_questions as build_mvs_exam_questions_use_case,
    build_mvs_exam_session,
)
from services.ticket_service import get_ticket as get_ticket_use_case
from services.ticket_service import list_tickets as list_tickets_use_case
from services.theory_service import (
    get_theory_section_payload as get_theory_section_payload_use_case,
    list_theory_category_payloads as list_theory_category_payloads_use_case,
    list_theory_section_payloads as list_theory_section_payloads_use_case,
    list_theory_topic_payloads as list_theory_topic_payloads_use_case,
)
from services.theory_maintenance_service import (
    ensure_question_metadata as ensure_question_metadata_use_case,
    ensure_theory_seed_data as ensure_theory_seed_data_use_case,
    sync_theory_data as sync_theory_data_use_case,
)

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
app.mount("/images", StaticFiles(directory=str(PUBLIC_STATIC_IMAGES_DIR)), name="images")


def _is_frontend_navigation(request: Request) -> bool:
    if request.method != "GET" or not IS_PRODUCTION or not FRONTEND_DIST_DIR.exists():
        return False

    path = request.url.path
    if path in {"/health", "/api/health"} or path.startswith(("/api/", "/assets/", "/images/", "/uploads/", "/ws")):
        return False

    accept = request.headers.get("accept", "")
    fetch_dest = request.headers.get("sec-fetch-dest", "")
    return "text/html" in accept or fetch_dest == "document"


@app.middleware("http")
async def serve_frontend_navigation(request: Request, call_next):
    if _is_frontend_navigation(request):
        return FileResponse(FRONTEND_DIST_DIR / "index.html")
    return await call_next(request)


@app.get("/health")
def healthcheck() -> dict[str, str]:
    return {"status": "ok"}


@app.get("/api/health", include_in_schema=False)
def api_healthcheck() -> dict[str, str]:
    return healthcheck()


realtime_hub = RealtimeHub()


def _json_dumps(value: Any) -> str:
    return json.dumps(value, ensure_ascii=False, separators=(",", ":"))


def _normalize_plan_code(plan_code: Any) -> str:
    normalized = PREMIUM_PLAN_ALIASES.get(str(plan_code or "").strip().lower())
    if not normalized:
        raise HTTPException(400, "РќРµРІС–РґРѕРјРёР№ С‚Р°СЂРёС„ Premium")
    return normalized


def _normalize_price_map(raw: Any, fallback: dict[str, int]) -> dict[str, int]:
    prices: dict[str, int] = {}
    source = raw if isinstance(raw, dict) else {}
    for code, default_value in fallback.items():
        candidate = source.get(code, default_value)
        try:
            prices[code] = max(0, int(float(candidate)))
        except (TypeError, ValueError):
            prices[code] = int(default_value)
    return prices


def _normalize_promo_settings(raw: Any) -> dict[str, Any]:
    data = raw if isinstance(raw, dict) else {}
    return {
        "is_active": bool(data.get("is_active", DEFAULT_PROMO_SETTINGS["is_active"])),
        "started_at": data.get("started_at") or None,
        "never_ends": bool(data.get("never_ends", DEFAULT_PROMO_SETTINGS["never_ends"])),
        "duration_days": max(1, int(data.get("duration_days") or DEFAULT_PROMO_SETTINGS["duration_days"])),
        "promo_prices": _normalize_price_map(data.get("promo_prices"), DEFAULT_PROMO_SETTINGS["promo_prices"]),
        "regular_prices": _normalize_price_map(data.get("regular_prices"), DEFAULT_PROMO_SETTINGS["regular_prices"]),
    }


def _save_promo_settings(settings: dict[str, Any]) -> None:
    PROMO_SETTINGS_FILE.parent.mkdir(parents=True, exist_ok=True)
    PROMO_SETTINGS_FILE.write_text(_json_dumps(_normalize_promo_settings(settings)), encoding="utf-8")


def _load_promo_settings() -> dict[str, Any]:
    if not PROMO_SETTINGS_FILE.exists():
        settings = _normalize_promo_settings(DEFAULT_PROMO_SETTINGS)
        _save_promo_settings(settings)
        return settings
    try:
        raw = json.loads(PROMO_SETTINGS_FILE.read_text(encoding="utf-8"))
    except Exception:
        raw = DEFAULT_PROMO_SETTINGS
    settings = _normalize_promo_settings(raw)
    if settings != raw:
        _save_promo_settings(settings)
    return settings


def _plan_catalog_from_prices(current_prices: dict[str, int], original_prices: dict[str, int]) -> list[dict[str, Any]]:
    plans: list[dict[str, Any]] = []
    for code in ("1", "3", "6", "12"):
        meta = PREMIUM_PLANS[code]
        plans.append(
            {
                "code": code,
                "slug": meta["slug"],
                "title": meta["title"],
                "months": meta["months"],
                "current_price": int(current_prices[code]),
                "original_price": int(original_prices[code]),
            }
        )
    return plans


def _compute_promo_status(settings: Optional[dict[str, Any]] = None, *, persist: bool = True) -> dict[str, Any]:
    payload = _normalize_promo_settings(settings or _load_promo_settings())
    now = datetime.utcnow()
    started_at_raw = payload.get("started_at")
    started_at = None
    if started_at_raw:
        try:
            started_at = datetime.fromisoformat(str(started_at_raw))
        except ValueError:
            started_at = None

    is_active = bool(payload["is_active"] and started_at)
    seconds_left: Optional[int] = 0
    if is_active and payload.get("never_ends"):
        seconds_left = None
    elif is_active and started_at:
        elapsed_seconds = int((now - started_at).total_seconds())
        seconds_left = max(0, int(payload["duration_days"]) * 86400 - max(0, elapsed_seconds))
        if seconds_left <= 0:
            payload["is_active"] = False
            payload["started_at"] = None
            payload["never_ends"] = False
            is_active = False
            if persist:
                _save_promo_settings(payload)

    current_prices = payload["promo_prices"] if is_active else payload["regular_prices"]
    original_prices = payload["regular_prices"]
    return {
        "is_active": bool(is_active),
        "started_at": payload.get("started_at"),
        "duration_days": int(payload["duration_days"]),
        "never_ends": bool(payload.get("never_ends")),
        "seconds_left": None if seconds_left is None else int(seconds_left),
        "show_strikethrough": bool(is_active),
        "current_prices": {key: int(value) for key, value in current_prices.items()},
        "original_prices": {key: int(value) for key, value in original_prices.items()},
        "promo_prices": {key: int(value) for key, value in payload["promo_prices"].items()},
        "regular_prices": {key: int(value) for key, value in payload["regular_prices"].items()},
        "plans": _plan_catalog_from_prices(current_prices, original_prices),
    }


def _get_premium_plan(plan_code: str) -> dict[str, Any]:
    normalized_code = _normalize_plan_code(plan_code)
    meta = PREMIUM_PLANS[normalized_code]
    promo_status = _compute_promo_status()
    price_uah = int(promo_status["current_prices"][normalized_code])
    return {
        **meta,
        "code": normalized_code,
        "currency": "UAH",
        "amount": price_uah * 100,
        "display_price": price_uah,
    }


def _normalize_premium_features(raw: Any) -> list[dict[str, Any]]:
    rows = raw if isinstance(raw, list) else DEFAULT_PREMIUM_FEATURES
    normalized: list[dict[str, Any]] = []
    seen: set[str] = set()
    for index, item in enumerate(rows):
        if not isinstance(item, dict):
            continue
        feature_id = str(item.get("id") or "").strip().lower().replace(" ", "_")
        if not feature_id or feature_id in seen:
            continue
        seen.add(feature_id)
        normalized.append(
            {
                "id": feature_id,
                "title": str(item.get("title") or feature_id).strip(),
                "description": str(item.get("description") or "").strip(),
                "is_enabled": bool(item.get("is_enabled", True)),
                "sort_order": int(item.get("sort_order") or index + 1),
            }
        )
    if not normalized:
        normalized = [dict(item) for item in DEFAULT_PREMIUM_FEATURES]
    return sorted(normalized, key=lambda item: (int(item.get("sort_order") or 0), item.get("title") or ""))


def _save_premium_features(features: list[dict[str, Any]]) -> None:
    PREMIUM_FEATURES_FILE.parent.mkdir(parents=True, exist_ok=True)
    PREMIUM_FEATURES_FILE.write_text(
        _json_dumps(_normalize_premium_features(features)),
        encoding="utf-8",
    )


def _load_premium_features() -> list[dict[str, Any]]:
    if not PREMIUM_FEATURES_FILE.exists():
        _save_premium_features(DEFAULT_PREMIUM_FEATURES)
        return [dict(item) for item in DEFAULT_PREMIUM_FEATURES]
    try:
        raw = json.loads(PREMIUM_FEATURES_FILE.read_text(encoding="utf-8"))
    except Exception:
        raw = DEFAULT_PREMIUM_FEATURES
    features = _normalize_premium_features(raw)
    if features != raw:
        _save_premium_features(features)
    return features


def _build_liqpay_payload(*, order_id: str, plan: dict[str, Any], result_url: str) -> dict[str, Any]:
    return {
        "version": 3,
        "public_key": LIQPAY_PUBLIC_KEY,
        "action": "pay",
        "amount": plan["amount"] / 100,
        "currency": plan["currency"],
        "description": plan["title"],
        "order_id": order_id,
        "result_url": result_url,
        "server_url": f"{BACKEND_PUBLIC_URL.rstrip('/')}/payment/liqpay-callback",
        "sandbox": 1 if LIQPAY_PUBLIC_KEY.startswith("sandbox_") else 0,
    }


def _encode_liqpay_payload(payload: dict[str, Any]) -> tuple[str, str]:
    encoded = base64.b64encode(_json_dumps(payload).encode("utf-8")).decode("utf-8")
    signature = base64.b64encode(
        hashlib.sha1(f"{LIQPAY_PRIVATE_KEY}{encoded}{LIQPAY_PRIVATE_KEY}".encode("utf-8")).digest()
    ).decode("utf-8")
    return encoded, signature


def _verify_liqpay_signature(data: str, signature: str) -> bool:
    if not LIQPAY_PRIVATE_KEY:
        return False
    expected = base64.b64encode(
        hashlib.sha1(f"{LIQPAY_PRIVATE_KEY}{data}{LIQPAY_PRIVATE_KEY}".encode("utf-8")).digest()
    ).decode("utf-8")
    return expected == signature


def _decode_liqpay_data(data: str) -> dict[str, Any]:
    raw = base64.b64decode(data).decode("utf-8")
    return json.loads(raw)


@app.on_event("startup")
def on_startup() -> None:
    if not RUN_STARTUP_MAINTENANCE:
        print("[startup] maintenance skipped; Render preDeployCommand handles schema and seed data", flush=True)
        return

    tasks = [
        ("schema tables", ensure_schema_tables),
        ("runtime migrations", ensure_runtime_migrations),
        ("schema indexes", ensure_schema_indexes),
        ("theory seed", ensure_theory_seed_data),
        ("theory sync", sync_theory_data),
        ("question metadata", ensure_question_metadata),
    ]
    for label, task in tasks:
        try:
            task()
        except (psycopg_errors.DeadlockDetected, psycopg_errors.LockNotAvailable):
            print(f"[startup] {label} skipped temporarily because another database task is holding locks", flush=True)


def _clean_text(value: Any) -> str:
    return domain_clean_text(value, QUESTION_UI_MARKERS)


def _strip_embedded_options_from_question(value: Any) -> str:
    return domain_strip_embedded_options_from_question(
        value,
        ui_markers=QUESTION_UI_MARKERS,
        embedded_option_re=EMBEDDED_OPTION_RE,
    )


def _sanitize_handbook_text(value: Any) -> str:
    text = _clean_text(value)
    text = re.sub(r"(?:\b\d{1,2}\b\s*){10,}", " ", text)
    text = re.sub(r"\s+(?:(?:\d+\.)+\d+|\d+\.\d+|\d+)\s*$", "", text).strip()
    words = text.split()
    if len(words) > 3 and words[0].lower() == words[-1].lower():
        text = " ".join(words[:-1])
    return re.sub(r"\s+", " ", text).strip()


def _sanitize_handbook_html(value: Any, section_title: str = "") -> str:
    html = str(value or "")
    if not html:
        return ""
    return html.strip()


def _normalize_category(category: Optional[str]) -> Optional[str]:
    if not category:
        return None
    raw = category.strip().upper()
    return CATEGORY_ALIASES.get(raw, raw)


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
    return StarsRepository(conn).earned_stars(user_id=user_id)


def _purchased_frames(user: dict[str, Any]) -> list[str]:
    return [str(item) for item in _coerce_json_list(user.get("purchased_frames")) if str(item).strip()]


def _total_stars(conn: psycopg.Connection, user: dict[str, Any]) -> int:
    return max(0, _earned_stars(conn, user["id"]) + int(user.get("manual_star_adjustment") or 0))


def _available_stars(conn: psycopg.Connection, user: dict[str, Any]) -> int:
    return max(0, _total_stars(conn, user) - int(user.get("spent_stars") or 0))


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
    return domain_sanitize_question_row(
        row,
        ui_markers=QUESTION_UI_MARKERS,
        embedded_option_re=EMBEDDED_OPTION_RE,
    )


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
        "is_premium": bool(user.get("is_premium", False)),
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
    return domain_normalize_username(value)


def _is_email_verified(user: Optional[dict[str, Any]]) -> bool:
    return domain_email_is_verified(user)


def _resolve_user_by_login(conn: psycopg.Connection, identifier: str) -> Optional[dict[str, Any]]:
    return AuthRepository(conn).get_user_by_login(identifier)


def _resolve_user_by_handle(conn: psycopg.Connection, handle: str) -> Optional[dict[str, Any]]:
    return AuthRepository(conn).get_user_by_login(handle)


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


def create_admin_token(username: str, remember_me: bool = True) -> str:
    days = JWT_REMEMBER_DAYS if remember_me else JWT_SESSION_DAYS
    payload = {
        "sub": f"admin:{username}",
        "scope": "admin",
        "exp": datetime.utcnow() + timedelta(days=days),
    }
    return jwt.encode(payload, JWT_SECRET, algorithm="HS256")


def _admin_public() -> dict[str, Any]:
    return {
        "id": 0,
        "username": ADMIN_USERNAME,
        "name": "РђРґРјС–РЅС–СЃС‚СЂР°С‚РѕСЂ",
        "full_name": "DrivePrep Admin",
        "email": SUPPORT_EMAIL,
        "is_admin": True,
        "admin_session": True,
    }


def _is_admin_password_configured() -> bool:
    return bool(ADMIN_PASSWORD_HASH or ADMIN_PASSWORD or PROMO_ADMIN_KEY or not IS_PRODUCTION)


def _check_admin_credentials(username: str, password: str) -> bool:
    if username.strip().lower() != ADMIN_USERNAME.lower():
        return False
    if not _is_admin_password_configured():
        return False
    if ADMIN_PASSWORD_HASH:
        return check_password(password, ADMIN_PASSWORD_HASH)
    expected = ADMIN_PASSWORD or PROMO_ADMIN_KEY or ("admin12345" if not IS_PRODUCTION else "")
    return bool(expected) and hmac.compare_digest(password, expected)


def get_current_admin(authorization: Optional[str] = Header(default=None)) -> dict[str, Any]:
    if not authorization or not authorization.startswith("Bearer "):
        raise HTTPException(401, "РџРѕС‚СЂС–Р±РµРЅ РІС…С–Рґ РІ Р°РґРјС–РЅ-РїР°РЅРµР»СЊ")

    token = authorization[7:]
    try:
        payload = jwt.decode(token, JWT_SECRET, algorithms=["HS256"])
        if payload.get("scope") == "admin":
            token_username = str(payload.get("sub") or "").replace("admin:", "", 1)
            if token_username.lower() != ADMIN_USERNAME.lower():
                raise HTTPException(401, "РђРґРјС–РЅ-СЃРµСЃС–СЏ РЅРµРґС–Р№СЃРЅР°")
            return _admin_public()
    except jwt.ExpiredSignatureError as exc:
        raise HTTPException(401, "РђРґРјС–РЅ-СЃРµСЃС–СЏ Р·Р°РІРµСЂС€РёР»Р°СЃСЏ, СѓРІС–Р№РґС–С‚СЊ Р·РЅРѕРІСѓ") from exc
    except HTTPException:
        raise
    except Exception:
        pass

    user = get_current_user(authorization)
    if not _is_admin_email(user.get("email")):
        raise HTTPException(403, "РџРѕС‚СЂС–Р±РЅС– РїСЂР°РІР° Р°РґРјС–РЅС–СЃС‚СЂР°С‚РѕСЂР°")
    return user


def get_optional_admin(authorization: Optional[str] = Header(default=None)) -> Optional[dict[str, Any]]:
    if not authorization:
        return None
    try:
        return get_current_admin(authorization)
    except HTTPException:
        return None


def get_current_user(authorization: Optional[str] = Header(default=None)) -> dict[str, Any]:
    if not authorization or not authorization.startswith("Bearer "):
        raise HTTPException(401, "РџРѕС‚СЂС–Р±РЅР° Р°РІС‚РѕСЂРёР·Р°С†С–СЏ")

    token = authorization[7:]
    try:
        payload = jwt.decode(token, JWT_SECRET, algorithms=["HS256"])
        user_id = int(payload["sub"])
    except jwt.ExpiredSignatureError as exc:
        raise HTTPException(401, "РЎРµСЃС–СЏ Р·Р°РІРµСЂС€РёР»Р°СЃСЏ, СѓРІС–Р№РґС–С‚СЊ Р·РЅРѕРІСѓ") from exc
    except Exception as exc:
        raise HTTPException(401, "РќРµРІР°Р»С–РґРЅРёР№ С‚РѕРєРµРЅ") from exc

    try:
        return get_session_user_use_case(user_id, is_admin_email=_is_admin_email)
    except ServiceError as exc:
        raise HTTPException(exc.status_code, exc.message) from exc


def get_optional_user(authorization: Optional[str] = Header(default=None)) -> Optional[dict[str, Any]]:
    if not authorization:
        return None


def get_client_ip(request: Request) -> str:
    forwarded = request.headers.get("x-forwarded-for", "")
    if forwarded:
        return forwarded.split(",")[0].strip()
    real_ip = request.headers.get("x-real-ip", "")
    if real_ip:
        return real_ip.strip()
    return request.client.host if request.client else "unknown"
    try:
        return get_current_user(authorization)
    except HTTPException:
        return None


def require_admin(admin=Depends(get_current_admin)) -> dict[str, Any]:
    return admin


def require_promo_admin(
    x_admin_key: Optional[str] = Header(default=None, alias="x-admin-key"),
    admin=Depends(get_optional_admin),
) -> Optional[dict[str, Any]]:
    if PROMO_ADMIN_KEY and x_admin_key and x_admin_key == PROMO_ADMIN_KEY:
        return {"source": "secret-key"}
    if admin:
        return admin
    raise HTTPException(403, "РџРѕС‚СЂС–Р±РЅС– РїСЂР°РІР° Р°РґРјС–РЅС–СЃС‚СЂР°С‚РѕСЂР° Р°Р±Рѕ РєРѕСЂРµРєС‚РЅРёР№ promo key")


def _resolve_user_from_token(token: str) -> Optional[dict[str, Any]]:
    try:
        payload = jwt.decode(token, JWT_SECRET, algorithms=["HS256"])
        user_id = int(payload["sub"])
        return get_session_user_use_case(user_id, is_admin_email=_is_admin_email)
    except Exception:
        return None


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


def _prepare_import_question(item: dict[str, Any]) -> dict[str, Any]:
    raw_options = item.get("options") or item.get("Р Р†Р В°РЎР‚РЎвЂ“Р В°Р Р…РЎвЂљР С‘") or []
    options: list[str] = []
    for option in raw_options:
        if isinstance(option, dict):
            text = _clean_text(option.get("text"))
        else:
            text = _clean_text(option)
        if text:
            options.append(text)

    images = item.get("images") or item.get("Р С”Р В°РЎР‚РЎвЂљР С‘Р Р…Р С”Р С‘") or []
    if not images and item.get("image_url"):
        images = [item.get("image_url")]

    correct_ans = item.get("correct_ans") or item.get("Р С—РЎР‚Р В°Р Р†Р С‘Р В»РЎРЉР Р…Р В°_Р Р†РЎвЂ“Р Т‘Р С—Р С•Р Р†РЎвЂ“Р Т‘РЎРЉ")
    correct_answer = str(item.get("correct_answer") or "").strip().upper()
    if not correct_ans and correct_answer:
        labels = ["A", "B", "C", "D", "E", "F"]
        if correct_answer in labels:
            correct_ans = labels.index(correct_answer) + 1

    raw_category = item.get("category") or item.get("Р С”Р В°РЎвЂљР ВµР С–Р С•РЎР‚РЎвЂ“РЎРЏ")
    if not raw_category:
        raw_categories = item.get("Р С”Р В°РЎвЂљР ВµР С–Р С•РЎР‚РЎвЂ“РЎвЂ”") or []
        if isinstance(raw_categories, list) and raw_categories:
            raw_category = raw_categories[0]

    return {
        "id": int(item["id"]),
        "section": str(item.get("section") or item.get("Р РЋР ВµР В·Р Т‘РЎвЂ“Р В»") or item.get("Р РЋР С•Р В·Р Т‘РЎвЂ“Р В»") or item.get("Р РЋР В·Р С•Р Т‘РЎвЂ“Р В»") or item.get("Р РЋР Т‘Р С•Р В·Р Т‘РЎвЂ“Р В»") or item.get("Р РЋРЎР‚Р С•Р В·Р Т‘РЎвЂ“Р В»") or item.get("РЎР‚Р С•Р В·Р Т‘РЎвЂ“Р В»") or ""),
        "section_name": _clean_text(item.get("section_name") or item.get("Р Р…Р В°Р В·Р Р†Р В°_РЎР‚Р С•Р В·Р Т‘РЎвЂ“Р В»РЎС“")),
        "num_in_section": item.get("num_in_section") or item.get("Р Р…Р С•Р СР ВµРЎР‚_Р Р†_РЎР‚Р С•Р В·Р Т‘РЎвЂ“Р В»РЎвЂ“"),
        "category": _normalize_category(raw_category),
        "difficulty": _clean_text(item.get("difficulty") or item.get("РЎРѓР С”Р В»Р В°Р Т‘Р Р…РЎвЂ“РЎРѓРЎвЂљРЎРЉ")) or "medium",
        "explanation": _clean_text(item.get("explanation") or item.get("Р С—Р С•РЎРЏРЎРѓР Р…Р ВµР Р…Р Р…РЎРЏ")),
        "question_text": _clean_text(item.get("question_text") or item.get("РЎвЂљР ВµР С”РЎРѓРЎвЂљ_Р С—Р С‘РЎвЂљР В°Р Р…Р Р…РЎРЏ")),
        "options": options,
        "correct_ans": int(correct_ans or 0),
        "images": [str(image) for image in images if str(image).strip()],
        "page": item.get("page") or item.get("РЎРѓРЎвЂљР С•РЎР‚РЎвЂ“Р Р…Р С”Р В°"),
    }


ACHIEVEMENTS_DEF = [
    ("first_step", 1, "РџРµСЂС€РёР№ РІРёС—Р·Рґ", "РџСЂРѕР№С‚Рё РїРµСЂС€РёР№ С‚РµСЃС‚", "tests", 1),
    ("rookie", 2, "РќРѕРІР°С‡РѕРє", "РџСЂРѕР№С‚Рё 10 С‚РµСЃС‚С–РІ", "tests", 10),
    ("driver", 3, "Р’РѕРґС–Р№", "РџСЂРѕР№С‚Рё 50 С‚РµСЃС‚С–РІ", "tests", 50),
    ("pro_driver", 4, "РџСЂРѕС„С–", "РџСЂРѕР№С‚Рё 100 С‚РµСЃС‚С–РІ", "tests", 100),
    ("veteran_driver", 4, "Р”РѕСЃРІС–РґС‡РµРЅРёР№ РІРѕРґС–Р№", "РџСЂРѕР№С‚Рё 250 С‚РµСЃС‚С–РІ", "tests", 250),
    ("hundred", 1, "РЎРѕС‚РЅСЏ", "100 РїСЂР°РІРёР»СЊРЅРёС… РІС–РґРїРѕРІС–РґРµР№", "correct", 100),
    ("five_hundred", 2, "Рџ'СЏС‚РёСЃРѕС‚РЅСЏ", "500 РїСЂР°РІРёР»СЊРЅРёС… РІС–РґРїРѕРІС–РґРµР№", "correct", 500),
    ("thousand", 3, "РўРёСЃСЏС‡РЅРёРє", "1000 РїСЂР°РІРёР»СЊРЅРёС… РІС–РґРїРѕРІС–РґРµР№", "correct", 1000),
    ("legend", 4, "Р›РµРіРµРЅРґР°", "5000 РїСЂР°РІРёР»СЊРЅРёС… РІС–РґРїРѕРІС–РґРµР№", "correct", 5000),
    ("streak_3", 1, "Р РѕР·С–РіСЂС–РІ", "3 РґРЅС– РїС–РґСЂСЏРґ", "streak", 3),
    ("streak_7", 2, "РўРµРјРї", "7 РґРЅС–РІ РїС–РґСЂСЏРґ", "streak", 7),
    ("streak_28", 3, "Р’РѕРіРѕРЅСЊ", "28 РґРЅС–РІ РїС–РґСЂСЏРґ", "streak", 28),
    ("streak_90", 4, "РЎС‚Р°Р±С–Р»СЊРЅРёР№ С‚РµРјРї", "90 РґРЅС–РІ Р°РєС‚РёРІРЅРѕСЃС‚С– РїС–РґСЂСЏРґ", "streak", 90),
    ("marathon_10", 1, "Р‘С–РіСѓРЅ", "10 Сѓ РјР°СЂР°С„РѕРЅС–", "marathon", 10),
    ("marathon_50", 2, "РЎРїСЂРёРЅС‚РµСЂ", "50 Сѓ РјР°СЂР°С„РѕРЅС–", "marathon", 50),
    ("marathon_100", 3, "Р‘Р»РёСЃРєР°РІРєР°", "100 Сѓ РјР°СЂР°С„РѕРЅС–", "marathon", 100),
    ("perfect_1", 1, "Р‘РµР· РїРѕРјРёР»РѕРє", "РџРµСЂС€РёР№ С–РґРµР°Р»СЊРЅРёР№ С‚РµСЃС‚", "perfect", 1),
    ("perfect_5", 2, "Р’С–РґРјС–РЅРЅРёРє", "5 С–РґРµР°Р»СЊРЅРёС… С‚РµСЃС‚С–РІ", "perfect", 5),
    ("perfect_20", 3, "Р§РёСЃС‚Р° СЃРµСЂС–СЏ", "20 С‚РµСЃС‚С–РІ Р±РµР· РїРѕРјРёР»РѕРє", "perfect", 20),
    ("exam_passed", 2, "Р†СЃРїРёС‚ СЃРєР»Р°РґРµРЅРѕ", "РЎРєР»Р°СЃС‚Рё РїРµСЂС€РёР№ С–СЃРїРёС‚ РњР’РЎ Р°Р±Рѕ Р±С–Р»РµС‚", "exam", 1),
    ("exam_5", 3, "РЎС‚Р°Р±С–Р»СЊРЅРёР№ С–СЃРїРёС‚", "РЎРєР»Р°СЃС‚Рё 5 С–СЃРїРёС‚С–РІ РњР’РЎ Р°Р±Рѕ Р±С–Р»РµС‚С–РІ", "exam", 5),
    ("exam_10", 3, "Р”РµСЃСЏС‚РєР° С–СЃРїРёС‚С–РІ", "РЎРєР»Р°СЃС‚Рё 10 С–СЃРїРёС‚С–РІ РњР’РЎ Р°Р±Рѕ Р±С–Р»РµС‚С–РІ", "exam", 10),
    ("exam_20", 4, "Р•РєР·Р°РјРµРЅР°С†С–Р№РЅРёР№ С‚РµРјРї", "РЎРєР»Р°СЃС‚Рё 20 С–СЃРїРёС‚С–РІ РњР’РЎ Р°Р±Рѕ Р±С–Р»РµС‚С–РІ", "exam", 20),
    ("exam_50", 4, "Р“РѕС‚РѕРІРёР№ РґРѕ СЃРµСЂРІС–СЃРЅРѕРіРѕ С†РµРЅС‚СЂСѓ", "РЎРєР»Р°СЃС‚Рё 50 С–СЃРїРёС‚С–РІ РњР’РЎ Р°Р±Рѕ Р±С–Р»РµС‚С–РІ", "exam", 50),
    ("exam_perfect", 4, "Р†РґРµР°Р»СЊРЅРёР№ С–СЃРїРёС‚", "РЎРєР»Р°СЃС‚Рё С–СЃРїРёС‚ РњР’РЎ Р°Р±Рѕ Р±С–Р»РµС‚ Р±РµР· РїРѕРјРёР»РѕРє", "exam", 1),
    ("exam_perfect_5", 4, "Рџ'СЏС‚СЊ С‡РёСЃС‚РёС… С–СЃРїРёС‚С–РІ", "РЎРєР»Р°СЃС‚Рё 5 С–СЃРїРёС‚С–РІ Р°Р±Рѕ Р±С–Р»РµС‚С–РІ Р±РµР· РїРѕРјРёР»РѕРє", "exam", 5),
    ("exam_perfect_10", 4, "Р”РµСЃСЏС‚СЊ С‡РёСЃС‚РёС… С–СЃРїРёС‚С–РІ", "РЎРєР»Р°СЃС‚Рё 10 С–СЃРїРёС‚С–РІ Р°Р±Рѕ Р±С–Р»РµС‚С–РІ Р±РµР· РїРѕРјРёР»РѕРє", "exam", 10),
    ("accuracy_70", 1, "Р С–РІРЅР° С—Р·РґР°", "РўСЂРёРјР°С‚Рё Р·Р°РіР°Р»СЊРЅСѓ С‚РѕС‡РЅС–СЃС‚СЊ РІС–Рґ 70%", "accuracy", 70),
    ("accuracy_75", 1, "Р’РїРµРІРЅРµРЅР° Р±Р°Р·Р°", "РўСЂРёРјР°С‚Рё Р·Р°РіР°Р»СЊРЅСѓ С‚РѕС‡РЅС–СЃС‚СЊ РІС–Рґ 75%", "accuracy", 75),
    ("accuracy_80", 2, "Р’РїРµРІРЅРµРЅР° С‚РѕС‡РЅС–СЃС‚СЊ", "РўСЂРёРјР°С‚Рё Р·Р°РіР°Р»СЊРЅСѓ С‚РѕС‡РЅС–СЃС‚СЊ РІС–Рґ 80%", "accuracy", 80),
    ("accuracy_85", 2, "Р§С–С‚РєРёР№ РєРѕРЅС‚СЂРѕР»СЊ", "РўСЂРёРјР°С‚Рё Р·Р°РіР°Р»СЊРЅСѓ С‚РѕС‡РЅС–СЃС‚СЊ РІС–Рґ 85%", "accuracy", 85),
    ("accuracy_90", 3, "РўРѕС‡РЅРёР№ РјР°СЂС€СЂСѓС‚", "РўСЂРёРјР°С‚Рё Р·Р°РіР°Р»СЊРЅСѓ С‚РѕС‡РЅС–СЃС‚СЊ РІС–Рґ 90%", "accuracy", 90),
    ("accuracy_92", 3, "РњР°Р№Р¶Рµ Р±РµР· РїСЂРѕРјР°С…С–РІ", "РўСЂРёРјР°С‚Рё Р·Р°РіР°Р»СЊРЅСѓ С‚РѕС‡РЅС–СЃС‚СЊ РІС–Рґ 92%", "accuracy", 92),
    ("accuracy_95", 4, "Р®РІРµР»С–СЂРЅР° С‚РѕС‡РЅС–СЃС‚СЊ", "РўСЂРёРјР°С‚Рё Р·Р°РіР°Р»СЊРЅСѓ С‚РѕС‡РЅС–СЃС‚СЊ РІС–Рґ 95%", "accuracy", 95),
    ("accuracy_98", 4, "Р•С‚Р°Р»РѕРЅРЅР° С‚РѕС‡РЅС–СЃС‚СЊ", "РўСЂРёРјР°С‚Рё Р·Р°РіР°Р»СЊРЅСѓ С‚РѕС‡РЅС–СЃС‚СЊ РІС–Рґ 98%", "accuracy", 98),
    ("battle_first", 1, "РџРµСЂС€РёР№ Р±Р°С‚Р»", "Р—Р°РІРµСЂС€РёС‚Рё РїРµСЂС€РёР№ Р±Р°С‚Р»", "battle", 1),
    ("battle_3", 1, "РўСЂРё РІРёРєР»РёРєРё", "Р—Р°РІРµСЂС€РёС‚Рё 3 Р±Р°С‚Р»Рё", "battle", 3),
    ("battle_5", 2, "Р‘Р°С‚Р»-СЃРµСЂС–СЏ", "Р—Р°РІРµСЂС€РёС‚Рё 5 Р±Р°С‚Р»С–РІ", "battle", 5),
    ("battle_10", 2, "Р”РµСЃСЏС‚РєР° Р±Р°С‚Р»С–РІ", "Р—Р°РІРµСЂС€РёС‚Рё 10 Р±Р°С‚Р»С–РІ", "battle", 10),
    ("battle_20", 3, "РђСЂРµРЅР° РґРѕСЃРІС–РґСѓ", "Р—Р°РІРµСЂС€РёС‚Рё 20 Р±Р°С‚Р»С–РІ", "battle", 20),
    ("battle_50", 4, "Р’РµС‚РµСЂР°РЅ Р±Р°С‚Р»С–РІ", "Р—Р°РІРµСЂС€РёС‚Рё 50 Р±Р°С‚Р»С–РІ", "battle", 50),
    ("battle_winner", 2, "РџРµСЂРµРјРѕРіР° РІ Р±Р°С‚Р»С–", "Р’РёРіСЂР°С‚Рё РїРµСЂС€РёР№ Р±Р°С‚Р»", "battle_wins", 1),
    ("battle_wins_3", 2, "РўСЂРё РїРµСЂРµРјРѕРіРё", "Р’РёРіСЂР°С‚Рё 3 Р±Р°С‚Р»Рё", "battle_wins", 3),
    ("battle_wins_5", 3, "Рџ'СЏС‚СЊ РїРµСЂРµРјРѕРі", "Р’РёРіСЂР°С‚Рё 5 Р±Р°С‚Р»С–РІ", "battle_wins", 5),
    ("battle_champion", 3, "Р§РµРјРїС–РѕРЅ Р±Р°С‚Р»С–РІ", "Р’РёРіСЂР°С‚Рё 10 Р±Р°С‚Р»С–РІ", "battle_wins", 10),
    ("battle_wins_15", 4, "РЎРµСЂС–СЏ РїРµСЂРµРјРѕР¶С†СЏ", "Р’РёРіСЂР°С‚Рё 15 Р±Р°С‚Р»С–РІ", "battle_wins", 15),
    ("battle_wins_25", 4, "Р›С–РґРµСЂ Р±Р°С‚Р»С–РІ", "Р’РёРіСЂР°С‚Рё 25 Р±Р°С‚Р»С–РІ", "battle_wins", 25),
    ("battle_wins_50", 4, "Р›РµРіРµРЅРґР° РґСѓРµР»РµР№", "Р’РёРіСЂР°С‚Рё 50 Р±Р°С‚Р»С–РІ", "battle_wins", 50),
]


def _check_achievements(conn: psycopg.Connection, user_id: int) -> list[dict[str, Any]]:
    return check_achievements_use_case(conn, user_id, ACHIEVEMENTS_DEF)


@app.get("/")
def root():
    if IS_PRODUCTION and FRONTEND_DIST_DIR.exists():
        return FileResponse(FRONTEND_DIST_DIR / "index.html")
    return {"status": "ok", "version": "3.0.0"}


@app.post("/auth/register", response_model=AuthMessageResponse)
def register(req: RegisterRequest):
    try:
        return register_user_use_case(req, hash_password=hash_password)
    except ServiceError as exc:
        raise HTTPException(exc.status_code, exc.message) from exc


@app.post("/auth/verify-email", response_model=AuthTokenResponse)
def verify_email(req: VerifyEmailRequest):
    try:
        return verify_email_use_case(req, create_token=create_token, present_user=_user_public)
    except ServiceError as exc:
        raise HTTPException(exc.status_code, exc.message) from exc


@app.post("/auth/login", response_model=AuthTokenResponse)
def login(req: LoginRequest):
    try:
        return login_user_use_case(
            req,
            check_password=check_password,
            create_token=create_token,
            present_user=_user_public,
            is_admin_email=_is_admin_email,
        )
    except ServiceError as exc:
        raise HTTPException(exc.status_code, exc.message) from exc


@app.post("/auth/resend-verification", response_model=AuthMessageResponse)
def resend_verification(req: ResendVerificationRequest):
    try:
        return resend_verification_code_use_case(req)
    except ServiceError as exc:
        raise HTTPException(exc.status_code, exc.message) from exc


@app.post("/auth/forgot-password", response_model=AuthMessageResponse)
def forgot_password(req: ForgotPasswordRequest):
    try:
        return request_password_reset_use_case(req)
    except ServiceError as exc:
        raise HTTPException(exc.status_code, exc.message) from exc


@app.post("/auth/reset-password", response_model=AuthMessageResponse)
def reset_password(req: ResetPasswordRequest):
    try:
        return reset_password_use_case(req, hash_password=hash_password)
    except ServiceError as exc:
        raise HTTPException(exc.status_code, exc.message) from exc


@app.get("/auth/me")
def auth_me(user=Depends(get_current_user)):
    return _user_public(user)


@app.post("/access/limits/check")
@app.post("/api/access/limits/check", include_in_schema=False)
def check_access_limit(
    req: AccessLimitRequest,
    request: Request,
    guest_id: Optional[str] = Header(default=None, alias="X-DrivePrep-Guest-Id"),
    user=Depends(get_optional_user),
):
    return check_access_limit_use_case(
        action=req.action,
        user=user,
        guest_id=guest_id,
        ip_address=get_client_ip(request),
    )


@app.post("/access/limits/consume")
@app.post("/api/access/limits/consume", include_in_schema=False)
def consume_access_limit(
    req: AccessLimitRequest,
    request: Request,
    guest_id: Optional[str] = Header(default=None, alias="X-DrivePrep-Guest-Id"),
    user=Depends(get_optional_user),
):
    return consume_access_limit_use_case(
        action=req.action,
        user=user,
        guest_id=guest_id,
        ip_address=get_client_ip(request),
    )


@app.post("/admin/auth/login")
@app.post("/api/admin/auth/login", include_in_schema=False)
def admin_login(req: AdminLoginRequest):
    if not _is_admin_password_configured():
        raise HTTPException(503, "Адмін-пароль не налаштовано. Додайте ADMIN_PASSWORD або ADMIN_PASSWORD_HASH у змінні середовища.")
    if not _check_admin_credentials(req.username, req.password):
        raise HTTPException(401, "Невірний нік або пароль адміністратора")
    token = create_admin_token(ADMIN_USERNAME, remember_me=req.remember_me)
    return {"token": token, "admin": _admin_public()}


@app.get("/admin/auth/me")
@app.get("/api/admin/auth/me", include_in_schema=False)
def admin_me(admin=Depends(require_admin)):
    if admin.get("admin_session"):
        return admin
    return {
        **_user_public(admin),
        "admin_session": False,
    }


def _ensure_admin_media_table(conn) -> None:
    conn.execute(
        """
        CREATE TABLE IF NOT EXISTS admin_media_files (
            id BIGSERIAL PRIMARY KEY,
            scope TEXT NOT NULL DEFAULT 'general',
            filename TEXT NOT NULL,
            content_type TEXT NOT NULL DEFAULT 'application/octet-stream',
            file_size INT NOT NULL DEFAULT 0,
            data BYTEA NOT NULL,
            uploaded_by TEXT,
            created_at TIMESTAMP NOT NULL DEFAULT NOW()
        )
        """
    )
    conn.execute("CREATE INDEX IF NOT EXISTS idx_admin_media_files_scope ON admin_media_files(scope)")


def _save_admin_media_upload(file: UploadFile, *, scope: str, admin: Optional[dict[str, Any]] = None) -> dict[str, str]:
    allowed_exts = {".jpg", ".jpeg", ".png", ".webp", ".gif", ".bmp", ".svg"}
    ext = Path(file.filename or "").suffix.lower()
    content_type = (file.content_type or "").lower()
    looks_like_image = content_type.startswith("image/") or ext in allowed_exts
    if not looks_like_image or ext not in allowed_exts:
        raise HTTPException(400, "Оберіть зображення у форматі PNG, JPG, WEBP, GIF, BMP або SVG.")

    safe_scope = re.sub(r"[^a-z0-9_-]+", "-", str(scope or "general").lower()).strip("-") or "general"
    filename = f"{datetime.utcnow().strftime('%Y%m%d%H%M%S')}_{uuid4().hex[:10]}{ext}"
    content = file.file.read()
    if not content:
        raise HTTPException(400, "Файл порожній. Оберіть інше зображення.")
    max_size = 8 * 1024 * 1024
    if len(content) > max_size:
        raise HTTPException(400, "Зображення завелике. Максимальний розмір — 8 МБ.")

    try:
        with db() as conn:
            _ensure_admin_media_table(conn)
            row = conn.execute(
                """
                INSERT INTO admin_media_files (scope, filename, content_type, file_size, data, uploaded_by)
                VALUES (%s, %s, %s, %s, %s, %s)
                RETURNING id
                """,
                (
                    safe_scope,
                    filename,
                    content_type or "application/octet-stream",
                    len(content),
                    content,
                    admin.get("username") or admin.get("email") if isinstance(admin, dict) else None,
                ),
            ).fetchone()
            conn.commit()
    except Exception as exc:
        print(f"[ADMIN MEDIA ERROR] failed to save upload in database: {type(exc).__name__}: {exc}", flush=True)
        raise HTTPException(500, "Не вдалося зберегти зображення в базі даних.") from exc

    saved_id = int(row["id"])
    url = f"/media/admin/{saved_id}/{filename}"
    return {"url": url, "filename": filename}


@app.get("/media/admin/{media_id}/{filename}")
@app.get("/api/media/admin/{media_id}/{filename}", include_in_schema=False)
def get_admin_media(media_id: int, filename: str):
    with db() as conn:
        _ensure_admin_media_table(conn)
        row = conn.execute(
            """
            SELECT filename, content_type, data
            FROM admin_media_files
            WHERE id = %s
            """,
            (media_id,),
        ).fetchone()
    if not row:
        raise HTTPException(404, "Зображення не знайдено")
    return Response(
        content=row["data"],
        media_type=row["content_type"] or "application/octet-stream",
        headers={
            "Cache-Control": "public, max-age=31536000, immutable",
            "Content-Disposition": f'inline; filename="{row["filename"] or filename}"',
        },
    )


@app.post("/admin/media/upload")
@app.post("/api/admin/media/upload", include_in_schema=False)
def admin_upload_media(
    file: UploadFile = File(...),
    scope: str = Form(default="general"),
    section_id: Optional[int] = Form(default=None),
    admin=Depends(require_admin),
):
    saved = _save_admin_media_upload(file, scope=scope, admin=admin)
    if section_id and str(scope).startswith("theory"):
        with db() as conn:
            row = conn.execute("SELECT COALESCE(MAX(sort_order), 0) + 1 AS next_order FROM theory_assets WHERE section_id = %s", (section_id,)).fetchone()
            sort_order = int(row["next_order"] or 1)
            conn.execute(
                """
                INSERT INTO theory_assets (section_id, asset_type, asset_url, caption, sort_order)
                VALUES (%s, 'image', %s, '', %s)
                """,
                (section_id, saved["url"], sort_order),
            )
            conn.commit()
    return {"url": saved["url"], "filename": saved["filename"]}


@app.get("/promo/status")
@app.get("/api/promo/status", include_in_schema=False)
def get_promo_status():
    return _compute_promo_status()


@app.patch("/admin/promo/config")
@app.patch("/api/admin/promo/config", include_in_schema=False)
def update_promo_config(req: PromoConfigRequest, admin=Depends(require_promo_admin)):
    settings = _load_promo_settings()
    if req.duration_days is not None:
        settings["duration_days"] = max(1, int(req.duration_days))
    if req.never_ends is not None:
        settings["never_ends"] = bool(req.never_ends)
    if req.promo_prices is not None:
        settings["promo_prices"] = _normalize_price_map(req.promo_prices, settings["promo_prices"])
    if req.regular_prices is not None:
        settings["regular_prices"] = _normalize_price_map(req.regular_prices, settings["regular_prices"])
    _save_promo_settings(settings)
    return {
        "message": "РќР°Р»Р°С€С‚СѓРІР°РЅРЅСЏ Р°РєС†С–С— Р·Р±РµСЂРµР¶РµРЅРѕ",
        "status": _compute_promo_status(settings, persist=False),
    }


@app.post("/admin/promo/start")
@app.post("/api/admin/promo/start", include_in_schema=False)
def start_promo(req: PromoConfigRequest, admin=Depends(require_promo_admin)):
    settings = _load_promo_settings()
    if req.duration_days is not None:
        settings["duration_days"] = max(1, int(req.duration_days))
    if req.never_ends is not None:
        settings["never_ends"] = bool(req.never_ends)
    if req.promo_prices is not None:
        settings["promo_prices"] = _normalize_price_map(req.promo_prices, settings["promo_prices"])
    if req.regular_prices is not None:
        settings["regular_prices"] = _normalize_price_map(req.regular_prices, settings["regular_prices"])
    settings["is_active"] = True
    settings["started_at"] = datetime.utcnow().isoformat()
    _save_promo_settings(settings)
    return {
        "message": "РђРєС†С–СЋ Р·Р°РїСѓС‰РµРЅРѕ Р±РµР· РґР°С‚Рё Р·Р°РІРµСЂС€РµРЅРЅСЏ" if settings.get("never_ends") else f"РђРєС†С–СЋ Р·Р°РїСѓС‰РµРЅРѕ РЅР° {settings['duration_days']} РґРЅС–РІ",
        "status": _compute_promo_status(settings, persist=False),
    }


@app.post("/admin/promo/stop")
@app.post("/api/admin/promo/stop", include_in_schema=False)
def stop_promo(admin=Depends(require_promo_admin)):
    settings = _load_promo_settings()
    settings["is_active"] = False
    settings["started_at"] = None
    settings["never_ends"] = False
    _save_promo_settings(settings)
    return {
        "message": "РђРєС†С–СЋ Р·СѓРїРёРЅРµРЅРѕ",
        "status": _compute_promo_status(settings, persist=False),
    }


@app.get("/premium/features")
@app.get("/api/premium/features", include_in_schema=False)
def get_premium_features():
    return [feature for feature in _load_premium_features() if feature.get("is_enabled")]


@app.get("/admin/premium/features")
@app.get("/api/admin/premium/features", include_in_schema=False)
def admin_premium_features(admin=Depends(require_admin)):
    return _load_premium_features()


@app.patch("/admin/premium/features")
@app.patch("/api/admin/premium/features", include_in_schema=False)
def admin_update_premium_features(req: PremiumFeaturesUpdateRequest, admin=Depends(require_admin)):
    features = _normalize_premium_features(req.features)
    _save_premium_features(features)
    return {"message": "Premium-С„С–С‡С– РѕРЅРѕРІР»РµРЅРѕ", "features": features}


@app.get("/admin/premium/orders")
@app.get("/api/admin/premium/orders", include_in_schema=False)
def admin_premium_orders(limit: int = Query(default=60, ge=1, le=200), admin=Depends(require_admin)):
    return list_admin_premium_orders_use_case(limit=limit)


@app.post("/payment/checkout")
def create_premium_checkout(req: PremiumCheckoutRequest, user=Depends(get_current_user)):
    try:
        return create_premium_checkout_use_case(
            req,
            user,
            get_plan=_get_premium_plan,
            build_liqpay_payload=_build_liqpay_payload,
            encode_liqpay_payload=_encode_liqpay_payload,
            dump_json=_json_dumps,
        )
    except ServiceError as exc:
        raise HTTPException(exc.status_code, exc.message) from exc


@app.get("/payment/status/{order_id}")
def get_payment_status(order_id: str, user=Depends(get_current_user)):
    try:
        return get_payment_status_use_case(order_id, user)
    except ServiceError as exc:
        raise HTTPException(exc.status_code, exc.message) from exc


@app.post("/payment/mock/activate/{order_id}")
def activate_mock_payment(order_id: str, user=Depends(get_current_user)):
    try:
        return activate_mock_payment_use_case(
            order_id,
            user,
            get_plan=_get_premium_plan,
            present_user=_user_public,
        )
    except ServiceError as exc:
        raise HTTPException(exc.status_code, exc.message) from exc


@app.post("/payment/liqpay-callback")
def handle_liqpay_callback(data: str = Form(...), signature: str = Form(...)):
    try:
        return handle_liqpay_callback_use_case(
            data,
            signature,
            verify_signature=_verify_liqpay_signature,
            decode_payload=_decode_liqpay_data,
            dump_json=_json_dumps,
            get_plan=_get_premium_plan,
        )
    except ServiceError as exc:
        raise HTTPException(exc.status_code, exc.message) from exc


@app.patch("/users/me")
def update_profile(req: UpdateProfileRequest, user=Depends(get_current_user)):
    try:
        return update_profile_use_case(req, user, present_user=_user_public)
    except ServiceError as exc:
        raise HTTPException(exc.status_code, exc.message) from exc


def ensure_theory_seed_data() -> None:
    ensure_theory_seed_data_use_case(category_fallbacks=THEORY_CATEGORY_FALLBACKS)


def _canonical_theory_topic(topic_key: Any, category: Any, source_url: Any) -> str | None:
    raw_topic = _clean_text(topic_key)
    if raw_topic in THEORY_SOURCE_MAP:
        return raw_topic

    raw_category = _clean_text(category)
    if raw_category in THEORY_SOURCE_MAP:
        return raw_category
    if raw_category == "signs":
        return "road-signs"
    if raw_category == "markings":
        return "road-markings"
    if raw_category in {"lectures", "video-lectures", "videos"}:
        return "video-lectures"

    url = str(source_url or "")
    for candidate in THEORY_SOURCE_MAP:
        if f"/theory/{candidate}" in url:
            return candidate
    return None


def _plain_to_html(text: str) -> str:
    cleaned = _sanitize_handbook_text(text)
    if not cleaned:
        return ""
    parts = [part.strip() for part in re.split(r"(?<=[.!?])\s+", cleaned) if part.strip()]
    if not parts:
        return ""
    return "".join(f"<p>{html_escape(part)}</p>" for part in parts[:2])


def _extract_handbook_description(row: dict[str, Any]) -> str:
    for candidate in [_sanitize_handbook_text(row.get("content_text")), _sanitize_handbook_text(row.get("section_title"))]:
        if not candidate:
            continue
        if len(candidate) <= 280:
            return candidate
        shortened = candidate[:277].rstrip(" ,.;:")
        return f"{shortened}..."
    return ""


def _extract_handbook_comment_html(row: dict[str, Any]) -> str:
    raw_comment = str(row.get("comment_html") or "").strip()
    if raw_comment:
        return raw_comment
    plain = _sanitize_handbook_text(row.get("content_text"))
    return _plain_to_html(plain)


def _extract_handbook_video_url(row: dict[str, Any]) -> str | None:
    value = str(row.get("video_url") or "").strip()
    return value or None


def _extract_handbook_embed_url(row: dict[str, Any]) -> str | None:
    value = str(row.get("embed_url") or "").strip()
    return value or None


def sync_theory_data() -> None:
    sync_theory_data_use_case(
        category_fallbacks=THEORY_CATEGORY_FALLBACKS,
        multi_topic_category_slugs=MULTI_TOPIC_CATEGORY_SLUGS,
        theory_source_map=THEORY_SOURCE_MAP,
        clean_text=_clean_text,
        sanitize_text=_sanitize_handbook_text,
        sanitize_html=_sanitize_handbook_html,
        coerce_json_list=_coerce_json_list,
        resolve_topic=_canonical_theory_topic,
        extract_description=_extract_handbook_description,
        extract_comment_html=_extract_handbook_comment_html,
        extract_video_url=_extract_handbook_video_url,
        extract_embed_url=_extract_handbook_embed_url,
    )


def ensure_question_metadata() -> None:
    ensure_question_metadata_use_case(
        clean_text=_clean_text,
        plain_to_html=_plain_to_html,
    )


@app.post("/users/me/avatar")
def upload_avatar(file: UploadFile = File(...), user=Depends(get_current_user)):
    ext = Path(file.filename or "avatar.png").suffix.lower() or ".png"
    allowed_exts = {".png", ".jpg", ".jpeg", ".webp", ".gif", ".bmp"}
    content_type = (file.content_type or "").lower()
    looks_like_image = content_type.startswith("image/") or ext in allowed_exts
    if not looks_like_image:
        raise HTTPException(400, "Можна завантажити тільки зображення")

    if ext not in allowed_exts:
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
    return update_avatar_use_case(user, avatar_url, present_user=_user_public)


@app.delete("/users/me/avatar")
def delete_avatar(user=Depends(get_current_user)):
    for old_file in UPLOAD_DIR.glob(f"user_{user['id']}_*"):
        try:
            old_file.unlink()
        except OSError:
            pass
    return clear_avatar_use_case(user, present_user=_user_public)


@app.get("/users/{user_id}/profile")
def get_user_profile(user_id: int, viewer=Depends(get_optional_user)):
    try:
        return get_public_profile_by_id_use_case(
            user_id,
            viewer=viewer,
            present_user=_user_public,
            is_admin_email=_is_admin_email,
        )
    except ServiceError as exc:
        raise HTTPException(exc.status_code, exc.message) from exc


@app.get("/users/by-username/{username}/profile")
def get_user_profile_by_username(username: str, viewer=Depends(get_optional_user)):
    try:
        return get_public_profile_by_username_use_case(
            username,
            viewer=viewer,
            present_user=_user_public,
            is_admin_email=_is_admin_email,
        )
    except ServiceError as exc:
        raise HTTPException(exc.status_code, exc.message) from exc


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
    return list_questions_use_case(
        section=section,
        category=category,
        topic=topic,
        limit=limit,
        offset=offset,
        search=search,
        ids=ids,
    )


@app.get("/questions/random")
def get_random_questions(
    count: int = Query(default=20, ge=1, le=200),
    section: Optional[str] = None,
    category: Optional[str] = None,
    topic: Optional[str] = None,
    difficulty: Optional[str] = None,
    exclude_ids: str = "",
    difficult_only: bool = False,
    seed: Optional[str] = None,
    user=Depends(get_optional_user),
):
    return random_questions_use_case(
        count=count,
        section=section,
        category=category,
        topic=topic,
        difficulty=difficulty,
        exclude_ids=exclude_ids,
        difficult_only=difficult_only,
        seed=seed,
        user=user,
    )


@app.get("/questions/mvs-exam", response_model=MvsExamResponse)
def get_mvs_exam_questions(
    category: Optional[str] = "B",
    seed: Optional[str] = None,
):
    return build_mvs_exam_session(category, seed=seed)


@app.get("/questions/{question_id}")
def get_question(question_id: int):
    try:
        return get_question_use_case(question_id)
    except ServiceError as exc:
        raise HTTPException(exc.status_code, exc.message) from exc


@app.get("/sections")
def get_sections(category: Optional[str] = None):
    return list_sections_use_case(category=category)


@app.post("/questions/import")
def import_questions(payload: list[dict[str, Any]], user=Depends(get_optional_user)):
    try:
        return import_questions_use_case(payload, user, prepare_question=_prepare_import_question)
    except ServiceError as exc:
        raise HTTPException(exc.status_code, exc.message) from exc


@app.post("/questions/import-bundled")
def import_bundled_questions(user=Depends(get_optional_user)):
    if not DEFAULT_IMPORT_FILE.exists():
        raise HTTPException(404, f"Р¤Р°Р№Р» РЅРµ Р·РЅР°Р№РґРµРЅРѕ: {DEFAULT_IMPORT_FILE.name}")
    payload = json.loads(DEFAULT_IMPORT_FILE.read_text(encoding="utf-8"))
    questions = payload if isinstance(payload, list) else payload.get("questions", [])
    if not isinstance(questions, list):
        raise HTTPException(400, "РќРµРІР°Р»С–РґРЅРёР№ С„РѕСЂРјР°С‚ bundled JSON")
    return import_questions(questions, user)


@app.post("/progress/test-result", response_model=TestResultResponse)
def submit_test_result(data: TestResultSubmit, user=Depends(get_current_user)):
    return submit_test_result_use_case(
        data,
        user,
        check_achievements=_check_achievements,
        available_stars=_available_stars,
    )


@app.post("/progress/marathon-score")
def submit_marathon(data: MarathonScoreSubmit, user=Depends(get_current_user)):
    return submit_marathon_score_use_case(data, user, check_achievements=_check_achievements)


@app.post("/progress/streak-restore")
def restore_streak(user=Depends(get_current_user)):
    try:
        return restore_streak_use_case(user)
    except ServiceError as exc:
        raise HTTPException(exc.status_code, exc.message) from exc


@app.get("/progress/results", response_model=list[ProgressResultResponse])
def get_progress_results(user=Depends(get_current_user)):
    return list_progress_results_use_case(user)


@app.get("/progress/stats", response_model=ProgressStatsResponse)
def get_progress_stats(user=Depends(get_current_user)):
    try:
        return get_progress_stats_use_case(
            user,
            present_user=_user_public,
            resolve_streak=_streak_snapshot,
            available_stars=_available_stars,
            build_frame_shop=_frame_shop_payload,
            section_order_sql=_section_order_sql,
        )
    except Exception as exc:
        print(f"[PROGRESS STATS ERROR] {type(exc).__name__}: {exc}", flush=True)
        raise


@app.get("/achievements")
def get_achievements(user=Depends(get_optional_user)):
    return list_achievement_progress_use_case(ACHIEVEMENTS_DEF, user)


@app.get("/leaderboard")
def leaderboard():
    return list_leaderboard_use_case(excluded_emails=ADMIN_EMAILS)


@app.get("/theory/categories")
def get_theory_categories_endpoint():
    return list_theory_category_payloads_use_case()


@app.get("/theory/topics")
def get_theory_topics_endpoint(category: str = Query(..., min_length=1)):
    return list_theory_topic_payloads_use_case(category)


@app.get("/theory/sections")
def get_theory_sections_endpoint(topic: str = Query(..., min_length=1)):
    return list_theory_section_payloads_use_case(
        topic,
        sanitize_text=_sanitize_handbook_text,
        extract_description=_extract_handbook_description,
    )


@app.get("/theory/sections/{section_id}")
def get_theory_section_endpoint(section_id: int):
    try:
        return get_theory_section_payload_use_case(
            section_id,
            sanitize_text=_sanitize_handbook_text,
            sanitize_html=_sanitize_handbook_html,
            extract_description=_extract_handbook_description,
            extract_comment_html=_extract_handbook_comment_html,
            extract_video_url=_extract_handbook_video_url,
            extract_embed_url=_extract_handbook_embed_url,
            resolve_topic=_canonical_theory_topic,
        )
    except ServiceError as exc:
        raise HTTPException(exc.status_code, exc.message) from exc


@app.get("/tickets")
def get_tickets(category: Optional[str] = None):
    return list_tickets_use_case(
        category=category,
        normalize_category=_normalize_category,
        mvs_ticket_count=MVS_TICKET_COUNT,
    )


@app.get("/tickets/{ticket_number}")
def get_ticket(ticket_number: int, category: Optional[str] = None):
    try:
        return get_ticket_use_case(
            ticket_number=ticket_number,
            category=category,
            normalize_category=_normalize_category,
            mvs_ticket_count=MVS_TICKET_COUNT,
            build_mvs_questions=build_mvs_exam_questions_use_case,
            sanitize_question=_sanitize_question_row,
        )
    except ServiceError as exc:
        raise HTTPException(exc.status_code, exc.message) from exc


@app.get("/handbook/topics")
def get_handbook_topics():
    return list_handbook_topics_use_case(handbook_topics=HANDBOOK_TOPICS)


@app.get("/handbook/entries")
def get_handbook_entries(topic: str = Query(..., min_length=1)):
    return list_handbook_entries_use_case(
        topic=topic,
        topic_category_map=HANDBOOK_TOPIC_CATEGORY_MAP,
        sanitize_text=_sanitize_handbook_text,
    )


@app.get("/handbook/entries/{entry_id}")
def get_handbook_entry(entry_id: int):
    try:
        return get_handbook_entry_use_case(
            entry_id,
            sanitize_text=_sanitize_handbook_text,
            sanitize_html=_sanitize_handbook_html,
        )
    except ServiceError as exc:
        raise HTTPException(exc.status_code, exc.message) from exc


@app.get("/handbook/search")
def search_handbook(q: str = Query(..., min_length=2), topic: Optional[str] = None):
    return search_handbook_entries_use_case(
        query=q,
        topic=topic,
        topic_category_map=HANDBOOK_TOPIC_CATEGORY_MAP,
        sanitize_text=_sanitize_handbook_text,
    )


@app.get("/friends")
def get_friends(user=Depends(get_current_user)):
    return list_friends_use_case(user)


@app.post("/friends/invite")
async def invite_friend(req: FriendInviteRequest, user=Depends(get_current_user)):
    try:
        result = invite_friend_use_case(req, user, resolve_social_user=_resolve_social_user_by_handle)
    except ServiceError as exc:
        raise HTTPException(exc.status_code, exc.message) from exc

    event = result.get("event", "friends_updated")
    event_payload = result.get("event_payload", {})
    for email in result.get("emit", []):
        await realtime_hub.emit(email, event, event_payload)
    return result["payload"]


@app.post("/friends/{friendship_id}/accept")
async def accept_friend(friendship_id: int, user=Depends(get_current_user)):
    try:
        result = accept_friend_use_case(friendship_id, user)
    except ServiceError as exc:
        raise HTTPException(exc.status_code, exc.message) from exc
    for email in result.get("emit", []):
        await realtime_hub.emit(email, "friends_updated", {})
    return result["payload"]


@app.delete("/friends/{friendship_id}")
def remove_friend(friendship_id: int, user=Depends(get_current_user)):
    try:
        return remove_friend_use_case(friendship_id, user)
    except ServiceError as exc:
        raise HTTPException(exc.status_code, exc.message) from exc


@app.get("/messages")
def get_messages(partner_email: Optional[str] = None, user=Depends(get_current_user)):
    try:
        return list_messages_use_case(
            partner_email=partner_email,
            user=user,
            resolve_social_user=_resolve_social_user_by_handle,
        )
    except ServiceError as exc:
        raise HTTPException(exc.status_code, exc.message) from exc


@app.post("/messages")
async def send_message(req: MessageCreateRequest, user=Depends(get_current_user)):
    try:
        sent = send_message_use_case(
            req,
            user,
            resolve_social_user=_resolve_social_user_by_handle,
        )
    except ServiceError as exc:
        raise HTTPException(exc.status_code, exc.message) from exc
    await realtime_hub.emit(sent.recipient_email, "friend_message", {"from_email": user["email"]})
    await realtime_hub.emit(user["email"], "friend_message", {"from_email": user["email"]})
    return sent.payload


@app.get("/support/messages")
def get_support_messages(user=Depends(get_current_user)):
    return list_user_support_messages_use_case(user)


@app.post("/support/messages")
async def send_support_message(req: SupportMessageCreateRequest, user=Depends(get_current_user)):
    try:
        sent = send_user_support_message_use_case(req, user)
    except ServiceError as exc:
        raise HTTPException(exc.status_code, exc.message) from exc
    await realtime_hub.emit(SUPPORT_EMAIL, "support_message", {"from_email": user["email"]})
    await realtime_hub.emit(user["email"], "support_message", {"from_email": user["email"]})
    return sent.payload


@app.get("/notifications/summary")
def get_notifications_summary(user=Depends(get_current_user)):
    return get_notifications_summary_use_case(user)


@app.get("/admin/support/conversations")
def admin_support_conversations(admin=Depends(require_admin)):
    return list_admin_support_conversations_use_case(present_user=_user_public)


@app.get("/admin/support/conversations/{user_id}")
def admin_support_thread(user_id: int, admin=Depends(require_admin)):
    try:
        return get_admin_support_thread_use_case(user_id, present_user=_user_public)
    except ServiceError as exc:
        raise HTTPException(exc.status_code, exc.message) from exc


@app.post("/admin/support/conversations/{user_id}")
async def admin_support_reply(user_id: int, req: AdminSupportReplyRequest, admin=Depends(require_admin)):
    try:
        reply = send_admin_support_reply_use_case(user_id, req)
    except ServiceError as exc:
        raise HTTPException(exc.status_code, exc.message) from exc
    await realtime_hub.emit(reply.target_email, "support_reply", {"from_email": SUPPORT_EMAIL})
    await realtime_hub.emit(SUPPORT_EMAIL, "support_reply", {"to_email": reply.target_email})
    return reply.payload


@app.get("/admin/users")
def admin_users(admin=Depends(require_admin)):
    return list_admin_users_use_case(
        present_user=_user_public,
        total_stars=_total_stars,
        available_stars=_available_stars,
    )


@app.get("/admin/users/{user_id}/audit")
def admin_user_audit(user_id: int, admin=Depends(require_admin)):
    try:
        return get_admin_user_audit_use_case(
            user_id,
            present_user=_user_public,
            total_stars=_total_stars,
            available_stars=_available_stars,
            coerce_json_list=_coerce_json_list,
            coerce_json_dict=_coerce_json_dict,
        )
    except ServiceError as exc:
        raise HTTPException(exc.status_code, exc.message) from exc


@app.patch("/admin/users/{user_id}")
def admin_update_user(user_id: int, req: AdminUserUpdateRequest, admin=Depends(require_admin)):
    try:
        return update_admin_user_use_case(
            user_id,
            req,
            present_user=_user_public,
            is_admin_email=_is_admin_email,
        )
    except ServiceError as exc:
        raise HTTPException(exc.status_code, exc.message) from exc


@app.delete("/admin/users/{user_id}")
def admin_delete_user(user_id: int, admin=Depends(require_admin)):
    try:
        return delete_admin_user_use_case(user_id, is_admin_email=_is_admin_email)
    except ServiceError as exc:
        raise HTTPException(exc.status_code, exc.message) from exc


@app.post("/admin/users/{user_id}/reset-password")
def admin_reset_user_password(user_id: int, admin=Depends(require_admin)):
    try:
        reset = create_admin_password_reset_use_case(user_id, code_factory=gen_code)
    except ServiceError as exc:
        raise HTTPException(exc.status_code, exc.message) from exc
    sent = send_email(
        reset["email"],
        "РЎРєРёРґР°РЅРЅСЏ РїР°СЂРѕР»СЏ PDRPrep",
        f"<p>РђРґРјС–РЅС–СЃС‚СЂР°С‚РѕСЂ РЅР°РґС–СЃР»Р°РІ РІС–РґРЅРѕРІР»РµРЅРЅСЏ РґРѕСЃС‚СѓРїСѓ. Р’Р°С€ РєРѕРґ: <b style='font-size:24px'>{reset['code']}</b></p>",
    )
    return email_delivery_response(sent, reset["code"], "Р›РёСЃС‚ РЅР° РІС–РґРЅРѕРІР»РµРЅРЅСЏ РїР°СЂРѕР»СЏ РЅР°РґС–СЃР»Р°РЅРѕ")


@app.post("/admin/users/{user_id}/achievements")
def admin_update_user_achievements(user_id: int, req: AdminAchievementUpdateRequest, admin=Depends(require_admin)):
    try:
        return update_admin_user_achievement_use_case(
            user_id,
            req,
            achievement_defs=ACHIEVEMENTS_DEF,
        )
    except ServiceError as exc:
        raise HTTPException(exc.status_code, exc.message) from exc


@app.get("/admin/questions")
def admin_search_questions(
    search: str = Query(default=""),
    section: str = Query(default=""),
    limit: int = Query(default=40, ge=1, le=1000),
    admin=Depends(require_admin),
):
    return search_admin_questions_use_case(
        search=search,
        section=section,
        limit=limit,
        present_question=_sanitize_question_row,
    )


@app.get("/admin/questions/sections")
def admin_question_sections(admin=Depends(require_admin)):
    return list_admin_question_sections_use_case()


@app.post("/admin/questions")
def admin_create_question(req: AdminQuestionCreateRequest, admin=Depends(require_admin)):
    try:
        return create_admin_question_use_case(
            req,
            clean_text=_clean_text,
            present_question=_sanitize_question_row,
        )
    except ServiceError as exc:
        raise HTTPException(exc.status_code, exc.message) from exc


@app.patch("/admin/questions/{question_id}")
def admin_update_question(question_id: int, req: AdminQuestionUpdateRequest, admin=Depends(require_admin)):
    try:
        return update_admin_question_use_case(
            question_id,
            req,
            clean_text=_clean_text,
            present_question=_sanitize_question_row,
        )
    except ServiceError as exc:
        raise HTTPException(exc.status_code, exc.message) from exc


@app.delete("/admin/questions/{question_id}")
def admin_delete_question(question_id: int, admin=Depends(require_admin)):
    try:
        return delete_admin_question_use_case(question_id)
    except ServiceError as exc:
        raise HTTPException(exc.status_code, exc.message) from exc


@app.get("/admin/theory/summary")
def admin_theory_summary(admin=Depends(require_admin)):
    return get_admin_theory_summary_use_case()


_theory_parse_lock = threading.Lock()
_theory_parse_process: subprocess.Popen | None = None


def _now_iso() -> str:
    return datetime.utcnow().isoformat(timespec="seconds") + "Z"


def _repair_mojibake(value: Any) -> Any:
    if not isinstance(value, str) or not any(marker in value for marker in ("Р", "С", "вЂ")):
        return value
    try:
        repaired = value.encode("cp1251").decode("utf-8")
        return repaired if repaired.count("�") <= value.count("�") else value
    except Exception:
        return value


def _write_theory_parse_status(payload: dict[str, Any]) -> dict[str, Any]:
    RUNTIME_DIR.mkdir(parents=True, exist_ok=True)
    current = _read_theory_parse_status(include_log=False)
    current.update(payload)
    THEORY_PARSE_STATUS_FILE.write_text(json.dumps(current, ensure_ascii=False), encoding="utf-8")
    return current


def _read_theory_parse_status(*, include_log: bool = True) -> dict[str, Any]:
    if THEORY_PARSE_STATUS_FILE.exists():
        try:
            status = json.loads(THEORY_PARSE_STATUS_FILE.read_text(encoding="utf-8"))
            if not isinstance(status, dict):
                status = {}
        except Exception:
            status = {}
    else:
        status = {"running": False, "message": "Парсинг ще не запускався"}
    if "message" in status:
        status["message"] = _repair_mojibake(status.get("message"))
    if include_log and THEORY_PARSE_LOG_FILE.exists():
        try:
            lines = THEORY_PARSE_LOG_FILE.read_text(encoding="utf-8", errors="replace").splitlines()
            status["log_tail"] = "\n".join(lines[-80:])
        except Exception:
            status["log_tail"] = ""
    return status


def _watch_theory_parse_process(process: subprocess.Popen) -> None:
    exit_code = process.wait()
    global _theory_parse_process
    with _theory_parse_lock:
      _theory_parse_process = None
    _write_theory_parse_status(
        {
            "running": False,
            "finished_at": _now_iso(),
            "exit_code": exit_code,
            "message": "Парсинг завершено" if exit_code == 0 else "Парсинг завершився з помилкою",
        }
    )


@app.post("/admin/theory/parse")
def admin_start_theory_parse(req: AdminTheoryParseRequest, admin=Depends(require_admin)):
    global _theory_parse_process
    with _theory_parse_lock:
        if _theory_parse_process and _theory_parse_process.poll() is None:
            status = _read_theory_parse_status()
            status["running"] = True
            return status

        RUNTIME_DIR.mkdir(parents=True, exist_ok=True)
        script_path = BASE_DIR / "scripts" / "import_vodiy_theory.py"
        if not script_path.exists():
            raise HTTPException(500, "Скрипт парсингу теорії не знайдено")

        command = [sys.executable, str(script_path)]
        if req.chapters:
            command.extend(["--chapters", req.chapters])
        if req.skip_signs:
            command.append("--skip-signs")
        if req.skip_markings:
            command.append("--skip-markings")
        if req.write_seed:
            command.append("--write-seed")

        log_file = THEORY_PARSE_LOG_FILE.open("w", encoding="utf-8")
        process = subprocess.Popen(
            command,
            cwd=str(BASE_DIR.parent),
            stdout=log_file,
            stderr=subprocess.STDOUT,
            env=os.environ.copy(),
            text=True,
        )
        log_file.close()
        _theory_parse_process = process
        status = _write_theory_parse_status(
            {
                "running": True,
                "started_at": _now_iso(),
                "finished_at": None,
                "exit_code": None,
                "message": "Парсинг теорії запущено",
                "command": " ".join(command),
            }
        )
        threading.Thread(target=_watch_theory_parse_process, args=(process,), daemon=True).start()
        return status


@app.get("/admin/theory/parse/status")
def admin_theory_parse_status(admin=Depends(require_admin)):
    status = _read_theory_parse_status()
    if _theory_parse_process and _theory_parse_process.poll() is None:
        status["running"] = True
    return status


@app.get("/admin/theory/sections")
def admin_theory_sections(
    search: str = Query(default=""),
    topic: str = Query(default=""),
    category: str = Query(default=""),
    limit: int = Query(default=80, ge=1, le=200),
    admin=Depends(require_admin),
):
    return list_admin_theory_sections_use_case(
        search=search,
        topic=topic,
        category=category,
        limit=limit,
    )


@app.patch("/admin/theory/sections/{section_id}")
def admin_update_theory_section(section_id: int, req: AdminTheorySectionUpdateRequest, admin=Depends(require_admin)):
    try:
        return update_admin_theory_section_use_case(
            section_id,
            req,
            sanitize_text=_sanitize_handbook_text,
        )
    except ServiceError as exc:
        raise HTTPException(exc.status_code, exc.message) from exc


@app.post("/frames/purchase")
def purchase_frame(req: FramePurchaseRequest, user=Depends(get_current_user)):
    try:
        return purchase_frame_use_case(
            req,
            user,
            available_stars=_available_stars,
            build_frame_shop=_frame_shop_payload,
        )
    except ServiceError as exc:
        raise HTTPException(exc.status_code, exc.message) from exc


@app.get("/battles")
def get_battles(user=Depends(get_current_user)):
    return list_battles_use_case(user)


@app.post("/battles")
async def create_battle(req: BattleCreateRequest, user=Depends(get_current_user)):
    try:
        result = create_battle_use_case(
            req,
            user,
            resolve_social_user=_resolve_social_user_by_handle,
            normalize_category=_normalize_category,
            question_provider=random_questions_use_case,
        )
    except ServiceError as exc:
        raise HTTPException(exc.status_code, exc.message) from exc
    for email in result.emit:
        await realtime_hub.emit(email, result.event, {"battle_id": result.payload["id"]})
    return result.payload


@app.post("/battles/{battle_id}/accept")
async def accept_battle(battle_id: int, user=Depends(get_current_user)):
    try:
        result = accept_battle_use_case(battle_id, user)
    except ServiceError as exc:
        raise HTTPException(exc.status_code, exc.message) from exc
    for email in result.emit:
        await realtime_hub.emit(email, result.event, {"battle_id": battle_id})
    return result.payload


@app.post("/battles/{battle_id}/decline")
async def decline_battle(battle_id: int, user=Depends(get_current_user)):
    try:
        result = decline_battle_use_case(battle_id, user)
    except ServiceError as exc:
        raise HTTPException(exc.status_code, exc.message) from exc
    for email in result.emit:
        await realtime_hub.emit(email, result.event, {"battle_id": battle_id})
    return result.payload


@app.post("/battles/{battle_id}/cancel")
async def cancel_battle(battle_id: int, user=Depends(get_current_user)):
    try:
        result = cancel_battle_use_case(battle_id, user)
    except ServiceError as exc:
        raise HTTPException(exc.status_code, exc.message) from exc
    for email in result.emit:
        await realtime_hub.emit(email, result.event, {"battle_id": battle_id})
    return result.payload


@app.get("/battles/{battle_id}")
def get_battle(battle_id: int, user=Depends(get_current_user)):
    try:
        return get_battle_detail_use_case(
            battle_id,
            user,
            sanitize_question=_sanitize_question_row,
        )
    except ServiceError as exc:
        raise HTTPException(exc.status_code, exc.message) from exc


@app.post("/battles/{battle_id}/submit", response_model=BattleSubmitResponse)
async def submit_battle_answers(battle_id: int, req: BattleSubmitRequest, user=Depends(get_current_user)):
    try:
        result = submit_battle_answers_use_case(battle_id, req, user)
    except ServiceError as exc:
        raise HTTPException(exc.status_code, exc.message) from exc

    await realtime_hub.emit(result.challenger_email, "battle_update", {"battle_id": battle_id})
    await realtime_hub.emit(result.opponent_email, "battle_update", {"battle_id": battle_id})
    return result.response

API_ROUTE_PREFIXES = {
    "api",
    "auth",
    "promo",
    "admin",
    "payment",
    "users",
    "questions",
    "sections",
    "progress",
    "achievements",
    "leaderboard",
    "theory",
    "tickets",
    "handbook",
    "friends",
    "messages",
    "support",
    "notifications",
    "frames",
    "battles",
    "uploads",
    "images",
    "health",
    "ws",
}


if IS_PRODUCTION:
    if FRONTEND_DIST_DIR.exists():

        @app.get("/{full_path:path}", include_in_schema=False)
        def serve_frontend(full_path: str):
            first_segment = full_path.strip("/").split("/", 1)[0]

            dist_root = FRONTEND_DIST_DIR.resolve()
            requested_file = (dist_root / full_path).resolve()
            try:
                requested_file.relative_to(dist_root)
            except ValueError:
                raise HTTPException(404, "Not found")

            if requested_file.is_file():
                return FileResponse(requested_file)

            if first_segment in API_ROUTE_PREFIXES or first_segment in {"assets", "images"}:
                raise HTTPException(404, "Not found")

            return FileResponse(dist_root / "index.html")
    else:
        print(f"[startup] frontend dist not found at {FRONTEND_DIST_DIR}", flush=True)


if __name__ == "__main__":
    import uvicorn

    uvicorn.run("main:app", host="0.0.0.0", port=PORT, reload=False)



