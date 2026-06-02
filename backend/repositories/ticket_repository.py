from __future__ import annotations

from typing import Any

import psycopg


class TicketRepository:
    def __init__(self, conn: psycopg.Connection):
        self.conn = conn

    def list_legacy_tickets(self) -> dict[str, Any]:
        rows = self.conn.execute(
            """
            SELECT ticket_number, COUNT(*) AS questions_count
            FROM questions
            WHERE ticket_number IS NOT NULL
            GROUP BY ticket_number
            ORDER BY ticket_number
            """
        ).fetchall()
        tickets = [
            {
                "ticket_number": int(row["ticket_number"]),
                "questions_count": int(row["questions_count"]),
            }
            for row in rows
        ]
        return {"tickets": tickets, "total": len(tickets)}

    def get_legacy_ticket_questions(self, ticket_number: int) -> list[dict[str, Any]]:
        rows = self.conn.execute(
            """
            SELECT *
            FROM questions
            WHERE ticket_number = %s
            ORDER BY COALESCE(question_number, num_in_section, id), id
            """,
            (ticket_number,),
        ).fetchall()
        return [dict(row) for row in rows]
