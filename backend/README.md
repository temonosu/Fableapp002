# backend

バックエンド (Python + FastAPI)。

依存管理は [uv](https://docs.astral.sh/uv/)(`uv.lock` で固定)。

```bash
uv sync                                # 依存のインストール (.venv を自動作成)
uv run uvicorn app.main:app --reload   # 開発サーバ (http://localhost:8000)
uv run pytest                          # テスト
uv run ruff check . && uv run mypy     # lint
uv run alembic upgrade head            # マイグレーション適用
```

レイヤ構成: `routers/`(API層)→ `services/`(ロジック)→ `repositories/`(DBアクセス)。
設計方針は `docs/spec/foundation/design.md`、コーディング制約はルートの `CLAUDE.md` を参照。
