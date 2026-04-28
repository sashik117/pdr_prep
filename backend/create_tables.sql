CREATE TABLE IF NOT EXISTS users (
    id              SERIAL PRIMARY KEY,
    name            TEXT NOT NULL,
    surname         TEXT,
    username        TEXT UNIQUE,
    email           TEXT UNIQUE NOT NULL,
    password_hash   TEXT NOT NULL,
    email_verified  BOOLEAN NOT NULL DEFAULT FALSE,
    email_code      TEXT,
    reset_code      TEXT,
    reset_code_exp  TIMESTAMP,
    avatar_url      TEXT,
    avatar_version  INT NOT NULL DEFAULT 0,
    bio             TEXT,
    active_frame    TEXT,
    purchased_frames JSONB NOT NULL DEFAULT '[]'::jsonb,
    spent_stars     INT NOT NULL DEFAULT 0,
    featured_achievements JSONB NOT NULL DEFAULT '[]'::jsonb,
    email_visible   BOOLEAN NOT NULL DEFAULT TRUE,
    theme_preference TEXT NOT NULL DEFAULT 'system',
    font_size       INT NOT NULL DEFAULT 16,
    sound_enabled   BOOLEAN NOT NULL DEFAULT TRUE,
    push_enabled    BOOLEAN NOT NULL DEFAULT FALSE,
    is_blocked      BOOLEAN NOT NULL DEFAULT FALSE,
    manual_star_adjustment INT NOT NULL DEFAULT 0,
    username_change_count INT NOT NULL DEFAULT 0,
    username_last_changed_at TIMESTAMP,
    streak_days     INT NOT NULL DEFAULT 0,
    last_activity   DATE,
    streak_restores_left INT NOT NULL DEFAULT 3,
    streak_restores_month TEXT,
    total_tests     INT NOT NULL DEFAULT 0,
    total_correct   INT NOT NULL DEFAULT 0,
    total_answers   INT NOT NULL DEFAULT 0,
    marathon_best   INT NOT NULL DEFAULT 0,
    created_at      TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS questions (
    id              INT PRIMARY KEY,
    section         TEXT NOT NULL,
    section_name    TEXT,
    num_in_section  INT,
    category        TEXT,
    difficulty      TEXT,
    explanation     TEXT,
    question_text   TEXT NOT NULL,
    options         JSONB NOT NULL DEFAULT '[]'::jsonb,
    correct_ans     INT,
    images          JSONB NOT NULL DEFAULT '[]'::jsonb,
    page            INT
);

CREATE INDEX IF NOT EXISTS idx_questions_section ON questions(section);
CREATE INDEX IF NOT EXISTS idx_questions_text ON questions
    USING gin (to_tsvector('simple', question_text));

CREATE TABLE IF NOT EXISTS test_results (
    id            SERIAL PRIMARY KEY,
    user_id       INT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    section       TEXT,
    mode          TEXT NOT NULL,
    total         INT NOT NULL,
    correct       INT NOT NULL,
    time_seconds  INT NOT NULL,
    created_at    TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_test_results_user ON test_results(user_id);

CREATE TABLE IF NOT EXISTS user_answers (
    id              BIGSERIAL PRIMARY KEY,
    user_id         INT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    question_id     INT NOT NULL REFERENCES questions(id) ON DELETE CASCADE,
    selected_index  INT,
    is_correct      BOOLEAN NOT NULL,
    time_ms         INT,
    answered_at     TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_user_answers_user ON user_answers(user_id);
CREATE INDEX IF NOT EXISTS idx_user_answers_question ON user_answers(question_id);
CREATE INDEX IF NOT EXISTS idx_user_answers_user_correct ON user_answers(user_id, is_correct);

CREATE TABLE IF NOT EXISTS user_achievements (
    id               SERIAL PRIMARY KEY,
    user_id          INT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    achievement_id   TEXT NOT NULL,
    achievement_name TEXT,
    achievement_desc TEXT,
    tier             INT,
    category         TEXT,
    earned_at        TIMESTAMP NOT NULL DEFAULT NOW(),
    UNIQUE (user_id, achievement_id)
);

CREATE INDEX IF NOT EXISTS idx_user_achievements_user ON user_achievements(user_id);

CREATE TABLE IF NOT EXISTS friendships (
    id             SERIAL PRIMARY KEY,
    requester_id   INT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    addressee_id   INT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    status         TEXT NOT NULL DEFAULT 'pending',
    addressee_seen_at TIMESTAMP,
    created_at     TIMESTAMP NOT NULL DEFAULT NOW(),
    responded_at   TIMESTAMP,
    CHECK (status IN ('pending', 'accepted')),
    CHECK (requester_id <> addressee_id)
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_friendships_pair
    ON friendships (LEAST(requester_id, addressee_id), GREATEST(requester_id, addressee_id));

CREATE INDEX IF NOT EXISTS idx_friendships_requester ON friendships(requester_id);
CREATE INDEX IF NOT EXISTS idx_friendships_addressee ON friendships(addressee_id);

CREATE TABLE IF NOT EXISTS messages (
    id           SERIAL PRIMARY KEY,
    to_email     TEXT NOT NULL,
    from_email   TEXT NOT NULL,
    from_name    TEXT,
    content      TEXT NOT NULL,
    type         TEXT NOT NULL DEFAULT 'text',
    result_data  JSONB NOT NULL DEFAULT '{}'::jsonb,
    is_read      BOOLEAN NOT NULL DEFAULT FALSE,
    created_at   TIMESTAMP NOT NULL DEFAULT NOW(),
    CHECK (type IN ('text', 'result_share'))
);

CREATE INDEX IF NOT EXISTS idx_messages_to_email ON messages(to_email);
CREATE INDEX IF NOT EXISTS idx_messages_from_email ON messages(from_email);
CREATE INDEX IF NOT EXISTS idx_messages_created_at ON messages(created_at DESC);

CREATE TABLE IF NOT EXISTS battles (
    id                   SERIAL PRIMARY KEY,
    challenger_email     TEXT NOT NULL,
    challenger_name      TEXT,
    opponent_email       TEXT NOT NULL,
    opponent_name        TEXT,
    status               TEXT NOT NULL DEFAULT 'pending',
    category             TEXT NOT NULL DEFAULT 'B',
    question_ids         JSONB NOT NULL DEFAULT '[]'::jsonb,
    challenger_answers   JSONB NOT NULL DEFAULT '{}'::jsonb,
    opponent_answers     JSONB NOT NULL DEFAULT '{}'::jsonb,
    challenger_score     INT NOT NULL DEFAULT 0,
    opponent_score       INT NOT NULL DEFAULT 0,
    challenger_time      INT NOT NULL DEFAULT 0,
    opponent_time        INT NOT NULL DEFAULT 0,
    winner_email         TEXT,
    challenger_seen_at   TIMESTAMP,
    opponent_seen_at     TIMESTAMP,
    expires_at           TIMESTAMP,
    finished_at          TIMESTAMP,
    created_at           TIMESTAMP NOT NULL DEFAULT NOW(),
    CHECK (status IN ('pending', 'active', 'finished', 'declined'))
);

CREATE INDEX IF NOT EXISTS idx_battles_challenger_email ON battles(challenger_email);
CREATE INDEX IF NOT EXISTS idx_battles_opponent_email ON battles(opponent_email);
CREATE INDEX IF NOT EXISTS idx_battles_status ON battles(status);

CREATE TABLE IF NOT EXISTS handbook_data (
    id            SERIAL PRIMARY KEY,
    topic_key     TEXT NOT NULL,
    category      TEXT,
    chapter_num   INT,
    sort_order    INT NOT NULL DEFAULT 0,
    section_title TEXT NOT NULL,
    source_url    TEXT UNIQUE,
    source_slug   TEXT UNIQUE,
    content_html  TEXT NOT NULL,
    content_text  TEXT NOT NULL DEFAULT '',
    image_paths   JSONB NOT NULL DEFAULT '[]'::jsonb,
    search_vector TSVECTOR GENERATED ALWAYS AS (
        to_tsvector('simple', COALESCE(section_title, '') || ' ' || COALESCE(content_text, ''))
    ) STORED,
    created_at    TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_handbook_topic_key ON handbook_data(topic_key);
CREATE INDEX IF NOT EXISTS idx_handbook_chapter_num ON handbook_data(chapter_num);
CREATE INDEX IF NOT EXISTS idx_handbook_sort_order ON handbook_data(sort_order);
CREATE INDEX IF NOT EXISTS idx_handbook_category ON handbook_data(category);
CREATE INDEX IF NOT EXISTS idx_handbook_search_vector ON handbook_data USING gin(search_vector);
