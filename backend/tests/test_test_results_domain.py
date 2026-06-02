from __future__ import annotations

from datetime import date, timedelta

from domain.test_results import earned_star, plan_streak_update, streak_snapshot


def test_streak_snapshot_marks_two_day_gap_as_restorable_when_restore_available() -> None:
    today = date(2026, 6, 2)
    user = {
        "last_activity": today - timedelta(days=2),
        "streak_days": 7,
        "streak_restores_left": 1,
        "streak_restores_month": "2026-06",
    }

    snapshot = streak_snapshot(user, today)

    assert snapshot["status"] == "restorable"
    assert snapshot["days"] == 7
    assert snapshot["missed_days"] == 1


def test_plan_streak_update_restores_two_day_gap_and_spends_one_restore() -> None:
    today = date(2026, 6, 2)
    user = {
        "last_activity": today - timedelta(days=2),
        "streak_days": 7,
        "streak_restores_left": 2,
        "streak_restores_month": "2026-06",
    }

    update = plan_streak_update(user, today)

    assert update.streak_days == 8
    assert update.restored is True
    assert update.restores_left == 1
    assert update.should_persist is True


def test_plan_streak_update_does_not_persist_when_already_active_today() -> None:
    today = date(2026, 6, 2)
    user = {"last_activity": today, "streak_days": 5}

    update = plan_streak_update(user, today)

    assert update.streak_days == 5
    assert update.should_persist is False


def test_earned_star_only_for_perfect_non_empty_result() -> None:
    assert earned_star(total=20, correct=20)
    assert not earned_star(total=20, correct=19)
    assert not earned_star(total=0, correct=0)
