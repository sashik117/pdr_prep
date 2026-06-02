from __future__ import annotations

from datetime import datetime
from typing import Any, Optional

import psycopg

from domain.auth import is_email_login, normalize_email, normalize_username


class AuthRepository:
    def __init__(self, conn: psycopg.Connection):
        self.conn = conn

    @staticmethod
    def _row(row: Any) -> Optional[dict[str, Any]]:
        return dict(row) if row else None

    def get_user_by_email(self, email: str) -> Optional[dict[str, Any]]:
        row = self.conn.execute(
            "SELECT * FROM users WHERE email = %s",
            (normalize_email(email),),
        ).fetchone()
        return self._row(row)

    def get_user_by_username(self, username: str) -> Optional[dict[str, Any]]:
        normalized = normalize_username(username)
        if not normalized:
            return None
        row = self.conn.execute(
            "SELECT * FROM users WHERE LOWER(username) = %s",
            (normalized,),
        ).fetchone()
        return self._row(row)

    def get_user_by_id(self, user_id: int) -> Optional[dict[str, Any]]:
        row = self.conn.execute("SELECT * FROM users WHERE id = %s", (user_id,)).fetchone()
        return self._row(row)

    def get_user_by_login(self, identifier: str) -> Optional[dict[str, Any]]:
        if is_email_login(identifier):
            return self.get_user_by_email(identifier)
        return self.get_user_by_username(identifier)

    def create_pending_user(
        self,
        *,
        name: str,
        surname: str,
        username: str,
        email: str,
        password_hash: str,
        email_code: str,
    ) -> None:
        self.conn.execute(
            """
            INSERT INTO users (name, surname, username, email, password_hash, email_code, email_verified)
            VALUES (%s, %s, %s, %s, %s, %s, false)
            """,
            (name, surname, username, normalize_email(email), password_hash, email_code),
        )

    def update_pending_registration(
        self,
        *,
        name: str,
        surname: str,
        username: str,
        email: str,
        password_hash: str,
        email_code: str,
    ) -> None:
        self.conn.execute(
            """
            UPDATE users
            SET name = %s, surname = %s, username = %s, password_hash = %s, email_code = %s
            WHERE email = %s
            """,
            (name, surname, username, password_hash, email_code, normalize_email(email)),
        )

    def set_email_verified(self, email: str) -> None:
        self.conn.execute(
            """
            UPDATE users
            SET email_verified = true, email_code = null
            WHERE email = %s
            """,
            (normalize_email(email),),
        )

    def set_email_code(self, email: str, code: str) -> None:
        self.conn.execute(
            "UPDATE users SET email_code = %s WHERE email = %s",
            (code, normalize_email(email)),
        )

    def set_reset_code(self, email: str, code: str, expires_at: datetime) -> None:
        self.conn.execute(
            """
            UPDATE users
            SET reset_code = %s, reset_code_exp = %s
            WHERE email = %s
            """,
            (code, expires_at, normalize_email(email)),
        )

    def update_password(self, email: str, password_hash: str) -> None:
        self.conn.execute(
            """
            UPDATE users
            SET password_hash = %s, reset_code = null, reset_code_exp = null
            WHERE email = %s
            """,
            (password_hash, normalize_email(email)),
        )
