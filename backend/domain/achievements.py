from __future__ import annotations

from typing import Any


EXAM_PERFECT_ACHIEVEMENTS = {"exam_perfect", "exam_perfect_5", "exam_perfect_10"}


ACHIEVEMENT_COPY: dict[str, dict[str, str]] = {
    "first_step": {"name": "Перший виїзд", "description": "Пройти перший тест"},
    "rookie": {"name": "Новачок", "description": "Пройти 10 тестів"},
    "driver": {"name": "Водій", "description": "Пройти 50 тестів"},
    "pro_driver": {"name": "Профі", "description": "Пройти 100 тестів"},
    "veteran_driver": {"name": "Досвідчений водій", "description": "Пройти 250 тестів"},
    "hundred": {"name": "Сотня", "description": "100 правильних відповідей"},
    "five_hundred": {"name": "П'ятисотня", "description": "500 правильних відповідей"},
    "thousand": {"name": "Тисячник", "description": "1000 правильних відповідей"},
    "legend": {"name": "Легенда", "description": "5000 правильних відповідей"},
    "streak_3": {"name": "Розігрів", "description": "3 дні підряд"},
    "streak_7": {"name": "Темп", "description": "7 днів підряд"},
    "streak_28": {"name": "Вогонь", "description": "28 днів підряд"},
    "streak_90": {"name": "Стабільний темп", "description": "90 днів активності підряд"},
    "marathon_10": {"name": "Бігун", "description": "10 у марафоні"},
    "marathon_50": {"name": "Спринтер", "description": "50 у марафоні"},
    "marathon_100": {"name": "Блискавка", "description": "100 у марафоні"},
    "perfect_1": {"name": "Без помилок", "description": "Перший ідеальний тест"},
    "perfect_5": {"name": "Відмінник", "description": "5 ідеальних тестів"},
    "perfect_20": {"name": "Чиста серія", "description": "20 тестів без помилок"},
    "exam_passed": {"name": "Іспит складено", "description": "Скласти перший іспит МВС або білет"},
    "exam_5": {"name": "Стабільний іспит", "description": "Скласти 5 іспитів МВС або білетів"},
    "exam_10": {"name": "Десятка іспитів", "description": "Скласти 10 іспитів МВС або білетів"},
    "exam_20": {"name": "Екзаменаційний темп", "description": "Скласти 20 іспитів МВС або білетів"},
    "exam_50": {"name": "Готовий до сервісного центру", "description": "Скласти 50 іспитів МВС або білетів"},
    "exam_perfect": {"name": "Ідеальний іспит", "description": "Скласти іспит МВС або білет без помилок"},
    "exam_perfect_5": {"name": "П'ять чистих іспитів", "description": "Скласти 5 іспитів або білетів без помилок"},
    "exam_perfect_10": {"name": "Десять чистих іспитів", "description": "Скласти 10 іспитів або білетів без помилок"},
    "accuracy_70": {"name": "Рівна їзда", "description": "Тримати загальну точність від 70%"},
    "accuracy_75": {"name": "Впевнена база", "description": "Тримати загальну точність від 75%"},
    "accuracy_80": {"name": "Впевнена точність", "description": "Тримати загальну точність від 80%"},
    "accuracy_85": {"name": "Чіткий контроль", "description": "Тримати загальну точність від 85%"},
    "accuracy_90": {"name": "Точний маршрут", "description": "Тримати загальну точність від 90%"},
    "accuracy_92": {"name": "Майже без промахів", "description": "Тримати загальну точність від 92%"},
    "accuracy_95": {"name": "Ювелірна точність", "description": "Тримати загальну точність від 95%"},
    "accuracy_98": {"name": "Еталонна точність", "description": "Тримати загальну точність від 98%"},
    "battle_first": {"name": "Перший батл", "description": "Завершити перший батл"},
    "battle_3": {"name": "Три виклики", "description": "Завершити 3 батли"},
    "battle_5": {"name": "Батл-серія", "description": "Завершити 5 батлів"},
    "battle_10": {"name": "Десятка батлів", "description": "Завершити 10 батлів"},
    "battle_20": {"name": "Арена досвіду", "description": "Завершити 20 батлів"},
    "battle_50": {"name": "Ветеран батлів", "description": "Завершити 50 батлів"},
    "battle_winner": {"name": "Перемога в батлі", "description": "Виграти перший батл"},
    "battle_wins_3": {"name": "Три перемоги", "description": "Виграти 3 батли"},
    "battle_wins_5": {"name": "П'ять перемог", "description": "Виграти 5 батлів"},
    "battle_champion": {"name": "Чемпіон батлів", "description": "Виграти 10 батлів"},
    "battle_wins_15": {"name": "Серія переможця", "description": "Виграти 15 батлів"},
    "battle_wins_25": {"name": "Лідер батлів", "description": "Виграти 25 батлів"},
    "battle_wins_50": {"name": "Легенда дуелей", "description": "Виграти 50 батлів"},
}


def achievement_copy(achievement_id: str, name: str, description: str) -> tuple[str, str]:
    copy = ACHIEVEMENT_COPY.get(str(achievement_id or ""))
    if not copy:
        return name, description
    return copy["name"], copy["description"]


def user_accuracy_percent(user: dict[str, Any]) -> int:
    total_answers = int(user.get("total_answers") or 0)
    if total_answers <= 0:
        return 0
    return round((int(user.get("total_correct") or 0) / total_answers) * 100)


def achievement_progress_value(
    *,
    achievement_id: str,
    category: str,
    user: dict[str, Any],
    perfect_tests: int,
    exam_stats: dict[str, Any],
    battle_stats: dict[str, int],
) -> int:
    if category == "tests":
        return int(user.get("total_tests") or 0)
    if category == "correct":
        return int(user.get("total_correct") or 0)
    if category == "streak":
        return int(user.get("streak_days") or 0)
    if category == "marathon":
        return int(user.get("marathon_best") or 0)
    if category == "perfect":
        return int(perfect_tests or 0)
    if category == "exam":
        if achievement_id in EXAM_PERFECT_ACHIEVEMENTS:
            return int(exam_stats.get("perfect_count") or 0)
        return int(exam_stats.get("passed_count") or 0)
    if category == "accuracy":
        if int(user.get("total_answers") or 0) < 20:
            return 0
        return user_accuracy_percent(user)
    if category == "battle":
        return int(battle_stats.get("battle_finished") or 0)
    if category == "battle_wins":
        return int(battle_stats.get("battle_wins") or 0)
    return 0


def should_award_achievement(
    *,
    achievement_id: str,
    category: str,
    threshold: int,
    user: dict[str, Any],
    perfect_tests: int,
    exam_stats: dict[str, Any],
    battle_stats: dict[str, int],
) -> bool:
    if category == "accuracy" and int(user.get("total_answers") or 0) < 20:
        return False
    return achievement_progress_value(
        achievement_id=achievement_id,
        category=category,
        user=user,
        perfect_tests=perfect_tests,
        exam_stats=exam_stats,
        battle_stats=battle_stats,
    ) >= int(threshold)
