from __future__ import annotations

from pathlib import Path

from psycopg import errors as psycopg_errors

from core.config import BASE_DIR
from core.database import db


def _schema_sql_path() -> Path:
    migration_path = BASE_DIR / "migrations" / "001_base_schema.sql"
    if migration_path.exists():
        return migration_path
    return BASE_DIR / "create_tables.sql"


def _schema_statements() -> list[str]:
    sql_path = _schema_sql_path()
    if not sql_path.exists():
        return []

    raw_sql = sql_path.read_text(encoding="utf-8")
    return [statement.strip() for statement in raw_sql.split(";") if statement.strip()]


def ensure_schema_tables() -> None:
    statements = [
        statement
        for statement in _schema_statements()
        if statement.upper().startswith("CREATE TABLE")
    ]
    with db() as conn:
        for statement in statements:
            conn.execute(statement)
        conn.commit()


def ensure_schema_indexes() -> None:
    statements = [
        statement
        for statement in _schema_statements()
        if not statement.upper().startswith("CREATE TABLE")
    ]
    if not statements:
        return

    with db() as conn:
        for statement in statements:
            try:
                conn.execute(statement)
            except (psycopg_errors.UndefinedColumn, psycopg_errors.UndefinedTable):
                if statement.upper().startswith("CREATE INDEX"):
                    continue
                raise
        conn.commit()


def ensure_runtime_migrations() -> None:
    statements = [
        "ALTER TABLE users ADD COLUMN IF NOT EXISTS surname TEXT",
        "ALTER TABLE users ADD COLUMN IF NOT EXISTS username TEXT",
        "ALTER TABLE users ADD COLUMN IF NOT EXISTS email_verified BOOLEAN NOT NULL DEFAULT FALSE",
        "ALTER TABLE users ADD COLUMN IF NOT EXISTS avatar_version INT NOT NULL DEFAULT 0",
        "ALTER TABLE users ADD COLUMN IF NOT EXISTS purchased_frames JSONB NOT NULL DEFAULT '[]'::jsonb",
        "ALTER TABLE users ADD COLUMN IF NOT EXISTS spent_stars INT NOT NULL DEFAULT 0",
        "ALTER TABLE users ADD COLUMN IF NOT EXISTS featured_achievements JSONB NOT NULL DEFAULT '[]'::jsonb",
        "ALTER TABLE users ADD COLUMN IF NOT EXISTS email_visible BOOLEAN NOT NULL DEFAULT TRUE",
        "ALTER TABLE users ADD COLUMN IF NOT EXISTS theme_preference TEXT NOT NULL DEFAULT 'system'",
        "ALTER TABLE users ADD COLUMN IF NOT EXISTS font_size INT NOT NULL DEFAULT 16",
        "ALTER TABLE users ADD COLUMN IF NOT EXISTS sound_enabled BOOLEAN NOT NULL DEFAULT TRUE",
        "ALTER TABLE users ADD COLUMN IF NOT EXISTS push_enabled BOOLEAN NOT NULL DEFAULT FALSE",
        "ALTER TABLE users ADD COLUMN IF NOT EXISTS is_blocked BOOLEAN NOT NULL DEFAULT FALSE",
        "ALTER TABLE users ADD COLUMN IF NOT EXISTS manual_star_adjustment INT NOT NULL DEFAULT 0",
        "ALTER TABLE users ADD COLUMN IF NOT EXISTS username_change_count INT NOT NULL DEFAULT 0",
        "ALTER TABLE users ADD COLUMN IF NOT EXISTS username_last_changed_at TIMESTAMP",
        "ALTER TABLE users ADD COLUMN IF NOT EXISTS streak_restores_left INT NOT NULL DEFAULT 3",
        "ALTER TABLE users ADD COLUMN IF NOT EXISTS streak_restores_month TEXT",
        "CREATE INDEX IF NOT EXISTS idx_users_username ON users(username)",
        """
        DO $$
        BEGIN
            IF EXISTS (
                SELECT 1
                FROM information_schema.columns
                WHERE table_name = 'users' AND column_name = 'email_confirmed'
            ) THEN
                EXECUTE '
                    UPDATE users
                    SET email_verified = true
                    WHERE COALESCE(email_verified, false) = false
                      AND COALESCE(email_confirmed, false) = true
                ';
            END IF;
        END $$;
        """,
        """
        UPDATE users
        SET username = LOWER(REGEXP_REPLACE(COALESCE(username, SPLIT_PART(email, '@', 1)), '[^a-zA-Z0-9_]+', '', 'g'))
        WHERE username IS NULL OR BTRIM(username) = ''
        """,
        """
        DO $$
        DECLARE
            duplicate_record RECORD;
        BEGIN
            FOR duplicate_record IN
                SELECT username
                FROM users
                WHERE username IS NOT NULL AND BTRIM(username) <> ''
                GROUP BY username
                HAVING COUNT(*) > 1
            LOOP
                UPDATE users
                SET username = CONCAT(username, '_', id)
                WHERE username = duplicate_record.username;
            END LOOP;
        END $$;
        """,
        "CREATE UNIQUE INDEX IF NOT EXISTS uq_users_username ON users (LOWER(username))",
        "ALTER TABLE users ADD COLUMN IF NOT EXISTS is_premium BOOLEAN NOT NULL DEFAULT FALSE",
        "ALTER TABLE questions ADD COLUMN IF NOT EXISTS section_name TEXT",
        "ALTER TABLE questions ADD COLUMN IF NOT EXISTS num_in_section INT",
        "ALTER TABLE questions ADD COLUMN IF NOT EXISTS ticket_number INT",
        "ALTER TABLE questions ADD COLUMN IF NOT EXISTS question_number INT",
        "ALTER TABLE questions ADD COLUMN IF NOT EXISTS category TEXT",
        "ALTER TABLE questions ADD COLUMN IF NOT EXISTS difficulty TEXT",
        "ALTER TABLE questions ADD COLUMN IF NOT EXISTS explanation TEXT",
        "ALTER TABLE questions ADD COLUMN IF NOT EXISTS explanation_html TEXT",
        "ALTER TABLE questions ADD COLUMN IF NOT EXISTS source_rule_slug TEXT",
        "ALTER TABLE questions ADD COLUMN IF NOT EXISTS theory_section_id INT",
        "ALTER TABLE questions ADD COLUMN IF NOT EXISTS images JSONB NOT NULL DEFAULT '[]'::jsonb",
        "ALTER TABLE questions ADD COLUMN IF NOT EXISTS page INT",
        "CREATE INDEX IF NOT EXISTS idx_questions_section ON questions(section)",
        "CREATE INDEX IF NOT EXISTS idx_questions_category ON questions(category)",
        "CREATE INDEX IF NOT EXISTS idx_questions_ticket_number ON questions(ticket_number)",
        "CREATE INDEX IF NOT EXISTS idx_questions_ticket_question ON questions(ticket_number, question_number)",
        "CREATE INDEX IF NOT EXISTS idx_questions_text ON questions USING gin (to_tsvector('simple', question_text))",
        """
        CREATE TABLE IF NOT EXISTS user_achievements (
            id SERIAL PRIMARY KEY,
            user_id INT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
            achievement_id TEXT NOT NULL,
            achievement_name TEXT,
            achievement_desc TEXT,
            tier INT,
            category TEXT,
            earned_at TIMESTAMP NOT NULL DEFAULT NOW(),
            UNIQUE (user_id, achievement_id)
        )
        """,
        "CREATE INDEX IF NOT EXISTS idx_user_achievements_user ON user_achievements(user_id)",
        """
        CREATE TABLE IF NOT EXISTS admin_media_files (
            id BIGSERIAL PRIMARY KEY,
            scope TEXT NOT NULL DEFAULT 'general',
            filename TEXT NOT NULL,
            content_type TEXT NOT NULL DEFAULT 'application/octet-stream',
            file_size INT NOT NULL DEFAULT 0,
            data BYTEA NOT NULL,
            uploaded_by TEXT,
            created_at TIMESTAMP NOT NULL DEFAULT NOW()
        )
        """,
        "CREATE INDEX IF NOT EXISTS idx_admin_media_files_scope ON admin_media_files(scope)",
        "ALTER TABLE test_results ADD COLUMN IF NOT EXISTS client_attempt_id TEXT",
        "CREATE UNIQUE INDEX IF NOT EXISTS uq_test_results_user_attempt ON test_results(user_id, client_attempt_id) WHERE client_attempt_id IS NOT NULL",
        """
        CREATE TABLE IF NOT EXISTS access_usage (
            id BIGSERIAL PRIMARY KEY,
            usage_date DATE NOT NULL,
            action TEXT NOT NULL,
            scope_hash TEXT NOT NULL,
            user_id INT REFERENCES users(id) ON DELETE CASCADE,
            guest_id TEXT,
            ip_hash TEXT,
            count INT NOT NULL DEFAULT 0,
            created_at TIMESTAMP NOT NULL DEFAULT NOW(),
            updated_at TIMESTAMP NOT NULL DEFAULT NOW(),
            UNIQUE (usage_date, action, scope_hash)
        )
        """,
        "CREATE INDEX IF NOT EXISTS idx_access_usage_user ON access_usage(user_id)",
        "CREATE INDEX IF NOT EXISTS idx_access_usage_guest ON access_usage(guest_id)",
        """
        DO $$
        BEGIN
            IF EXISTS (
                SELECT 1
                FROM information_schema.columns
                WHERE table_name = 'messages' AND column_name = 'read'
            ) AND NOT EXISTS (
                SELECT 1
                FROM information_schema.columns
                WHERE table_name = 'messages' AND column_name = 'is_read'
            ) THEN
                ALTER TABLE messages RENAME COLUMN read TO is_read;
            END IF;
        END $$;
        """,
        "ALTER TABLE messages ADD COLUMN IF NOT EXISTS from_name TEXT",
        "ALTER TABLE messages ADD COLUMN IF NOT EXISTS type TEXT NOT NULL DEFAULT 'text'",
        "ALTER TABLE messages ADD COLUMN IF NOT EXISTS result_data JSONB NOT NULL DEFAULT '{}'::jsonb",
        "ALTER TABLE messages ADD COLUMN IF NOT EXISTS is_read BOOLEAN NOT NULL DEFAULT FALSE",
        """
        CREATE TABLE IF NOT EXISTS handbook_data (
            id SERIAL PRIMARY KEY,
            topic_key TEXT NOT NULL,
            category TEXT,
            chapter_num INT,
            sort_order INT NOT NULL DEFAULT 0,
            section_title TEXT NOT NULL,
            source_url TEXT UNIQUE,
            source_slug TEXT UNIQUE,
            content_html TEXT NOT NULL,
            content_text TEXT NOT NULL DEFAULT '',
            image_paths JSONB NOT NULL DEFAULT '[]'::jsonb,
            created_at TIMESTAMP NOT NULL DEFAULT NOW()
        )
        """,
        "ALTER TABLE handbook_data ADD COLUMN IF NOT EXISTS topic_key TEXT",
        "ALTER TABLE handbook_data ADD COLUMN IF NOT EXISTS category TEXT",
        "ALTER TABLE handbook_data ADD COLUMN IF NOT EXISTS chapter_num INT",
        "ALTER TABLE handbook_data ADD COLUMN IF NOT EXISTS sort_order INT NOT NULL DEFAULT 0",
        "ALTER TABLE handbook_data ADD COLUMN IF NOT EXISTS source_url TEXT",
        "ALTER TABLE handbook_data ADD COLUMN IF NOT EXISTS source_slug TEXT",
        "ALTER TABLE handbook_data ADD COLUMN IF NOT EXISTS content_html TEXT",
        "ALTER TABLE handbook_data ADD COLUMN IF NOT EXISTS content_text TEXT NOT NULL DEFAULT ''",
        "ALTER TABLE handbook_data ADD COLUMN IF NOT EXISTS image_paths JSONB NOT NULL DEFAULT '[]'::jsonb",
        """
        DO $$
        BEGIN
            IF NOT EXISTS (
                SELECT 1
                FROM information_schema.columns
                WHERE table_name = 'handbook_data' AND column_name = 'search_vector'
            ) THEN
                ALTER TABLE handbook_data
                ADD COLUMN search_vector TSVECTOR GENERATED ALWAYS AS (
                    to_tsvector('simple', COALESCE(section_title, '') || ' ' || COALESCE(content_text, ''))
                ) STORED;
            END IF;
        END $$;
        """,
        "CREATE INDEX IF NOT EXISTS idx_handbook_topic_key ON handbook_data(topic_key)",
        "CREATE INDEX IF NOT EXISTS idx_handbook_chapter_num ON handbook_data(chapter_num)",
        "CREATE INDEX IF NOT EXISTS idx_handbook_sort_order ON handbook_data(sort_order)",
        "CREATE INDEX IF NOT EXISTS idx_handbook_category ON handbook_data(category)",
        "CREATE INDEX IF NOT EXISTS idx_handbook_search_vector ON handbook_data USING gin(search_vector)",
        "ALTER TABLE handbook_data ADD COLUMN IF NOT EXISTS comment_html TEXT",
        "ALTER TABLE handbook_data ADD COLUMN IF NOT EXISTS video_url TEXT",
        "ALTER TABLE handbook_data ADD COLUMN IF NOT EXISTS embed_url TEXT",
        """
        CREATE TABLE IF NOT EXISTS theory_categories (
            id SERIAL PRIMARY KEY,
            slug TEXT NOT NULL UNIQUE,
            title TEXT NOT NULL,
            description TEXT,
            sort_order INT NOT NULL DEFAULT 0,
            created_at TIMESTAMP NOT NULL DEFAULT NOW()
        )
        """,
        """
        CREATE TABLE IF NOT EXISTS theory_topics (
            id SERIAL PRIMARY KEY,
            category_id INT NOT NULL REFERENCES theory_categories(id) ON DELETE CASCADE,
            slug TEXT NOT NULL UNIQUE,
            title TEXT NOT NULL,
            description TEXT,
            topic_type TEXT NOT NULL DEFAULT 'topic',
            sort_order INT NOT NULL DEFAULT 0,
            source_url TEXT,
            created_at TIMESTAMP NOT NULL DEFAULT NOW()
        )
        """,
        """
        CREATE TABLE IF NOT EXISTS theory_sections (
            id SERIAL PRIMARY KEY,
            topic_id INT NOT NULL REFERENCES theory_topics(id) ON DELETE CASCADE,
            slug TEXT NOT NULL UNIQUE,
            title TEXT NOT NULL,
            description TEXT,
            comment_html TEXT,
            content_html TEXT NOT NULL DEFAULT '',
            content_text TEXT NOT NULL DEFAULT '',
            video_url TEXT,
            embed_url TEXT,
            chapter_num INT,
            sort_order INT NOT NULL DEFAULT 0,
            source_url TEXT,
            created_at TIMESTAMP NOT NULL DEFAULT NOW()
        )
        """,
        """
        CREATE TABLE IF NOT EXISTS theory_assets (
            id SERIAL PRIMARY KEY,
            section_id INT NOT NULL REFERENCES theory_sections(id) ON DELETE CASCADE,
            asset_type TEXT NOT NULL DEFAULT 'image',
            asset_url TEXT NOT NULL,
            alt_text TEXT,
            caption TEXT,
            sort_order INT NOT NULL DEFAULT 0,
            created_at TIMESTAMP NOT NULL DEFAULT NOW()
        )
        """,
        "ALTER TABLE theory_sections ADD COLUMN IF NOT EXISTS comment_html TEXT",
        "ALTER TABLE theory_sections ADD COLUMN IF NOT EXISTS video_url TEXT",
        "ALTER TABLE theory_sections ADD COLUMN IF NOT EXISTS embed_url TEXT",
        "ALTER TABLE theory_sections ADD COLUMN IF NOT EXISTS chapter_num INT",
        "ALTER TABLE theory_assets ADD COLUMN IF NOT EXISTS caption TEXT",
        "CREATE INDEX IF NOT EXISTS idx_theory_topics_category_id ON theory_topics(category_id)",
        "CREATE INDEX IF NOT EXISTS idx_theory_topics_sort_order ON theory_topics(sort_order)",
        "CREATE INDEX IF NOT EXISTS idx_theory_sections_topic_id ON theory_sections(topic_id)",
        "CREATE INDEX IF NOT EXISTS idx_theory_sections_sort_order ON theory_sections(sort_order)",
        "CREATE INDEX IF NOT EXISTS idx_theory_assets_section_id ON theory_assets(section_id)",
        "CREATE INDEX IF NOT EXISTS idx_theory_assets_sort_order ON theory_assets(sort_order)",
        """
        CREATE TABLE IF NOT EXISTS premium_orders (
            id SERIAL PRIMARY KEY,
            user_id INT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
            plan_code TEXT NOT NULL,
            amount INT NOT NULL,
            currency TEXT NOT NULL DEFAULT 'UAH',
            provider TEXT NOT NULL DEFAULT 'liqpay',
            status TEXT NOT NULL DEFAULT 'pending',
            provider_order_id TEXT UNIQUE,
            provider_payment_id TEXT,
            checkout_url TEXT,
            provider_payload JSONB NOT NULL DEFAULT '{}'::jsonb,
            activated_at TIMESTAMP,
            expires_at TIMESTAMP,
            created_at TIMESTAMP NOT NULL DEFAULT NOW(),
            updated_at TIMESTAMP NOT NULL DEFAULT NOW()
        )
        """,
        "ALTER TABLE premium_orders ADD COLUMN IF NOT EXISTS provider_payload JSONB NOT NULL DEFAULT '{}'::jsonb",
        "ALTER TABLE premium_orders ADD COLUMN IF NOT EXISTS activated_at TIMESTAMP",
        "ALTER TABLE premium_orders ADD COLUMN IF NOT EXISTS expires_at TIMESTAMP",
        "ALTER TABLE premium_orders ADD COLUMN IF NOT EXISTS provider_payment_id TEXT",
        "ALTER TABLE premium_orders ADD COLUMN IF NOT EXISTS checkout_url TEXT",
        "CREATE INDEX IF NOT EXISTS idx_premium_orders_user_id ON premium_orders(user_id)",
        "CREATE INDEX IF NOT EXISTS idx_premium_orders_status ON premium_orders(status)",
        """
        CREATE INDEX IF NOT EXISTS idx_theory_sections_search
        ON theory_sections USING gin (to_tsvector('simple', COALESCE(title, '') || ' ' || COALESCE(content_text, '')))
        """,
        """
        UPDATE handbook_data
        SET content_html = regexp_replace(
                content_html,
                '<(?:p|div)[^>]*>\\s*(?:<a[^>]*>\\s*\\d+\\s*</a>\\s*){5,}</(?:p|div)>',
                '',
                'gi'
            ),
            content_text = regexp_replace(
                content_text,
                '(?:\\m\\d{1,2}\\M\\s*){10,}',
                ' ',
                'g'
            )
        WHERE content_html ~ '<(?:p|div)[^>]*>\\s*(?:<a[^>]*>\\s*\\d+\\s*</a>\\s*){5,}</(?:p|div)>'
           OR content_text ~ '(?:\\m\\d{1,2}\\M\\s*){10,}';
        """,
        """
        UPDATE handbook_data
        SET topic_key = CASE
                WHEN source_url LIKE '%/theory/rules/%' THEN 'rules'
                WHEN source_url LIKE '%/theory/road-signs%' THEN 'road-signs'
                WHEN source_url LIKE '%/theory/road-markings%' THEN 'road-markings'
                WHEN source_url LIKE '%/theory/regulator%' THEN 'regulator'
                WHEN source_url LIKE '%/theory/traffic-light%' THEN 'traffic-light'
                ELSE topic_key
            END
        WHERE topic_key IS NULL
           OR BTRIM(topic_key) = ''
           OR topic_key NOT IN ('rules', 'road-signs', 'road-markings', 'regulator', 'traffic-light');
        """,
        "ALTER TABLE friendships ADD COLUMN IF NOT EXISTS addressee_seen_at TIMESTAMP",
        """
        DO $$
        BEGIN
            IF EXISTS (
                SELECT 1
                FROM information_schema.columns
                WHERE table_name = 'messages'
                  AND column_name = 'result_data'
                  AND udt_name <> 'jsonb'
            ) THEN
                ALTER TABLE messages
                ALTER COLUMN result_data TYPE jsonb
                USING CASE
                    WHEN result_data IS NULL OR BTRIM(result_data::text) = '' THEN '{}'::jsonb
                    ELSE result_data::jsonb
                END;
            END IF;
        END $$;
        """,
        "ALTER TABLE battles ADD COLUMN IF NOT EXISTS challenger_name TEXT",
        "ALTER TABLE battles ADD COLUMN IF NOT EXISTS opponent_name TEXT",
        "ALTER TABLE battles ADD COLUMN IF NOT EXISTS status TEXT NOT NULL DEFAULT 'pending'",
        "ALTER TABLE battles ADD COLUMN IF NOT EXISTS category TEXT NOT NULL DEFAULT 'B'",
        "ALTER TABLE battles ADD COLUMN IF NOT EXISTS question_ids JSONB NOT NULL DEFAULT '[]'::jsonb",
        "ALTER TABLE battles ADD COLUMN IF NOT EXISTS challenger_answers JSONB NOT NULL DEFAULT '{}'::jsonb",
        "ALTER TABLE battles ADD COLUMN IF NOT EXISTS opponent_answers JSONB NOT NULL DEFAULT '{}'::jsonb",
        "ALTER TABLE battles ADD COLUMN IF NOT EXISTS challenger_score INT NOT NULL DEFAULT 0",
        "ALTER TABLE battles ADD COLUMN IF NOT EXISTS opponent_score INT NOT NULL DEFAULT 0",
        "ALTER TABLE battles ADD COLUMN IF NOT EXISTS challenger_time INT NOT NULL DEFAULT 0",
        "ALTER TABLE battles ADD COLUMN IF NOT EXISTS opponent_time INT NOT NULL DEFAULT 0",
        "ALTER TABLE battles ADD COLUMN IF NOT EXISTS winner_email TEXT",
        "ALTER TABLE battles ADD COLUMN IF NOT EXISTS challenger_seen_at TIMESTAMP",
        "ALTER TABLE battles ADD COLUMN IF NOT EXISTS opponent_seen_at TIMESTAMP",
        "ALTER TABLE battles ADD COLUMN IF NOT EXISTS expires_at TIMESTAMP",
        "ALTER TABLE battles ADD COLUMN IF NOT EXISTS finished_at TIMESTAMP",
        "ALTER TABLE battles ADD COLUMN IF NOT EXISTS created_at TIMESTAMP NOT NULL DEFAULT NOW()",
        "CREATE INDEX IF NOT EXISTS idx_battles_challenger_email ON battles(challenger_email)",
        "CREATE INDEX IF NOT EXISTS idx_battles_opponent_email ON battles(opponent_email)",
        "CREATE INDEX IF NOT EXISTS idx_battles_status ON battles(status)",
        """
        DO $$
        BEGIN
            IF EXISTS (
                SELECT 1
                FROM information_schema.tables
                WHERE table_name = 'battles'
            ) THEN
                ALTER TABLE battles DROP CONSTRAINT IF EXISTS battles_status_check;
                ALTER TABLE battles
                ADD CONSTRAINT battles_status_check
                CHECK (status IN ('pending', 'active', 'finished', 'declined'));
            END IF;
        END $$;
        """,
        """
        DO $$
        BEGIN
            IF EXISTS (
                SELECT 1
                FROM information_schema.columns
                WHERE table_name = 'battles'
                  AND column_name = 'question_ids'
                  AND udt_name <> 'jsonb'
            ) THEN
                ALTER TABLE battles
                ALTER COLUMN question_ids TYPE jsonb
                USING CASE
                    WHEN question_ids IS NULL OR BTRIM(question_ids::text) = '' THEN '[]'::jsonb
                    ELSE question_ids::jsonb
                END;
            END IF;
        END $$;
        """,
        """
        DO $$
        BEGIN
            IF EXISTS (
                SELECT 1
                FROM information_schema.columns
                WHERE table_name = 'battles'
                  AND column_name = 'challenger_answers'
                  AND udt_name <> 'jsonb'
            ) THEN
                ALTER TABLE battles
                ALTER COLUMN challenger_answers TYPE jsonb
                USING CASE
                    WHEN challenger_answers IS NULL OR BTRIM(challenger_answers::text) = '' THEN '{}'::jsonb
                    ELSE challenger_answers::jsonb
                END;
            END IF;
        END $$;
        """,
        """
        DO $$
        BEGIN
            IF EXISTS (
                SELECT 1
                FROM information_schema.columns
                WHERE table_name = 'battles'
                  AND column_name = 'opponent_answers'
                  AND udt_name <> 'jsonb'
            ) THEN
                ALTER TABLE battles
                ALTER COLUMN opponent_answers TYPE jsonb
                USING CASE
                    WHEN opponent_answers IS NULL OR BTRIM(opponent_answers::text) = '' THEN '{}'::jsonb
                    ELSE opponent_answers::jsonb
                END;
            END IF;
        END $$;
        """,
    ]

    with db() as conn:
        for statement in statements:
            conn.execute(statement)
        conn.commit()
