from __future__ import annotations

from collections.abc import Callable
from typing import Any, Optional
from uuid import uuid4

from core.config import (
    FRONTEND_URL,
    IS_PRODUCTION,
    LIQPAY_PRIVATE_KEY,
    LIQPAY_PUBLIC_KEY,
    MONO_JAR_CARD,
    MONO_JAR_URL,
    PAYMENT_MODE,
)
from core.database import db
from repositories.payment_repository import PaymentRepository
from schemas.requests import PremiumCheckoutRequest
from services.errors import ServiceError


PlanResolver = Callable[[str], dict[str, Any]]
JsonDumper = Callable[[Any], str]
LiqpayPayloadBuilder = Callable[..., dict[str, Any]]
LiqpayPayloadEncoder = Callable[[dict[str, Any]], tuple[str, str]]
LiqpaySignatureVerifier = Callable[[str, str], bool]
LiqpayPayloadDecoder = Callable[[str], dict[str, Any]]
UserPresenter = Callable[[dict[str, Any]], dict[str, Any]]

LIQPAY_CHECKOUT_URL = "https://www.liqpay.ua/api/3/checkout"


def _resolve_provider() -> str:
    if PAYMENT_MODE == "liqpay":
        if not LIQPAY_PUBLIC_KEY or not LIQPAY_PRIVATE_KEY:
            raise ServiceError(
                503,
                "Оплата LiqPay ще не налаштована. Додайте ключі LiqPay у змінні середовища.",
            )
        return "liqpay"
    if PAYMENT_MODE in {"mono", "mono_manual", "monobank", "jar"}:
        if not MONO_JAR_URL:
            raise ServiceError(503, "Посилання на mono Банку ще не налаштоване.")
        return "mono_manual"
    if PAYMENT_MODE == "mock":
        if MONO_JAR_URL:
            return "mono_manual"
        if not IS_PRODUCTION:
            return "mock"
    raise ServiceError(
        503,
        "Оплата тимчасово недоступна. Будь ласка, спробуйте трохи пізніше.",
    )


def _checkout_return_url(return_url: Optional[str], order_id: str) -> str:
    result_url = return_url or f"{FRONTEND_URL.rstrip('/')}/pricing?checkout=success"
    separator = "&" if "?" in result_url else "?"
    return f"{result_url}{separator}orderId={order_id}"


def create_premium_checkout(
    req: PremiumCheckoutRequest,
    user: dict[str, Any],
    *,
    get_plan: PlanResolver,
    build_liqpay_payload: LiqpayPayloadBuilder,
    encode_liqpay_payload: LiqpayPayloadEncoder,
    dump_json: JsonDumper,
) -> dict[str, Any]:
    plan = get_plan(req.plan_code)
    provider = _resolve_provider()
    order_uuid = f"premium_{user['id']}_{uuid4().hex[:16]}"
    result_url = _checkout_return_url(req.return_url, order_uuid)
    checkout_url = LIQPAY_CHECKOUT_URL if provider == "liqpay" else (MONO_JAR_URL or None)
    provider_payload: dict[str, Any] = {}
    if provider == "mono_manual":
        provider_payload = {
            "jar_url": MONO_JAR_URL,
            "jar_card": MONO_JAR_CARD,
            "order_id": order_uuid,
            "user_id": int(user["id"]),
            "user_email": user.get("email"),
            "amount": int(plan["amount"]),
            "currency": plan["currency"],
            "manual_confirmation": True,
        }

    with db() as conn:
        repo = PaymentRepository(conn)
        order = repo.create_order(
            user_id=int(user["id"]),
            plan=plan,
            provider=provider,
            provider_order_id=order_uuid,
            checkout_url=checkout_url,
            provider_payload_json=dump_json(provider_payload),
        )
        response_payload: dict[str, Any] = {
            "provider": provider,
            "order_id": order_uuid,
            "order_db_id": order["id"],
            "status": order["status"],
            "plan_code": plan["code"],
            "amount": int(plan["amount"]),
            "currency": plan["currency"],
            "is_premium": bool(user.get("is_premium", False)),
        }

        if provider == "liqpay":
            liqpay_payload = build_liqpay_payload(order_id=order_uuid, plan=plan, result_url=result_url)
            data, signature = encode_liqpay_payload(liqpay_payload)
            repo.update_order_checkout_payload(
                order_id=int(order["id"]),
                checkout_url=LIQPAY_CHECKOUT_URL,
                provider_payload_json=dump_json(liqpay_payload),
            )
            conn.commit()
            response_payload.update(
                {
                    "checkout_action": LIQPAY_CHECKOUT_URL,
                    "data": data,
                    "signature": signature,
                    "public_key": LIQPAY_PUBLIC_KEY,
                }
            )
            return response_payload

        if provider == "mono_manual":
            conn.commit()
            response_payload.update(
                {
                    "checkout_url": checkout_url,
                    "jar_url": MONO_JAR_URL,
                    "jar_card": MONO_JAR_CARD,
                    "manual_confirmation": True,
                    "payment_note": (
                        f"DrivePrep Premium, {plan['months']} міс., "
                        f"{user.get('email') or 'email профілю'}, order {order_uuid}"
                    ),
                }
            )
            return response_payload

        conn.commit()
        response_payload["mock_checkout"] = True
        return response_payload


def list_admin_premium_orders(*, limit: int) -> list[dict[str, Any]]:
    with db() as conn:
        return PaymentRepository(conn).list_admin_orders(limit=limit)


def activate_admin_premium_order(
    order_id: int,
    *,
    get_plan: PlanResolver,
) -> dict[str, Any]:
    with db() as conn:
        repo = PaymentRepository(conn)
        order = repo.get_order_by_id(order_id)
        if not order:
            raise ServiceError(404, "Замовлення не знайдено")
        if order["status"] in {"paid", "activated"}:
            refreshed_user = repo.get_user(int(order["user_id"]))
            return {"status": order["status"], "order": order, "user": refreshed_user}

        plan = get_plan(order["plan_code"])
        activated = repo.activate_order(
            order=order,
            plan_months=int(plan["months"]),
            provider_payment_id=f"manual_{uuid4().hex[:12]}",
        )
        conn.commit()
        refreshed_user = repo.get_user(int(order["user_id"]))

    return {"status": "paid", "order": activated, "user": refreshed_user}


def get_payment_status(order_id: str, user: dict[str, Any]) -> dict[str, Any]:
    with db() as conn:
        repo = PaymentRepository(conn)
        order = repo.get_order_for_user(provider_order_id=order_id, user_id=int(user["id"]))
        if not order:
            raise ServiceError(404, "Замовлення не знайдено")
        refreshed_user = repo.get_user(int(user["id"]))
    return {
        "order": order,
        "is_premium": bool(refreshed_user["is_premium"]) if refreshed_user else False,
    }


def activate_mock_payment(
    order_id: str,
    user: dict[str, Any],
    *,
    get_plan: PlanResolver,
    present_user: UserPresenter,
) -> dict[str, Any]:
    if IS_PRODUCTION:
        raise ServiceError(403, "Mock-активація вимкнена у production-режимі")
    if PAYMENT_MODE == "liqpay" and LIQPAY_PUBLIC_KEY and LIQPAY_PRIVATE_KEY:
        raise ServiceError(403, "Mock-активація вимкнена у production-режимі")

    with db() as conn:
        repo = PaymentRepository(conn)
        order = repo.get_order_for_user(provider_order_id=order_id, user_id=int(user["id"]))
        if not order:
            raise ServiceError(404, "Замовлення не знайдено")
        plan = get_plan(order["plan_code"])
        activated = repo.activate_order(
            order=order,
            plan_months=int(plan["months"]),
            provider_payment_id=f"mock_{uuid4().hex[:12]}",
        )
        conn.commit()
        refreshed_user = repo.get_user(int(user["id"]))

    return {
        "status": "paid",
        "order": activated,
        "user": present_user(refreshed_user) if refreshed_user else None,
    }


def handle_liqpay_callback(
    data: str,
    signature: str,
    *,
    verify_signature: LiqpaySignatureVerifier,
    decode_payload: LiqpayPayloadDecoder,
    dump_json: JsonDumper,
    get_plan: PlanResolver,
) -> dict[str, Any]:
    if not data or not signature:
        raise ServiceError(400, "Missing data or signature")
    if not verify_signature(data, signature):
        raise ServiceError(400, "Invalid signature")

    payload = decode_payload(data)
    order_id = str(payload.get("order_id") or "").strip()
    status = str(payload.get("status") or "").strip().lower()
    payment_id = payload.get("payment_id") or payload.get("transaction_id")
    if not order_id:
        raise ServiceError(400, "Відсутній order_id")

    with db() as conn:
        repo = PaymentRepository(conn)
        order = repo.get_order_by_provider_id(order_id)
        if not order:
            raise ServiceError(404, "Замовлення не знайдено")

        if status in {"success", "subscribed", "sandbox"}:
            plan = get_plan(order["plan_code"])
            updated = repo.activate_order(
                order=order,
                plan_months=int(plan["months"]),
                provider_payment_id=str(payment_id) if payment_id else None,
            )
            conn.commit()
            return {"ok": True, "status": "paid", "order": updated}

        repo.update_order_status(
            order_id=int(order["id"]),
            status=status or "failed",
            provider_payment_id=str(payment_id) if payment_id else None,
            provider_payload_json=dump_json(payload),
        )
        conn.commit()

    return {"ok": True, "status": status or "accepted"}
