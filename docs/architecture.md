# Architecture

## Project Layout

DrivePrep is a fullstack project with a Python/FastAPI backend and a React/Vite frontend.

- `backend/` - API entrypoint, database bootstrap, migrations, parsers, payment helpers, imported question/theory seed data.
- `frontend/` - React app, route pages, shared UI, feature modules, admin panel, public images and PWA assets.
- `docs/` - architecture notes, data model notes, parser documentation and local audit screenshots.
- `screenshots/` - portfolio/README screenshots that are safe to keep in Git.
- `render.yaml`, `Dockerfile`, `.dockerignore` - Render deployment configuration.

Generated files, local logs, audit screenshots, Chrome profiles and temporary style packs are ignored by Git.

## Frontend

The frontend is organized around route pages plus feature modules:

- `frontend/src/pages/` - route-level screens such as tests, profile, analytics, friends, settings and legal pages.
- `frontend/src/features/admin/` - isolated admin panel code: shell, pages, cards and admin utilities.
- `frontend/src/features/home/` - home page sections and marketing content.
- `frontend/src/features/theory/` - theory directory, topic pages and rich content/video/gallery renderers.
- `frontend/src/features/tickets/` - ticket list and ticket detail views.
- `frontend/src/components/layout/` - shared app chrome: `AppLayout.jsx`, `Header.jsx`, `SiteFooter.jsx`, back button and navigation config.
- `frontend/src/components/ui/` - reusable UI primitives.
- `frontend/src/components/test/` - reusable test/question UI.
- `frontend/src/lib/` - auth context, theme, sounds, achievements, saved questions, offline progress and utilities.
- `frontend/src/api/` - API clients and payment helpers.

`AppLayout.jsx` owns application-level concerns such as theme bootstrapping, connection state, pending result sync and WebSocket invalidation. `Header.jsx` owns the visual navigation/header.

## Backend

The backend keeps the FastAPI app and route registration in `backend/main.py`, while business code is split into focused layers:

- `backend/core/config.py` - environment variables, public paths, feature flags and business constants.
- `backend/core/database.py` - PostgreSQL connection factory and schema/search-path setup.
- `backend/core/bootstrap.py` - database table creation, indexes and runtime migrations used on startup.
- `backend/domain/` - pure business rules that do not talk to HTTP or the database.
- `backend/services/` - application use cases: auth, tests, progress, theory, tickets, payments, admin operations, friends, battles and support.
- `backend/repositories/` - SQL and persistence access.
- `backend/schemas/` - Pydantic request/response DTOs used at API boundaries.

Preferred backend flow:

```text
FastAPI route -> service -> domain logic / repository -> database
```

Routes should stay thin: validate inputs, call a service and return DTO-shaped data. Domain modules should stay pure whenever possible, so rules such as result calculation, achievement progress and media filtering can be tested without a database.

Supporting backend folders:

- `backend/migrations/` - SQL migrations used during deployment/bootstrap.
- `backend/parsers/` - theory parsing source configuration and normalization helpers.
- `backend/scripts/` - import, audit and smoke-test scripts.
- `backend/tests/` - focused backend tests for pure domain rules and media handling.
- `backend/data/questions/` - imported question JSON files.
- `backend/data/theory/` - theory seed data.
- `backend/public/images/theory/` - theory media, road signs, road markings and question illustrations served by the backend.
- `backend/uploads/handbook/` - generated handbook media and `rules_media_map.json`; these paths are intentionally preserved for parser/runtime compatibility.
- `backend/logs/` - local logs only, ignored by Git except `.gitkeep`.

Media deployment details live in `docs/deployment-media.md`.

## Local Artifacts

Local-only artifacts are kept out of the repository:

- `backend/logs/*`
- `docs/screenshots/audit/*`
- `.tmp-chrome*/`
- `.codex-screens/`
- `mobile-audit/`
- `tmp_style_pack/`
- `dist/`, `frontend/dist/`, `node_modules/`, virtual environments and cache folders

