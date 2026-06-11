from __future__ import annotations

from typing import Any, Optional
from uuid import uuid4

from core.config import (
    BROKEN_OPTION_RE,
    CATEGORY_ALIASES,
    EMBEDDED_OPTION_RE,
    IMAGE_REQUIRED_MARKERS,
    MVS_BLOCKS,
    MVS_CATEGORY_BLOCKS,
    PUBLIC_IMAGES_DIR,
    PUBLIC_STATIC_IMAGES_DIR,
    QUESTION_UI_MARKERS,
)
from core.database import db
from domain.questions import dedupe_and_filter_questions, local_or_remote_image_exists
from domain.test_sessions import (
    add_exam_block_metadata,
    build_exam_block_summary,
    mvs_block_sections,
    normalize_category,
)
from repositories.question_repository import QuestionRepository
from schemas.questions import MvsExamResponse


def _question_has_available_image(question: dict[str, Any]) -> bool:
    return any(
        local_or_remote_image_exists(image, PUBLIC_IMAGES_DIR)
        or local_or_remote_image_exists(image, PUBLIC_STATIC_IMAGES_DIR)
        for image in question.get("images") or []
    )


def _prepare_questions(rows: list[dict[str, Any]], count: int) -> list[dict[str, Any]]:
    return dedupe_and_filter_questions(
        rows,
        count=count,
        ui_markers=QUESTION_UI_MARKERS,
        embedded_option_re=EMBEDDED_OPTION_RE,
        broken_option_re=BROKEN_OPTION_RE,
        image_required_markers=IMAGE_REQUIRED_MARKERS,
        image_exists=_question_has_available_image,
    )


def build_mvs_exam_questions(category: Optional[str], seed: Optional[str] = None) -> list[dict[str, Any]]:
    normalized = normalize_category(category, CATEGORY_ALIASES, default="B") or "B"
    stable_seed = seed or f"mvs:{normalized}:{uuid4().hex}"
    questions: list[dict[str, Any]] = []
    excluded_ids: set[int] = set()

    with db() as conn:
        repo = QuestionRepository(conn)
        for block_key, meta in MVS_BLOCKS.items():
            required_count = int(meta["count"])
            rows = repo.get_mvs_block_candidates(
                sections=mvs_block_sections(
                    category=normalized,
                    block_key=block_key,
                    common_blocks=MVS_BLOCKS,
                    category_blocks=MVS_CATEGORY_BLOCKS,
                ),
                excluded_ids=excluded_ids,
                seed=stable_seed,
                block_key=block_key,
                count=required_count,
            )
            block_questions = _prepare_questions(rows, required_count)
            block_questions = add_exam_block_metadata(
                block_questions,
                block_key=block_key,
                label=meta.get("label") or block_key,
            )
            questions.extend(block_questions)
            excluded_ids.update(int(item["id"]) for item in block_questions if item.get("id") is not None)

    return questions


def build_mvs_exam_session(category: Optional[str], seed: Optional[str] = None) -> MvsExamResponse:
    normalized = normalize_category(category, CATEGORY_ALIASES, default="B") or "B"
    questions = build_mvs_exam_questions(normalized, seed=seed)
    return MvsExamResponse(
        category=normalized,
        questions_count=len(questions),
        blocks=build_exam_block_summary(MVS_BLOCKS, questions),
        questions=questions,
    )
