from __future__ import annotations

import re


def clean_text(value: str | None) -> str:
    return re.sub(r"\s+", " ", (value or "").replace("\xa0", " ")).strip()


def strip_pagination_tail(value: str | None) -> str:
    text = clean_text(value)
    return re.sub(r"(?:\s*\d{1,2}){8,}\s*$", "", text).strip()


def strip_heading_echo(value: str | None, heading: str | None) -> str:
    text = clean_text(value)
    title = clean_text(heading)
    if not text or not title:
        return text
    escaped = re.escape(title)
    text = re.sub(rf"^\s*{escaped}\s*", "", text, flags=re.IGNORECASE).strip()
    text = re.sub(rf"\s*{escaped}\s*$", "", text, flags=re.IGNORECASE).strip()
    return text


def sanitize_text_block(value: str | None, heading: str | None = None) -> str:
    text = strip_pagination_tail(value)
    text = strip_heading_echo(text, heading)
    return clean_text(text)

