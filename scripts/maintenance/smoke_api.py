from __future__ import annotations

import os
import sys
from pathlib import Path

BACKEND_DIR = Path(__file__).resolve().parents[2] / "backend"
if str(BACKEND_DIR) not in sys.path:
    sys.path.insert(0, str(BACKEND_DIR))

os.environ.setdefault("DATABASE_URL", "postgresql://user:pass@localhost:5432/pdrprep")
os.environ.setdefault("JWT_SECRET", "smoke-test-secret")

from fastapi.testclient import TestClient  # noqa: E402

import main  # noqa: E402


def main_smoke() -> int:
    client = TestClient(main.app)
    response = client.get("/api/health")
    print(response.status_code, response.json())
    return 0 if response.status_code == 200 and response.json().get("status") == "ok" else 1


if __name__ == "__main__":
    raise SystemExit(main_smoke())
