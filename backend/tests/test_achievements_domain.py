from __future__ import annotations

from domain.achievements import achievement_progress_value, should_award_achievement, user_accuracy_percent


def test_user_accuracy_percent_rounds_from_total_answers() -> None:
    assert user_accuracy_percent({"total_answers": 7, "total_correct": 5}) == 71
    assert user_accuracy_percent({"total_answers": 0, "total_correct": 0}) == 0


def test_accuracy_achievement_requires_minimum_answer_count() -> None:
    assert not should_award_achievement(
        achievement_id="accuracy_90",
        category="accuracy",
        threshold=90,
        user={"total_answers": 19, "total_correct": 19},
        perfect_tests=0,
        exam_stats={},
        battle_stats={},
    )
    assert should_award_achievement(
        achievement_id="accuracy_90",
        category="accuracy",
        threshold=90,
        user={"total_answers": 20, "total_correct": 18},
        perfect_tests=0,
        exam_stats={},
        battle_stats={},
    )


def test_exam_perfect_achievement_uses_perfect_exam_count() -> None:
    value = achievement_progress_value(
        achievement_id="exam_perfect",
        category="exam",
        user={},
        perfect_tests=0,
        exam_stats={"passed_count": 5, "perfect_count": 2},
        battle_stats={},
    )

    assert value == 2
