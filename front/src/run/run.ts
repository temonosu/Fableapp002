import { cardOf } from "../game/cards";
import { applyAction as applyTableAction, createTable } from "../game/match";
import { combineSeeds, mulberry32 } from "../game/rng";
import type { GameEvent, PlayerId, TableConfig } from "../game/types";
import { BOSS_COLUMN, REGION_NAMES, generateRegionBoard } from "./board";
import { RELICS, RUN_EVENTS, SAIKU_LIMIT_BASE, marketPool, saikuName } from "./items";
import type { BoardNode, RunAction, RunApplyResult, RunState } from "./types";

export const START_CHIPS = 100;
export const REGION_COUNT = 3;

/** counter を1つ消費して 0〜1 の乱数を得る(シード+アクション列で再現可能) */
function draw(draft: RunState): number {
  const rng = mulberry32(combineSeeds(draft.seed, 7777 + draft.counter));
  draft.counter += 1;
  return rng();
}

export function createRun(seed: number): RunState {
  return {
    seed,
    counter: 0,
    chips: START_CHIPS,
    region: 0,
    column: -1,
    lane: 0,
    board: generateRegionBoard(seed, 1, 0),
    relics: [],
    saiku: { inventory: [], placed: {} },
    dice: null,
    pendingColumn: null,
    status: "board",
    battle: null,
    battleNode: null,
    enemyAggression: 0.5,
    market: null,
    eventText: null,
    manekineko: 0,
  };
}

export function saikuLimit(state: RunState): number {
  return SAIKU_LIMIT_BASE + (state.relics.includes("saikubako") ? 2 : 0);
}

export function entryFeeFor(state: RunState, rate: number): number {
  const base = rate * 5;
  return state.relics.includes("kidogomen") ? Math.ceil(base / 2) : base;
}

function fail(reason: string): RunApplyResult {
  return { ok: false, reason };
}

function startBattle(draft: RunState, node: BoardNode, log: string[]): void {
  const isBoss = node.kind === "sekisho";
  const rate = isBoss || node.column >= 4 ? 2 : 1;
  const entryFee = entryFeeFor(draft, rate);
  const kubikake: PlayerId | null = draft.chips < entryFee ? "A" : null;
  const enemyChips = isBoss ? 100 : 30 + Math.floor(draw(draft) * 21);
  draft.enemyAggression = isBoss ? 0.85 : 0.3 + draw(draft) * 0.5;
  const dealer: PlayerId = draw(draft) < 0.5 ? "A" : "B";
  const config: TableConfig = {
    seed: Math.floor(draw(draft) * 0xffffffff) >>> 0,
    month: node.month,
    rate,
    entryFee,
    entrant: "A",
    effects: { ...draft.saiku.placed },
    kubikake,
  };
  const { state } = createTable(config, { A: draft.chips, B: enemyChips }, dealer);
  draft.battle = state;
  draft.battleNode = node;
  draft.status = "battle";
  log.push(
    `${isBoss ? "関所" : "賭場"}に入る(${node.month}月・レート${rate}文・場代${entryFee}文・相手の持ち文${enemyChips}文)`,
  );
  if (kubikake !== null) log.push("場代が払えない…首賭けで入場した!");
}

function land(draft: RunState, column: number, lane: number, log: string[]): RunApplyResult {
  const node = draft.board[column]?.[lane];
  if (node === undefined) return fail("そのマスは存在しない");
  draft.column = column;
  draft.lane = lane;
  switch (node.kind) {
    case "tobaku":
    case "sekisho":
      startBattle(draft, node, log);
      break;
    case "market": {
      const pool = marketPool(draft.relics);
      const stock = [];
      const used = new Set<number>();
      while (stock.length < Math.min(3, pool.length)) {
        const i = Math.floor(draw(draft) * pool.length);
        if (used.has(i)) continue;
        used.add(i);
        const item = pool[i];
        if (item !== undefined) stock.push(item);
      }
      draft.market = stock;
      draft.status = "market";
      log.push("市場に立ち寄った");
      break;
    }
    case "event": {
      const event = RUN_EVENTS[Math.floor(draw(draft) * RUN_EVENTS.length)];
      if (event === undefined) return fail("イベントの抽選に失敗");
      draft.chips = Math.max(0, draft.chips + event.chipDelta);
      draft.eventText = event.text;
      draft.status = "event";
      log.push(event.text);
      if (draft.chips <= 0) {
        draft.status = "gameover";
        log.push("路銀が尽きた…ラン終了");
      }
      break;
    }
  }
  return { ok: true, state: draft, log };
}

/**
 * ランのアクションを適用する。純関数(元の state は変更しない)。
 * battle アクションは game-core にそのまま中継する。
 */
export function applyRunAction(
  state: RunState,
  action: RunAction,
): RunApplyResult & { events?: GameEvent[] } {
  const draft = structuredClone(state);
  const log: string[] = [];

  switch (action.type) {
    case "roll": {
      if (draft.status !== "board") return fail("盤面にいない");
      if (draft.dice !== null) return fail("出目を選んでいない");
      const count = draft.relics.includes("saifuri") ? 3 : 2;
      draft.dice = Array.from({ length: count }, () => 1 + Math.floor(draw(draft) * 6));
      log.push(`サイコロ: ${draft.dice.join("・")}`);
      return { ok: true, state: draft, log };
    }

    case "chooseDie": {
      if (draft.status !== "board" || draft.dice === null) return fail("サイコロを振っていない");
      const value = draft.dice[action.index];
      if (value === undefined) return fail("その出目はない");
      draft.dice = null;
      const column = Math.min(draft.column + value, BOSS_COLUMN);
      const lanes = draft.board[column]?.length ?? 0;
      if (lanes >= 2) {
        draft.pendingColumn = column;
        draft.status = "chooseLane";
        return { ok: true, state: draft, log };
      }
      return land(draft, column, 0, log);
    }

    case "chooseLane": {
      if (draft.status !== "chooseLane" || draft.pendingColumn === null) {
        return fail("レーン選択待ちではない");
      }
      const column = draft.pendingColumn;
      if (draft.board[column]?.[action.lane] === undefined) return fail("そのレーンはない");
      draft.pendingColumn = null;
      return land(draft, column, action.lane, log);
    }

    case "battle": {
      if (draft.status !== "battle" || draft.battle === null) return fail("対局中ではない");
      const result = applyTableAction(draft.battle, action.action);
      if (!result.ok) return fail(result.reason);
      draft.battle = result.state;
      // 招き猫: 自分が受けた大入りを後払い分として積む
      if (draft.relics.includes("manekineko")) {
        for (const e of result.events) {
          if (e.type === "roundEnd" && e.settlement !== null) {
            const s = e.settlement;
            if (s.winner === "A" && s.ooiriBonus > 0) draft.manekineko += s.ooiriBonus;
          }
        }
      }
      return { ok: true, state: draft, log, events: result.events };
    }

    case "continueAfterBattle": {
      if (draft.status !== "battle" || draft.battle === null) return fail("対局中ではない");
      const battleResult = draft.battle.result;
      if (battleResult === null) return fail("対局がまだ終わっていない");
      const battle = draft.battle;
      const node = draft.battleNode;
      draft.chips = battle.chips.A;
      if (draft.manekineko > 0) {
        draft.chips += draft.manekineko;
        log.push(`招き猫が招く! おひねりをもう一度(+${draft.manekineko}文)`);
        draft.manekineko = 0;
      }
      draft.battle = null;
      draft.battleNode = null;

      if (draft.chips <= 0) {
        const haramaki = draft.relics.indexOf("haramaki");
        if (haramaki >= 0) {
          draft.relics.splice(haramaki, 1);
          draft.chips = 10;
          draft.status = "board";
          log.push("胴巻きに隠した10文で命拾いした…");
          return { ok: true, state: draft, log };
        }
        draft.status = "gameover";
        log.push("飛ばされた…ラン終了");
        return { ok: true, state: draft, log };
      }

      const wonBoss =
        node?.kind === "sekisho" && battleResult.kind === "bust" && battleResult.winner === "A";
      if (wonBoss) {
        draft.region += 1;
        if (draft.region >= REGION_COUNT) {
          draft.status = "clear";
          log.push(`全地方を制覇した! 持ち帰った路銀: ${draft.chips}文`);
          return { ok: true, state: draft, log };
        }
        draft.board = generateRegionBoard(draft.seed, 1, draft.region);
        draft.column = -1;
        draft.lane = 0;
        draft.status = "board";
        log.push(`関所を破った! ${REGION_NAMES[draft.region] ?? "次の地方"}へ`);
        return { ok: true, state: draft, log };
      }

      draft.status = "board";
      return { ok: true, state: draft, log };
    }

    case "buy": {
      if (draft.status !== "market" || draft.market === null) return fail("市場にいない");
      const item = draft.market[action.index];
      if (item === undefined) return fail("その品はない");
      if (draft.chips < item.price) return fail("文が足りない");
      draft.chips -= item.price;
      if (item.kind === "saiku") {
        draft.saiku.inventory.push(item.effect);
        log.push(`細工「${saikuName(item.effect)}」を買った(-${item.price}文)`);
      } else {
        draft.relics.push(item.relic);
        draft.market.splice(action.index, 1);
        log.push(`レリック「${RELICS[item.relic].name}」を買った(-${item.price}文)`);
      }
      return { ok: true, state: draft, log };
    }

    case "assignSaiku": {
      if (draft.status !== "market") return fail("細工の仕込みは市場でのみ");
      const index = draft.saiku.inventory.indexOf(action.effect);
      if (index < 0) return fail("その細工を持っていない");
      if (draft.saiku.placed[action.card] !== undefined) return fail("その札には既に細工がある");
      if (Object.keys(draft.saiku.placed).length >= saikuLimit(draft)) {
        return fail("細工の上限に達している");
      }
      draft.saiku.inventory.splice(index, 1);
      draft.saiku.placed[action.card] = action.effect;
      const card = cardOf(action.card);
      log.push(`${card.month}月「${card.name}」に${saikuName(action.effect)}を仕込んだ`);
      return { ok: true, state: draft, log };
    }

    case "leaveMarket": {
      if (draft.status !== "market") return fail("市場にいない");
      draft.market = null;
      draft.status = "board";
      return { ok: true, state: draft, log };
    }

    case "ackEvent": {
      if (draft.status !== "event") return fail("イベント中ではない");
      draft.eventText = null;
      draft.status = "board";
      return { ok: true, state: draft, log };
    }
  }
}
