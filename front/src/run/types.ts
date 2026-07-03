// roguelike-run の型定義。docs/spec/roguelike-run/design.md に対応する
import type { Action, CardId, EffectId, Month, TableState } from "../game/types";

export type NodeKind = "tobaku" | "market" | "event" | "sekisho";

export interface BoardNode {
  column: number;
  lane: number;
  month: Month;
  kind: NodeKind;
}

export type BoardColumn = BoardNode[]; // 1〜2レーン

export type RelicId = "kidogomen" | "manekineko" | "saikubako" | "saifuri" | "haramaki";

export type MarketItem =
  | { kind: "saiku"; effect: EffectId; price: number }
  | { kind: "relic"; relic: RelicId; price: number };

export type RunStatus =
  | "board" // サイコロ待ち / 出目選択待ち
  | "chooseLane" // 2レーン列の着地レーン選択待ち
  | "battle" // 賭場戦(game-core に中継)
  | "market"
  | "event"
  | "gameover"
  | "clear";

export interface RunState {
  seed: number;
  counter: number; // 乱数の消費数。シード+アクション列で完全再現するための通し番号
  chips: number;
  region: number; // 0=春 / 1=夏秋 / 2=冬
  column: number; // -1 = 地方の入口
  lane: number;
  board: BoardColumn[];
  relics: RelicId[];
  saiku: {
    inventory: EffectId[];
    placed: Partial<Record<CardId, EffectId>>;
  };
  dice: number[] | null; // 振った出目(選択待ち)
  pendingColumn: number | null; // chooseLane 中の着地列
  status: RunStatus;
  battle: TableState | null;
  battleNode: BoardNode | null;
  enemyAggression: number;
  market: MarketItem[] | null;
  eventText: string | null;
  manekineko: number; // 招き猫の後払いボーナス(対局終了時に精算)
}

export type RunAction =
  | { type: "roll" }
  | { type: "chooseDie"; index: number }
  | { type: "chooseLane"; lane: number }
  | { type: "battle"; action: Action }
  | { type: "continueAfterBattle" }
  | { type: "buy"; index: number }
  | { type: "assignSaiku"; effect: EffectId; card: CardId }
  | { type: "leaveMarket" }
  | { type: "ackEvent" };

export type RunApplyResult =
  { ok: true; state: RunState; log: string[] } | { ok: false; reason: string };
