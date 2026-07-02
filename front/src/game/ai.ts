import { cardOf } from "./cards";
import { fieldMatches, other } from "./match";
import type { Action, CardId, PlayerId, RoundState, TableState } from "./types";
import { totalPoints } from "./yaku";

// NPC の思考ルーチン。1手読みのヒューリスティック(探索なし)。
// 入力が同じなら同じ手を返す(決定論性: リプレイ・P2P 検証のため乱数を使わない)

export interface AiPersonality {
  /** 攻撃性 0〜1。高いほどこいこいしやすい */
  aggression: number;
}

const KIND_VALUE: Record<string, number> = {
  hikari: 20,
  tane: 10,
  tanzaku: 6,
  kasu: 1,
};

/** 1枚の取得価値(旬・細工・役シナジー込み) */
function captureValue(state: TableState, player: PlayerId, cardId: CardId): number {
  const card = cardOf(cardId);
  const round = state.round;
  let value = KIND_VALUE[card.kind] ?? 0;
  if (card.month === state.config.month) value += 3; // 旬札
  const effect = state.config.effects[cardId];
  if (effect === "kinmekki") value += 6;
  if (effect === "noroi") value -= 8;
  if (effect === "sainome") value += 5;
  if (round === null) return value;

  const mine = round.captured[player].map(cardOf);
  if (card.kind === "hikari") {
    value += 6 * mine.filter((c) => c.kind === "hikari").length;
  }
  if (card.tag === "boar" || card.tag === "deer" || card.tag === "butterfly") {
    value +=
      5 * mine.filter((c) => c.tag === "boar" || c.tag === "deer" || c.tag === "butterfly").length;
  }
  if (card.tag === "akatan" || card.tag === "aotan") {
    value += 5 * mine.filter((c) => c.tag === card.tag).length;
  }
  if (card.tag === "sake" && mine.some((c) => c.tag === "moon" || c.tag === "curtain")) {
    value += 8;
  }
  if ((card.tag === "moon" || card.tag === "curtain") && mine.some((c) => c.tag === "sake")) {
    value += 8;
  }
  return value;
}

/** 相手の役の近さ(0〜1)。こいこい判断のリスク評価に使う */
function opponentThreat(state: TableState, player: PlayerId): number {
  const round = state.round;
  if (round === null) return 0;
  const opp = round.captured[other(player)].map(cardOf);
  const hikari = opp.filter((c) => c.kind === "hikari").length;
  const tanzaku = opp.filter((c) => c.kind === "tanzaku").length;
  const tane = opp.filter((c) => c.kind === "tane").length;
  const kasu = opp.filter((c) => c.kind === "kasu").length;
  let threat = 0;
  if (hikari >= 2) threat += 0.35;
  if (tanzaku >= 4) threat += 0.3;
  if (tane >= 4) threat += 0.25;
  if (kasu >= 8) threat += 0.25;
  return Math.min(1, threat);
}

/**
 * 現在の状態で AI が取るべきアクションを返す。
 * AI の手番・判断待ちでなければ null。
 */
export function chooseAiAction(
  state: TableState,
  player: PlayerId,
  personality: AiPersonality,
): Action | null {
  const round = state.round;
  if (round === null) return null;

  if (round.phase === "awaitFlipTarget" && round.turn === player) {
    const flipped = round.pendingFlip;
    if (flipped === null) return null;
    const targets = fieldMatches(round, flipped);
    const best = pickMax(targets, (t) => captureValue(state, player, t));
    return best === undefined ? null : { type: "chooseFlipTarget", player, target: best };
  }

  if (round.phase === "awaitDecision" && round.turn === player) {
    return decideKoikoi(state, round, player, personality);
  }

  if (round.phase === "awaitPlay" && round.turn === player) {
    return choosePlay(state, round, player);
  }

  return null;
}

function choosePlay(state: TableState, round: RoundState, player: PlayerId): Action | null {
  const hand = round.hands[player];
  let best: { action: Action; score: number } | null = null;
  for (const card of hand) {
    const matches = fieldMatches(round, card);
    if (matches.length === 0) {
      // 捨て札: 価値の低い札から切る(自分の取得価値をそのまま損失とみなす)
      const score = -captureValue(state, player, card) * 0.4;
      if (best === null || score > best.score) {
        best = { action: { type: "playCard", player, card }, score };
      }
    } else if (matches.length === 3) {
      const score =
        captureValue(state, player, card) +
        matches.reduce((s, m) => s + captureValue(state, player, m), 0);
      if (best === null || score > best.score) {
        best = { action: { type: "playCard", player, card }, score };
      }
    } else {
      for (const target of matches) {
        const score = captureValue(state, player, card) + captureValue(state, player, target);
        if (best === null || score > best.score) {
          best = { action: { type: "playCard", player, card, target }, score };
        }
      }
    }
  }
  return best?.action ?? null;
}

function decideKoikoi(
  state: TableState,
  round: RoundState,
  player: PlayerId,
  personality: AiPersonality,
): Action {
  const base = totalPoints(round.captured[player]);
  const gain = base * state.config.rate * round.multiplier;
  const oppChips = state.chips[other(player)];
  const remaining = round.hands[player].length;

  // 今上がれば相手が飛ぶなら迷わず勝負
  if (gain >= oppChips) return { type: "declareShobu", player };
  // 続ける余地がほぼないなら勝負
  if (remaining <= 1) return { type: "declareShobu", player };

  const threat = opponentThreat(state, player);
  const score = personality.aggression * (remaining / 8) - threat * 0.5 - base * 0.03;
  return score > 0 ? { type: "declareKoikoi", player } : { type: "declareShobu", player };
}

function pickMax<T>(items: readonly T[], score: (item: T) => number): T | undefined {
  let best: T | undefined;
  let bestScore = -Infinity;
  for (const item of items) {
    const s = score(item);
    if (s > bestScore) {
      best = item;
      bestScore = s;
    }
  }
  return best;
}
