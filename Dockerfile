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

ENV PYTHONDONTWRITEBYTECODE=1
ENV PYTHONUNBUFFERED=1
ENV NODE_ENV=production

WORKDIR /app

COPY backend/requirements.txt ./backend/requirements.txt
RUN pip install --no-cache-dir -r backend/requirements.txt

COPY backend ./backend
COPY --from=frontend-build /app/frontend/dist ./frontend/dist

EXPOSE 8000

CMD ["python", "backend/scripts/container_start.py"]
