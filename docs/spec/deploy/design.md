# 設計: deploy(Google Cloud への低コストデプロイ)

> ステータス: **確定**
> 対応する要件: [requirements.md](./requirements.md)

## 構成

```
利用者 ──HTTPS──→ Cloud Run(1サービス, min=0 / max=1, 256Mi)
                    ├── /            SPA(front の dist を FastAPI が静的配信)
                    ├── /api/v1/*    FastAPI(ヘルス・ルーム発行)
                    └── /api/v1/rooms/{code}/ws   シグナリング WS
                    ※ 対局中の通信は WebRTC で P2P 直結(サーバーを経由しない)
```

- **単一サービス同居**を選ぶ理由: 追加サービス(Firebase Hosting / LB / GCS)なしで
  最安・同一オリジンで CORS 不要・URL が1つ。静的配信の負荷は Cloud Run の
  無料枠で十分吸収できる規模
- **max-instances=1** はコスト上限であると同時に、`room_service` の
  インメモリ台帳が複数インスタンスに分裂しないための正しさの条件でもある
  (スケールが必要になったら台帳を Redis/Firestore 化する別 spec を書く)
- **DB なし**: 現状スキーマが空で永続化機能もないため作らない。
  `/api/v1/health` は `database: "unavailable"` を返すが 200 のまま(仕様通り)

## 変更点

### backend: SPA の静的配信

- `Settings.static_dir: str | None = None`(環境変数 `STATIC_DIR`)
- 設定時、FastAPI に SPA 配信を追加:
  - 実ファイルがあればそれを返し、なければ `index.html` にフォールバック
    (StaticFiles のサブクラスで 404 を index.html に差し替え)
  - API ルートが優先(マウントは最後)
- `db.py` に `connect_timeout=3` を追加(DB なし環境で health が長時間
  ハングしないように)

### front: 同一オリジン対応

- 本番ビルドは `VITE_API_BASE_URL=""`(空)でビルドし、API パスを相対にする
- `buildWsUrl` を相対 URL 対応にする(`window.location` から ws(s):// を組み立て)

### コンテナ(ルートの Dockerfile)

マルチステージ: ① node:22 で front をビルド(`VITE_API_BASE_URL=""`)
→ ② python:3.12-slim + uv で backend を `--no-dev` インストールし、
①の dist を `/app/static` に同梱。`STATIC_DIR=/app/static`、`$PORT`(既定8080)で
uvicorn を起動する。開発用の `front/Dockerfile`・`backend/Dockerfile` はそのまま。

### デプロイスクリプト(infra/gcp/deploy.sh)

```
./infra/gcp/deploy.sh <PROJECT_ID> [REGION=asia-northeast1] [SERVICE=myapp]
```

- 必要な API(run / cloudbuild / artifactregistry)を有効化
- `gcloud run deploy --source .`(ルートの Dockerfile を Cloud Build がビルド)
- フラグ: `--allow-unauthenticated --min-instances 0 --max-instances 1
  --memory 256Mi --cpu 1 --timeout 3600 --port 8080`
  (timeout 3600 = ルーム待機中のシグナリング WS を切らない)

## コスト見積もり(個人利用規模)

| リソース | 課金 | 見込み |
|----------|------|--------|
| Cloud Run | リクエスト処理中のみ。無料枠: 月180万リクエスト・36万 vCPU秒等 | ほぼ ¥0(アイドル時 ¥0) |
| Cloud Build | 無料枠: 2,500ビルド分/月 | デプロイ時のみ。¥0 |
| Artifact Registry | 0.5GB まで無料 | イメージ数世代で ¥0〜数円 |
| DB | 作らない | ¥0 |

注意: WS 接続中はインスタンスが起きたままになるため、長時間の対戦・放置が
続くと CPU 割当時間を消費する(それでも無料枠が大きく、個人利用では実質 ¥0)。

## エラーハンドリング

- デプロイスクリプトは `set -euo pipefail`。PROJECT_ID 未指定は使い方を表示して終了

## セキュリティ考慮

- 公開エンドポイントは静的配信・ルーム発行・シグナリング中継のみ(DB・秘密情報なし)
- 秘密情報は使わない(必要になったら Secret Manager を別途)

## 未決事項

- [ ] 独自ドメイン(必要になったら Cloud Run のドメインマッピングを追記)
