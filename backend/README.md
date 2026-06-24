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
4. Run `../scripts/deploy/database_setup.py` once to create tables and import questions.
5. Start the server with `uvicorn main:app --reload`.

## Structure

- `api/` reserved for extracted route modules
- `config/` runtime JSON config such as promo settings
- `data/questions/` source question JSON files
- `domain/` pure business rules with no database access
- `legacy/` archived importers, cleanup scripts, and old specs
- `logs/` background import logs
- `migrations/` SQL schema snapshots
- `parsers/` active parser sources and seeds
- `repositories/` PostgreSQL queries and persistence boundaries
- `schemas/` shared backend models
- `../scripts/` parsers, deployment helpers, and one-off maintenance tools
- `services/` active business logic
- `tests/` backend unit and smoke tests
- `uploads/` local assets served by the API
- `utils/` shared helpers

## Content import

- Main theory/content importer: `../scripts/parsers/import_driveprep_content.py`
- Question bootstrap: `../scripts/deploy/database_setup.py`
- Question JSON normalization helper: `../scripts/parsers/rebuild_category_json.py`
- Media consistency audit: `../scripts/maintenance/audit_media.py`

## Quality checks

From the repository root:

```bash
npm run backend:test
npm run backend:audit-media
npm run backend:smoke
```

`backend:audit-media` checks theory HTML, theory assets, media maps and question images. It must report `missing=0` before deployment.

The repository intentionally does not track every generated upload image because theory media is heavy. If you deploy from a clean Git checkout, make sure your deployment process restores `backend/uploads/theory/**` or runs the importer before serving theory pages.

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
