from __future__ import annotations

from typing import Any, Optional

from pydantic import BaseModel, Field


class TestResultResponse(BaseModel):
    result_id: Optional[int] = None
    duplicate: bool = False
    streak: int
    streak_days: int
    streak_status: str
    streak_restored: bool = False
    streak_restores_left: int
    earned_star: bool = False
    total_stars: int = 0
    available_stars: int = 0
    new_achievements: list[dict[str, Any]] = Field(default_factory=list)


class ProgressResultResponse(BaseModel):
    id: int
    section: Optional[str] = None
    mode: str
    total: int
    correct: int
    time_seconds: int
    score_percent: int
    passed: bool
    created_at: str


class ProgressStatsResponse(BaseModel):
    user: dict[str, Any]
    total_tests: int = 0
    total_correct: int = 0
    total_answers: int = 0
    total_wrong: int = 0
    total_test_time_seconds: int = 0
    today_test_time_seconds: int = 0
    best_exam_time_seconds: int = 0
    passed_tests: int = 0
    streak_days: int = 0
    streak_status: str = "inactive"
    streak_restores_left: int = 0
    marathon_best: int = 0
    total_stars: int = 0
    available_stars: int = 0
    by_section: list[dict[str, Any]] = Field(default_factory=list)
    weak_sections: list[dict[str, Any]] = Field(default_factory=list)
    recent_tests: list[dict[str, Any]] = Field(default_factory=list)
    difficult_question_ids: list[int] = Field(default_factory=list)
    achievements: list[dict[str, Any]] = Field(default_factory=list)
    activity_days: list[str] = Field(default_factory=list)
    daily_test_time: list[dict[str, Any]] = Field(default_factory=list)
    frame_shop: list[dict[str, Any]] = Field(default_factory=list)
