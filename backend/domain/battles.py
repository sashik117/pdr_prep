from __future__ import annotations

import json
from dataclasses import dataclass
from datetime import datetime, timedelta
from typing import Any, Optional


ANSWER_LABELS = ["A", "B", "C", "D", "E", "F"]


@dataclass(frozen=True)
class BattleScore:
    score: int
    answers: dict[str, str]


@dataclass(frozen=True)
class FinalizedBattle:
    battle: dict[str, Any]
    changed: bool


@dataclass(frozen=True)
class BattleSubmission:
    battle: dict[str, Any]
    score: int


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


def normalize_battle_record(battle: dict[str, Any]) -> dict[str, Any]:
    normalized = dict(battle)
    normalized["challenger_email"] = str(normalized.get("challenger_email") or "").strip().lower()
    normalized["opponent_email"] = str(normalized.get("opponent_email") or "").strip().lower()
    normalized["challenger_name"] = str(normalized.get("challenger_name") or "").strip() or None
    normalized["opponent_name"] = str(normalized.get("opponent_name") or "").strip() or None
    normalized["status"] = str(normalized.get("status") or "pending").strip().lower() or "pending"
    normalized["category"] = str(normalized.get("category") or "B").strip().upper() or "B"
    normalized["question_ids"] = _coerce_json_list(normalized.get("question_ids"))
    normalized["challenger_answers"] = _coerce_json_dict(normalized.get("challenger_answers"))
    normalized["opponent_answers"] = _coerce_json_dict(normalized.get("opponent_answers"))
    normalized["challenger_score"] = int(normalized.get("challenger_score") or 0)
    normalized["opponent_score"] = int(normalized.get("opponent_score") or 0)
    normalized["challenger_time"] = int(normalized.get("challenger_time") or 0)
    normalized["opponent_time"] = int(normalized.get("opponent_time") or 0)
    return normalized


def role_for_email(battle: dict[str, Any], email: str) -> Optional[str]:
    normalized = email.strip().lower()
    if battle["challenger_email"].lower() == normalized:
        return "challenger"
    if battle["opponent_email"].lower() == normalized:
        return "opponent"
    return None


def answer_label_to_index(answer: Optional[str], question: dict[str, Any]) -> int:
    if not answer:
        return 0
    options = question.get("options") or []
    label = str(answer).strip().upper()
    for index in range(min(len(options), len(ANSWER_LABELS))):
        if ANSWER_LABELS[index] == label:
            return index + 1
    return 0


def score_answers(
    question_ids: list[Any],
    submitted_answers: dict[str, str],
    questions_by_id: dict[str, dict[str, Any]],
) -> BattleScore:
    score = 0
    normalized_answers: dict[str, str] = {}
    for question_id in question_ids:
        key = str(question_id)
        answer = submitted_answers.get(key)
        if answer is None:
            continue
        question = questions_by_id.get(key)
        if not question:
            continue
        normalized_answers[key] = str(answer).strip().upper()
        if answer_label_to_index(answer, question) == int(question.get("correct_ans") or 0):
            score += 1
    return BattleScore(score=score, answers=normalized_answers)


def pick_winner(battle: dict[str, Any]) -> Optional[str]:
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


def deadline_seconds(battle: dict[str, Any], now: Optional[datetime] = None) -> Optional[int]:
    expires_at = battle.get("expires_at")
    if not expires_at:
        return None
    current = now or datetime.utcnow()
    return max(0, int((expires_at - current).total_seconds()))


def seen_column_for_role(role: Optional[str]) -> Optional[str]:
    if role == "challenger":
        return "challenger_seen_at"
    if role == "opponent":
        return "opponent_seen_at"
    return None


def invite_seen(battle: dict[str, Any], role: Optional[str]) -> bool:
    column = seen_column_for_role(role)
    return bool(column and battle.get(column))


def finalize_expired_battle(battle: dict[str, Any], now: Optional[datetime] = None) -> FinalizedBattle:
    current = now or datetime.utcnow()
    normalized = normalize_battle_record(battle)
    expires_at = normalized.get("expires_at")
    if normalized.get("status") != "active" or not expires_at or expires_at > current:
        return FinalizedBattle(battle=normalized, changed=False)

    normalized["status"] = "finished"
    normalized["winner_email"] = pick_winner(normalized)
    return FinalizedBattle(battle=normalized, changed=True)


def apply_submission(
    battle: dict[str, Any],
    role: str,
    submitted_answers: dict[str, str],
    time_seconds: int,
    questions_by_id: dict[str, dict[str, Any]],
    now: Optional[datetime] = None,
) -> BattleSubmission:
    current = now or datetime.utcnow()
    next_battle = normalize_battle_record(battle)
    scored = score_answers(next_battle.get("question_ids") or [], submitted_answers, questions_by_id)

    if role == "challenger":
        next_battle["challenger_answers"] = scored.answers
        next_battle["challenger_score"] = scored.score
        next_battle["challenger_time"] = int(time_seconds or 0)
    else:
        next_battle["opponent_answers"] = scored.answers
        next_battle["opponent_score"] = scored.score
        next_battle["opponent_time"] = int(time_seconds or 0)

    both_done = bool(next_battle["challenger_answers"]) and bool(next_battle["opponent_answers"])
    next_battle["status"] = "finished" if both_done else "active"
    next_battle["finished_at"] = current if both_done else next_battle.get("finished_at")
    if not both_done:
        default_deadline = current + timedelta(minutes=10)
        next_battle["expires_at"] = min(next_battle.get("expires_at") or default_deadline, current + timedelta(seconds=60))
    next_battle["winner_email"] = pick_winner(next_battle) if both_done else None
    return BattleSubmission(battle=next_battle, score=scored.score)
