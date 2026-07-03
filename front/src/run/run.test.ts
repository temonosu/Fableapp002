import { describe, expect, it } from "vitest";
import { chooseAiAction } from "../game/ai";
import type { Month } from "../game/types";
import { BOSS_COLUMN, generateRegionBoard, regionMonths } from "./board";
import { applyRunAction, createRun, saikuLimit } from "./run";
import type { BoardNode, RunAction, RunState } from "./types";

function node(column: number, kind: BoardNode["kind"], month: Month = 1): BoardNode {
  return { column, lane: 0, month, kind };
}

/** 次の着地マスを固定したいテスト用に、盤面と出目を直接仕込む */
function rigged(kind: BoardNode["kind"], over: Partial<RunState> = {}): RunState {
  const state = createRun(1);
  return {
    ...state,
    board: [[node(0, kind)], ...state.board.slice(1)],
    dice: [1],
    ...over,
  };
}

function apply(state: RunState, action: RunAction): RunState {
  const result = applyRunAction(state, action);
  if (!result.ok) throw new Error(result.reason);
  return result.state;
}

describe("盤面生成", () => {
  it("8列・最終列が関所・月は地方の4ヶ月", () => {
    for (let region = 0; region < 3; region++) {
      const board = generateRegionBoard(42, 1, region);
      expect(board).toHaveLength(8);
      expect(board[BOSS_COLUMN]).toHaveLength(1);
      expect(board[BOSS_COLUMN]?.[0]?.kind).toBe("sekisho");
      const months = regionMonths(region);
      for (const column of board) {
        expect(column.length).toBeGreaterThanOrEqual(1);
        expect(column.length).toBeLessThanOrEqual(2);
        for (const n of column) {
          expect(months).toContain(n.month);
        }
      }
    }
  });

  it("同一シードなら同一盤面", () => {
    expect(generateRegionBoard(7, 1, 0)).toEqual(generateRegionBoard(7, 1, 0));
  });
});

describe("移動", () => {
  it("サイコロは2個(賽振りの腕で3個)、選んだ出目だけ進む", () => {
    const rolled = apply(createRun(3), { type: "roll" });
    expect(rolled.dice).toHaveLength(2);
    for (const d of rolled.dice ?? []) {
      expect(d).toBeGreaterThanOrEqual(1);
      expect(d).toBeLessThanOrEqual(6);
    }
    const withRelic = apply({ ...createRun(3), relics: ["saifuri"] }, { type: "roll" });
    expect(withRelic.dice).toHaveLength(3);
  });

  it("関所を通り過ぎない(クランプして関所戦)", () => {
    const state = { ...createRun(5), column: BOSS_COLUMN - 1, dice: [6, 6] };
    const landed = apply(state, { type: "chooseDie", index: 0 });
    expect(landed.column).toBe(BOSS_COLUMN);
    expect(landed.status).toBe("battle");
    expect(landed.battleNode?.kind).toBe("sekisho");
    expect(landed.battle?.chips.B).toBe(100);
  });

  it("2レーン列に着地するとレーン選択になる", () => {
    const state = createRun(11);
    const twoLane = state.board.findIndex((c) => c.length === 2);
    expect(twoLane).toBeGreaterThanOrEqual(0);
    const landed = apply({ ...state, dice: [twoLane + 1] }, { type: "chooseDie", index: 0 });
    expect(landed.status).toBe("chooseLane");
    const after = apply(landed, { type: "chooseLane", lane: 1 });
    expect(after.lane).toBe(1);
  });
});

describe("マスの解決", () => {
  it("賭場: 場代を払って対局が始まる(細工が持ち込まれる)", () => {
    const state = rigged("tobaku", {
      saiku: { inventory: [], placed: { 2: "kinmekki" } },
    });
    const landed = apply(state, { type: "chooseDie", index: 0 });
    expect(landed.status).toBe("battle");
    expect(landed.battle?.config.effects[2]).toBe("kinmekki");
    expect(landed.battle?.config.kubikake).toBeNull();
    // 場代5文(レート1)が引かれている
    expect(landed.battle?.chips.A).toBe(95);
  });

  it("場代が払えないと首賭けで自動入場", () => {
    const landed = apply(rigged("tobaku", { chips: 3 }), { type: "chooseDie", index: 0 });
    expect(landed.battle?.config.kubikake).toBe("A");
    expect(landed.battle?.chips.A).toBe(3); // 場代免除
    expect(landed.battle?.heat).toBe(30);
  });

  it("イベント: 文が増減する", () => {
    const landed = apply(rigged("event"), { type: "chooseDie", index: 0 });
    expect(landed.status).toBe("event");
    expect([115, 90, 100]).toContain(landed.chips);
    const back = apply(landed, { type: "ackEvent" });
    expect(back.status).toBe("board");
  });

  it("市場: 3点並び、購入で文が減る。レリックは在庫から消える", () => {
    const landed = apply(rigged("market"), { type: "chooseDie", index: 0 });
    expect(landed.status).toBe("market");
    expect(landed.market).toHaveLength(3);
    const stock = landed.market ?? [];
    const relicIndex = stock.findIndex((i) => i.kind === "relic");
    const saikuIndex = stock.findIndex((i) => i.kind === "saiku");
    let state = landed;
    if (saikuIndex >= 0) {
      const item = stock[saikuIndex];
      state = apply(state, { type: "buy", index: saikuIndex });
      expect(state.chips).toBe(landed.chips - (item?.price ?? 0));
      expect(state.saiku.inventory).toHaveLength(1);
    }
    if (relicIndex >= 0 && state.market !== null) {
      const idx = state.market.findIndex((i) => i.kind === "relic");
      if (idx >= 0) {
        const before = state.market.length;
        state = apply(state, { type: "buy", index: idx });
        expect(state.relics).toHaveLength(1);
        expect(state.market).toHaveLength(before - 1);
      }
    }
    expect(apply(state, { type: "leaveMarket" }).status).toBe("board");
  });

  it("細工の仕込みは市場でのみ・上限あり・二重仕込み不可", () => {
    const base = rigged("market");
    const landed = apply(base, { type: "chooseDie", index: 0 });
    const withInv: RunState = {
      ...landed,
      saiku: { inventory: ["kinmekki", "noroi"], placed: {} },
    };
    const placed = apply(withInv, { type: "assignSaiku", effect: "kinmekki", card: 2 });
    expect(placed.saiku.placed[2]).toBe("kinmekki");
    expect(placed.saiku.inventory).toEqual(["noroi"]);
    // 同じ札への二重仕込みは拒否
    expect(applyRunAction(placed, { type: "assignSaiku", effect: "noroi", card: 2 }).ok).toBe(
      false,
    );
    // 上限(細工箱なし=6)
    const full: RunState = {
      ...placed,
      saiku: {
        inventory: ["noroi"],
        placed: {
          0: "kinmekki",
          1: "kinmekki",
          2: "kinmekki",
          3: "kinmekki",
          4: "kinmekki",
          5: "kinmekki",
        },
      },
    };
    expect(saikuLimit(full)).toBe(6);
    expect(applyRunAction(full, { type: "assignSaiku", effect: "noroi", card: 10 }).ok).toBe(false);
    expect(saikuLimit({ ...full, relics: ["saikubako"] })).toBe(8);
  });
});

/** 対局を AI 両対応で最後まで進める */
function playBattleOut(state: RunState): RunState {
  let current = state;
  for (let i = 0; i < 3000; i++) {
    const battle = current.battle;
    if (battle === null) throw new Error("対局中ではない");
    if (battle.result !== null) return current;
    if (battle.round?.phase === "roundOver") {
      current = apply(current, { type: "battle", action: { type: "nextRound", player: "A" } });
      continue;
    }
    const turn = battle.round?.turn;
    if (turn === undefined) throw new Error("局がない");
    const action = chooseAiAction(
      battle,
      turn,
      turn === "A" ? { aggression: 0.5 } : { aggression: current.enemyAggression },
    );
    if (action === null) throw new Error("AI が手を返さない");
    current = apply(current, { type: "battle", action });
  }
  throw new Error("対局が終わらない");
}

describe("対局の中継と決着", () => {
  it("賭場戦の結果が持ち文に反映され、盤面に戻る", () => {
    const landed = apply(rigged("tobaku"), { type: "chooseDie", index: 0 });
    const done = playBattleOut(landed);
    const battleChips = done.battle?.chips.A ?? -1;
    const after = apply(done, { type: "continueAfterBattle" });
    if (battleChips <= 0) {
      expect(["gameover", "board"]).toContain(after.status); // 胴巻きなし → gameover
    } else {
      expect(after.status).toBe("board");
      expect(after.chips).toBe(battleChips);
    }
    expect(after.battle).toBeNull();
  });

  it("飛ばされても胴巻きがあれば10文で生還(消費)", () => {
    const landed = apply(rigged("tobaku", { chips: 6, relics: ["haramaki"] }), {
      type: "chooseDie",
      index: 0,
    });
    // 対局を強制的に敗北状態にする
    const lost: RunState = {
      ...landed,
      battle:
        landed.battle === null
          ? null
          : {
              ...landed.battle,
              chips: { A: 0, B: 50 },
              result: { kind: "bust", winner: "B" },
            },
    };
    const after = apply(lost, { type: "continueAfterBattle" });
    expect(after.chips).toBe(10);
    expect(after.relics).toEqual([]);
    expect(after.status).toBe("board");
  });

  it("関所を破ると次の地方へ、3地方制覇でクリア", () => {
    const boss = { ...createRun(9), column: BOSS_COLUMN - 1, dice: [1] };
    const landed = apply(boss, { type: "chooseDie", index: 0 });
    expect(landed.battleNode?.kind).toBe("sekisho");
    const won: RunState = {
      ...landed,
      battle:
        landed.battle === null
          ? null
          : { ...landed.battle, chips: { A: 150, B: 0 }, result: { kind: "bust", winner: "A" } },
    };
    const next = apply(won, { type: "continueAfterBattle" });
    expect(next.region).toBe(1);
    expect(next.column).toBe(-1);
    expect(next.status).toBe("board");
    // 最終地方でボスを倒すとクリア
    const final: RunState = { ...next, region: 2, column: BOSS_COLUMN - 1, dice: [1] };
    const bossLanded = apply(final, { type: "chooseDie", index: 0 });
    const finalWon: RunState = {
      ...bossLanded,
      battle:
        bossLanded.battle === null
          ? null
          : {
              ...bossLanded.battle,
              chips: { A: 200, B: 0 },
              result: { kind: "bust", winner: "A" },
            },
    };
    expect(apply(finalWon, { type: "continueAfterBattle" }).status).toBe("clear");
  });
});

describe("通しシミュレーション", () => {
  it("複数シードでランを最後まで(または上限まで)進めても不正が起きない", () => {
    for (let seed = 1; seed <= 5; seed++) {
      let state = createRun(seed);
      let steps = 0;
      while (state.status !== "clear" && state.status !== "gameover" && steps < 20000) {
        steps++;
        switch (state.status) {
          case "board":
            state = apply(
              state,
              state.dice === null ? { type: "roll" } : { type: "chooseDie", index: 0 },
            );
            break;
          case "chooseLane":
            state = apply(state, { type: "chooseLane", lane: 0 });
            break;
          case "market":
            state = apply(state, { type: "leaveMarket" });
            break;
          case "event":
            state = apply(state, { type: "ackEvent" });
            break;
          case "battle": {
            const battle = state.battle;
            if (battle === null) throw new Error("battle がない");
            if (battle.result !== null) {
              state = apply(state, { type: "continueAfterBattle" });
            } else if (battle.round?.phase === "roundOver") {
              state = apply(state, { type: "battle", action: { type: "nextRound", player: "A" } });
            } else {
              const turn = battle.round?.turn ?? "A";
              const action = chooseAiAction(battle, turn, { aggression: 0.5 });
              if (action === null) throw new Error("AI が手を返さない");
              state = apply(state, { type: "battle", action });
            }
            break;
          }
        }
        expect(state.chips).toBeGreaterThanOrEqual(0);
      }
      expect(["clear", "gameover"]).toContain(state.status);
    }
  });

  it("同一シード・同一操作で同一結果(決定論)", () => {
    const run = (): RunState => {
      let state = createRun(4);
      state = apply(state, { type: "roll" });
      state = apply(state, { type: "chooseDie", index: 1 });
      return state;
    };
    expect(run()).toEqual(run());
  });
});
