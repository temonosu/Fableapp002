# 本番用イメージ(Cloud Run 向け)。docs/spec/deploy/design.md 参照
# front をビルドして backend(FastAPI)に同梱し、1コンテナで SPA + API + WS を配信する
# 開発用は front/Dockerfile・backend/Dockerfile(docker-compose)を使う

# --- ステージ1: front のビルド ---
FROM node:22-slim AS front-build

WORKDIR /front
COPY front/package.json front/package-lock.json ./
RUN npm ci
COPY front/ ./
# 同一オリジン配信のため API パスを相対にする
ENV VITE_API_BASE_URL=""
RUN npm run build

# --- ステージ2: backend + 静的ファイル ---
FROM python:3.12-slim

COPY --from=ghcr.io/astral-sh/uv:0.8 /uv /uvx /usr/local/bin/

WORKDIR /app
ENV UV_PROJECT_ENVIRONMENT=/opt/venv \
    UV_LINK_MODE=copy

COPY backend/pyproject.toml backend/uv.lock ./
RUN uv sync --frozen --no-install-project --no-dev

COPY backend/ ./
RUN uv sync --frozen --no-dev

COPY --from=front-build /front/dist /app/static

ENV PATH="/opt/venv/bin:$PATH" \
    STATIC_DIR=/app/static

EXPOSE 8080

# Cloud Run は $PORT を注入する(既定 8080)
CMD exec uvicorn app.main:app --host 0.0.0.0 --port ${PORT:-8080}
