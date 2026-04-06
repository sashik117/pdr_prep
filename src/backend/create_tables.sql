-- PDR Trainer — повна схема БД
-- Запусти в Supabase: SQL Editor → вставити → Run

-- ─── USERS ───────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS users (
    id              SERIAL PRIMARY KEY,
    name            TEXT NOT NULL,
    email           TEXT UNIQUE NOT NULL,
    password_hash   TEXT NOT NULL,
    email_verified  BOOLEAN DEFAULT FALSE,
    email_code      TEXT,
    reset_code      TEXT,
    reset_code_exp  TIMESTAMP,
    avatar_url      TEXT,
    bio             TEXT,
    active_frame    TEXT,          -- id досягнення-рамки
    streak_days     INT DEFAULT 0,
    last_activity   DATE,
    total_tests     INT DEFAULT 0,
    total_correct   INT DEFAULT 0,
    total_answers   INT DEFAULT 0,
    marathon_best   INT DEFAULT 0,
    created_at      TIMESTAMP DEFAULT NOW()
);

-- ─── QUESTIONS ───────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS questions (
    id              INT PRIMARY KEY,
    section         TEXT NOT NULL,
    section_name    TEXT,
    num_in_section  INT,
    question_text   TEXT NOT NULL,
    options         JSONB NOT NULL DEFAULT '[]',   -- ["варіант 1", "варіант 2", ...]
    correct_ans     INT,                            -- 1-based індекс
    images          JSONB NOT NULL DEFAULT '[]',   -- ["img_00001.jpeg", ...]
    page            INT
);

CREATE INDEX IF NOT EXISTS idx_q_section ON questions(section);
CREATE INDEX IF NOT EXISTS idx_q_fulltext ON questions
    USING gin(to_tsvector('simple', question_text));

-- ─── TEST RESULTS ────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS test_results (
    id           SERIAL PRIMARY KEY,
    user_id      INT REFERENCES users(id) ON DELETE CASCADE,
    section      TEXT,
    mode         TEXT,  -- quick/full/marathon/difficult/daily/srs
    total        INT,
    correct      INT,
    time_seconds INT,
    created_at   TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_tr_user ON test_results(user_id);

-- ─── USER ANSWERS (для статистики по питаннях) ───────────────
CREATE TABLE IF NOT EXISTS user_answers (
    id              BIGSERIAL PRIMARY KEY,
    user_id         INT REFERENCES users(id) ON DELETE CASCADE,
    question_id     INT REFERENCES questions(id) ON DELETE CASCADE,
    selected_index  INT,
    is_correct      BOOLEAN,
    time_ms         INT,
    answered_at     TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_ua_user ON user_answers(user_id);
CREATE INDEX IF NOT EXISTS idx_ua_question ON user_answers(question_id);
CREATE INDEX IF NOT EXISTS idx_ua_user_correct ON user_answers(user_id, is_correct);

-- ─── USER ACHIEVEMENTS ───────────────────────────────────────
CREATE TABLE IF NOT EXISTS user_achievements (
    id               SERIAL PRIMARY KEY,
    user_id          INT REFERENCES users(id) ON DELETE CASCADE,
    achievement_id   TEXT NOT NULL,
    achievement_name TEXT,
    achievement_desc TEXT,
    tier             INT,           -- 1=bronze, 2=silver, 3=gold, 4=legendary
    category         TEXT,
    earned_at        TIMESTAMP DEFAULT NOW(),
    UNIQUE(user_id, achievement_id)
);

CREATE INDEX IF NOT EXISTS idx_ua_achievements ON user_achievements(user_id);