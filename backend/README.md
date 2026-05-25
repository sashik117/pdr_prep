# DrivePrep Backend

## Stack

- `FastAPI` API
- `PostgreSQL` as the only database
- `JWT` auth
- `SMTP` mail delivery for verification and password reset
- local uploads for avatars and theory assets

## Local setup

1. Create a PostgreSQL database named `pdrprep`.
2. Fill `backend/.env` with your local credentials.
3. Install dependencies from `requirements.txt`.
4. Run `scripts/database_setup.py` once to create tables and import questions.
5. Start the server with `uvicorn main:app --reload`.

## Structure

- `api/` reserved for extracted route modules
- `config/` runtime JSON config such as promo settings
- `data/questions/` source question JSON files
- `legacy/` archived importers, cleanup scripts, and old specs
- `logs/` background import logs
- `migrations/` SQL schema snapshots
- `parsers/` active parser sources and seeds
- `schemas/` shared backend models
- `scripts/` one-off maintenance and import helpers
- `services/` active business logic
- `uploads/` local assets served by the API
- `utils/` shared helpers

## Content import

- Main theory/content importer: `import_driveprep_content.py`
- Question bootstrap: `scripts/database_setup.py`
- Question JSON normalization helper: `scripts/rebuild_category_json.py`

## Main environment variables

```env
DATABASE_URL=postgresql://postgres:password@localhost:5432/pdrprep
JWT_SECRET=replace_with_your_secret
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=your@gmail.com
SMTP_PASS=your_app_password
FRONTEND_URL=http://localhost:5173
PORT=8000
```

## Important routes

- `POST /auth/register`
- `POST /auth/verify-email`
- `POST /auth/login`
- `POST /auth/forgot-password`
- `POST /auth/reset-password`
- `GET /auth/me`
- `PATCH /users/me`
- `POST /users/me/avatar`
- `GET /questions`
- `GET /questions/random`
- `GET /sections`
- `POST /questions/import`
- `POST /progress/test-result`
- `GET /progress/stats`
- `GET /friends`
- `POST /friends/invite`
- `GET /messages`
- `POST /messages`
- `GET /battles`
- `POST /battles`

## Notes

- The backend works only with your own PostgreSQL database and local API services.
- Avatars and imported theory assets are stored under `backend/uploads` and served by the API.
- Question source files live under `backend/data/questions`.
- Legacy handbook import scripts are archived under `backend/legacy`.
