# myapp

スマートフォン向け Web アプリのテンプレートリポジトリ。
React + Vite + TypeScript(front)/ FastAPI(backend)/ PostgreSQL の3層構成で、
spec 駆動(kiro式)の開発フローを前提にしている。

## テンプレートとして使い始める

```bash
# 1. このリポジトリをクローン(または GitHub の Use this template)
git clone <this-repo> my-new-app && cd my-new-app

# 2. プロジェクト名を設定(プレースホルダー "myapp" を一括置換し .env を生成)
./setup.sh my-new-app

# 3. 起動
docker-compose up
```

| URL | 内容 |
|-----|------|
| http://localhost:5173 | フロントエンド |
| http://localhost:8000/docs | API ドキュメント (OpenAPI) |
| http://localhost:8000/api/v1/health | ヘルスチェック |

トップページに「API: ok / DB: ok」と表示されれば環境構築は完了。

## リポジトリ構成

```
docs/spec/     仕様書(kiro式)。機能ごとに requirements / design / tasks の3点セット
front/         フロントエンド (React + Vite + TypeScript)
backend/       バックエンド (FastAPI。routers → services → repositories の3層)
infra/         インフラ定義(IaC。デプロイ先決定後に追加)
CLAUDE.md      コーディング制約(AI エージェント・人間共通のルール)
```

## 開発コマンド

Docker を使わずローカルで開発する場合(Node 22+ / Python 3.11+):

```bash
make setup    # 依存のインストール + .env 作成
make dev      # Docker Compose で全サービス起動
make test     # front + backend の全テスト
make lint     # front + backend の全 lint
make format   # 自動整形
make migrate  # DB マイグレーション適用
```

## 開発フロー(spec 駆動)

1. `docs/spec/_template/` をコピーして機能の仕様(要件 → 設計 → タスク)を書く
2. タスクを上から順に実装する
3. 詳細は [docs/spec/README.md](./docs/spec/README.md) と [CLAUDE.md](./CLAUDE.md) を参照

## テンプレートに含まれるもの

- front / backend の動く骨組み(ヘルスチェックで疎通確認済みの状態)
- Docker Compose 開発環境、Alembic マイグレーション基盤
- CI(GitHub Actions: lint + test)、PR テンプレート
- ESLint / Prettier / ruff / mypy / pre-commit の設定
- spec 雛形(docs/spec/_template/)
