# PDR Trainer — Backend

## ⚡ Швидкий старт

### 1. Supabase (БД)

1. Зайди: https://supabase.com → New project
2. **SQL Editor** → вставити вміст `create_tables.sql` → **Run**
3. **Settings → Database → Connection string → URI** — скопіюй

### 2. Gmail для відправки email

1. Google Account → Security → 2-Step Verification → увімкни
2. App Passwords → "Mail" → згенерує 16-символьний пароль
3. Використовуй у `.env` як `SMTP_PASS`

### 3. .env файл

```bash
cp .env.example .env
# Заповни всі змінні
```

```env
DATABASE_URL=postgresql://postgres:[pass]@db.[ref].supabase.co:5432/postgres
JWT_SECRET=сгенеруй_рандомний_ключ_тут
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=your@gmail.com
SMTP_PASS=your_app_password_16chars
FRONTEND_URL=https://your-app.netlify.app
```

### 4. Локальний запуск

```bash
cd backend
python -m venv venv

# Windows
venv\Scripts\activate
# Mac/Linux
source venv/bin/activate

pip install -r requirements.txt

# Заповни БД питаннями (один раз)
python database_setup.py

# Запуск сервера
uvicorn main:app --reload
# → http://localhost:8000
# → Docs: http://localhost:8000/docs
```

### 5. Картинки

```bash
# Скопіюй картинки від парсера у фронтенд
mkdir -p ../public/images/pdr
cp output/images/* ../public/images/pdr/
```

### 6. Деплой на Render

1. Render.com → New → Web Service → підключи GitHub
2. Root directory: `backend`
3. Build: `pip install -r requirements.txt`
4. Start: `uvicorn main:app --host 0.0.0.0 --port $PORT`
5. Environment Variables: скопіюй з `.env`

### 7. Деплой фронтенду на Netlify

1. Netlify → New site → GitHub
2. Build: `npm run build`, Publish: `dist`
3. Environment: `VITE_API_URL=https://your-api.onrender.com`

## API

| Метод | Шлях | Опис |
|-------|------|------|
| POST | `/auth/register` | Реєстрація |
| POST | `/auth/verify-email` | Підтвердження email кодом |
| POST | `/auth/login` | Вхід |
| POST | `/auth/forgot-password` | Скидання пароля |
| POST | `/auth/reset-password` | Новий пароль |
| GET  | `/auth/me` | Поточний користувач |
| PATCH | `/users/me` | Оновити профіль |
| POST | `/users/me/avatar` | Завантажити аватар |
| GET  | `/users/{id}/profile` | Публічний профіль |
| GET  | `/questions` | Список (фільтри: section, search) |
| GET  | `/questions/random` | Випадкові (параметр exclude_ids для нескінченності) |
| GET  | `/sections` | Всі розділи |
| POST | `/progress/test-result` | Зберегти результат тесту |
| POST | `/progress/marathon-score` | Рекорд марафону |
| GET  | `/progress/stats` | Вся статистика користувача |
| GET  | `/achievements` | Всі досягнення з прогресом |
| GET  | `/leaderboard` | Таблиця лідерів |

## Досягнення (20 штук, 4 рівні)

| Категорія | Бронза (1) | Срібло (2) | Золото (3) | Легенда (4) |
|-----------|-----------|-----------|-----------|------------|
| Тести     | 1 тест    | 10 тестів | 50 тестів | 100 тестів |
| Відповіді | 100       | 500       | 1000      | 5000       |
| Стрік     | 3 дні     | 7 днів    | 28 днів   | 90 днів    |
| Марафон   | 10        | 50        | 100       | 300        |
| Ідеальні  | 1 тест    | 5 тестів  | 20 тестів | —          |
| Рамки     | —         | —         | 🔥 Вогняна| 👑 Золота  |