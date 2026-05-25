from __future__ import annotations

from pydantic import BaseModel


class TheoryCategoryOut(BaseModel):
    slug: str
    title: str
    description: str | None = None
    sort_order: int = 0


class TheoryTopicOut(BaseModel):
    id: int
    slug: str
    title: str
    description: str | None = None
    topic_type: str = "topic"
    sort_order: int = 0
    source_url: str | None = None


class TheorySectionOut(BaseModel):
    id: int
    slug: str
    title: str
    description: str | None = None
    content_html: str = ""
    content_text: str = ""
    sort_order: int = 0
    source_url: str | None = None

