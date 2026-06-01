from __future__ import annotations

import psycopg
from psycopg import sql
from psycopg.rows import dict_row

from core.config import DATABASE_SCHEMA, DB_URL


def db():
    conn = psycopg.connect(DB_URL, row_factory=dict_row)
    if DATABASE_SCHEMA:
        if not DATABASE_SCHEMA.replace("_", "").isalnum() or DATABASE_SCHEMA[0].isdigit():
            raise RuntimeError("DATABASE_SCHEMA must contain only letters, numbers, and underscores, and cannot start with a number")
        conn.execute(sql.SQL("SET search_path TO {}, public").format(sql.Identifier(DATABASE_SCHEMA)))
    conn.execute("SET lock_timeout TO '2000ms'")
    conn.execute("SET statement_timeout TO '20000ms'")
    return conn
