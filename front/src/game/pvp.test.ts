import { describe, expect, it } from "vitest";
import { chooseAiAction } from "./ai";
import { findByTag } from "./cards";
import { PVP_MAX_GAMES, PVP_START_CHIPS, applyPvpAction, createPvpMatch } from "./pvp";
import type { PvpState } from "./pvp";
import type { TableState } from "./types";

const inoshikacho = [findByTag("boar").id, findByTag("deer").id, findByTag("butterfly").id];

function apply(state: PvpState, action: Parameters<typeof applyPvpAction>[1]): PvpState {
  const result = applyPvpAction(state, action);
  if (!result.ok) throw new Error(result.reason);
  return result.state;
}

/** 卓を「局が終わって持ち文が確定した」状態に差し替える */
function withRoundOver(state: PvpState, chips: { A: number; B: number }): PvpState {
  const round = state.table.round;
  if (round === null) throw new Error("round がない");
  const table: TableState = {
    ...state.table,
    chips,
    round: { ...round, phase: "roundOver" },
  };
  return { ...state, table };
}

describe("PvP 試合の構成", () => {
  it("両者30文・レート1・場代の徴収なしで始まる", () => {
    const match = createPvpMatch(42);
    expect(match.gameIndex).toBe(1);
    expect(match.table.chips).toEqual({ A: PVP_START_CHIPS, B: PVP_START_CHIPS });
    expect(match.table.config.rate).toBe(1);
    expect(match.table.config.entrant).toBeNull();
    expect(match.table.config.kubikake).toBeNull();
    expect(Object.keys(match.table.config.effects)).toHaveLength(0);
  });

  it("同一シードなら同一の試合(決定論)", () => {
    expect(createPvpMatch(7)).toEqual(createPvpMatch(7));
  });

  it("nextGame でレートが漸増し、持ち文と親を引き継ぐ", () => {
    const match = withRoundOver(createPvpMatch(3), { A: 40, B: 20 });
    const next = apply(match, { type: "nextGame" });
    expect(next.gameIndex).toBe(2);
    expect(next.table.config.rate).toBe(2);
    expect(next.table.chips).toEqual({ A: 40, B: 20 });
    expect(next.table.dealer).toBe(match.table.dealer);
  });

  it("残文が場代未満のプレイヤーは自動で首賭け", () => {
    // 2局目は レート2 → 場代10。B の 8文 は足りない
    const match = withRoundOver(createPvpMatch(3), { A: 52, B: 8 });
    const next = apply(match, { type: "nextGame" });
    expect(next.table.config.kubikake).toBe("B");
    expect(next.table.heat).toBe(30);
  });

  it("5局終了時は残文勝負(同数は引き分け)", () => {
    const last = {
      ...withRoundOver(createPvpMatch(3), { A: 40, B: 20 }),
      gameIndex: PVP_MAX_GAMES,
    };
    const result = apply(last, { type: "nextGame" });
    expect(result.result).toEqual({ kind: "count", winner: "A" });
    const tied = {
      ...withRoundOver(createPvpMatch(3), { A: 30, B: 30 }),
      gameIndex: PVP_MAX_GAMES,
    };
    expect(apply(tied, { type: "nextGame" }).result).toEqual({ kind: "count", winner: null });
  });

  it("卓内の nextRound / retreat は拒否される", () => {
    const match = withRoundOver(createPvpMatch(3), { A: 30, B: 30 });
    expect(
      applyPvpAction(match, { type: "table", action: { type: "nextRound", player: "A" } }).ok,
    ).toBe(false);
    expect(
      applyPvpAction(match, { type: "table", action: { type: "retreat", player: "A" } }).ok,
    ).toBe(false);
  });

  it("飛びで即決着になる", () => {
    const match = createPvpMatch(9);
    const round = match.table.round;
    if (round === null) throw new Error("round がない");
    // B が僅少の持ち文で、A が猪鹿蝶で勝負する状況を作る
    const rigged: PvpState = {
      ...match,
      table: {
        ...match.table,
        chips: { A: 55, B: 5 },
        round: {
          ...round,
          phase: "awaitDecision",
          turn: "A",
          hands: { A: [0], B: [1] },
          captured: { A: inoshikacho, B: [] },
        },
      },
    };
    const done = apply(rigged, { type: "table", action: { type: "declareShobu", player: "A" } });
    expect(done.result).toEqual({ kind: "bust", winner: "A" });
    expect(applyPvpAction(done, { type: "nextGame" }).ok).toBe(false);
  });
});

describe("PvP 通し対局", () => {
  it("AI 同士で必ず5局以内に決着し、決定論が保たれる", () => {
    const playOut = (seed: number): PvpState => {
      let state = createPvpMatch(seed);
      for (let step = 0; step < 5000; step++) {
        if (state.result !== null) return state;
        const round = state.table.round;
        if (round === null) throw new Error("round がない");
        if (round.phase === "roundOver") {
          state = apply(state, { type: "nextGame" });
          continue;
        }
        const action = chooseAiAction(state.table, round.turn, { aggression: 0.5 });
        if (action === null) throw new Error(`AI が手を返さない: ${round.phase}`);
        state = apply(state, { type: "table", action });
      }
      throw new Error("試合が終わらない");
    };
    for (let seed = 1; seed <= 8; seed++) {
      const result = playOut(seed);
      expect(result.result).not.toBeNull();
      expect(result.gameIndex).toBeLessThanOrEqual(PVP_MAX_GAMES);
    }
    expect(playOut(2)).toEqual(playOut(2));
  });
});
