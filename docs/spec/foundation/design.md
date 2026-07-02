# 設計: foundation(プロジェクト基盤)

> ステータス: **確定**
> 対応する要件: [requirements.md](./requirements.md)

## 1. アーキテクチャ概要

```
┌─────────────────┐      HTTPS/JSON      ┌─────────────────┐      SQL      ┌──────────────┐
│  front (SPA)     │ ──────────────────→ │  backend (API)   │ ───────────→ │  PostgreSQL   │
│  React + Vite    │ ←────────────────── │  FastAPI         │ ←─────────── │               │
└─────────────────┘                      └─────────────────┘               └──────────────┘
```

- SPA + REST API の構成。front は静的配信、backend はステートレスな API サーバ
- ローカル開発は Docker Compose で3サービスを一括起動

## 2. フロントエンド設計 (front/)

### 技術スタック

| 項目 | 選定 |
|------|------|
| フレームワーク | React 18+ |
| ビルド | Vite |
| 言語 | TypeScript (strict) |
| ルーティング | React Router |
| 状態管理 | まずは React 標準 (useState/Context)。必要になったら再検討 |
| テスト | Vitest |
| Lint/Format | ESLint (flat config) + Prettier |

### ディレクトリ構成

```
front/
├── src/
│   ├── api/          # API クライアント(fetch のラッパーと型定義)
│   ├── components/   # 再利用コンポーネント(必要になったら作成)
│   ├── pages/        # 画面単位のコンポーネント
│   ├── hooks/        # カスタムフック(必要になったら作成)
│   ├── styles/       # グローバル CSS
│   └── main.tsx
├── Dockerfile
└── package.json
```

### モバイル対応方針

- viewport meta 設定(`viewport-fit=cover` で iOS セーフエリア対応)、375px 基準のモバイルファースト CSS
- タップ領域 44px 以上、`touch-action: manipulation` の指定
- 将来的な PWA 化(manifest + service worker)を想定した構成にする

## 3. バックエンド設計 (backend/)

### 技術スタック

| 項目 | 選定 |
|------|------|
| フレームワーク | FastAPI |
| 言語 | Python 3.11+ |
| パッケージ管理 | uv(`uv sync` + `uv.lock` で依存を固定) |
| ORM | SQLAlchemy 2.x |
| マイグレーション | Alembic |
| バリデーション | Pydantic v2 |
| 設定管理 | pydantic-settings(環境変数 / .env) |
| テスト | pytest |
| Lint | ruff / mypy (strict) |

### レイヤ構成

```
backend/
├── app/
│   ├── routers/       # API エンドポイント定義(HTTP層)
│   ├── services/      # ビジネスロジック
│   ├── repositories/  # DB アクセス
│   ├── models/        # SQLAlchemy モデル
│   ├── schemas/       # Pydantic スキーマ(リクエスト/レスポンス)
│   ├── config.py      # 設定 (pydantic-settings)
│   ├── db.py          # エンジン・セッション管理
│   └── main.py
├── migrations/        # Alembic マイグレーション
├── tests/
├── Dockerfile
└── pyproject.toml
```

依存方向: `routers → services → repositories → models`(逆方向・層飛ばしは禁止)

- 依存注入は FastAPI の `Depends` を使う。router で service を組み立て、テストでは
  `app.dependency_overrides` で差し替える(実装例: `routers/health.py` と `tests/test_health.py`)

### API 設計方針

- REST。パスは `/api/v1/...` でバージョニング
- エラーレスポンスは `{"detail": "..."}` 形式で統一(FastAPI 標準)
- OpenAPI ドキュメントを `/docs` で自動公開(本番では無効化)

### API 一覧

| メソッド | パス | 説明 |
|----------|------|------|
| GET | /api/v1/health | ヘルスチェック。`{"status": "ok", "database": "ok" \| "unavailable"}` |

## 4. データベース設計

- PostgreSQL 16
- マイグレーションは Alembic で管理し、手動でのスキーマ変更は禁止
- テーブル定義は各機能の design.md に記載する(基盤時点ではテーブルなし)

## 5. インフラ設計 (infra/)

- ローカル: `docker-compose.yml`(ルート)で front / backend / db を起動
- 環境変数はルートの `.env` で管理(`.env.example` を雛形とする)
- CI: GitHub Actions(`.github/workflows/ci.yml`)で front / backend の lint + test
- 本番: アプリ内容の決定後、別機能の spec として設計する

### ローカル開発のポート

| サービス | ポート |
|----------|--------|
| front (Vite dev server) | 5173 |
| backend (FastAPI) | 8000 |
| db (PostgreSQL) | 5432 |

## 6. テンプレート再利用の設計

- プレースホルダーはすべて `myapp`(パッケージ名・DB名・画面タイトル)
- `setup.sh` が `git grep` で対象ファイルを探して一括置換し、`.env` を生成する
- 新機能の仕様は `docs/spec/_template/` をコピーして書く(運用は docs/spec/README.md)
