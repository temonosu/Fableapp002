// game-core の型定義。docs/spec/game-core/design.md に対応する
export type PlayerId = "A" | "B";

export type Month = 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 | 11 | 12;

export type CardKind = "hikari" | "tane" | "tanzaku" | "kasu";

/** 役判定・細工で参照する札の個性 */
export type CardTag =
  | "rain" // 柳の光(小野道風)。四光から除外される
  | "curtain" // 桜の幕。花見で一杯
  | "moon" // 芒の月。月見で一杯
  | "sake" // 菊の盃
  | "boar"
  | "deer"
  | "butterfly"
  | "akatan"
  | "aotan";

export type CardId = number; // 0..47

export interface Card {
  readonly id: CardId;
  readonly month: Month;
  readonly kind: CardKind;
  readonly name: string;
  readonly tag?: CardTag;
}

export type EffectId = "kinmekki" | "noroi" | "sainome";

export type Phase =
  | "awaitPlay" // 手番プレイヤーの打牌待ち
  | "awaitFlipTarget" // めくり札の合わせ先選択待ち
  | "awaitDecision" // こいこい / 勝負 の選択待ち
  | "roundOver" // 局終了(次局開始 or 撤退の選択)
  | "tableOver"; // 賭場戦終了

export interface RoundState {
  phase: Phase;
  turn: PlayerId;
  deck: CardId[];
  field: CardId[];
  hands: Record<PlayerId, CardId[]>;
  captured: Record<PlayerId, CardId[]>;
  multiplier: number; // 局倍率(こいこいで+1、両者共有)
  koikoiCount: Record<PlayerId, number>;
  /** 前回のこいこい/局開始時点の役文数。これを超えたら「新しい役」 */
  yakuBase: Record<PlayerId, number>;
  pendingFlip: CardId | null; // awaitFlipTarget 中のめくり札
}

export interface TableConfig {
  seed: number;
  month: Month; // 旬
  rate: number; // 文/点
  entryFee: number; // 場代(慣例: rate × 5)
  entrant: PlayerId; // 入場側(場代を払い、撤退を選べる側)
  effects: Readonly<Partial<Record<CardId, EffectId>>>; // 細工(48枚中最大6枚)
  kubikake: PlayerId | null; // 首賭け中のプレイヤー
}

export interface Settlement {
  winner: PlayerId;
  base: number; // 役文数合計
  multiplier: number; // 細工込みの最終倍率
  shunCount: number;
  shunBonus: number; // shunCount × rate
  koikoiFee: number; // 敗者のこいこい料
  kubikakeDoubled: boolean;
  gross: number; // 勝者の獲得(clip 前)
  transfer: number; // 実際に動いた文数(clip 後)
  ooiriBonus: number; // 大入りのおひねり(場からの湧き出し。0 = 大入りなし)
}

export interface TableResult {
  kind: "bust" | "retreat";
  winner: PlayerId | null; // retreat のときは null
}

export interface TableState {
  config: TableConfig;
  chips: Record<PlayerId, number>;
  dealer: PlayerId;
  roundNumber: number; // 1 始まり
  round: RoundState | null;
  result: TableResult | null;
  /** 熱気ゲージ(roguelike-run 要件4)。100で大入り→リセット。局間で-20 */
  heat: number;
}

export type Action =
  | { type: "playCard"; player: PlayerId; card: CardId; target?: CardId }
  | { type: "chooseFlipTarget"; player: PlayerId; target: CardId }
  | { type: "declareKoikoi"; player: PlayerId }
  | { type: "declareShobu"; player: PlayerId }
  | { type: "nextRound"; player: PlayerId }
  | { type: "retreat"; player: PlayerId };

export type GameEvent =
  | { type: "deal"; dealer: PlayerId }
  | { type: "capture"; player: PlayerId; cards: CardId[] }
  | { type: "toField"; player: PlayerId; card: CardId }
  | { type: "flip"; card: CardId }
  | { type: "yaku"; player: PlayerId; names: string[] }
  | { type: "koikoi"; player: PlayerId; multiplier: number }
  | {
      type: "effect";
      effect: EffectId;
      player: PlayerId;
      chipDelta: number;
      multiplierDelta: number;
    }
  | { type: "roundEnd"; settlement: Settlement | null } // null = 流局
  | { type: "tableEnd"; result: TableResult };

export type ApplyResult =
  { ok: true; state: TableState; events: GameEvent[] } | { ok: false; reason: string };
