#!/usr/bin/env python3
from __future__ import annotations

from render_migrate import main


if __name__ == "__main__":
    print("[northflank-bootstrap] Starting database bootstrap...", flush=True)
    main()
    print("[northflank-bootstrap] Done.", flush=True)
