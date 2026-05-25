from __future__ import annotations

import base64
import hashlib
import json
import os
from typing import Any, Optional

PUBLIC_KEY = os.getenv("LIQPAY_PUBLIC_KEY", "")
PRIVATE_KEY = os.getenv("LIQPAY_PRIVATE_KEY", "")


def _sign(data: str) -> str:
    raw = f"{PRIVATE_KEY}{data}{PRIVATE_KEY}"
    sha = hashlib.sha1(raw.encode("utf-8")).digest()
    return base64.b64encode(sha).decode("utf-8")


def create_payment_data(
    *,
    amount: float,
    order_id: str,
    description: str,
    result_url: str,
    server_url: str,
    currency: str = "UAH",
) -> dict[str, str]:
    params = {
        "public_key": PUBLIC_KEY,
        "version": "3",
        "action": "pay",
        "amount": str(amount),
        "currency": currency,
        "description": description,
        "order_id": order_id,
        "result_url": result_url,
        "server_url": server_url,
    }
    if PUBLIC_KEY.startswith("sandbox_"):
        params["sandbox"] = "1"

    data = base64.b64encode(json.dumps(params, ensure_ascii=False).encode("utf-8")).decode("utf-8")
    return {"data": data, "signature": _sign(data)}


def decode_callback(data: str, signature: str) -> Optional[dict[str, Any]]:
    if not data or not signature:
        return None
    if _sign(data) != signature:
        return None
    return json.loads(base64.b64decode(data).decode("utf-8"))
