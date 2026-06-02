from __future__ import annotations

from datetime import datetime
from typing import Any, Optional

import psycopg


def add_months(base_value: datetime, months: int) -> datetime:
    month_index = base_value.month - 1 + months
    year = base_value.year + month_index // 12
    month = month_index % 12 + 1
    day = min(base_value.day, 28)
    return base_value.replace(year=year, month=month, day=day)


class PaymentRepository:
    def __init__(self, conn: psycopg.Connection):
        self.conn = conn

    @staticmethod
    def _row(row: Any) -> Optional[dict[str, Any]]:
        return dict(row) if row else None

    def create_order(
        self,
        *,
        user_id: int,
        plan: dict[str, Any],
        provider: str,
        provider_order_id: str,
        checkout_url: Optional[str],
        provider_payload_json: str,
    ) -> dict[str, Any]:
        row = self.conn.execute(
            """
            INSERT INTO premium_orders (
                user_id, plan_code, amount, currency, provider, status,
                provider_order_id, checkout_url, provider_payload, created_at, updated_at
            )
            VALUES (%s, %s, %s, %s, %s, 'pending', %s, %s, %s::jsonb, NOW(), NOW())
            RETURNING *
            """,
            (
                user_id,
                plan["code"],
                int(plan["amount"]),
                plan["currency"],
                provider,
                provider_order_id,
                checkout_url,
                provider_payload_json,
            ),
        ).fetchone()
        return dict(row)

    def update_order_checkout_payload(
        self,
        *,
        order_id: int,
        checkout_url: str,
        provider_payload_json: str,
    ) -> None:
        self.conn.execute(
            """
            UPDATE premium_orders
            SET provider_payload = %s::jsonb, checkout_url = %s, updated_at = NOW()
            WHERE id = %s
            """,
            (provider_payload_json, checkout_url, order_id),
        )

    def get_order_for_user(self, *, provider_order_id: str, user_id: int) -> Optional[dict[str, Any]]:
        row = self.conn.execute(
            """
            SELECT *
            FROM premium_orders
            WHERE provider_order_id = %s AND user_id = %s
            """,
            (provider_order_id, user_id),
        ).fetchone()
        return self._row(row)

    def list_admin_orders(self, *, limit: int) -> list[dict[str, Any]]:
        rows = self.conn.execute(
            """
            SELECT
                po.id,
                po.user_id,
                po.plan_code,
                po.amount,
                po.currency,
                po.provider,
                po.status,
                po.provider_order_id,
                po.provider_payment_id,
                po.checkout_url,
                po.created_at,
                po.activated_at,
                po.expires_at,
                u.email,
                u.username,
                u.name,
                u.surname,
                u.is_premium
            FROM premium_orders po
            LEFT JOIN users u ON u.id = po.user_id
            ORDER BY po.created_at DESC
            LIMIT %s
            """,
            (limit,),
        ).fetchall()
        return [dict(row) for row in rows]

    def get_order_by_provider_id(self, provider_order_id: str) -> Optional[dict[str, Any]]:
        row = self.conn.execute(
            "SELECT * FROM premium_orders WHERE provider_order_id = %s",
            (provider_order_id,),
        ).fetchone()
        return self._row(row)

    def get_user(self, user_id: int) -> Optional[dict[str, Any]]:
        return self._row(self.conn.execute("SELECT * FROM users WHERE id = %s", (user_id,)).fetchone())

    def activate_order(
        self,
        *,
        order: dict[str, Any],
        plan_months: int,
        provider_payment_id: Optional[str] = None,
    ) -> dict[str, Any]:
        now = datetime.utcnow()
        expires_at = add_months(now, plan_months)
        self.conn.execute(
            """
            UPDATE premium_orders
            SET status = 'paid',
                provider_payment_id = COALESCE(%s, provider_payment_id),
                activated_at = %s,
                expires_at = %s,
                updated_at = %s
            WHERE id = %s
            """,
            (provider_payment_id, now, expires_at, now, order["id"]),
        )
        self.conn.execute(
            """
            UPDATE users
            SET is_premium = TRUE
            WHERE id = %s
            """,
            (order["user_id"],),
        )
        updated = self.conn.execute("SELECT * FROM premium_orders WHERE id = %s", (order["id"],)).fetchone()
        return dict(updated) if updated else {}

    def update_order_status(
        self,
        *,
        order_id: int,
        status: str,
        provider_payment_id: Optional[str],
        provider_payload_json: str,
    ) -> None:
        self.conn.execute(
            """
            UPDATE premium_orders
            SET status = %s,
                provider_payment_id = COALESCE(%s, provider_payment_id),
                provider_payload = %s::jsonb,
                updated_at = NOW()
            WHERE id = %s
            """,
            (status, provider_payment_id, provider_payload_json, order_id),
        )
