#!/usr/bin/env bash
# Google Cloud Run へのデプロイ(docs/spec/deploy/design.md)
#
# 使い方:
#   ./infra/gcp/deploy.sh <PROJECT_ID> [REGION] [SERVICE]
#
# 前提:
#   - gcloud CLI がインストール済みで `gcloud auth login` 済み
#   - 課金が有効なプロジェクト(無料枠内でもプロジェクト自体に課金設定は必要)
#
# コスト方針(spec 参照): min-instances=0 でアイドル時 ¥0。
# max-instances=1 はコスト上限であると同時に、インメモリのルーム台帳が
# 複数インスタンスに分裂しないための条件でもある(変更しないこと)

set -euo pipefail

PROJECT_ID="${1:?使い方: ./infra/gcp/deploy.sh <PROJECT_ID> [REGION] [SERVICE]}"
REGION="${2:-asia-northeast1}"
SERVICE="${3:-myapp}"

cd "$(dirname "$0")/../.."

echo "==> 必要な API を有効化します(初回のみ数分かかる)"
gcloud services enable \
    run.googleapis.com \
    cloudbuild.googleapis.com \
    artifactregistry.googleapis.com \
    --project "$PROJECT_ID"

echo "==> Cloud Run にデプロイします(ルートの Dockerfile を Cloud Build がビルド)"
gcloud run deploy "$SERVICE" \
    --project "$PROJECT_ID" \
    --region "$REGION" \
    --source . \
    --allow-unauthenticated \
    --port 8080 \
    --min-instances 0 \
    --max-instances 1 \
    --memory 256Mi \
    --cpu 1 \
    --timeout 3600

URL=$(gcloud run services describe "$SERVICE" \
    --project "$PROJECT_ID" --region "$REGION" \
    --format "value(status.url)")

echo ""
echo "デプロイ完了: $URL"
echo "  ゲーム:       $URL"
echo "  API ドキュメント: $URL/docs"
echo "  ヘルスチェック:  $URL/api/v1/health (DB なし構成のため database は unavailable で正常)"
