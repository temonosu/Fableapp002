# infra

インフラ定義とデプロイ手順。

## Google Cloud Run へのデプロイ(現行)

設計と判断の経緯は [docs/spec/deploy/](../docs/spec/deploy/) を参照。

```bash
# 前提: gcloud CLI + `gcloud auth login` + 課金有効なプロジェクト
./infra/gcp/deploy.sh <PROJECT_ID>                # 東京リージョン・サービス名 myapp
./infra/gcp/deploy.sh <PROJECT_ID> us-central1 my-service  # 変更する場合
# または
make deploy project=<PROJECT_ID>
```

### 構成

- **Cloud Run 1サービス**に SPA(front の dist)+ API + シグナリング WS を同居
  (ルートの `Dockerfile` でマルチステージビルド)
- `min-instances=0`: アイドル時の課金ゼロ
- `max-instances=1`: コスト上限 **かつ** インメモリのルーム台帳の正しさの条件。
  スケールさせたくなったら台帳の外部化(Redis/Firestore)を別 spec で
- `timeout=3600`: ルーム待機中のシグナリング WS を切らないため
- **DB なし**: 現状永続化する機能がないため。`/api/v1/health` の
  `database: "unavailable"` は正常

### コスト(個人利用規模)

アイドル時 ¥0。Cloud Run / Cloud Build / Artifact Registry とも無料枠が大きく、
フレンド対戦規模なら実質 ¥0〜数円/月。WS 接続中(対戦の待機・シグナリング)は
インスタンスが起きるため、その時間だけ CPU 割当を消費する。

## 環境差分

環境ごとの値はすべてスクリプト引数か環境変数(`STATIC_DIR`、`CORS_ORIGINS` 等)で
渡す。ハードコードしない。

## 今後(必要になったら別 spec を書く)

- CI からの自動デプロイ(GitHub Actions + Workload Identity 連携)
- 独自ドメイン(Cloud Run ドメインマッピング)
- DB(Cloud SQL 等)+ Alembic の本番適用 — 永続化機能とセットで
