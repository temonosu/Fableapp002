import { describe, expect, it } from "vitest";
import { chooseAiAction, type AiPersonality } from "./ai";
import { applyAction, countAllCards, createTable } from "./match";
import type { Month, TableState } from "./types";

const CALM: AiPersonality = { aggression: 0.3 };
const WILD: AiPersonality = { aggression: 0.9 };

/** AI 同士で賭場戦を最後まで(または上限まで)進める */
function playOut(seed: number, maxSteps = 5000): { state: TableState; steps: number } {
  const month = ((seed % 12) + 1) as Month;
  let { state } = createTable(
    { seed, month, rate: 1, entryFee: 5, entrant: "A", effects: {}, kubikake: null },
    { A: 60, B: 60 },
    "A",
  );
  for (let step = 0; step < maxSteps; step++) {
    if (state.result !== null) return { state, steps: step };
    const round = state.round;
    if (round === null) throw new Error("round がない");
    expect(countAllCards(state)).toBe(48);

    if (round.phase === "roundOver") {
      const next = applyAction(state, { type: "nextRound", player: "A" });
      if (!next.ok) throw new Error(next.reason);
      state = next.state;
      continue;
    }
    const player = round.turn;
    const action = chooseAiAction(state, player, player === "A" ? CALM : WILD);
    if (action === null) throw new Error(`AI が手を返さない: ${round.phase}`);
    const result = applyAction(state, action);
    if (!result.ok) throw new Error(`AI が不正な手: ${result.reason}`);
    state = result.state;
  }
  return { state, steps: maxSteps };
}

describe("AI 同士の通し対局(エンジンの総合検証)", () => {
  it("複数シードで不正な手なく進行し、チップ総量が保存される", () => {
    for (let seed = 1; seed <= 12; seed++) {
      const { state } = playOut(seed);
      // 場代5文は場に消える。細工なしなので以降の総量は不変
      expect(state.chips.A + state.chips.B).toBe(115);
      expect(state.chips.A).toBeGreaterThanOrEqual(0);
      expect(state.chips.B).toBeGreaterThanOrEqual(0);
      if (state.result !== null) {
        expect(state.result.kind).toBe("bust");
      }
    }
  });

  it("同一シードなら完全に同じ結果(決定論性)", () => {
    const a = playOut(7);
    const b = playOut(7);
    expect(a.steps).toBe(b.steps);
    expect(a.state).toEqual(b.state);
  });
});

describe("こいこい判断", () => {
  it("上がれば相手が飛ぶときは必ず勝負する", () => {
    const { state } = createTable(
      { seed: 3, month: 1, rate: 5, entryFee: 25, entrant: "A", effects: {}, kubikake: null },
      { A: 100, B: 100 },
      "A",
    );
    const round = state.round;
    if (round === null) throw new Error("round がない");
    // 猪鹿蝶(5文×レート5=25文)で相手の持ち文3文を確実に飛ばせる状況を作る
    const rigged: TableState = {
      ...state,
      chips: { A: 100, B: 3 },
      round: {
        ...round,
        phase: "awaitDecision",
        turn: "A",
        captured: { A: [24, 36, 20], B: [] },
        hands: { A: [0, 1, 2, 3], B: [4, 5, 6] },
      },
    };
    expect(chooseAiAction(rigged, "A", WILD)).toEqual({ type: "declareShobu", player: "A" });
  });
});
