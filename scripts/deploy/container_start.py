#!/usr/bin/env python3
from __future__ import annotations

import os
import traceback
from urllib.parse import urlparse


def _database_host(database_url: str) -> str:
    try:
        parsed = urlparse(database_url)
    except Exception:
        return "unparseable"
    return parsed.hostname or "missing-host"


def main() -> None:
    database_url = (os.getenv("DATABASE_URL") or os.getenv("POSTGRES_URI") or "").strip()
    if not database_url:
        print("[container-start] DATABASE_URL or POSTGRES_URI is missing. Add it as a platform secret.", flush=True)
        raise SystemExit(1)

    os.environ.setdefault("DATABASE_URL", database_url)
    print(f"[container-start] database URL configured for host: {_database_host(database_url)}", flush=True)
    run_bootstrap = os.getenv("RUN_CONTAINER_BOOTSTRAP", "false").strip().lower() in {"1", "true", "yes"}
    if run_bootstrap:
        print("[container-start] Running database bootstrap...", flush=True)
        try:
            import render_migrate

            render_migrate.main()
        except Exception:
            print("[container-start] Database bootstrap failed:", flush=True)
            traceback.print_exc()
            raise SystemExit(1)
    else:
        print("[container-start] Database bootstrap skipped for this web machine.", flush=True)
        sync_question_media = os.getenv("RUN_QUESTION_IMAGE_SYNC", "true").strip().lower() in {"1", "true", "yes"}
        if sync_question_media:
            print("[container-start] Syncing bundled question image paths...", flush=True)
            try:
                import json

                import psycopg
                from database_setup import DATABASE_URL, QUESTIONS_FILE, flatten_questions, sync_question_images

                raw_data = json.loads(QUESTIONS_FILE.read_text(encoding="utf-8"))
                questions = flatten_questions(raw_data)
                with psycopg.connect(DATABASE_URL) as conn:
                    sync_question_images(conn, questions)
            except Exception:
                print("[container-start] Question image sync failed:", flush=True)
                traceback.print_exc()
                raise SystemExit(1)

    port = os.getenv("PORT", "8000")
    print(f"[container-start] Starting API on port {port}...", flush=True)
    os.execvp(
        "uvicorn",
        ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", port, "--app-dir", "backend"],
    )


if __name__ == "__main__":
    main()
