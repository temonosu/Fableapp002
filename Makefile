# 開発でよく使うコマンド。CLAUDE.md からも参照される
.PHONY: setup dev down test lint format front-install backend-install \
        front-test backend-test front-lint backend-lint migrate migration

# --- セットアップ ---

setup: front-install backend-install ## 依存を全てインストール
	@[ -f .env ] || cp .env.example .env

front-install:
	cd front && npm install

backend-install:
	cd backend && pip install -e ".[dev]"

# --- 開発 ---

dev: ## front / backend / db を Docker Compose で起動
	docker-compose up

down:
	docker-compose down

# --- テスト・Lint ---

test: front-test backend-test ## 全テストを実行

front-test:
	cd front && npm test

backend-test:
	cd backend && python -m pytest

lint: front-lint backend-lint ## 全 Lint を実行

front-lint:
	cd front && npm run lint && npm run format:check && npx tsc -b

backend-lint:
	cd backend && python -m ruff check . && python -m ruff format --check . && python -m mypy

format: ## コードを自動整形
	cd front && npm run format
	cd backend && python -m ruff format . && python -m ruff check --fix .

# --- DB ---

migrate: ## マイグレーションを適用
	cd backend && alembic upgrade head

migration: ## マイグレーションを自動生成 (make migration m="add users table")
	cd backend && alembic revision --autogenerate -m "$(m)"
