# DrivePrep Northflank Deploy

This project is deployed as one Docker web service:

- frontend is built by Vite inside the Docker image
- backend runs FastAPI/Uvicorn
- public HTTP port is `8000`
- PostgreSQL is provided by a Northflank Postgres addon

## 1. Create Project

In Northflank:

1. Create a new project, for example `driveprep`.
2. Choose a region close to users, preferably Europe if available.

## 2. Create PostgreSQL Addon

1. Create addon: `PostgreSQL`.
2. Name it `driveprep-db`.
3. Wait until the database is running.
4. Open the database connection details.
5. Use the normal application connection string, not an admin-only string.

Northflank can expose the connection as `DATABASE_URL` via a secrets group.
If the generated variable is named differently, create an alias named `DATABASE_URL`.

## 3. Create Combined Service

1. Create service -> `Combined service`.
2. Source: GitHub repository `sashik117/pdr_prep`.
3. Branch: `main`.
4. Build method: `Dockerfile`.
5. Dockerfile path: `/Dockerfile`.
6. Build context: `/`.
7. Public port:
   - port: `8000`
   - protocol: `HTTP`
   - publicly expose: yes
8. Health check path: `/api/health`.

The Dockerfile already exposes port `8000` and starts:

```bash
python backend/scripts/container_start.py
```

## 4. Runtime Variables

Generate a safe copy-paste block locally:

```bash
npm run deploy:northflank:env
```

Paste the generated variables into the Northflank web service runtime variables.
The template is also saved here:

```text
docs/northflank-env.example
```

The service needs these variables:

```env
NODE_ENV=production
PORT=8000
DATABASE_URL=<from Northflank PostgreSQL addon>
DATABASE_SCHEMA=public
DATABASE_SSL=true
JWT_SECRET=<long random secret>
ADMIN_USERNAME=<your admin username>
ADMIN_PASSWORD=<your admin password>
RUN_CONTAINER_BOOTSTRAP=false
RUN_STARTUP_MAINTENANCE=false
PAYMENT_MODE=mock
ALLOW_MOCK_PAYMENTS=true
EMAIL_PROVIDER=smtp
SMTP_HOST=smtp.gmail.com
SMTP_PORT=465
SMTP_SECURE=true
SMTP_TIMEOUT=8
SMTP_USER=pdr.preparation@gmail.com
SMTP_PASS=<gmail app password>
FRONTEND_URL=<Northflank public URL after service is created>
BACKEND_PUBLIC_URL=<same Northflank public URL>
```

Do not commit real secrets to GitHub.

## 5. First Database Bootstrap

Do not run bootstrap as a pre-deploy command on the web service. It can keep the HTTP port closed too long and make the platform think the service is unhealthy.

After the web service is deployed once, run a one-off job or temporary command with:

```env
RUN_CONTAINER_BOOTSTRAP=true
```

Command:

```bash
python backend/scripts/northflank_bootstrap.py
```

The bootstrap imports:

- base schema
- question bank
- theory seed
- ticket metadata
- theory links

After it finishes, keep the web service with:

```env
RUN_CONTAINER_BOOTSTRAP=false
```

## 6. Update Public URLs

After Northflank gives the public domain, update runtime variables:

```env
FRONTEND_URL=https://your-northflank-domain
BACKEND_PUBLIC_URL=https://your-northflank-domain
```

Redeploy the service.

## 7. Smoke Checks

Open:

- `/api/health` -> should return `{"status":"ok"}`
- `/` -> should render the frontend
- `/study` -> theory should load
- `/tests` -> tests should load
- `/auth` -> registration/login should open

If theory or questions are missing, run the bootstrap job again and check logs.
