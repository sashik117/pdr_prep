from __future__ import annotations

import json
from datetime import datetime
from typing import Any

import psycopg

class BattleRepository:
    def __init__(self, conn: psycopg.Connection):
        self.conn = conn

    def get_battle(self, battle_id: int) -> dict[str, Any] | None:
        row = self.conn.execute("SELECT * FROM battles WHERE id = %s", (battle_id,)).fetchone()
        return dict(row) if row else None

    def list_battles_for_email(self, email: str) -> list[dict[str, Any]]:
        rows = self.conn.execute(
            """
            SELECT *
            FROM battles
            WHERE challenger_email = %s OR opponent_email = %s
            ORDER BY created_at DESC
            """,
            (email, email),
        ).fetchall()
        return [dict(row) for row in rows]

    def get_questions_by_ids(self, question_ids: list[Any]) -> dict[str, dict[str, Any]]:
        if not question_ids:
            return {}
        rows = self.conn.execute("SELECT * FROM questions WHERE id = ANY(%s)", (question_ids,)).fetchall()
        return {str(row["id"]): dict(row) for row in rows}

    def get_questions_ordered(self, question_ids: list[Any]) -> list[dict[str, Any]]:
        if not question_ids:
            return []
        by_id = self.get_questions_by_ids(question_ids)
        return [by_id[str(question_id)] for question_id in question_ids if str(question_id) in by_id]

    def get_battle_user(self, email: str) -> dict[str, Any] | None:
        row = self.conn.execute(
            "SELECT id, username, surname, avatar_url, avatar_version, active_frame FROM users WHERE email = %s",
            (email,),
        ).fetchone()
        return dict(row) if row else None

    def get_username_by_email(self, email: str) -> str | None:
        row = self.conn.execute("SELECT username FROM users WHERE email = %s", (email,)).fetchone()
        return row["username"] if row else None

    def active_battle_between(self, *, challenger_email: str, opponent_email: str) -> dict[str, Any] | None:
        row = self.conn.execute(
            """
            SELECT *
            FROM battles
            WHERE LEAST(challenger_email, opponent_email) = LEAST(%s, %s)
              AND GREATEST(challenger_email, opponent_email) = GREATEST(%s, %s)
              AND status IN ('pending', 'active')
            ORDER BY created_at DESC
            LIMIT 1
            """,
            (challenger_email, opponent_email, challenger_email, opponent_email),
        ).fetchone()
        return dict(row) if row else None

    def create_battle(
        self,
        *,
        challenger_email: str,
        challenger_name: str,
        opponent_email: str,
        opponent_name: str,
        category: str,
        question_ids: list[Any],
        expires_at: datetime,
    ) -> dict[str, Any]:
        row = self.conn.execute(
            """
            INSERT INTO battles (
                challenger_email, challenger_name, opponent_email, opponent_name,
                status, category, question_ids, expires_at
            )
            VALUES (%s, %s, %s, %s, 'pending', %s, %s::jsonb, %s)
            RETURNING *
            """,
            (
                challenger_email,
                challenger_name,
                opponent_email,
                opponent_name,
                category,
                json.dumps(question_ids, ensure_ascii=False),
                expires_at,
            ),
        ).fetchone()
        return dict(row)

    def accepted_friendship_exists(self, *, first_user_id: int, second_user_id: int) -> bool:
        row = self.conn.execute(
            """
            SELECT id
            FROM friendships
            WHERE status = 'accepted'
              AND LEAST(requester_id, addressee_id) = LEAST(%s, %s)
              AND GREATEST(requester_id, addressee_id) = GREATEST(%s, %s)
            """,
            (first_user_id, second_user_id, first_user_id, second_user_id),
        ).fetchone()
        return bool(row)

    def create_battle_invite_message(
        self,
        *,
        to_email: str,
        from_email: str,
        from_name: str,
        battle_id: int,
        category: str,
    ) -> None:
        self.conn.execute(
            """
            INSERT INTO messages (to_email, from_email, from_name, content, type, result_data)
            VALUES (%s, %s, %s, %s, 'result_share', %s::jsonb)
            """,
            (
                to_email,
                from_email,
                from_name,
                "Запрошення на батл",
                json.dumps({"kind": "battle_invite", "battle_id": battle_id, "category": category}, ensure_ascii=False),
            ),
        )

    def activate_battle(self, *, battle_id: int, expires_at: datetime) -> None:
        self.conn.execute("UPDATE battles SET status = 'active', expires_at = %s WHERE id = %s", (expires_at, battle_id))

    def mark_declined(self, *, battle_id: int, seen_column: str) -> None:
        self.conn.execute(
            f"""
            UPDATE battles
            SET status = 'declined',
                winner_email = NULL,
                {seen_column} = NOW()
            WHERE id = %s
            """,
            (battle_id,),
        )

    def mark_seen(self, *, battle: dict[str, Any], role: str) -> dict[str, Any]:
        column = "challenger_seen_at" if role == "challenger" else "opponent_seen_at" if role == "opponent" else None
        if not column or battle.get(column):
            return battle
        self.conn.execute(f"UPDATE battles SET {column} = NOW() WHERE id = %s", (battle["id"],))
        battle[column] = self.conn.execute("SELECT NOW() AS now").fetchone()["now"]
        return battle

    def save_expired_finalization(self, battle: dict[str, Any]) -> None:
        self.conn.execute(
            """
            UPDATE battles
            SET status = %s,
                winner_email = %s
            WHERE id = %s
            """,
            (battle["status"], battle.get("winner_email"), battle["id"]),
        )

    def save_submission(self, battle: dict[str, Any]) -> None:
        self.conn.execute(
            """
            UPDATE battles
            SET status = %s,
                challenger_answers = %s::jsonb,
                opponent_answers = %s::jsonb,
                challenger_score = %s,
                opponent_score = %s,
                challenger_time = %s,
                opponent_time = %s,
                winner_email = %s,
                expires_at = %s,
                finished_at = %s
            WHERE id = %s
            """,
            (
                battle["status"],
                json.dumps(battle["challenger_answers"], ensure_ascii=False),
                json.dumps(battle["opponent_answers"], ensure_ascii=False),
                battle["challenger_score"],
                battle["opponent_score"],
                battle["challenger_time"],
                battle["opponent_time"],
                battle.get("winner_email"),
                battle.get("expires_at"),
                battle.get("finished_at"),
                battle["id"],
            ),
        )

    def get_user_id_by_email(self, email: str) -> int | None:
        row = self.conn.execute("SELECT id FROM users WHERE LOWER(email) = LOWER(%s)", (email,)).fetchone()
        return int(row["id"]) if row else None

    def create_battle_progress(
        self,
        *,
        user_id: int,
        battle_id: int,
        question_ids: list[Any],
        answers: dict[str, str],
        questions_by_id: dict[str, dict[str, Any]],
        score: int,
        time_seconds: int,
    ) -> None:
        client_attempt_id = f"battle:{battle_id}:user:{user_id}"
        inserted = self.conn.execute(
            """
            INSERT INTO test_results (user_id, section, mode, total, correct, time_seconds, client_attempt_id)
            VALUES (%s, %s, 'battle', %s, %s, %s, %s)
            ON CONFLICT (user_id, client_attempt_id) WHERE client_attempt_id IS NOT NULL DO NOTHING
            RETURNING id
            """,
            (user_id, "battle", len(question_ids), score, int(time_seconds or 0), client_attempt_id),
        ).fetchone()
        if not inserted:
            return

        self.conn.execute(
            """
            UPDATE users
            SET total_tests = total_tests + 1,
                total_correct = total_correct + %s,
                total_answers = total_answers + %s
            WHERE id = %s
            """,
            (score, len(question_ids), user_id),
        )

        answer_rows: list[tuple[int, int, bool, None]] = []
        for question_id in question_ids:
            key = str(question_id)
            question = questions_by_id.get(key)
            if not question:
                continue
            label = str(answers.get(key) or "").strip().upper()
            if not label:
                continue
            index = ["A", "B", "C", "D", "E", "F"].index(label) + 1 if label in ["A", "B", "C", "D", "E", "F"] else 0
            if index <= 0:
                continue
            answer_rows.append((int(question_id), index, index == int(question.get("correct_ans") or 0), None))

        if answer_rows:
            with self.conn.cursor() as cursor:
                cursor.executemany(
                    """
                    INSERT INTO user_answers (user_id, question_id, selected_index, is_correct, time_ms)
                    SELECT %s, %s, %s, %s, %s
                    WHERE EXISTS (SELECT 1 FROM questions WHERE id = %s)
                    """,
                    [
                        (user_id, question_id, selected_index, is_correct, time_ms, question_id)
                        for question_id, selected_index, is_correct, time_ms in answer_rows
                    ],
                )
