# docs/spec — 仕様書の置き場

このプロジェクトは spec 駆動(kiro式)で開発する。
機能ごとにフォルダを作り、3つのファイルで仕様を管理する。

## 構成

```
docs/spec/
├── README.md          # このファイル
├── _template/         # 新しい機能の仕様を書くときの雛形(コピーして使う)
│   ├── requirements.md
│   ├── design.md
│   └── tasks.md
└── <機能名>/          # 機能ごとの仕様(例: foundation, user-auth, ...)
    ├── requirements.md  # 要件定義(ユーザーストーリー + EARS記法の受け入れ基準)
    ├── design.md        # 設計(アーキテクチャ、データモデル、API)
    └── tasks.md         # 実装タスク(チェックボックス付き)
```

## 進め方

1. **要件**: `_template/` を `docs/spec/<機能名>/` にコピーし、requirements.md を書く
2. **設計**: 要件に合意できたら design.md を書く
3. **タスク**: 設計をタスクに分解して tasks.md に書く
4. **実装**: tasks.md のタスクを上から順に消化する。完了したら `[x]` を付ける
5. 実装中に要件・設計が変わったら、コードより先に spec を更新する

## 既存の spec

| 機能 | 状態 |
|------|------|
| [foundation](./foundation/) | 実装済み(プロジェクト基盤: front/backend/DB の骨組み) |
| [game-core](./game-core/) | 実装済み(こいこい対局エンジン・細工フック・対AI戦) |
| [roguelike-run](./roguelike-run/) | 実装済み(暦すごろく・市場/レリック・熱気・首賭け) |
| [p2p-match](./p2p-match/) | 対戦は実装済み(WebRTC + シグナリング)。観戦・観戦者ベット(要件4・5)は M4 |
| [deploy](./deploy/) | 実装済み(Cloud Run 単一サービスの最安構成。`make deploy`) |
