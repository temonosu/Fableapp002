# 花札行脚(仮)

昭和レトロな日本を旅する博徒となり、**暦すごろく**を進みながら各地の賭場で
**こいこい(花札)** を打つ、スマートフォン向けローグライクカードゲーム。

React + Vite + TypeScript + Tailwind CSS(front)/ FastAPI(backend)/ PostgreSQL の
3層構成で、spec 駆動(kiro式)で開発している。

## ゲームの骨子

- **こいこい × ローグライク**: 持ち文(チップ)が HP 兼 通貨。役を作って奪い合い、
  こいこい宣言で場の倍率を吊り上げる。0文になったらラン終了
- **暦すごろく**: 盤面のマスに「月」が振られ、止まったマスの月が対局の「旬」になる。
  春の街道 → 夏秋の峠 → 冬の湊 の3地方、各地方の最後には関所(ボス)
- **細工とレリック**: 市場で買った細工(金鍍金・賽の目・呪い)を自分のデッキの札に
  仕込める。ただし山札は共有 — 敵に取られれば敵に発動する
- **押し引きの報酬**: 派手なプレイで熱気ゲージが上がり、100で「大入り」のおひねり。
  場代が払えなければ「首賭け」で入場(勝てば倍・負けたら即終了)
- **予定**: WebRTC による P2P リアルタイム対戦と観戦(勝率メーター・観戦者ベット)

## 起動

```bash
docker-compose up
```

| URL | 内容 |
|-----|------|
| http://localhost:5173 | ゲーム(トップ →「旅打ちに出る」でラン開始) |
| http://localhost:5173/match | 腕試し(単発の対AI対局) |
| http://localhost:8000/docs | API ドキュメント (OpenAPI) |

Docker を使わない場合は `make setup` 後、`cd front && npm run dev`(Node 22+ / [uv](https://docs.astral.sh/uv/))。

## 開発状況

| マイルストーン | 状態 | spec |
|----------------|------|------|
| M1: こいこい対局エンジン + 対AI戦 | ✅ 実装済み | [game-core](./docs/spec/game-core/) |
| M2: ラン構造(すごろく・市場・レリック・熱気) | ✅ 実装済み | [roguelike-run](./docs/spec/roguelike-run/) |
| M3: P2P 対戦(WebRTC + シグナリング) | 要件のみ | [p2p-match](./docs/spec/p2p-match/) |
| M4: 観戦(勝率メーター・観戦者ベット)・メタ進行 | 要件のみ | 同上 |

## リポジトリ構成

```
docs/spec/     仕様書(kiro式)。機能ごとに requirements / design / tasks の3点セット
front/         フロントエンド。src/game/ に対局エンジン、src/run/ にラン構造(共に純TS)
backend/       バックエンド (FastAPI。routers → services → repositories の3層)
infra/         インフラ定義(IaC。デプロイ先決定後に追加)
CLAUDE.md      コーディング制約(AI エージェント・人間共通のルール)
```

## 開発コマンド

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
2. タスクを上から順に実装する(ゲームルールの変更は spec を先に更新する)
3. 詳細は [docs/spec/README.md](./docs/spec/README.md) と [CLAUDE.md](./CLAUDE.md) を参照

> このリポジトリはスマホ向け Web アプリテンプレートを土台にしている。
> プロジェクト名のプレースホルダーは `myapp` のまま(`./setup.sh <名前>` で置換可能)。
