from __future__ import annotations

from collections.abc import Callable
from datetime import datetime, timedelta
from typing import Any, Optional

from core.config import USERNAME_RE
from core.database import db
from domain.auth import (
    email_is_valid,
    email_is_verified,
    is_email_login,
    normalize_email,
    normalize_username,
    password_meets_policy,
    reset_code_is_expired,
    username_is_valid,
)
from repositories.auth_repository import AuthRepository
from schemas.requests import (
    ForgotPasswordRequest,
    LoginRequest,
    RegisterRequest,
    ResendVerificationRequest,
    ResetPasswordRequest,
    VerifyEmailRequest,
)
from services.email import email_delivery_response, gen_code, send_email
from services.errors import ServiceError


PasswordHasher = Callable[[str], str]
PasswordChecker = Callable[[str, str], bool]
TokenFactory = Callable[[int, bool], str]
UserPresenter = Callable[[dict[str, Any]], dict[str, Any]]
AdminEmailPredicate = Callable[[Optional[str]], bool]


def _require_valid_password(password: str) -> None:
    if not password_meets_policy(password):
        raise ServiceError(400, "Пароль має містити щонайменше 6 символів")


def _require_valid_email(email: str) -> None:
    if not email_is_valid(email):
        raise ServiceError(400, "Невалідний email")


def _require_valid_username(username: str) -> str:
    normalized = normalize_username(username) or ""
    if not username_is_valid(normalized, USERNAME_RE):
        raise ServiceError(
            400,
            "Username має містити лише латиницю, цифри або _, від 3 до 32 символів",
        )
    return normalized


def register_user(req: RegisterRequest, *, hash_password: PasswordHasher) -> dict[str, Any]:
    email = normalize_email(req.email)
    name = req.name.strip()
    surname = req.surname.strip()

    _require_valid_password(req.password)
    _require_valid_email(email)
    if not name:
        raise ServiceError(400, "Вкажіть ім'я")
    if not surname:
        raise ServiceError(400, "Вкажіть прізвище")
    username = _require_valid_username(req.username)

    code = gen_code()
    password_hash = hash_password(req.password)
    with db() as conn:
        repo = AuthRepository(conn)
        existing = repo.get_user_by_email(email)
        username_owner = repo.get_user_by_username(username)

        if username_owner and username_owner["email"] != email:
            raise ServiceError(409, "Цей нікнейм вже зайнятий")
        if existing and email_is_verified(existing):
            raise ServiceError(409, "Ця пошта вже зареєстрована")

        if existing:
            repo.update_pending_registration(
                name=name,
                surname=surname,
                username=username,
                email=email,
                password_hash=password_hash,
                email_code=code,
            )
        else:
            repo.create_pending_user(
                name=name,
                surname=surname,
                username=username,
                email=email,
                password_hash=password_hash,
                email_code=code,
            )
        conn.commit()

    sent = send_email(
        email,
        "Код підтвердження PDRPrep",
        f"<p>Ваш код підтвердження: <b style='font-size:24px'>{code}</b></p>",
    )
    return email_delivery_response(sent, code, "Код підтвердження надіслано на email")


def verify_email(
    req: VerifyEmailRequest,
    *,
    create_token: TokenFactory,
    present_user: UserPresenter,
) -> dict[str, Any]:
    email = normalize_email(req.email)
    with db() as conn:
        repo = AuthRepository(conn)
        user = repo.get_user_by_email(email)
        if not user or user.get("email_code") != req.code.strip():
            raise ServiceError(400, "Невірний код")
        repo.set_email_verified(email)
        conn.commit()
        verified = repo.get_user_by_email(email)

    if not verified:
        raise ServiceError(404, "Користувача не знайдено")
    token = create_token(int(verified["id"]), True)
    return {"token": token, "user": present_user(verified)}


def login_user(
    req: LoginRequest,
    *,
    check_password: PasswordChecker,
    create_token: TokenFactory,
    present_user: UserPresenter,
    is_admin_email: AdminEmailPredicate,
) -> dict[str, Any]:
    identifier = req.identifier.strip()
    with db() as conn:
        user = AuthRepository(conn).get_user_by_login(identifier)

    if not user:
        message = "Такого E-mail не існує" if is_email_login(identifier) else "Такого нікнейму не існує"
        raise ServiceError(401, message)
    if not user.get("password_hash") or not check_password(req.password, user["password_hash"]):
        raise ServiceError(401, "Невірний пароль")
    if user.get("is_blocked") and not is_admin_email(user.get("email")):
        raise ServiceError(403, "Акаунт заблоковано")
    if not email_is_verified(user):
        raise ServiceError(403, "Спочатку підтвердіть email")

    token = create_token(int(user["id"]), req.remember_me)
    return {"token": token, "user": present_user(user)}


def get_session_user(user_id: int, *, is_admin_email: AdminEmailPredicate) -> dict[str, Any]:
    with db() as conn:
        user = AuthRepository(conn).get_user_by_id(user_id)
    if not user:
        raise ServiceError(401, "Користувача не знайдено")
    if user.get("is_blocked") and not is_admin_email(user.get("email")):
        raise ServiceError(403, "Акаунт заблоковано")
    return user


def resend_verification_code(req: ResendVerificationRequest) -> dict[str, Any]:
    email = normalize_email(req.email)
    with db() as conn:
        repo = AuthRepository(conn)
        user = repo.get_user_by_email(email)
        if not user:
            raise ServiceError(404, "Такого E-mail не існує")
        if email_is_verified(user):
            return {"message": "Email уже підтверджено"}

        code = gen_code()
        repo.set_email_code(email, code)
        conn.commit()

    sent = send_email(
        email,
        "Новий код підтвердження PDRPrep",
        f"<p>Ваш новий код: <b style='font-size:24px'>{code}</b></p>",
    )
    return email_delivery_response(sent, code, "Новий код надіслано на email")


def request_password_reset(req: ForgotPasswordRequest) -> dict[str, Any]:
    email = normalize_email(req.email)
    with db() as conn:
        repo = AuthRepository(conn)
        user = repo.get_user_by_email(email)
        if not user:
            raise ServiceError(404, "Такого E-mail не існує")

        code = gen_code()
        repo.set_reset_code(email, code, datetime.utcnow() + timedelta(minutes=15))
        conn.commit()

    sent = send_email(
        email,
        "Скидання пароля PDRPrep",
        f"<p>Ваш код для скидання: <b style='font-size:24px'>{code}</b></p>",
    )
    return email_delivery_response(sent, code, "Код надіслано на email")


def reset_password(req: ResetPasswordRequest, *, hash_password: PasswordHasher) -> dict[str, Any]:
    email = normalize_email(req.email)
    _require_valid_password(req.new_password)

    with db() as conn:
        repo = AuthRepository(conn)
        user = repo.get_user_by_email(email)
        if not user or user.get("reset_code") != req.code.strip():
            raise ServiceError(400, "Невірний код")
        if reset_code_is_expired(user.get("reset_code_exp"), datetime.utcnow()):
            raise ServiceError(400, "Код застарів")

        repo.update_password(email, hash_password(req.new_password))
        conn.commit()

    return {"message": "Пароль змінено успішно"}
