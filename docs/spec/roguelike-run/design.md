# 設計: roguelike-run(ラン構造)

> ステータス: **確定**
> 対応する要件: [requirements.md](./requirements.md)

## 概要

ラン(暦すごろく1周)を `front/src/run/` に UI 非依存の純粋 TypeScript reducer として
実装する。対局は game-core の `TableState` をそのまま埋め込み、ラン reducer が
`battle` アクションとして中継する。すべてシード+アクション列で再現可能。

## モジュール構成

```
front/src/run/
├── types.ts    # RunState / BoardNode / RelicId / MarketItem / RunAction
├── board.ts    # 地方(4ヶ月分)の盤面生成
├── items.ts    # レリック定義・市場の品揃え・イベント定義
└── run.ts      # createRun / applyRunAction(ラン全体の reducer)
```

依存方向: `run → board, items → (game-core)`。React からは RunPage のみが利用する。

## データモデル

```ts
type NodeKind = "tobaku" | "market" | "event" | "sekisho";
interface BoardNode { column: number; lane: number; month: Month; kind: NodeKind }
type BoardColumn = BoardNode[];        // 1レーンまたは2レーン

type RunStatus =
  | "board" | "chooseLane" | "battle" | "market" | "event"
  | "gameover" | "clear";

interface RunState {
  seed: number; counter: number;       // counter 経由の draw で決定論を維持
  chips: number;                       // 持ち文(要件2)
  region: number;                      // 0=春 / 1=夏秋 / 2=冬
  column: number; lane: number;        // 現在位置(開始は column -1)
  board: BoardColumn[];
  relics: RelicId[];
  saiku: { inventory: EffectId[]; placed: Partial<Record<CardId, EffectId>> };
  dice: number[] | null;               // 振った出目(選択待ち)
  status: RunStatus;
  battle: TableState | null;           // 対局中は game-core の状態を内包
  battleNode: BoardNode | null;
  enemyAggression: number;
  market: MarketItem[] | null;
  eventText: string | null;
  manekineko: number;                  // 招き猫の後払いボーナス
}
```

## 盤面生成(board.ts)

- 1地方 = 8列。列0〜6は `月 = 地方の4ヶ月[min(3, floor(列/2))]`、列7は関所(ボス)
- 各列は 60% で2レーン。種別の重み: 賭場50% / 市場25% / イベント25%
- 敵の生成(賭場に止まった時): 持ち文30〜50、レート1(後半列は2)、攻撃性0.3〜0.8。
  関所: 持ち文100・レート2・攻撃性0.85

## ラン進行(run.ts の reducer)

```
roll → dice表示 → chooseDie(サイコロ2個から1つ選択。賽振りの腕で3個)
  → 前進(関所を通り過ぎない=クランプ) → 2レーン列なら chooseLane
  → マス解決:
      賭場/関所 → createTable(旬=マスの月, 細工=placed)で battle 開始
                   持ち文 < 場代なら首賭け(kubikake: "A")で自動入場(要件: game-core 4-4)
      市場      → 品揃え3点を抽選して market
      イベント  → 文の増減イベントを抽選して event
  → battle 中は battle(action) で game-core に中継、result 確定後 continueAfterBattle
  → 持ち文0で gameover。地方2の関所を制覇で clear
```

## 市場・レリック(items.ts)

| 品 | 効果 | 実装層 |
|----|------|--------|
| 細工: 金鍍金/賽の目/呪い | game-core の細工として任意の札へ配置(上限6) | エンジン |
| 木戸御免 | 場代半額(切り上げ) | ラン層(config 生成時) |
| 招き猫 | 大入りで自分が受けたおひねりと同額を後払い | ラン層 |
| 細工箱 | 細工の配置上限 +2 | ラン層 |
| 賽振りの腕 | サイコロ3個から選ぶ | ラン層 |
| 胴巻き | 飛ばされても一度だけ10文残して生還(消費) | ラン層 |

- 品揃えは3点(所持済みレリックは出ない)。細工は購入後に在庫へ入り、
  市場滞在中に任意の札へ配置できる(呪いは相手に取らせる地雷として自分で仕込む)

## 熱気・おひねり(要件4)

賭場戦の内部状態のため **game-core エンジン側に実装**する(決定論・テスト容易性のため)。

- `TableState.heat`(0〜)。こいこい+15 / 細工発動+5 / 倍率3以上の上がり+10×倍率 /
  旬札4枚独占+10 / 首賭け開始+30。局をまたぐと-20
- 精算時に heat≥100 なら勝者に**おひねり = 場代×3**(場からの湧き出し)を加算し0へリセット。
  `Settlement.ooiriBonus` として記録する

## 画面設計(RunPage)

- `/run`。status で切替: 盤面(横スクロールのすごろく+サイコロUI)/ 対局(共通
  TableBoard コンポーネント+熱気ゲージ)/ 市場(品揃え+札配置ピッカー)/
  イベント・クリア・ゲームオーバーのパネル
- 対局ビューは MatchPage から `components/TableBoard.tsx` として抽出し共用する

## エラーハンドリング

- reducer は game-core と同じ Result 型(`ok:false` で状態不変)

## 未決事項

- [ ] ボス固有の特殊ルール(こいこい強制など)はエンジン拡張が必要なため M3 以降
- [ ] 細工・レリックの価格/効果量はプレイテストで調整
