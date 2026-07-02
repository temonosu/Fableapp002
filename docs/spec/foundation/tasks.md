# タスク一覧: foundation(プロジェクト基盤)

> 対応する設計: [design.md](./design.md)
> 進め方: 上から順に1タスクずつ。完了したら `[x]` を付ける。

- [x] 1. リポジトリ構成の作成
  - docs/spec/ の仕様書、CLAUDE.md、front/backend/infra フォルダ、Docker 関連ファイル
- [x] 2. フロントエンドの初期化
  - Vite + React + TypeScript プロジェクト(ESLint + Prettier + Vitest)
  - API クライアント(src/api/)とサンプルページ、サンプルテスト
  - _要件: 1-2, 2-3_
- [x] 3. バックエンドの初期化
  - FastAPI プロジェクト(routers/services/repositories 構成、ruff/mypy/pytest)
  - `GET /api/v1/health` の実装とテスト
  - _要件: 1-3, 2-1, 2-2_
- [x] 4. DB マイグレーション基盤
  - Alembic の導入(migrations/、alembic.ini)
- [x] 5. CI の設定
  - GitHub Actions で front / backend の lint + test を PR ごとに実行
- [x] 6. テンプレート再利用の仕組み
  - setup.sh(プレースホルダー置換 + .env 生成)、.env.example、docs/spec/_template/
  - _要件: 3-1, 3-2_
- [ ] 7. Docker Compose での一括起動確認
  - `docker-compose up` で front / backend / db が起動し、トップページに DB: ok が表示されること
  - ※ Docker が使える環境で要確認(CI・ローカル検証はコンテナ外で実施済み)
  - _要件: 1-1_
