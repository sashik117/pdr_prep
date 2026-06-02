from __future__ import annotations

from collections.abc import Callable
from typing import Any

from core.database import db
from repositories.ticket_repository import TicketRepository
from services.errors import ServiceError


QuestionSanitizer = Callable[[dict[str, Any]], dict[str, Any]]
CategoryNormalizer = Callable[[str | None], str | None]


def list_tickets(*, category: str | None, normalize_category: CategoryNormalizer, mvs_ticket_count: int) -> dict[str, Any]:
    normalized = normalize_category(category)
    if normalized:
        tickets = [
            {
                "ticket_number": number,
                "questions_count": 20,
                "category": normalized,
                "source": "mvs_exam",
            }
            for number in range(1, mvs_ticket_count + 1)
        ]
        return {"tickets": tickets, "total": len(tickets), "category": normalized}
    with db() as conn:
        return TicketRepository(conn).list_legacy_tickets()


def get_ticket(
    *,
    ticket_number: int,
    category: str | None,
    normalize_category: CategoryNormalizer,
    mvs_ticket_count: int,
    build_mvs_questions: Callable[[str, str], list[dict[str, Any]]],
    sanitize_question: QuestionSanitizer,
) -> dict[str, Any]:
    normalized = normalize_category(category)
    if normalized:
        if ticket_number < 1 or ticket_number > mvs_ticket_count:
            raise ServiceError(404, "Білет не знайдено")
        prepared = build_mvs_questions(normalized, f"ticket:{normalized}:{ticket_number}")
        return {
            "ticket_number": ticket_number,
            "category": normalized,
            "source": "mvs_exam",
            "questions_count": len(prepared),
            "questions": prepared,
        }

    with db() as conn:
        rows = TicketRepository(conn).get_legacy_ticket_questions(ticket_number)
    if not rows:
        raise ServiceError(404, "Білет не знайдено")
    prepared = [sanitize_question(row) for row in rows]
    return {
        "ticket_number": ticket_number,
        "questions_count": len(prepared),
        "questions": prepared,
    }
