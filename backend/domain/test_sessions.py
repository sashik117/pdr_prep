from __future__ import annotations

from typing import Any, Optional


def normalize_category(category: Optional[str], aliases: dict[str, str], default: Optional[str] = None) -> Optional[str]:
    if not category:
        return default
    raw = category.strip().upper()
    return aliases.get(raw, raw)


def mvs_block_sections(
    *,
    category: str,
    block_key: str,
    common_blocks: dict[str, dict[str, Any]],
    category_blocks: dict[str, dict[str, list[int]]],
) -> list[int]:
    common_sections = list(common_blocks.get(block_key, {}).get("sections") or [])
    profile_sections = list((category_blocks.get(category) or {}).get(block_key) or [])
    return common_sections + profile_sections


def add_exam_block_metadata(questions: list[dict[str, Any]], *, block_key: str, label: str) -> list[dict[str, Any]]:
    return [{**question, "exam_block": block_key, "exam_block_label": label} for question in questions]


def build_exam_block_summary(common_blocks: dict[str, dict[str, Any]], questions: list[dict[str, Any]]) -> list[dict[str, Any]]:
    return [
        {
            "key": key,
            "label": meta["label"],
            "required_count": int(meta["count"]),
            "actual_count": sum(1 for question in questions if question.get("exam_block") == key),
        }
        for key, meta in common_blocks.items()
    ]

