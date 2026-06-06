from __future__ import annotations

from collections.abc import Callable
from datetime import datetime, timedelta
from typing import Any

import psycopg

from core.database import db
from domain.test_results import earned_star, plan_streak_update, streak_snapshot
from repositories.progress_repository import ProgressRepository
from schemas.progress import ProgressResultResponse, ProgressStatsResponse, TestResultResponse
from schemas.requests import MarathonScoreSubmit, TestResultSubmit
from services.errors import ServiceError


AchievementChecker = Callable[[psycopg.Connection, int], list[dict[str, Any]]]
StarsResolver = Callable[[psycopg.Connection, dict[str, Any]], int]
UserPresenter = Callable[[dict[str, Any]], dict[str, Any]]
StreakResolver = Callable[[dict[str, Any]], dict[str, Any]]
FrameShopBuilder = Callable[[dict[str, Any], list[str], int], list[dict[str, Any]]]
SectionOrderSqlBuilder = Callable[[str], str]


def _today():
    return datetime.now().astimezone().date()


def submit_test_result(
    data: TestResultSubmit,
    user: dict[str, Any],
    *,
    check_achievements: AchievementChecker,
    available_stars: StarsResolver,
) -> TestResultResponse:
    today = _today()
    user_id = int(user["id"])
    client_attempt_id = (data.client_attempt_id or "").strip()[:120] or None

    with db() as conn:
        repo = ProgressRepository(conn)
        created = repo.create_test_result(
            user_id=user_id,
            section=data.section,
            mode=data.mode,
            total=data.total,
            correct=data.correct,
            time_seconds=data.time_seconds,
            client_attempt_id=client_attempt_id,
        )

        if created.duplicate:
            current_user = repo.get_user(user_id)
            current_streak = streak_snapshot(current_user, today)
            total_stars = int(available_stars(conn, current_user) or 0)
            return TestResultResponse(
                result_id=created.result_id,
                duplicate=True,
                streak=current_streak["days"],
                streak_days=current_streak["days"],
                streak_status=current_streak["status"],
                streak_restores_left=current_streak["restores_left"],
                total_stars=total_stars,
                available_stars=total_stars,
            )

        repo.insert_answers(user_id=user_id, answers=data.answers)

        streak_state = repo.get_user_streak_state(user_id)
        streak_update = plan_streak_update(streak_state, today)
        if streak_update.should_persist:
            repo.update_streak(
                user_id=user_id,
                today=today,
                streak_days=streak_update.streak_days,
                restores_left=streak_update.restores_left,
                month_key=streak_update.month_key,
            )

        repo.increment_user_totals(user_id=user_id, correct=data.correct, total=data.total)
        new_achievements = check_achievements(conn, user_id)
        updated_user = repo.get_user(user_id)
        total_stars = int(available_stars(conn, updated_user) or 0)
        conn.commit()

    return TestResultResponse(
        result_id=created.result_id,
        streak=streak_update.streak_days,
        streak_days=streak_update.streak_days,
        streak_status="active",
        streak_restored=streak_update.restored,
        streak_restores_left=streak_update.restores_left,
        earned_star=earned_star(data.total, data.correct),
        total_stars=total_stars,
        available_stars=total_stars,
        new_achievements=new_achievements,
    )


def list_progress_results(user: dict[str, Any], *, limit: int = 365) -> list[ProgressResultResponse]:
    with db() as conn:
        rows = ProgressRepository(conn).list_recent_results(user_id=int(user["id"]), limit=limit)

    results: list[ProgressResultResponse] = []
    for row in rows:
        total = int(row.get("total") or 0)
        correct = int(row.get("correct") or 0)
        score_percent = round((correct / total) * 100) if total > 0 else 0
        results.append(
            ProgressResultResponse(
                id=int(row["id"]),
                section=row.get("section"),
                mode=str(row.get("mode") or ""),
                total=total,
                correct=correct,
                time_seconds=int(row.get("time_seconds") or 0),
                score_percent=score_percent,
                passed=score_percent >= 80,
                created_at=str(row.get("created_at") or ""),
            )
        )
    return results


def submit_marathon_score(
    data: MarathonScoreSubmit,
    user: dict[str, Any],
    *,
    check_achievements: AchievementChecker,
) -> dict[str, Any]:
    user_id = int(user["id"])
    with db() as conn:
        repo = ProgressRepository(conn)
        old_best = repo.get_marathon_best(user_id=user_id)
        new_best = max(old_best, int(data.score))
        repo.set_marathon_best(user_id=user_id, score=new_best)
        new_achievements = check_achievements(conn, user_id)
        conn.commit()
    return {
        "marathon_best": new_best,
        "is_new_record": new_best > old_best,
        "new_achievements": new_achievements,
    }


def restore_streak(user: dict[str, Any]) -> dict[str, Any]:
    today = _today()
    user_id = int(user["id"])

    with db() as conn:
        repo = ProgressRepository(conn)
        current = repo.get_user(user_id)
        streak = streak_snapshot(current, today)
        if streak["status"] != "restorable":
            raise ServiceError(400, "Немає серії для відновлення")
        last_activity = current.get("last_activity")
        if not last_activity or (today - last_activity).days != 2:
            raise ServiceError(400, "Відновлення зараз недоступне")

        restores_left = max(0, int(streak["restores_left"]) - 1)
        repo.restore_streak(
            user_id=user_id,
            restores_left=restores_left,
            month_key=str(streak["month_key"]),
            last_activity=today - timedelta(days=1),
        )
        conn.commit()
        updated = repo.get_user(user_id)

    refreshed = streak_snapshot(updated, today)
    return {
        "streak_days": refreshed["days"],
        "streak_status": refreshed["status"],
        "streak_restores_left": refreshed["restores_left"],
    }


def get_progress_stats(
    user: dict[str, Any],
    *,
    present_user: UserPresenter,
    resolve_streak: StreakResolver,
    available_stars: StarsResolver,
    build_frame_shop: FrameShopBuilder,
    section_order_sql: SectionOrderSqlBuilder,
) -> ProgressStatsResponse:
    user_id = int(user["id"])
    order_sql = section_order_sql("q.section")

    with db() as conn:
        conn.execute(
            """
            CREATE TABLE IF NOT EXISTS user_achievements (
                id SERIAL PRIMARY KEY,
                user_id INT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
                achievement_id TEXT NOT NULL,
                achievement_name TEXT,
                achievement_desc TEXT,
                tier INT,
                category TEXT,
                earned_at TIMESTAMP NOT NULL DEFAULT NOW(),
                UNIQUE (user_id, achievement_id)
            )
            """
        )
        conn.execute("CREATE INDEX IF NOT EXISTS idx_user_achievements_user ON user_achievements(user_id)")
        conn.commit()
        repo = ProgressRepository(conn)
        user_row = repo.get_user(user_id)
        streak = resolve_streak(user_row)
        by_section = repo.list_section_accuracy(user_id=user_id, section_order_sql=order_sql)
        weak_sections = repo.list_weak_sections(user_id=user_id, section_order_sql=order_sql)
        recent_tests = repo.list_recent_tests(user_id=user_id)
        time_stats = repo.get_time_stats(user_id=user_id)
        difficult_question_ids = repo.list_difficult_question_ids(user_id=user_id)
        achievements = repo.list_achievements(user_id=user_id)
        passed_tests = repo.passed_tests_count(user_id=user_id)
        total_stars = int(available_stars(conn, user_row) or 0)
        activity_days = repo.list_activity_days(user_id=user_id)
        daily_test_time = repo.list_daily_test_time(user_id=user_id)
        earned_achievement_ids = [str(row["achievement_id"]) for row in achievements]
        frame_shop = build_frame_shop(user_row, earned_achievement_ids, total_stars)

    total_answers = int(user_row.get("total_answers") or 0)
    total_correct = int(user_row.get("total_correct") or 0)

    return ProgressStatsResponse(
        user=present_user(user_row),
        total_tests=int(user_row.get("total_tests") or 0),
        total_correct=total_correct,
        total_answers=total_answers,
        total_wrong=max(0, total_answers - total_correct),
        total_test_time_seconds=int(time_stats.get("total_test_time_seconds") or 0),
        today_test_time_seconds=int(time_stats.get("today_test_time_seconds") or 0),
        best_exam_time_seconds=int(time_stats.get("best_exam_time_seconds") or 0),
        passed_tests=int(passed_tests or 0),
        streak_days=int(streak["days"]),
        streak_status=str(streak["status"]),
        streak_restores_left=int(streak["restores_left"]),
        marathon_best=int(user_row.get("marathon_best") or 0),
        total_stars=total_stars,
        available_stars=total_stars,
        by_section=by_section,
        weak_sections=weak_sections,
        recent_tests=recent_tests,
        difficult_question_ids=difficult_question_ids,
        achievements=achievements,
        activity_days=activity_days,
        daily_test_time=daily_test_time,
        frame_shop=frame_shop,
    )
