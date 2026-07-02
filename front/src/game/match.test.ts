import { describe, expect, it } from "vitest";
import { findByTag, findCard } from "./cards";
import { applyAction, countAllCards, createTable } from "./match";
import type { GameEvent, PlayerId, RoundState, Settlement, TableConfig, TableState } from "./types";

function makeConfig(over: Partial<TableConfig> = {}): TableConfig {
  return {
    seed: 1,
    month: 1,
    rate: 2,
    entryFee: 10,
    entrant: "A",
    effects: {},
    kubikake: null,
    ...over,
  };
}

function makeRound(over: Partial<RoundState> = {}): RoundState {
  return {
    phase: "awaitPlay",
    turn: "A",
    deck: [],
    field: [],
    hands: { A: [], B: [] },
    captured: { A: [], B: [] },
    multiplier: 1,
    koikoiCount: { A: 0, B: 0 },
    yakuBase: { A: 0, B: 0 },
    pendingFlip: null,
    ...over,
  };
}

function makeTable(
  round: RoundState,
  chips: Record<PlayerId, number>,
  config: TableConfig = makeConfig(),
): TableState {
  return { config, chips, dealer: "A", roundNumber: 1, round, result: null };
}

function settlementOf(events: GameEvent[]): Settlement {
  const e = events.find((ev) => ev.type === "roundEnd");
  if (e === undefined || e.type !== "roundEnd" || e.settlement === null) {
    throw new Error("精算イベントがない");
  }
  return e.settlement;
}

const inoshikacho = [findByTag("boar").id, findByTag("deer").id, findByTag("butterfly").id];

describe("配札", () => {
  it("8枚×2 + 場8 + 山24 で、場四・手四がない", () => {
    for (let seed = 1; seed <= 30; seed++) {
      const { state } = createTable(makeConfig({ seed, entryFee: 5 }), { A: 100, B: 100 }, "A");
      const round = state.round;
      expect(round).not.toBeNull();
      if (round === null) continue;
      expect(round.hands.A).toHaveLength(8);
      expect(round.hands.B).toHaveLength(8);
      expect(round.field).toHaveLength(8);
      expect(round.deck).toHaveLength(24);
      expect(countAllCards(state)).toBe(48);
      for (const zone of [round.field, round.hands.A, round.hands.B]) {
        const byMonth = new Map<number, number>();
        for (const id of zone) {
          const m = Math.floor(id / 4) + 1;
          byMonth.set(m, (byMonth.get(m) ?? 0) + 1);
        }
        expect(Math.max(...byMonth.values())).toBeLessThan(4);
      }
    }
  });

  it("入場側は場代を払う(首賭け中は免除)", () => {
    const { state } = createTable(makeConfig({ entryFee: 5 }), { A: 100, B: 40 }, "A");
    expect(state.chips.A).toBe(95);
    expect(state.chips.B).toBe(40);
    const kubikake = createTable(makeConfig({ entryFee: 5, kubikake: "A" }), { A: 3, B: 40 }, "A");
    expect(kubikake.state.chips.A).toBe(3);
  });

  it("同一シードなら同一の配札", () => {
    const a = createTable(makeConfig({ seed: 9 }), { A: 100, B: 100 }, "A");
    const b = createTable(makeConfig({ seed: 9 }), { A: 100, B: 100 }, "A");
    expect(a.state).toEqual(b.state);
  });
});

describe("精算(仕様書の数値例)", () => {
  it("レート2・こいこい2回・猪鹿蝶: 獲得30文 + こいこい料20文", () => {
    // 仕様の例: A がこいこい2回(倍率×3)→ B が猪鹿蝶で上がる
    const state = makeTable(
      makeRound({
        phase: "awaitDecision",
        turn: "B",
        hands: { A: [0], B: [1] },
        captured: { A: [], B: inoshikacho },
        multiplier: 3,
        koikoiCount: { A: 2, B: 0 },
      }),
      { A: 100, B: 40 },
    );
    const result = applyAction(state, { type: "declareShobu", player: "B" });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    const s = settlementOf(result.events);
    expect(s.base).toBe(5);
    expect(s.gross).toBe(30); // 5文 × レート2 × 倍率3
    expect(s.koikoiFee).toBe(20); // 場代10 × こいこい2回
    expect(s.transfer).toBe(50);
    expect(result.state.chips).toEqual({ A: 50, B: 90 });
    expect(result.state.dealer).toBe("B"); // 勝者が次局の親
  });

  it("四光・倍率3 = 48文", () => {
    const shiko = [1, 3, 8, 12].map((m) => findCard(m as 1, "hikari").id);
    const state = makeTable(
      makeRound({
        phase: "awaitDecision",
        turn: "A",
        hands: { A: [0], B: [1] },
        captured: { A: shiko, B: [] },
        multiplier: 3,
      }),
      { A: 100, B: 100 },
      makeConfig({ month: 2 }), // 旬と重ねない
    );
    const result = applyAction(state, { type: "declareShobu", player: "A" });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(settlementOf(result.events).gross).toBe(48);
  });

  it("旬札ボーナスは倍率の外側で +1文×レート", () => {
    // 月=7(萩)。猪(7月)が旬札1枚 → 5×2×1 + 1×2 = 12
    const state = makeTable(
      makeRound({
        phase: "awaitDecision",
        turn: "A",
        hands: { A: [0], B: [1] },
        captured: { A: inoshikacho, B: [] },
      }),
      { A: 100, B: 100 },
      makeConfig({ month: 7 }),
    );
    const result = applyAction(state, { type: "declareShobu", player: "A" });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    const s = settlementOf(result.events);
    expect(s.shunCount).toBe(1);
    expect(s.shunBonus).toBe(2);
    expect(s.gross).toBe(12);
  });

  it("支払いは持ち文で打ち止め(飛び)、賭場戦が終了する", () => {
    const state = makeTable(
      makeRound({
        phase: "awaitDecision",
        turn: "A",
        hands: { A: [0], B: [1] },
        captured: { A: inoshikacho, B: [] },
        multiplier: 3,
      }),
      { A: 100, B: 20 }, // 獲得30 > 持ち文20
    );
    const result = applyAction(state, { type: "declareShobu", player: "A" });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(settlementOf(result.events).transfer).toBe(20);
    expect(result.state.chips.B).toBe(0);
    expect(result.state.result).toEqual({ kind: "bust", winner: "A" });
  });
});

describe("首賭け", () => {
  const sanko = [1, 3, 12].map((m) => findCard(m as 1, "hikari").id);

  it("首賭け側が勝つと獲得×2", () => {
    const state = makeTable(
      makeRound({
        phase: "awaitDecision",
        turn: "A",
        hands: { A: [0], B: [1] },
        captured: { A: sanko, B: [] },
      }),
      { A: 3, B: 100 },
      makeConfig({ rate: 1, entryFee: 5, kubikake: "A", month: 2 }),
    );
    const result = applyAction(state, { type: "declareShobu", player: "A" });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    const s = settlementOf(result.events);
    expect(s.kubikakeDoubled).toBe(true);
    expect(s.gross).toBe(10); // 5×1×1 ×2
  });

  it("首賭け側が敗れると全額没収で即終了", () => {
    const state = makeTable(
      makeRound({
        phase: "awaitDecision",
        turn: "B",
        hands: { A: [0], B: [1] },
        captured: { A: [], B: sanko },
      }),
      { A: 37, B: 100 },
      makeConfig({ rate: 1, entryFee: 5, kubikake: "A" }),
    );
    const result = applyAction(state, { type: "declareShobu", player: "B" });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(settlementOf(result.events).transfer).toBe(37);
    expect(result.state.chips.A).toBe(0);
    expect(result.state.result).toEqual({ kind: "bust", winner: "B" });
  });

  it("首賭け中の流局も飛び", () => {
    // A が最後の1枚(合わない札)を出して流局 → 首賭けの A が飛ぶ
    const state = makeTable(
      makeRound({
        turn: "A",
        hands: { A: [findCard(1, "kasu").id], B: [] },
        field: [findCard(5, "tane").id],
        deck: [findCard(9, "kasu").id],
      }),
      { A: 8, B: 100 },
      makeConfig({ rate: 1, entryFee: 5, kubikake: "A" }),
    );
    const result = applyAction(state, {
      type: "playCard",
      player: "A",
      card: findCard(1, "kasu").id,
    });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.state.chips).toEqual({ A: 0, B: 108 });
    expect(result.state.result).toEqual({ kind: "bust", winner: "B" });
  });
});

describe("局の進行", () => {
  it("流局: 両者の手札が尽きたら無得点で親交代", () => {
    const state = makeTable(
      makeRound({
        turn: "A",
        hands: { A: [findCard(1, "kasu").id], B: [] },
        field: [findCard(5, "tane").id],
        deck: [findCard(9, "kasu").id],
      }),
      { A: 100, B: 100 },
    );
    const result = applyAction(state, {
      type: "playCard",
      player: "A",
      card: findCard(1, "kasu").id,
    });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.state.chips).toEqual({ A: 100, B: 100 });
    expect(result.state.round?.phase).toBe("roundOver");
    expect(result.state.dealer).toBe("B"); // 親交代
    const end = result.events.find((e) => e.type === "roundEnd");
    expect(end).toEqual({ type: "roundEnd", settlement: null });
  });

  it("同月の場札が2枚あるときは合わせ先の選択が必要", () => {
    const hand = findCard(1, "hikari").id;
    const targets = [findCard(1, "kasu", 0).id, findCard(1, "kasu", 1).id];
    const state = makeTable(
      makeRound({
        turn: "A",
        hands: { A: [hand, 0], B: [1] },
        field: [...targets, findCard(5, "tane").id],
        deck: [findCard(9, "kasu").id],
      }),
      { A: 100, B: 100 },
    );
    const noTarget = applyAction(state, { type: "playCard", player: "A", card: hand });
    expect(noTarget.ok).toBe(false);
    const withTarget = applyAction(state, {
      type: "playCard",
      player: "A",
      card: hand,
      target: targets[0],
    });
    expect(withTarget.ok).toBe(true);
    if (!withTarget.ok) return;
    expect(withTarget.state.round?.captured.A).toEqual([hand, targets[0]]);
  });

  it("こいこいで倍率が上がり手番が渡る", () => {
    const state = makeTable(
      makeRound({
        phase: "awaitDecision",
        turn: "A",
        hands: { A: [0, 4], B: [1] },
        captured: { A: inoshikacho, B: [] },
      }),
      { A: 100, B: 100 },
    );
    const result = applyAction(state, { type: "declareKoikoi", player: "A" });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.state.round?.multiplier).toBe(2);
    expect(result.state.round?.koikoiCount.A).toBe(1);
    expect(result.state.round?.turn).toBe("B");
    expect(result.state.round?.phase).toBe("awaitPlay");
  });

  it("不正アクションは状態を変えず拒否される", () => {
    const state = makeTable(makeRound({ turn: "A", hands: { A: [0], B: [1] } }), {
      A: 100,
      B: 100,
    });
    expect(applyAction(state, { type: "playCard", player: "B", card: 1 }).ok).toBe(false);
    expect(applyAction(state, { type: "playCard", player: "A", card: 99 }).ok).toBe(false);
    expect(applyAction(state, { type: "declareKoikoi", player: "A" }).ok).toBe(false);
  });

  it("撤退は入場側のみ・局間のみ", () => {
    const state = makeTable(makeRound({ phase: "roundOver" }), { A: 100, B: 100 });
    expect(applyAction(state, { type: "retreat", player: "B" }).ok).toBe(false);
    const result = applyAction(state, { type: "retreat", player: "A" });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.state.result).toEqual({ kind: "retreat", winner: null });
    const playing = makeTable(makeRound({ phase: "awaitPlay" }), { A: 100, B: 100 });
    expect(applyAction(playing, { type: "retreat", player: "A" }).ok).toBe(false);
  });

  it("nextRound で次局が配られ親は勝者", () => {
    const state = makeTable(makeRound({ phase: "roundOver" }), { A: 90, B: 110 });
    const result = applyAction(state, { type: "nextRound", player: "A" });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.state.roundNumber).toBe(2);
    expect(result.state.round?.hands.A).toHaveLength(8);
    expect(countAllCards(result.state)).toBe(48);
  });
});

describe("細工フック", () => {
  it("金鍍金: 取ると即 +3文×レート(場からの増減)", () => {
    const enchanted = findCard(1, "kasu", 1).id;
    const state = makeTable(
      makeRound({
        turn: "A",
        hands: { A: [findCard(1, "kasu", 0).id], B: [1] },
        field: [enchanted],
        deck: [findCard(9, "kasu").id],
      }),
      { A: 100, B: 100 },
      makeConfig({ rate: 2, effects: { [enchanted]: "kinmekki" } }),
    );
    const result = applyAction(state, {
      type: "playCard",
      player: "A",
      card: findCard(1, "kasu", 0).id,
    });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.state.chips.A).toBe(106);
    expect(result.events.some((e) => e.type === "effect" && e.effect === "kinmekki")).toBe(true);
  });

  it("呪い: 取っていた側が精算時に -3文×レート", () => {
    const cursed = findCard(1, "kasu").id;
    const state = makeTable(
      makeRound({
        phase: "awaitDecision",
        turn: "B",
        hands: { A: [0], B: [1] },
        captured: { A: [cursed], B: inoshikacho },
      }),
      { A: 100, B: 100 },
      makeConfig({ rate: 2, effects: { [cursed]: "noroi" } }),
    );
    const result = applyAction(state, { type: "declareShobu", player: "B" });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    // 移動10文(5×2×1)+ 呪い-6文 → A は 84
    expect(result.state.chips).toEqual({ A: 84, B: 110 });
  });

  it("賽の目: 取った状態で上がると局倍率+1", () => {
    const dice = findByTag("butterfly").id;
    const state = makeTable(
      makeRound({
        phase: "awaitDecision",
        turn: "B",
        hands: { A: [0], B: [1] },
        captured: { A: [], B: inoshikacho },
      }),
      { A: 100, B: 100 },
      makeConfig({ rate: 2, effects: { [dice]: "sainome" } }),
    );
    const result = applyAction(state, { type: "declareShobu", player: "B" });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    const s = settlementOf(result.events);
    expect(s.multiplier).toBe(2);
    expect(s.gross).toBe(20); // 5×2×2
  });
});
