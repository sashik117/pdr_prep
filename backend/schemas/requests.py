from __future__ import annotations

from typing import Any, Optional

from pydantic import BaseModel, Field


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


class AdminLoginRequest(BaseModel):
    username: str
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


class AccessLimitRequest(BaseModel):
    action: str


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
    client_attempt_id: Optional[str] = None
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
    attachment_url: Optional[str] = None


class FramePurchaseRequest(BaseModel):
    frame_id: str


class PremiumCheckoutRequest(BaseModel):
    plan_code: str
    return_url: Optional[str] = None


class PromoConfigRequest(BaseModel):
    duration_days: Optional[int] = Field(default=15, ge=1, le=60)
    never_ends: Optional[bool] = None
    promo_prices: Optional[dict[str, int]] = None
    regular_prices: Optional[dict[str, int]] = None


class SavedQuestionsSyncRequest(BaseModel):
    ids: list[int] = Field(default_factory=list)


class PremiumFeaturesUpdateRequest(BaseModel):
    features: list[dict[str, Any]]


class PremiumSettingsUpdateRequest(BaseModel):
    premium_enabled: bool = True


class AdminSupportReplyRequest(BaseModel):
    content: str


class AdminUserUpdateRequest(BaseModel):
    is_blocked: Optional[bool] = None
    is_premium: Optional[bool] = None
    premium_months: Optional[int] = Field(default=None, ge=0, le=120)
    premium_waived: Optional[bool] = None
    is_admin: Optional[bool] = None
    total_tests: Optional[int] = None
    total_correct: Optional[int] = None
    total_answers: Optional[int] = None
    marathon_best: Optional[int] = None
    streak_days: Optional[int] = None
    manual_star_adjustment: Optional[int] = None


class AdminUserCreateRequest(BaseModel):
    name: str
    surname: str = ""
    username: str
    email: str
    password: str
    is_premium: bool = False
    premium_months: Optional[int] = Field(default=None, ge=0, le=120)
    is_blocked: bool = False
    is_admin: bool = False
    premium_waived: bool = False


class AdminAchievementUpdateRequest(BaseModel):
    achievement_id: str
    remove: bool = False


class AdminQuestionUpdateRequest(BaseModel):
    section: Optional[str] = None
    question_text: Optional[str] = None
    explanation: Optional[str] = None
    difficulty: Optional[str] = None
    section_name: Optional[str] = None
    options: Optional[list[str]] = None
    images: Optional[list[str]] = None
    correct_ans: Optional[int] = None


class AdminQuestionCreateRequest(BaseModel):
    section: str
    question_text: str
    options: list[str]
    correct_ans: int
    section_name: Optional[str] = None
    explanation: Optional[str] = None
    difficulty: Optional[str] = "medium"
    images: Optional[list[str]] = None


class AdminTheoryParseRequest(BaseModel):
    chapters: Optional[str] = None
    skip_signs: bool = False
    skip_markings: bool = False
    write_seed: bool = True


class AdminTheorySectionUpdateRequest(BaseModel):
    title: Optional[str] = None
    description: Optional[str] = None
    content_html: Optional[str] = None
    comment_html: Optional[str] = None
    video_url: Optional[str] = None
    embed_url: Optional[str] = None
    chapter_num: Optional[int] = None
    sort_order: Optional[int] = None
