from __future__ import annotations

import json
import random
import smtplib
import string
import urllib.error
import urllib.request
from email.mime.multipart import MIMEMultipart
from email.mime.text import MIMEText
from typing import Any

from fastapi import HTTPException

from core.config import (
    EMAIL_FROM,
    EMAIL_PROVIDER,
    IS_PRODUCTION,
    RESEND_API_KEY,
    SMTP_HOST,
    SMTP_PASS,
    SMTP_PORT,
    SMTP_SECURE,
    SMTP_TIMEOUT,
    SMTP_USER,
)

def mask_email(email: str) -> str:
    local, _, domain = str(email).partition("@")
    if not domain:
        return "***"
    visible = local[:2] if len(local) > 2 else local[:1]
    return f"{visible}***@{domain}"


def send_email_with_resend(to_email: str, subject: str, body: str) -> bool:
    if not RESEND_API_KEY:
        print("[EMAIL RESEND] missing RESEND_API_KEY", flush=True)
        return False

    payload = json.dumps(
        {
            "from": EMAIL_FROM,
            "to": [to_email],
            "subject": subject,
            "html": body,
        }
    ).encode("utf-8")
    request = urllib.request.Request(
        "https://api.resend.com/emails",
        data=payload,
        method="POST",
        headers={
            "Authorization": f"Bearer {RESEND_API_KEY}",
            "Content-Type": "application/json",
        },
    )
    try:
        print(f"[EMAIL RESEND] sending to {mask_email(to_email)} from {EMAIL_FROM}", flush=True)
        with urllib.request.urlopen(request, timeout=SMTP_TIMEOUT) as response:
            raw = response.read().decode("utf-8", errors="replace")
            print(f"[EMAIL RESEND] sent to {mask_email(to_email)}: {response.status} {raw}", flush=True)
            return 200 <= response.status < 300
    except urllib.error.HTTPError as exc:
        raw = exc.read().decode("utf-8", errors="replace")
        print(f"[EMAIL RESEND ERROR] HTTP {exc.code}: {raw}", flush=True)
        return False
    except urllib.error.URLError as exc:
        print(f"[EMAIL RESEND ERROR] network: {exc}", flush=True)
        return False
    except TimeoutError as exc:
        print(f"[EMAIL RESEND ERROR] timeout after {SMTP_TIMEOUT}s: {exc}", flush=True)
        return False
    except Exception as exc:
        print(f"[EMAIL RESEND ERROR] {type(exc).__name__}: {exc}", flush=True)
        return False


def send_email_with_smtp(to_email: str, subject: str, body: str) -> bool:
    if not SMTP_USER or not SMTP_PASS:
        print(f"[EMAIL MOCK] missing SMTP credentials for {to_email}: {subject}", flush=True)
        return False

    masked_user = mask_email(SMTP_USER)
    try:
        print(
            f"[EMAIL] sending via {SMTP_HOST}:{SMTP_PORT} as {masked_user} to {mask_email(to_email)}",
            flush=True,
        )
        message = MIMEMultipart()
        message["From"] = SMTP_USER
        message["To"] = to_email
        message["Subject"] = subject
        message.attach(MIMEText(body, "html", "utf-8"))
        smtp_factory = smtplib.SMTP_SSL if SMTP_SECURE or SMTP_PORT == 465 else smtplib.SMTP
        with smtp_factory(SMTP_HOST, SMTP_PORT, timeout=SMTP_TIMEOUT) as smtp:
            smtp.ehlo()
            if smtp_factory is smtplib.SMTP:
                smtp.starttls()
                smtp.ehlo()
            smtp.login(SMTP_USER, SMTP_PASS)
            smtp.sendmail(SMTP_USER, to_email, message.as_string())
        print(f"[EMAIL] sent to {mask_email(to_email)}", flush=True)
        return True
    except smtplib.SMTPAuthenticationError as exc:
        print(f"[EMAIL ERROR] auth failed for {masked_user}: {exc.smtp_code} {exc.smtp_error!r}", flush=True)
        return False
    except smtplib.SMTPConnectError as exc:
        print(f"[EMAIL ERROR] connect failed to {SMTP_HOST}:{SMTP_PORT}: {exc}", flush=True)
        return False
    except smtplib.SMTPServerDisconnected as exc:
        print(f"[EMAIL ERROR] server disconnected {SMTP_HOST}:{SMTP_PORT}: {exc}", flush=True)
        return False
    except TimeoutError as exc:
        print(f"[EMAIL ERROR] timeout after {SMTP_TIMEOUT}s via {SMTP_HOST}:{SMTP_PORT}: {exc}", flush=True)
        return False
    except Exception as exc:
        print(f"[EMAIL ERROR] {type(exc).__name__} via {SMTP_HOST}:{SMTP_PORT}: {exc}", flush=True)
        return False


def send_email(to_email: str, subject: str, body: str) -> bool:
    if EMAIL_PROVIDER in {"resend", "api", "http"}:
        return send_email_with_resend(to_email, subject, body)
    if RESEND_API_KEY and EMAIL_PROVIDER == "auto":
        return send_email_with_resend(to_email, subject, body)
    return send_email_with_smtp(to_email, subject, body)


def email_delivery_response(sent: bool, code: str, message: str) -> dict[str, Any]:
    if sent:
        return {"message": message}
    if IS_PRODUCTION:
        raise HTTPException(
            503,
            "Не вдалося надіслати лист. Будь ласка, перевірте налаштування пошти або спробуйте трохи пізніше.",
        )
    return {"message": message, "dev_code": code}


def gen_code(length: int = 6) -> str:
    return "".join(random.choices(string.digits, k=length))
