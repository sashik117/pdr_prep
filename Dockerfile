FROM node:22-bookworm-slim AS frontend-build

WORKDIR /app/frontend
ARG VITE_API_URL
ARG VITE_MONO_JAR_URL
ARG VITE_MONO_JAR_CARD
ARG VITE_MONO_JAR_DESCRIPTION
ENV VITE_API_URL=$VITE_API_URL
ENV VITE_MONO_JAR_URL=$VITE_MONO_JAR_URL
ENV VITE_MONO_JAR_CARD=$VITE_MONO_JAR_CARD
ENV VITE_MONO_JAR_DESCRIPTION=$VITE_MONO_JAR_DESCRIPTION
COPY frontend/package*.json ./
RUN npm ci --include=dev
COPY frontend/ ./
RUN npm run build

FROM python:3.11-slim AS runtime

ARG MONO_JAR_URL
ARG MONO_JAR_CARD
ARG VITE_MONO_JAR_URL
ARG VITE_MONO_JAR_CARD

ENV PYTHONDONTWRITEBYTECODE=1
ENV PYTHONUNBUFFERED=1
ENV NODE_ENV=production
ENV MONO_JAR_URL=$MONO_JAR_URL
ENV MONO_JAR_CARD=$MONO_JAR_CARD
ENV VITE_MONO_JAR_URL=$VITE_MONO_JAR_URL
ENV VITE_MONO_JAR_CARD=$VITE_MONO_JAR_CARD

WORKDIR /app

COPY backend/requirements.txt ./backend/requirements.txt
RUN apt-get update \
    && apt-get install -y --no-install-recommends gcc libffi-dev \
    && pip install --no-cache-dir --upgrade pip \
    && pip install --no-cache-dir -r backend/requirements.txt \
    && apt-get purge -y gcc \
    && apt-get autoremove -y \
    && rm -rf /var/lib/apt/lists/*

COPY backend ./backend
COPY scripts ./scripts
COPY --from=frontend-build /app/frontend/dist ./frontend/dist

EXPOSE 8000

ENV PYTHONPATH=/app/backend
CMD ["python", "scripts/backend/container_start.py"]
