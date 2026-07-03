# 要件定義: foundation(プロジェクト基盤)

> ステータス: **確定**

## 概要

スマートフォン向け Web アプリの開発基盤。front / backend / DB が揃い、
クローン直後から機能開発を始められる状態を提供する。

## 機能要件

### 要件1: 開発環境の一括起動

**ユーザーストーリー:**
開発者として、機能開発をすぐ始められるように、front / backend / DB が揃った開発基盤がほしい

**受け入れ基準:**

1. WHEN 開発者が `docker-compose up` を実行した THEN システムは front・backend・DB の3サービスを起動 SHALL する
2. WHEN ユーザーがスマートフォンでアクセスした THEN front はモバイル最適化された画面を表示 SHALL する
3. WHEN front が API を呼び出した THEN backend は JSON で応答 SHALL する

### 要件2: ヘルスチェック

**ユーザーストーリー:**
開発者として、環境が正しく動いていることを確認するために、疎通確認の手段がほしい

**受け入れ基準:**

1. WHEN `GET /api/v1/health` を呼び出した THEN backend は API と DB の状態を JSON で返却 SHALL する
2. IF DB に接続できない THEN backend は `database: "unavailable"` を返却し、API 自体は 200 で応答 SHALL する
3. WHEN トップページを表示した THEN front は API のヘルス状態を画面に表示 SHALL する

### 要件3: テンプレートとしての再利用

**ユーザーストーリー:**
開発者として、新しいプロジェクトをすぐ始められるように、このリポジトリをテンプレートとして使い回したい

**受け入れ基準:**

1. WHEN `./setup.sh <プロジェクト名>` を実行した THEN システムはプレースホルダー(myapp)を新しい名前に置換し `.env` を作成 SHALL する
2. WHEN 新しい機能の仕様を書く THEN 開発者は `docs/spec/_template/` の雛形をコピーして使用 SHALL する

## 非機能要件

| 項目 | 要件 |
|------|------|
| 対応ブラウザ | iOS Safari / Android Chrome の最新2バージョン |
| 表示速度 | 4G 回線で初回表示 3 秒以内(目標) |
| 画面サイズ | 375px〜 のレスポンシブ対応 |
| セキュリティ | HTTPS 前提。秘密情報は環境変数管理 |
| CI | PR ごとに lint + test を自動実行 |

## 制約事項

- フロントエンド: React + Vite + TypeScript
- バックエンド: Python + FastAPI
- データベース: PostgreSQL
- ローカル開発: Docker Compose

## スコープ外

- 本番用イメージのビルド設定・デプロイ(アプリ内容の決定後に別機能として扱う)
- 認証・認可

## 未決事項

- [x] デプロイ先(クラウド/オンプレ)— Google Cloud Run に決定([deploy spec](../deploy/) 参照)
