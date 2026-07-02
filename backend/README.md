# backend

バックエンド (Python + FastAPI)。

```bash
pip install -e ".[dev]"
uvicorn app.main:app --reload   # 開発サーバ (http://localhost:8000)
pytest                          # テスト
ruff check . && mypy            # lint
alembic upgrade head            # マイグレーション適用
```

レイヤ構成: `routers/`(API層)→ `services/`(ロジック)→ `repositories/`(DBアクセス)。
設計方針は `docs/spec/foundation/design.md`、コーディング制約はルートの `CLAUDE.md` を参照。
