from __future__ import annotations

from pydantic import BaseModel


class TicketSummaryOut(BaseModel):
    ticket_number: int
    questions_count: int


class TicketQuestionOut(BaseModel):
    id: int
    ticket_number: int | None = None
    question_number: int | None = None
    question_text: str
    explanation: str | None = None
    explanation_html: str | None = None

