# CLAUDE.md — コーディング制約

このリポジトリはスマートフォン向け Web アプリのテンプレート(モノレポ)です。

## リポジトリ構成

```
docs/spec/     仕様書(kiro式)。機能ごとに requirements / design / tasks の3点セット
front/         フロントエンド (React + Vite + TypeScript)
backend/       バックエンド (Python + FastAPI)
infra/         インフラ定義 (IaC, デプロイ設定)
docker-compose.yml  ローカル開発環境
Makefile       開発コマンド集約 (make test / make lint など)
```

## 開発の進め方(spec駆動)

1. 機能追加・変更の前に必ず `docs/spec/<機能名>/requirements.md` を確認し、要件と矛盾しないこと
2. 新機能は `docs/spec/_template/` をコピーして spec(要件 → 設計 → タスク)を先に書く
3. 設計に関わる変更は design.md を先に更新してから実装する
4. 作業は tasks.md のタスク単位で進め、完了したらチェックを付ける
5. 仕様にない機能を勝手に追加しない。不明点は実装前に確認する

## 共通制約

- コミットは意味のある単位で分け、メッセージは変更理由が分かるように書く
- 秘密情報(APIキー、パスワード)をコードや設定ファイルにハードコードしない。ルートの `.env` を使う(`.env.example` が雛形)
- 依存パッケージの追加は最小限にし、追加時は理由を明確にする
- lint / test は `make lint` / `make test` で実行する(front / backend 個別は `make front-test` など)

## フロントエンド (front/)

- TypeScript strict モードを維持する。`any` の使用は禁止(ESLint でエラー)
- コンポーネントは関数コンポーネント + hooks で書く
- スマートフォンファースト: 375px 幅を基準にレイアウトし、タッチ操作(44px以上のタップ領域)を前提にする
- スタイリングは Tailwind CSS のユーティリティクラスで書く。全画面共通のベーススタイルのみ `src/styles/global.css` に置き、コンポーネント個別の CSS ファイルは作らない
- API 通信は `src/api/` に集約し、コンポーネントから直接 fetch しない(`src/api/client.ts` の `apiGet` 等を使う)
- ゲームロジックは `src/game/`(対局)と `src/run/`(ラン)に置き、React・通信に依存させない。
  状態変化は必ずアクション適用(reducer)経由とし、決定論(シード+操作列で完全再現)を壊さない。
  乱数は `src/game/rng.ts` のシード付き乱数のみ使い、`Math.random` を使わない
- Lint/Format: ESLint + Prettier に従う(CI で検査)

## バックエンド (backend/)

- Python 3.11+ / FastAPI。型ヒント必須(mypy strict が通ること)
- レイヤ構成を守る: `routers/`(API層) → `services/`(ビジネスロジック) → `repositories/`(DB アクセス)。層を飛ばした呼び出しをしない
- 依存注入は FastAPI の `Depends` を使う(実装例: `app/routers/health.py`)
- Pydantic モデル(`schemas/`)でリクエスト/レスポンスを必ず定義する
- DB アクセスは SQLAlchemy 経由。生 SQL はマイグレーションを除き禁止
- スキーマ変更は必ず Alembic マイグレーション(`make migration m="..."`)で行う
- Lint/Format: ruff に従う

## テスト

- backend: pytest。service 層は必ずユニットテストを書く。DB 依存は `app.dependency_overrides` で差し替える(例: `tests/test_health.py`)
- front: vitest。ロジックを含む hooks / API クライアント / ユーティリティはテストを書く(例: `src/api/client.test.ts`)
- テストが通らない状態でコミットしない

## インフラ (infra/)

- 環境差分は変数化し、環境ごとのハードコードをしない
- ローカル開発は `docker-compose up` だけで front / backend / DB が起動する状態を維持する

## テンプレート運用

- プロジェクト名のプレースホルダーは `myapp`。新プロジェクトでは `./setup.sh <名前>` で置換する
- テンプレート自体を改善する変更は、プレースホルダー `myapp` を維持すること
