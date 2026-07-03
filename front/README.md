# front

フロントエンド (React + Vite + TypeScript + Tailwind CSS)。

```bash
npm install
npm run dev    # 開発サーバ (http://localhost:5173)
npm test       # Vitest
npm run lint   # ESLint
```

## ディレクトリ構成

```
src/
├── game/        # こいこい対局エンジン(純TS・UI非依存・決定論)
│                #   cards / yaku / match(状態機械) / effects(細工) / ai
├── run/         # ラン構造(暦すごろく・市場・レリック)。同じく純TS の reducer
├── components/  # 再利用コンポーネント(TableBoard = 対局盤面)
├── hooks/       # カスタムフック(useAiTurn など)
├── pages/       # 画面(HomePage / RunPage = ラン / MatchPage = 単発対局)
├── api/         # API クライアント(fetch のラッパーと型定義)
└── styles/      # グローバル CSS(Tailwind の読み込みとベーススタイルのみ)
```

`game/` と `run/` は React に依存しない。状態変化はすべてアクション適用
(`applyAction` / `applyRunAction`)で行い、シード+操作列から対局・ランを
完全再現できる(リプレイ・P2P 同期の前提)。ロジックの変更は必ず対応する
テスト(`*.test.ts`)とセットで行うこと。

設計方針は `docs/spec/game-core/design.md`・`docs/spec/roguelike-run/design.md`、
コーディング制約はルートの `CLAUDE.md` を参照。API 通信は `src/api/` に集約する。
