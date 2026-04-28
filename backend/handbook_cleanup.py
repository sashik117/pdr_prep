from pathlib import Path

import psycopg
from dotenv import load_dotenv
import os

load_dotenv()

BASE_DIR = Path(__file__).resolve().parent
DB_URL = os.environ["DATABASE_URL"]
SQL_PATH = BASE_DIR / "handbook_cleanup.sql"


def main() -> None:
    sql = SQL_PATH.read_text(encoding="utf-8")
    with psycopg.connect(DB_URL) as conn:
        with conn.cursor() as cur:
            cur.execute(sql)
        conn.commit()
    print("handbook_data cleaned successfully")


if __name__ == "__main__":
    main()
