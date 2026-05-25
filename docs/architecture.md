# Architecture

## Frontend

The frontend stays route-first, but features are being extracted gradually:

- `features/home`
- `features/theory`
- `features/tickets`
- `features/pricing`

Pages in `frontend/src/pages` are thin wrappers or route entry files.

Shared UI lives in:

- `components/ui`
- `components/layout`
- `lib`
- `api`

## Backend

The backend still uses `main.py` as the FastAPI entrypoint, but the migration introduces:

- `backend/services` for business logic
- `backend/parsers` for theory import flows
- `backend/schemas` for extracted response models

This lets the project move away from a single-file backend without a risky full rewrite.

