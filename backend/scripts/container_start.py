#!/usr/bin/env python3
from __future__ import annotations

import os
import sys
import traceback
from urllib.parse import urlparse

import render_migrate


def _database_host(database_url: str) -> str:
    try:
        parsed = urlparse(database_url)
    except Exception:
        return "unparseable"
    return parsed.hostname or "missing-host"


def main() -> None:
    database_url = os.getenv("DATABASE_URL", "").strip()
    if not database_url:
        print("[container-start] DATABASE_URL is missing. Add it as a platform secret.", flush=True)
        raise SystemExit(1)

    print(f"[container-start] DATABASE_URL configured for host: {_database_host(database_url)}", flush=True)
    run_bootstrap = os.getenv("RUN_CONTAINER_BOOTSTRAP", "true").strip().lower() not in {"0", "false", "no"}
    if run_bootstrap:
        print("[container-start] Running database bootstrap...", flush=True)
        try:
            render_migrate.main()
        except Exception:
            print("[container-start] Database bootstrap failed:", flush=True)
            traceback.print_exc()
            raise SystemExit(1)
    else:
        print("[container-start] Database bootstrap skipped for this web machine.", flush=True)

    port = os.getenv("PORT", "8000")
    print(f"[container-start] Starting API on port {port}...", flush=True)
    os.execvp(
        "uvicorn",
        ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", port, "--app-dir", "backend"],
    )


if __name__ == "__main__":
    main()
