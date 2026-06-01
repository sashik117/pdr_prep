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

The backend keeps the FastAPI app in `backend/main.py`, while shared runtime pieces live in small focused modules:

- `backend/core/config.py` - environment variables, public paths, feature flags and business constants.
- `backend/core/database.py` - PostgreSQL connection factory and schema/search-path setup.
- `backend/core/bootstrap.py` - database table creation, indexes and runtime migrations used on startup.
- `backend/schemas/requests.py` - request body models used by API routes.

Supporting backend folders:

- `backend/services/` - reusable domain services for tickets, theory content, email delivery and realtime WebSocket delivery.
- `backend/schemas/` - Pydantic response/request schemas.
- `backend/migrations/` - SQL migrations used during deployment/bootstrap.
- `backend/parsers/` - theory parsing source configuration and normalization helpers.
- `backend/scripts/` - import scripts for parsed theory/PDR sections.
- `backend/data/questions/` - imported question JSON files.
- `backend/data/theory/` - theory seed data.
- `backend/public/images/theory/` - theory media, road signs, road markings and question illustrations served by the backend.
- `backend/uploads/handbook/` - generated handbook media and `rules_media_map.json`; these paths are intentionally preserved for parser/runtime compatibility.
- `backend/logs/` - local logs only, ignored by Git except `.gitkeep`.

## Local Artifacts

Local-only artifacts are kept out of the repository:

- `backend/logs/*`
- `docs/screenshots/audit/*`
- `.tmp-chrome*/`
- `.codex-screens/`
- `mobile-audit/`
- `tmp_style_pack/`
- `dist/`, `frontend/dist/`, `node_modules/`, virtual environments and cache folders

