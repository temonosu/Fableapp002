# 設計: game-core(こいこい対局エンジン)

> ステータス: **確定**
> 対応する要件: [requirements.md](./requirements.md)

## 概要

対局エンジンを `front/src/game/` に **UI・通信非依存の純粋 TypeScript** として実装する。
状態はイミュータブルに扱い、すべての変化は「アクション適用」で起きる
(シード+アクション列=完全再現)。React からは薄い hook で利用する。

## モジュール構成

```
front/src/game/
├── types.ts     # 型定義(札・状態・アクション・イベント)
├── cards.ts     # 48枚の札データと参照ヘルパ
├── rng.ts       # シード付き乱数(mulberry32)とシャッフル
├── yaku.ts      # 役判定(取り札 → 成立役リスト)
├── effects.ts   # 細工フック機構 + 細工定義
├── match.ts     # 局・賭場戦の状態機械(reducer)と精算
└── ai.ts        # NPC の打牌選択・こいこい判断
```

依存方向: `ai → match → (yaku, effects, cards, rng, types)`。逆依存禁止。
React コンポーネントは `match.ts` の公開 API のみを使う。

## データモデル(主要型)

```ts
type Month = 1 | ... | 12;
type CardKind = "hikari" | "tane" | "tanzaku" | "kasu";
interface Card { id: CardId; month: Month; kind: CardKind; name: string }

type Zone = "deck" | "field" | "handA" | "handB" | "capturedA" | "capturedB";

interface RoundState {
  phase: Phase;              // 下記の状態遷移を参照
  turn: PlayerId;            // "A" | "B"
  zones: Record<Zone, CardId[]>;
  multiplier: number;        // 局倍率(こいこいで+1)
  koikoiCount: { A: number; B: number };
  pendingFlip?: CardId;      // めくり札の合わせ選択待ち
  newYaku?: Yaku[];          // こいこい/勝負の判断待ち役
}

interface TableConfig {
  seed: number;
  month: Month;              // 旬
  rate: number;              // 文/点
  effects: Record<CardId, EffectId>;  // 細工(最大6枚)
  kubikake?: PlayerId;       // 首賭け中のプレイヤー
}

interface TableState {      // 賭場戦全体
  config: TableConfig;
  chips: { A: number; B: number };
  dealer: PlayerId;
  round: RoundState | null;
  result: TableResult | null;
}
```

## 状態遷移(1局)

```
deal ─→ selectHandCard ─→ (同月場札が複数 → selectFieldTarget)
              │
              ▼
        flipDeck(自動) ─→ (同月場札が2枚 → selectFlipTarget)
              │
              ▼
      新役あり? ── yes → koikoiDecision(こいこい|勝負)
              │ no                │こいこい
              ▼                   ▼
        相手の手番へ ←────────────┘
              │
   両手札が尽きた → 流局(draw)     勝負 → settle(精算)
```

アクションは `playCard / chooseTarget / declareKoikoi / declareShobu / retreat`
の5種。`applyAction(state, action): state` は純関数で、不正な操作は
`Result` 型のエラーで返す(例外は投げない)。

## 精算ロジック

```
獲得 = Σ役文数 × rate × multiplier
     + 旬札取得数 × rate            # 倍率は乗せない
     + 細工による増減
支払側がこいこい宣言済みなら + こいこい料(rate×5 × 宣言回数)
首賭け中の勝者は獲得×2
支払いは持ち文でクリップ(飛び)
```

## 細工フック機構

```ts
interface EffectContext { state, cardId, owner, rate }
interface EffectOutcome { chipDelta?, multiplierDelta?, reveal? }
interface CardEffect {
  id: EffectId; name: string; description: string;
  on: "capture" | "play" | "winWith" | "settle";
  apply(ctx: EffectContext): EffectOutcome;
}
```

- エンジンは各タイミングで対象札の効果を検索して `apply` を呼び、
  Outcome を状態に折り込む。効果側からは状態を直接変更できない
- M1 では機構+3種(金鍍金・呪い・賽の目)を実装し、機構の正しさをテストで担保。
  ラインナップ拡充は `roguelike-run` 側のタスク

## AI 設計

- **打牌選択**: 各合法手を「取得価値(光20/タネ10/短冊5/カス1)+ 旬ボーナス
  + 役への接近度 − 相手に与える機会」でスコアリングし最大を選ぶ。同点はシード乱数
- **こいこい判断**: `続行時の期待上積み × 攻撃性 > 相手の上がり見込み × 損失`
  の閾値判定。攻撃性(0〜1)は敵データ側で設定
- 探索はしない(1手読みのヒューリスティック)。M4 で必要なら強化

## エラーハンドリング

- 不正アクション(手番違い・不在の札・選択肢外のターゲット)は
  `{ ok: false, reason }` を返し状態を変えない(P2P で相手の不正入力を弾く前提)

## セキュリティ考慮

- エンジン自体に秘匿はない(P2P の信頼モデルは p2p-match 側で扱う)

## 未決事項

- [ ] AI 評価関数の係数(プレイテストで調整)
