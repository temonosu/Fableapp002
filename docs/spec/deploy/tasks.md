# タスク一覧: deploy(Google Cloud への低コストデプロイ)

> 対応する設計: [design.md](./design.md)
> 進め方: 上から順に1タスクずつ。完了したら `[x]` を付ける。

- [x] 1. backend の SPA 静的配信
  - `STATIC_DIR` 設定、index.html フォールバック、`connect_timeout=3`。pytest
  - _要件: 1-1, 1-2, 1-3_
- [x] 2. front の同一オリジン対応
  - `buildWsUrl` の相対 URL 対応(+テスト)。`VITE_API_BASE_URL=""` でのビルド確認
  - _要件: 1-3, 1-4_
- [x] 3. 本番 Dockerfile
  - ルートにマルチステージ Dockerfile と .dockerignore
  - _要件: 1-1〜1-4_
- [x] 4. デプロイスクリプトとドキュメント
  - `infra/gcp/deploy.sh`、Makefile の `deploy`、infra/README・ルート README 更新
  - _要件: 2-1〜2-3, 3-1, 3-2_
- [x] 5. ローカルでの本番相当の動作確認
  - `VITE_API_BASE_URL=""` でビルド → `STATIC_DIR` 付き backend で
    SPA 配信・フォールバック・API・WS を確認
  - _要件: 全要件の疎通確認_
