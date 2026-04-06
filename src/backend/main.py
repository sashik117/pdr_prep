"""
PDR Trainer — повний FastAPI Backend
=====================================
Змінні оточення (.env):
  DATABASE_URL   — Supabase PostgreSQL URI
  JWT_SECRET     — будь-який рандомний рядок (python -c "import secrets; print(secrets.token_hex(32))")
  SMTP_HOST      — smtp.gmail.com (або SendGrid)
  SMTP_PORT      — 587
  SMTP_USER      — your@gmail.com
  SMTP_PASS      — App Password (не звичайний пароль!)
  FRONTEND_URL   — https://your-app.netlify.app
"""

import os, json, random, string, hashlib, re
from datetime import datetime, timedelta, date
from typing import Optional, List
from fastapi import FastAPI, Depends, HTTPException, Header, Query, UploadFile, File
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel, EmailStr
import psycopg2, psycopg2.extras
from dotenv import load_dotenv
import jwt
import smtplib
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart
import bcrypt
import shutil
from pathlib import Path

load_dotenv()

DB_URL       = os.environ["DATABASE_URL"]
JWT_SECRET   = os.getenv("JWT_SECRET", "change-me-in-production")
JWT_EXP_DAYS = 30
FRONTEND_URL = os.getenv("FRONTEND_URL", "*")
SMTP_HOST    = os.getenv("SMTP_HOST", "smtp.gmail.com")
SMTP_PORT    = int(os.getenv("SMTP_PORT", 587))
SMTP_USER    = os.getenv("SMTP_USER", "")
SMTP_PASS    = os.getenv("SMTP_PASS", "")
UPLOAD_DIR   = Path("uploads/avatars")
UPLOAD_DIR.mkdir(parents=True, exist_ok=True)

app = FastAPI(title="PDR Trainer API", version="2.0.0")
app.add_middleware(CORSMiddleware,
    allow_origins=[FRONTEND_URL, "http://localhost:5173", "http://localhost:3000"],
    allow_credentials=True, allow_methods=["*"], allow_headers=["*"])
app.mount("/uploads", StaticFiles(directory="uploads"), name="uploads")


# ─── DB ───────────────────────────────────────────────────────
def db():
    return psycopg2.connect(DB_URL, cursor_factory=psycopg2.extras.RealDictCursor)


# ─── AUTH ─────────────────────────────────────────────────────
def hash_password(password: str) -> str:
    return bcrypt.hashpw(password.encode(), bcrypt.gensalt()).decode()

def check_password(password: str, hashed: str) -> bool:
    return bcrypt.checkpw(password.encode(), hashed.encode())

def create_token(user_id: int) -> str:
    payload = {"sub": str(user_id), "exp": datetime.utcnow() + timedelta(days=JWT_EXP_DAYS)}
    return jwt.encode(payload, JWT_SECRET, algorithm="HS256")

def get_current_user(authorization: str = Header(None)):
    if not authorization or not authorization.startswith("Bearer "):
        raise HTTPException(401, "Потрібна авторизація")
    token = authorization[7:]
    try:
        payload = jwt.decode(token, JWT_SECRET, algorithms=["HS256"])
        user_id = int(payload["sub"])
    except jwt.ExpiredSignatureError:
        raise HTTPException(401, "Токен застарів, увійдіть знову")
    except Exception:
        raise HTTPException(401, "Невалідний токен")

    conn = db(); cur = conn.cursor()
    cur.execute("SELECT * FROM users WHERE id = %s", (user_id,))
    user = cur.fetchone(); conn.close()
    if not user: raise HTTPException(401, "Користувача не знайдено")
    return dict(user)

def get_optional_user(authorization: str = Header(None)):
    if not authorization: return None
    try: return get_current_user(authorization)
    except: return None


# ─── EMAIL ────────────────────────────────────────────────────
def send_email(to: str, subject: str, body: str):
    if not SMTP_USER:
        print(f"[EMAIL MOCK] To: {to}\nSubject: {subject}\n{body}")
        return
    msg = MIMEMultipart()
    msg["From"] = SMTP_USER
    msg["To"] = to
    msg["Subject"] = subject
    msg.attach(MIMEText(body, "html"))
    with smtplib.SMTP(SMTP_HOST, SMTP_PORT) as s:
        s.starttls()
        s.login(SMTP_USER, SMTP_PASS)
        s.sendmail(SMTP_USER, to, msg.as_string())


def gen_code(n=6) -> str:
    return "".join(random.choices(string.digits, k=n))


# ─── PYDANTIC МОДЕЛІ ─────────────────────────────────────────

class RegisterRequest(BaseModel):
    name: str
    email: str
    password: str

class LoginRequest(BaseModel):
    email: str
    password: str

class VerifyEmailRequest(BaseModel):
    email: str
    code: str

class ForgotPasswordRequest(BaseModel):
    email: str

class ResetPasswordRequest(BaseModel):
    email: str
    code: str
    new_password: str

class UpdateProfileRequest(BaseModel):
    name: Optional[str] = None
    bio: Optional[str] = None
    active_frame: Optional[str] = None

class AnswerSubmit(BaseModel):
    question_id: int
    selected_index: int   # 0-based
    is_correct: bool
    time_ms: Optional[int] = None

class TestResultSubmit(BaseModel):
    section: Optional[str] = None
    mode: str  # quick/full/marathon/difficult/daily
    total: int
    correct: int
    time_seconds: int
    answers: List[AnswerSubmit]

class MarathonScoreSubmit(BaseModel):
    score: int


# ─── AUTH ENDPOINTS ───────────────────────────────────────────

@app.post("/auth/register")
def register(req: RegisterRequest):
    if len(req.password) < 6:
        raise HTTPException(400, "Пароль мінімум 6 символів")
    if not re.match(r"[^@]+@[^@]+\.[^@]+", req.email):
        raise HTTPException(400, "Невалідний email")

    conn = db(); cur = conn.cursor()
    cur.execute("SELECT id FROM users WHERE email = %s", (req.email.lower(),))
    if cur.fetchone():
        conn.close(); raise HTTPException(409, "Email вже зареєстровано")

    code = gen_code()
    hashed = hash_password(req.password)
    cur.execute("""
        INSERT INTO users (name, email, password_hash, email_code, email_verified)
        VALUES (%s, %s, %s, %s, false) RETURNING id
    """, (req.name.strip(), req.email.lower(), hashed, code))
    conn.commit(); conn.close()

    send_email(req.email, "Підтвердження email — ПДР Тренажер",
        f"<h2>Вітаємо, {req.name}!</h2>"
        f"<p>Ваш код підтвердження: <b style='font-size:24px'>{code}</b></p>"
        f"<p>Введіть його на сайті для активації акаунту.</p>")
    return {"message": "Код підтвердження надіслано на email"}


@app.post("/auth/verify-email")
def verify_email(req: VerifyEmailRequest):
    conn = db(); cur = conn.cursor()
    cur.execute("SELECT id, email_code FROM users WHERE email = %s", (req.email.lower(),))
    user = cur.fetchone()
    if not user or user["email_code"] != req.code:
        conn.close(); raise HTTPException(400, "Невірний код")
    cur.execute("UPDATE users SET email_verified=true, email_code=null WHERE email=%s", (req.email.lower(),))
    conn.commit()
    cur.execute("SELECT * FROM users WHERE email=%s", (req.email.lower(),))
    user = cur.fetchone(); conn.close()
    token = create_token(user["id"])
    return {"token": token, "user": _user_public(dict(user))}


@app.post("/auth/login")
def login(req: LoginRequest):
    conn = db(); cur = conn.cursor()
    cur.execute("SELECT * FROM users WHERE email = %s", (req.email.lower(),))
    user = cur.fetchone(); conn.close()
    if not user or not check_password(req.password, user["password_hash"]):
        raise HTTPException(401, "Невірний email або пароль")
    if not user["email_verified"]:
        raise HTTPException(403, "Email не підтверджено. Перевірте пошту.")
    token = create_token(user["id"])
    return {"token": token, "user": _user_public(dict(user))}


@app.post("/auth/forgot-password")
def forgot_password(req: ForgotPasswordRequest):
    conn = db(); cur = conn.cursor()
    cur.execute("SELECT id, name FROM users WHERE email = %s", (req.email.lower(),))
    user = cur.fetchone(); conn.close()
    if not user:
        return {"message": "Якщо email існує — код буде надіслано"}
    code = gen_code()
    conn = db(); cur = conn.cursor()
    cur.execute("UPDATE users SET reset_code=%s, reset_code_exp=%s WHERE email=%s",
        (code, datetime.utcnow() + timedelta(minutes=15), req.email.lower()))
    conn.commit(); conn.close()
    send_email(req.email, "Скидання пароля — ПДР Тренажер",
        f"<p>Код для скидання пароля: <b style='font-size:24px'>{code}</b></p>"
        f"<p>Дійсний 15 хвилин.</p>")
    return {"message": "Код надіслано на email"}


@app.post("/auth/reset-password")
def reset_password(req: ResetPasswordRequest):
    conn = db(); cur = conn.cursor()
    cur.execute("SELECT id, reset_code, reset_code_exp FROM users WHERE email=%s", (req.email.lower(),))
    user = cur.fetchone()
    if not user or user["reset_code"] != req.code:
        conn.close(); raise HTTPException(400, "Невірний код")
    if user["reset_code_exp"] < datetime.utcnow():
        conn.close(); raise HTTPException(400, "Код застарів")
    if len(req.new_password) < 6:
        conn.close(); raise HTTPException(400, "Пароль мінімум 6 символів")
    hashed = hash_password(req.new_password)
    cur.execute("UPDATE users SET password_hash=%s, reset_code=null, reset_code_exp=null WHERE email=%s",
        (hashed, req.email.lower()))
    conn.commit(); conn.close()
    return {"message": "Пароль змінено успішно"}


@app.get("/auth/me")
def get_me(user = Depends(get_current_user)):
    return _user_public(user)


def _user_public(u: dict) -> dict:
    return {
        "id": u["id"], "name": u["name"], "email": u["email"],
        "avatar_url": u.get("avatar_url"), "bio": u.get("bio"),
        "active_frame": u.get("active_frame"),
        "streak_days": u.get("streak_days", 0),
        "marathon_best": u.get("marathon_best", 0),
        "created_at": str(u.get("created_at", "")),
    }


# ─── PROFILE ──────────────────────────────────────────────────

@app.patch("/users/me")
def update_profile(req: UpdateProfileRequest, user = Depends(get_current_user)):
    fields, vals = [], []
    if req.name:    fields.append("name=%s");         vals.append(req.name.strip())
    if req.bio is not None: fields.append("bio=%s");  vals.append(req.bio)
    if req.active_frame is not None: fields.append("active_frame=%s"); vals.append(req.active_frame)
    if not fields: return _user_public(user)
    vals.append(user["id"])
    conn = db(); cur = conn.cursor()
    cur.execute(f"UPDATE users SET {','.join(fields)} WHERE id=%s", vals)
    conn.commit()
    cur.execute("SELECT * FROM users WHERE id=%s", (user["id"],))
    updated = cur.fetchone(); conn.close()
    return _user_public(dict(updated))


@app.post("/users/me/avatar")
def upload_avatar(file: UploadFile = File(...), user = Depends(get_current_user)):
    if not file.content_type.startswith("image/"):
        raise HTTPException(400, "Тільки зображення")
    ext = file.filename.rsplit(".", 1)[-1].lower()
    fname = f"user_{user['id']}.{ext}"
    fpath = UPLOAD_DIR / fname
    with open(fpath, "wb") as f: shutil.copyfileobj(file.file, f)
    url = f"/uploads/avatars/{fname}"
    conn = db(); cur = conn.cursor()
    cur.execute("UPDATE users SET avatar_url=%s WHERE id=%s", (url, user["id"]))
    conn.commit(); conn.close()
    return {"avatar_url": url}


@app.get("/users/{user_id}/profile")
def get_user_profile(user_id: int):
    conn = db(); cur = conn.cursor()
    cur.execute("SELECT * FROM users WHERE id=%s", (user_id,))
    user = cur.fetchone()
    if not user: raise HTTPException(404, "Не знайдено")
    cur.execute("SELECT * FROM user_achievements WHERE user_id=%s", (user_id,))
    achievements = cur.fetchall()
    conn.close()
    return {**_user_public(dict(user)), "achievements": [dict(a) for a in achievements]}


# ─── QUESTIONS ────────────────────────────────────────────────

@app.get("/questions")
def get_questions(
    section: Optional[str] = None,
    limit: int = Query(20, ge=1, le=200),
    offset: int = Query(0, ge=0),
    search: Optional[str] = None,
):
    conn = db(); cur = conn.cursor()
    conds, params = [], []
    if section: conds.append("section=%s"); params.append(section)
    if search:  conds.append("question_text ILIKE %s"); params.append(f"%{search}%")
    where = ("WHERE " + " AND ".join(conds)) if conds else ""
    cur.execute(f"SELECT COUNT(*) as total FROM questions {where}", params)
    total = cur.fetchone()["total"]
    cur.execute(f"SELECT * FROM questions {where} ORDER BY id LIMIT %s OFFSET %s",
        params + [limit, offset])
    rows = cur.fetchall(); conn.close()
    return {"total": total, "items": [dict(r) for r in rows]}


@app.get("/questions/random")
def get_random_questions(
    count: int = Query(20, ge=5, le=200),
    section: Optional[str] = None,
    exclude_ids: str = Query(""),
    difficult_only: bool = False,
    user_id: Optional[int] = None,
):
    conn = db(); cur = conn.cursor()
    conds, params = [], []

    if section: conds.append("q.section=%s"); params.append(section)

    if exclude_ids.strip():
        try:
            ids = [int(x) for x in exclude_ids.split(",") if x.strip()]
            if ids:
                conds.append(f"q.id NOT IN ({','.join(['%s']*len(ids))})")
                params.extend(ids)
        except: pass

    if difficult_only and user_id:
        conds.append("""q.id IN (
            SELECT question_id FROM user_answers
            WHERE user_id=%s AND is_correct=false
        )""")
        params.append(user_id)

    where = ("WHERE " + " AND ".join(conds)) if conds else ""
    cur.execute(f"SELECT * FROM questions q {where} ORDER BY RANDOM() LIMIT %s",
        params + [count])
    rows = cur.fetchall(); conn.close()
    return [dict(r) for r in rows]


@app.get("/questions/{qid}")
def get_question(qid: int):
    conn = db(); cur = conn.cursor()
    cur.execute("SELECT * FROM questions WHERE id=%s", (qid,))
    row = cur.fetchone(); conn.close()
    if not row: raise HTTPException(404, "Не знайдено")
    return dict(row)


@app.get("/sections")
def get_sections():
    conn = db(); cur = conn.cursor()
    cur.execute("""SELECT section, section_name, COUNT(*) as count
        FROM questions GROUP BY section, section_name
        ORDER BY section""")
    rows = cur.fetchall(); conn.close()
    return [dict(r) for r in rows]


# ─── PROGRESS & ANSWERS ───────────────────────────────────────

@app.post("/progress/test-result")
def submit_test_result(data: TestResultSubmit, user = Depends(get_current_user)):
    conn = db(); cur = conn.cursor()
    today = date.today().isoformat()

    # Зберігаємо результат тесту
    cur.execute("""
        INSERT INTO test_results (user_id, section, mode, total, correct, time_seconds, created_at)
        VALUES (%s,%s,%s,%s,%s,%s,NOW()) RETURNING id
    """, (user["id"], data.section, data.mode, data.total, data.correct, data.time_seconds))
    result_id = cur.fetchone()["id"]

    # Зберігаємо відповіді
    if data.answers:
        psycopg2.extras.execute_values(cur, """
            INSERT INTO user_answers (user_id, question_id, selected_index, is_correct, time_ms, answered_at)
            VALUES %s ON CONFLICT DO NOTHING
        """, [(user["id"], a.question_id, a.selected_index, a.is_correct,
               a.time_ms, datetime.utcnow()) for a in data.answers])

    # Streak
    cur.execute("SELECT last_activity, streak_days FROM users WHERE id=%s", (user["id"],))
    u = cur.fetchone()
    last = u["last_activity"]
    streak = u["streak_days"] or 0

    if last is None or str(last) != today:
        yesterday = (date.today() - timedelta(days=1)).isoformat()
        streak = (streak + 1) if str(last) == yesterday else 1
        cur.execute("UPDATE users SET last_activity=%s, streak_days=%s WHERE id=%s",
            (today, streak, user["id"]))

    # Загальна статистика
    cur.execute("""
        UPDATE users SET
            total_tests   = total_tests + 1,
            total_correct = total_correct + %s,
            total_answers = total_answers + %s
        WHERE id=%s
    """, (data.correct, data.total, user["id"]))

    conn.commit()

    # Перевіряємо досягнення
    new_achievements = _check_achievements(cur, conn, user["id"])

    conn.commit(); conn.close()
    return {"result_id": result_id, "streak": streak, "new_achievements": new_achievements}


@app.post("/progress/marathon-score")
def submit_marathon(data: MarathonScoreSubmit, user = Depends(get_current_user)):
    conn = db(); cur = conn.cursor()
    cur.execute("SELECT marathon_best FROM users WHERE id=%s", (user["id"],))
    current = cur.fetchone()["marathon_best"] or 0
    new_best = max(current, data.score)
    cur.execute("UPDATE users SET marathon_best=%s WHERE id=%s", (new_best, user["id"]))
    new_achievements = _check_achievements(cur, conn, user["id"])
    conn.commit(); conn.close()
    return {"marathon_best": new_best, "is_new_record": new_best > current,
            "new_achievements": new_achievements}


@app.get("/progress/stats")
def get_stats(user = Depends(get_current_user)):
    conn = db(); cur = conn.cursor()

    # Загальна статистика
    cur.execute("SELECT * FROM users WHERE id=%s", (user["id"],))
    u = dict(cur.fetchone())

    # По розділах
    cur.execute("""
        SELECT q.section, q.section_name,
               COUNT(*) FILTER (WHERE ua.is_correct=true) as correct,
               COUNT(*) as total
        FROM user_answers ua
        JOIN questions q ON q.id = ua.question_id
        WHERE ua.user_id=%s
        GROUP BY q.section, q.section_name
        ORDER BY q.section
    """, (user["id"],))
    by_section = [dict(r) for r in cur.fetchall()]

    # Останні тести
    cur.execute("""SELECT * FROM test_results WHERE user_id=%s
        ORDER BY created_at DESC LIMIT 20""", (user["id"],))
    recent_tests = [dict(r) for r in cur.fetchall()]

    # Важкі питання
    cur.execute("""
        SELECT question_id, COUNT(*) as wrong_count
        FROM user_answers WHERE user_id=%s AND is_correct=false
        GROUP BY question_id ORDER BY wrong_count DESC LIMIT 50
    """, (user["id"],))
    difficult = [dict(r) for r in cur.fetchall()]

    # Досягнення
    cur.execute("SELECT * FROM user_achievements WHERE user_id=%s", (user["id"],))
    achievements = [dict(r) for r in cur.fetchall()]

    # Activity streak (останні 90 днів)
    cur.execute("""
        SELECT DISTINCT DATE(answered_at)::text as day
        FROM user_answers WHERE user_id=%s
        AND answered_at > NOW() - INTERVAL '90 days'
        ORDER BY day
    """, (user["id"],))
    activity_days = [r["day"] for r in cur.fetchall()]

    conn.close()
    return {
        "user": _user_public(u),
        "total_tests": u.get("total_tests", 0),
        "total_correct": u.get("total_correct", 0),
        "total_answers": u.get("total_answers", 0),
        "streak_days": u.get("streak_days", 0),
        "marathon_best": u.get("marathon_best", 0),
        "by_section": by_section,
        "recent_tests": recent_tests,
        "difficult_question_ids": [d["question_id"] for d in difficult],
        "achievements": achievements,
        "activity_days": activity_days,
    }


# ─── ACHIEVEMENTS ────────────────────────────────────────────

ACHIEVEMENTS_DEF = [
    # (id, tier, name, description, category, threshold)
    # Тести
    ("first_step",   1, "🚗 Перший виїзд",      "Пройти перший тест",         "tests",   1),
    ("rookie",       2, "🚘 Новачок",            "Пройти 10 тестів",           "tests",   10),
    ("driver",       3, "🏎️ Водій",              "Пройти 50 тестів",           "tests",   50),
    ("pro_driver",   4, "🏆 Профі",              "Пройти 100 тестів",          "tests",   100),
    # Правильні відповіді
    ("hundred",      1, "💯 Сотня",              "100 правильних відповідей",  "correct", 100),
    ("five_hundred", 2, "🎯 П'ятисотня",         "500 правильних відповідей",  "correct", 500),
    ("thousand",     3, "⚡ Тисячник",            "1000 правильних відповідей", "correct", 1000),
    ("legend",       4, "🌟 Легенда",            "5000 правильних відповідей", "correct", 5000),
    # Стрік (дні підряд)
    ("streak_3",     1, "🔥 Почав розігріватись","3 дні підряд",               "streak",  3),
    ("streak_7",     2, "🔥🔥 Запалив",          "7 днів підряд",              "streak",  7),
    ("streak_28",    3, "🔥🔥🔥 Пекло",         "28 днів підряд",             "streak",  28),
    ("streak_90",    4, "☀️ Невгасимий",         "90 днів підряд",             "streak",  90),
    # Марафон
    ("marathon_10",  1, "🏃 Бігун",              "10 правильних в марафоні",   "marathon", 10),
    ("marathon_50",  2, "🏃‍♂️ Спринтер",         "50 правильних в марафоні",   "marathon", 50),
    ("marathon_100", 3, "⚡ Блискавка",           "100 правильних в марафоні",  "marathon", 100),
    ("marathon_300", 4, "👑 Нескоренний",        "300 правильних в марафоні",  "marathon", 300),
    # Ідеальний тест
    ("perfect_1",    1, "✨ Без помилок",        "Перший ідеальний тест",       "perfect", 1),
    ("perfect_5",    2, "💎 Відмінник",          "5 ідеальних тестів",          "perfect", 5),
    ("perfect_20",   3, "🎓 Золота голова",      "20 ідеальних тестів",         "perfect", 20),
    # Рамки профілю (спеціальні)
    ("frame_fire",   3, "🔥 Вогняна рамка",     "Отримати за 28-денний стрік", "frame",   None),
    ("frame_gold",   4, "👑 Золота рамка",       "Легенда — 5000 правильних",   "frame",   None),
]


def _check_achievements(cur, conn, user_id: int) -> list:
    """Перевіряє та видає нові досягнення."""
    cur.execute("SELECT achievement_id FROM user_achievements WHERE user_id=%s", (user_id,))
    earned = set(r["achievement_id"] for r in cur.fetchall())

    cur.execute("SELECT * FROM users WHERE id=%s", (user_id,))
    u = dict(cur.fetchone())

    # Рахуємо ідеальні тести
    cur.execute("""SELECT COUNT(*) as cnt FROM test_results
        WHERE user_id=%s AND correct=total AND total >= 10""", (user_id,))
    perfect_tests = cur.fetchone()["cnt"]

    new_achievements = []

    for ach_id, tier, name, desc, category, threshold in ACHIEVEMENTS_DEF:
        if ach_id in earned: continue
        should_earn = False

        if category == "tests"    and threshold: should_earn = (u.get("total_tests",0) >= threshold)
        elif category == "correct" and threshold: should_earn = (u.get("total_correct",0) >= threshold)
        elif category == "streak"  and threshold: should_earn = (u.get("streak_days",0) >= threshold)
        elif category == "marathon" and threshold: should_earn = (u.get("marathon_best",0) >= threshold)
        elif category == "perfect" and threshold: should_earn = (perfect_tests >= threshold)
        elif category == "frame":
            if ach_id == "frame_fire":  should_earn = (u.get("streak_days",0) >= 28)
            elif ach_id == "frame_gold": should_earn = (u.get("total_correct",0) >= 5000)

        if should_earn:
            cur.execute("""
                INSERT INTO user_achievements (user_id, achievement_id, achievement_name,
                    achievement_desc, tier, category, earned_at)
                VALUES (%s,%s,%s,%s,%s,%s,NOW())
                ON CONFLICT DO NOTHING
            """, (user_id, ach_id, name, desc, tier, category))
            new_achievements.append({
                "id": ach_id, "name": name, "description": desc, "tier": tier
            })

    return new_achievements


@app.get("/achievements")
def get_all_achievements(user = Depends(get_optional_user)):
    earned_ids = set()
    if user:
        conn = db(); cur = conn.cursor()
        cur.execute("SELECT achievement_id, earned_at FROM user_achievements WHERE user_id=%s",
            (user["id"],))
        earned_map = {r["achievement_id"]: r["earned_at"] for r in cur.fetchall()}
        conn.close()
        earned_ids = set(earned_map.keys())
    else:
        earned_map = {}

    return [
        {
            "id": a[0], "tier": a[1], "name": a[2], "description": a[3],
            "category": a[4], "threshold": a[5],
            "earned": a[0] in earned_ids,
            "earned_at": str(earned_map.get(a[0], "")) if a[0] in earned_ids else None,
        }
        for a in ACHIEVEMENTS_DEF
    ]


# ─── LEADERBOARD ─────────────────────────────────────────────

@app.get("/leaderboard")
def leaderboard():
    conn = db(); cur = conn.cursor()
    cur.execute("""SELECT id, name, avatar_url, active_frame, total_correct,
        total_tests, marathon_best, streak_days
        FROM users WHERE email_verified=true
        ORDER BY total_correct DESC LIMIT 50""")
    rows = cur.fetchall(); conn.close()
    return [dict(r) for r in rows]


# ─── MISC ────────────────────────────────────────────────────

@app.get("/")
def root(): return {"status": "ok", "version": "2.0.0"}


if __name__ == "__main__":
    import uvicorn
    uvicorn.run("main:app", host="0.0.0.0", port=int(os.getenv("PORT", 8000)), reload=False)