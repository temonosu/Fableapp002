import { applyAction, createTable, other } from "./match";
import { combineSeeds, mulberry32 } from "./rng";
import type { Action, GameEvent, Month, PlayerId, TableState } from "./types";

// PvP(対面こいこい)の試合ラッパー。docs/spec/p2p-match/design.md 参照。
// 両者30文・細工なし・場代徴収なし。局ごとに卓を作り直してレートを漸増させる。
// 純TS reducer: 同じ matchSeed とアクション列から両ピアが同一状態を再現する

export const PVP_START_CHIPS = 30;
export const PVP_MAX_GAMES = 5;

export interface PvpResult {
  kind: "bust" | "count"; // 飛び / 5局打ち切りの残文勝負
  winner: PlayerId | null; // null = 引き分け(残文同数)
}

export interface PvpState {
  matchSeed: number;
  gameIndex: number; // 1..PVP_MAX_GAMES
  table: TableState;
  result: PvpResult | null;
}

export type PvpAction = { type: "table"; action: Action } | { type: "nextGame" };

export type PvpApplyResult =
  { ok: true; state: PvpState; events: GameEvent[] } | { ok: false; reason: string };

function buildTable(
  matchSeed: number,
  gameIndex: number,
  chips: Record<PlayerId, number>,
  dealer: PlayerId,
): TableState {
  const rng = mulberry32(combineSeeds(matchSeed, 500 + gameIndex));
  const month = (Math.floor(rng() * 12) + 1) as Month;
  const rate = gameIndex; // レート漸増(1→5)。試合が必ず加速して終わる
  const fee = rate * 5;
  // 残文が場代未満のプレイヤーは自動的に首賭け(両者該当なら少ない方、同数なら子)
  let kubikake: PlayerId | null = null;
  const belowA = chips.A < fee;
  const belowB = chips.B < fee;
  if (belowA && belowB) {
    kubikake = chips.A < chips.B ? "A" : chips.B < chips.A ? "B" : other(dealer);
  } else if (belowA) {
    kubikake = "A";
  } else if (belowB) {
    kubikake = "B";
  }
  return createTable(
    {
      seed: Math.floor(rng() * 0xffffffff) >>> 0,
      month,
      rate,
      entryFee: fee,
      entrant: null, // 場代の徴収なし・撤退なし
      effects: {},
      kubikake,
    },
    chips,
    dealer,
  ).state;
}

export function createPvpMatch(matchSeed: number): PvpState {
  const rng = mulberry32(combineSeeds(matchSeed, 1));
  const dealer: PlayerId = rng() < 0.5 ? "A" : "B";
  return {
    matchSeed,
    gameIndex: 1,
    table: buildTable(matchSeed, 1, { A: PVP_START_CHIPS, B: PVP_START_CHIPS }, dealer),
    result: null,
  };
}

export function applyPvpAction(state: PvpState, action: PvpAction): PvpApplyResult {
  if (state.result !== null) return { ok: false, reason: "試合は終了している" };
  const draft = structuredClone(state);

  switch (action.type) {
    case "table": {
      // 卓は局ごとに作り直すため、卓内の続行・撤退アクションは使わない
      if (action.action.type === "nextRound" || action.action.type === "retreat") {
        return { ok: false, reason: "PvP では局ごとに卓を作り直す" };
      }
      const result = applyAction(draft.table, action.action);
      if (!result.ok) return { ok: false, reason: result.reason };
      draft.table = result.state;
      if (draft.table.result !== null) {
        // 飛び(首賭けの流局死を含む)で即決着
        draft.result = { kind: "bust", winner: draft.table.result.winner };
      }
      return { ok: true, state: draft, events: result.events };
    }

    case "nextGame": {
      const round = draft.table.round;
      if (draft.table.result !== null) return { ok: false, reason: "試合は決着している" };
      if (round === null || round.phase !== "roundOver") {
        return { ok: false, reason: "局が終わっていない" };
      }
      const chips = { ...draft.table.chips };
      if (draft.gameIndex >= PVP_MAX_GAMES) {
        // 打ち切り: 残文勝負
        draft.result = {
          kind: "count",
          winner: chips.A > chips.B ? "A" : chips.B > chips.A ? "B" : null,
        };
        return { ok: true, state: draft, events: [] };
      }
      draft.gameIndex += 1;
      // 親は前局から継承(エンジンが 勝者=親 / 流局=交代 を管理している)
      draft.table = buildTable(draft.matchSeed, draft.gameIndex, chips, draft.table.dealer);
      return { ok: true, state: draft, events: [{ type: "deal", dealer: draft.table.dealer }] };
    }
  }
}
