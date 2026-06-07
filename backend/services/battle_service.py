from __future__ import annotations

from dataclasses import dataclass
from datetime import datetime, timedelta
from collections.abc import Callable
from typing import Any

from core.database import db
from domain.auth import normalize_username
from domain.battles import (
    apply_submission,
    deadline_seconds,
    finalize_expired_battle,
    invite_seen,
    normalize_battle_record,
    role_for_email,
)
from repositories.battle_repository import BattleRepository
from schemas.battles import BattleSubmitResponse
from schemas.requests import BattleCreateRequest, BattleSubmitRequest
from services.errors import ServiceError


@dataclass(frozen=True)
class BattleSubmitResult:
    response: BattleSubmitResponse
    challenger_email: str
    opponent_email: str


@dataclass(frozen=True)
class BattleActionResult:
    payload: dict[str, Any]
    emit: list[str]
    event: str


QuestionSanitizer = Callable[[dict[str, Any]], dict[str, Any]]
SocialUserResolver = Callable[[Any, str, dict[str, Any]], dict[str, Any] | None]
CategoryNormalizer = Callable[[str | None], str | None]
QuestionProvider = Callable[..., list[dict[str, Any]]]


def _date_payload(battle: dict[str, Any]) -> dict[str, str]:
    return {
        "created_at": str(battle.get("created_at") or ""),
        "expires_at": str(battle.get("expires_at") or ""),
        "finished_at": str(battle.get("finished_at") or ""),
    }


def list_battles(user: dict[str, Any]) -> list[dict[str, Any]]:
    with db() as conn:
        repo = BattleRepository(conn)
        rows = repo.list_battles_for_email(user["email"])
        battles: list[dict[str, Any]] = []
        for row in rows:
            finalized = finalize_expired_battle(row)
            battle = finalized.battle
            if finalized.changed:
                repo.save_expired_finalization(battle)
            role = role_for_email(battle, user["email"])
            if not role:
                continue
            if battle.get("status") == "pending":
                battle = repo.mark_seen(battle=battle, role=role)
            opponent_email = battle["opponent_email"] if role == "challenger" else battle["challenger_email"]
            opponent_name = battle["opponent_name"] if role == "challenger" else battle["challenger_name"]
            opponent_user = repo.get_battle_user(opponent_email)
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
                    "invite_seen": invite_seen(battle, role),
                    "seconds_left": deadline_seconds(battle),
                    **_date_payload(battle),
                }
            )
        conn.commit()
    return battles


def create_battle(
    req: BattleCreateRequest,
    user: dict[str, Any],
    *,
    resolve_social_user: SocialUserResolver,
    normalize_category: CategoryNormalizer,
    question_provider: QuestionProvider,
) -> BattleActionResult:
    handle = req.opponent_user.strip()
    category = normalize_category(req.category) or "B"
    if normalize_username(handle) == normalize_username(user.get("username")):
        raise ServiceError(400, "Не можна створити батл із собою")

    with db() as conn:
        repo = BattleRepository(conn)
        opponent = resolve_social_user(conn, handle, user)
        if not opponent:
            raise ServiceError(404, "Опонента не знайдено")

        existing = repo.active_battle_between(challenger_email=user["email"], opponent_email=opponent["email"])
        if existing:
            raise ServiceError(409, "У вас уже є активний або очікуючий батл із цим користувачем")

        question_rows = question_provider(count=req.question_count, category=category)
        question_ids = [row["id"] for row in question_rows]
        if len(question_ids) < req.question_count:
            raise ServiceError(400, "Недостатньо питань для цього батлу")

        battle = repo.create_battle(
            challenger_email=user["email"],
            challenger_name=user["name"],
            opponent_email=opponent["email"],
            opponent_name=opponent["name"],
            category=category,
            question_ids=question_ids,
            expires_at=datetime.utcnow() + timedelta(days=7),
        )
        if repo.accepted_friendship_exists(first_user_id=int(user["id"]), second_user_id=int(opponent["id"])):
            repo.create_battle_invite_message(
                to_email=opponent["email"],
                from_email=user["email"],
                from_name=user["name"],
                battle_id=int(battle["id"]),
                category=category,
            )
        conn.commit()

    return BattleActionResult(
        payload=battle,
        emit=[opponent["email"], user["email"]],
        event="battle_invite",
    )


def accept_battle(battle_id: int, user: dict[str, Any]) -> BattleActionResult:
    with db() as conn:
        repo = BattleRepository(conn)
        battle = repo.get_battle(battle_id)
        if not battle:
            raise ServiceError(404, "Батл не знайдено")
        battle = normalize_battle_record(battle)
        if battle["opponent_email"] != user["email"].lower():
            raise ServiceError(403, "Тільки опонент може прийняти батл")
        if battle["status"] != "pending":
            return BattleActionResult(payload={"message": "Батл уже активний"}, emit=[], event="battle_active")

        expires_at = datetime.utcnow() + timedelta(minutes=10)
        repo.activate_battle(battle_id=battle_id, expires_at=expires_at)
        conn.commit()

    return BattleActionResult(
        payload={"message": "Батл активовано", "expires_at": expires_at.isoformat()},
        emit=[battle["challenger_email"], battle["opponent_email"]],
        event="battle_active",
    )


def decline_battle(battle_id: int, user: dict[str, Any]) -> BattleActionResult:
    with db() as conn:
        repo = BattleRepository(conn)
        battle = repo.get_battle(battle_id)
        if not battle:
            raise ServiceError(404, "Батл не знайдено")
        battle = normalize_battle_record(battle)
        if battle["opponent_email"] != user["email"].lower():
            raise ServiceError(403, "Тільки опонент може відхилити батл")
        if battle["status"] != "pending":
            if battle["status"] == "declined":
                return BattleActionResult(payload={"message": "Батл уже відхилено"}, emit=[], event="battle_declined")
            raise ServiceError(409, "Можна відхилити лише очікуючий батл")
        repo.mark_declined(battle_id=battle_id, seen_column="opponent_seen_at")
        conn.commit()

    return BattleActionResult(
        payload={"message": "Батл відхилено"},
        emit=[battle["challenger_email"], battle["opponent_email"]],
        event="battle_declined",
    )


def cancel_battle(battle_id: int, user: dict[str, Any]) -> BattleActionResult:
    with db() as conn:
        repo = BattleRepository(conn)
        battle = repo.get_battle(battle_id)
        if not battle:
            raise ServiceError(404, "Батл не знайдено")
        battle = normalize_battle_record(battle)
        if battle["challenger_email"] != user["email"].lower():
            raise ServiceError(403, "Тільки ініціатор може скасувати виклик")
        if battle["status"] != "pending":
            if battle["status"] == "declined":
                return BattleActionResult(payload={"message": "Виклик уже скасовано"}, emit=[], event="battle_cancelled")
            raise ServiceError(409, "Скасувати можна лише очікуючий виклик")
        repo.mark_declined(battle_id=battle_id, seen_column="challenger_seen_at")
        conn.commit()

    return BattleActionResult(
        payload={"message": "Виклик скасовано"},
        emit=[battle["challenger_email"], battle["opponent_email"]],
        event="battle_cancelled",
    )


def get_battle_detail(
    battle_id: int,
    user: dict[str, Any],
    *,
    sanitize_question: QuestionSanitizer,
) -> dict[str, Any]:
    with db() as conn:
        repo = BattleRepository(conn)
        battle = repo.get_battle(battle_id)
        if not battle:
            raise ServiceError(404, "Батл не знайдено")
        finalized = finalize_expired_battle(battle)
        battle_dict = finalized.battle
        if finalized.changed:
            repo.save_expired_finalization(battle_dict)
        role = role_for_email(battle_dict, user["email"])
        if not role:
            raise ServiceError(403, "Немає доступу до батлу")
        if battle_dict.get("status") == "pending":
            battle_dict = repo.mark_seen(battle=battle_dict, role=role)

        question_ids = battle_dict.get("question_ids") or []
        questions = [sanitize_question(row) for row in repo.get_questions_ordered(question_ids)]
        opponent_email = battle_dict["opponent_email"] if role == "challenger" else battle_dict["challenger_email"]
        opponent_user = repo.get_battle_user(opponent_email)
        challenger_username = repo.get_username_by_email(battle_dict["challenger_email"])
        opponent_username = repo.get_username_by_email(battle_dict["opponent_email"])
        conn.commit()

    my_answers = battle_dict["challenger_answers"] if role == "challenger" else battle_dict["opponent_answers"]
    winner_username = None
    if battle_dict.get("winner_email") == battle_dict["challenger_email"]:
        winner_username = challenger_username
    elif battle_dict.get("winner_email") == battle_dict["opponent_email"]:
        winner_username = opponent_username

    return {
        **battle_dict,
        "role": role,
        "questions": questions,
        "opponent_username": opponent_user["username"] if opponent_user else None,
        "opponent_id": opponent_user["id"] if opponent_user else None,
        "opponent_avatar_url": opponent_user["avatar_url"] if opponent_user else None,
        "opponent_avatar_version": int(opponent_user["avatar_version"] or 0) if opponent_user else 0,
        "opponent_active_frame": opponent_user["active_frame"] if opponent_user else None,
        "winner_username": winner_username,
        "my_submitted": bool(my_answers),
        "invite_seen": invite_seen(battle_dict, role),
        "seconds_left": deadline_seconds(battle_dict),
        **_date_payload(battle_dict),
    }


def submit_battle_answers(battle_id: int, req: BattleSubmitRequest, user: dict[str, Any]) -> BattleSubmitResult:
    now = datetime.utcnow()
    with db() as conn:
        repo = BattleRepository(conn)
        battle = repo.get_battle(battle_id)
        if not battle:
            raise ServiceError(404, "Батл не знайдено")

        finalized = finalize_expired_battle(battle, now)
        battle_dict = finalized.battle
        if finalized.changed:
            repo.save_expired_finalization(battle_dict)

        role = role_for_email(battle_dict, user["email"])
        if not role:
            raise ServiceError(403, "Немає доступу до батлу")
        if battle_dict["status"] == "finished":
            raise ServiceError(409, "Батл уже завершено")
        if battle_dict.get("expires_at") and battle_dict["expires_at"] <= now:
            raise ServiceError(409, "Час на батл уже вийшов")
        if role == "challenger" and battle_dict.get("challenger_answers"):
            raise ServiceError(409, "Ви вже завершили цей батл")
        if role == "opponent" and battle_dict.get("opponent_answers"):
            raise ServiceError(409, "Ви вже завершили цей батл")

        questions_by_id = repo.get_questions_by_ids(battle_dict.get("question_ids") or [])
        submitted = apply_submission(
            battle=battle_dict,
            role=role,
            submitted_answers=req.answers,
            time_seconds=req.time_seconds,
            questions_by_id=questions_by_id,
            now=now,
        )
        repo.save_submission(submitted.battle)
        user_id = repo.get_user_id_by_email(user["email"])
        if user_id:
            repo.create_battle_progress(
                user_id=user_id,
                battle_id=battle_id,
                question_ids=submitted.battle.get("question_ids") or [],
                answers=submitted.battle["challenger_answers"] if role == "challenger" else submitted.battle["opponent_answers"],
                questions_by_id=questions_by_id,
                score=submitted.score,
                time_seconds=req.time_seconds,
            )
        conn.commit()

    return BattleSubmitResult(
        response=BattleSubmitResponse(
            status=submitted.battle["status"],
            score=submitted.score,
            winner_email=submitted.battle.get("winner_email"),
            seconds_left=deadline_seconds(submitted.battle, now),
        ),
        challenger_email=submitted.battle["challenger_email"],
        opponent_email=submitted.battle["opponent_email"],
    )
