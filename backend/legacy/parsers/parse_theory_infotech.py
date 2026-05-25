from __future__ import annotations

"""
Compatibility entrypoint for the new theory parser package.

For this first migration pass we keep the proven import pipeline from
`import_handbook.py`, but move the public entrypoint into `backend/parsers`
so the project structure can evolve without breaking existing workflows.
"""

import sys
from pathlib import Path

BASE_DIR = Path(__file__).resolve().parents[1]
if str(BASE_DIR) not in sys.path:
    sys.path.insert(0, str(BASE_DIR))

from import_handbook import main


if __name__ == "__main__":
    main()
