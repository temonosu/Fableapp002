import { ALL_CARD_IDS, cardOf } from "./cards";
import { effectOf, type EffectTrigger } from "./effects";
import { combineSeeds, mulberry32, shuffle } from "./rng";
import type {
  Action,
  ApplyResult,
  CardId,
  GameEvent,
  PlayerId,
  RoundState,
  Settlement,
  TableConfig,
  TableState,
} from "./types";
import { evaluateYaku, totalPoints } from "./yaku";

export function other(player: PlayerId): PlayerId {
  return player === "A" ? "B" : "A";
}

/** 場にある同月札 */
export function fieldMatches(round: RoundState, card: CardId): CardId[] {
  const month = cardOf(card).month;
  return round.field.filter((f) => cardOf(f).month === month);
}

function hasFourOfSameMonth(cards: readonly CardId[]): boolean {
  const counts = new Map<number, number>();
  for (const id of cards) {
    const m = cardOf(id).month;
    counts.set(m, (counts.get(m) ?? 0) + 1);
  }
  return [...counts.values()].some((n) => n >= 4);
}

/** 賭場戦を開始する。入場側は場代を払う(首賭け中は免除) */
export function createTable(
  config: TableConfig,
  chips: Record<PlayerId, number>,
  dealer: PlayerId,
): { state: TableState; events: GameEvent[] } {
  const paid = { ...chips };
  if (config.kubikake !== config.entrant) {
    paid[config.entrant] = Math.max(0, paid[config.entrant] - config.entryFee);
  }
  const base: TableState = {
    config,
    chips: paid,
    dealer,
    roundNumber: 1,
    round: null,
    result: null,
    heat: config.kubikake !== null ? 30 : 0, // 首賭け宣言は場が沸く
  };
  return dealRound(base);
}

/** 配札して局を開始する(要件1-2, 1-3: 場四・手四は配り直し) */
function dealRound(state: TableState): { state: TableState; events: GameEvent[] } {
  const rng = mulberry32(combineSeeds(state.config.seed, state.roundNumber));
  let deck: CardId[] = [];
  let field: CardId[] = [];
  let handA: CardId[] = [];
  let handB: CardId[] = [];
  // 配り直し条件を満たさなくなるまでシャッフルし直す(乱数列は継続)
  for (;;) {
    const shuffled = shuffle(ALL_CARD_IDS, rng);
    handA = shuffled.slice(0, 8);
    handB = shuffled.slice(8, 16);
    field = shuffled.slice(16, 24);
    deck = shuffled.slice(24);
    if (!hasFourOfSameMonth(field) && !hasFourOfSameMonth(handA) && !hasFourOfSameMonth(handB)) {
      break;
    }
  }
  const round: RoundState = {
    phase: "awaitPlay",
    turn: state.dealer,
    deck,
    field,
    hands: { A: handA, B: handB },
    captured: { A: [], B: [] },
    multiplier: 1,
    koikoiCount: { A: 0, B: 0 },
    yakuBase: { A: 0, B: 0 },
    pendingFlip: null,
  };
  return {
    state: { ...state, round },
    events: [{ type: "deal", dealer: state.dealer }],
  };
}

/** 細工フックの発火。chipDelta は場との受け渡し(0未満にはならない) */
function fireEffects(
  draft: TableState,
  round: RoundState,
  trigger: EffectTrigger,
  cards: readonly CardId[],
  owner: PlayerId,
  events: GameEvent[],
): void {
  for (const card of cards) {
    const effectId = draft.config.effects[card];
    if (effectId === undefined) continue;
    const effect = effectOf(effectId);
    if (effect.trigger !== trigger) continue;
    const outcome = effect.apply({ owner, rate: draft.config.rate });
    const chipDelta = outcome.chipDelta ?? 0;
    const multiplierDelta = outcome.multiplierDelta ?? 0;
    draft.chips[owner] = Math.max(0, draft.chips[owner] + chipDelta);
    round.multiplier += multiplierDelta;
    draft.heat += 5; // 細工の発動は場が沸く
    events.push({ type: "effect", effect: effectId, player: owner, chipDelta, multiplierDelta });
  }
}

function capture(
  draft: TableState,
  round: RoundState,
  player: PlayerId,
  cards: CardId[],
  events: GameEvent[],
): void {
  round.captured[player].push(...cards);
  events.push({ type: "capture", player, cards });
  fireEffects(draft, round, "capture", cards, player, events);
}

/** 山からめくって合わせる。選択が必要なら false(pending)を返す */
function flipFromDeck(draft: TableState, round: RoundState, events: GameEvent[]): boolean {
  const flipped = round.deck.shift();
  if (flipped === undefined) return true; // 山切れ(通常は起きない)
  events.push({ type: "flip", card: flipped });
  const matches = fieldMatches(round, flipped);
  if (matches.length === 0) {
    round.field.push(flipped);
    return true;
  }
  if (matches.length === 2) {
    round.pendingFlip = flipped;
    round.phase = "awaitFlipTarget";
    return false;
  }
  // 1枚 → その1枚と、3枚 → 全部まとめて取る
  const taken = matches.length === 3 ? matches : matches.slice(0, 1);
  round.field = round.field.filter((f) => !taken.includes(f));
  capture(draft, round, round.turn, [flipped, ...taken], events);
  return true;
}

/** 手番の締め: 新役チェック → 判断待ち / 手番交代 / 流局 */
function finishTurn(draft: TableState, round: RoundState, events: GameEvent[]): void {
  const player = round.turn;
  const points = totalPoints(round.captured[player]);
  if (points > round.yakuBase[player]) {
    events.push({
      type: "yaku",
      player,
      names: evaluateYaku(round.captured[player]).map((y) => y.name),
    });
    if (round.hands[player].length === 0) {
      // 続く手がないため自動的に勝負(要件2-4の例外処理)
      settleRound(draft, round, player, events);
      return;
    }
    round.phase = "awaitDecision";
    return;
  }
  passTurn(draft, round, events);
}

function passTurn(draft: TableState, round: RoundState, events: GameEvent[]): void {
  const next = other(round.turn);
  if (round.hands.A.length === 0 && round.hands.B.length === 0) {
    endInDraw(draft, round, events);
    return;
  }
  round.turn = round.hands[next].length > 0 ? next : round.turn;
  round.phase = "awaitPlay";
}

/** 流局(要件2-5)。首賭け中のプレイヤーは流局でも飛ぶ */
function endInDraw(draft: TableState, round: RoundState, events: GameEvent[]): void {
  events.push({ type: "roundEnd", settlement: null });
  const kubikake = draft.config.kubikake;
  if (kubikake !== null) {
    const opponent = other(kubikake);
    draft.chips[opponent] += draft.chips[kubikake];
    draft.chips[kubikake] = 0;
    endTable(draft, round, { kind: "bust", winner: opponent }, events);
    return;
  }
  draft.dealer = other(draft.dealer);
  round.phase = "roundOver";
}

function endTable(
  draft: TableState,
  round: RoundState,
  result: TableState["result"],
  events: GameEvent[],
): void {
  draft.result = result;
  round.phase = "tableOver";
  if (result !== null) {
    events.push({ type: "tableEnd", result });
  }
}

/** 精算(要件3)。docs/spec/game-core/design.md の式に対応 */
function settleRound(
  draft: TableState,
  round: RoundState,
  winner: PlayerId,
  events: GameEvent[],
): void {
  const { rate, entryFee, month, kubikake } = draft.config;
  const loser = other(winner);

  // winWith 細工(賽の目など)で倍率が先に確定する
  fireEffects(draft, round, "winWith", round.captured[winner], winner, events);

  const base = totalPoints(round.captured[winner]);
  const multiplier = round.multiplier;
  const shunCount = round.captured[winner].filter((c) => cardOf(c).month === month).length;
  const shunBonus = shunCount * rate;
  let gross = base * rate * multiplier + shunBonus;
  const kubikakeDoubled = kubikake === winner;
  if (kubikakeDoubled) gross *= 2;
  const koikoiFee = round.koikoiCount[loser] > 0 ? entryFee * round.koikoiCount[loser] : 0;

  // 首賭け側が敗れたら全額没収、通常は持ち文で打ち止め(飛び)
  const transfer =
    kubikake === loser ? draft.chips[loser] : Math.min(gross + koikoiFee, draft.chips[loser]);
  draft.chips[loser] -= transfer;
  draft.chips[winner] += transfer;

  // 大入り: 熱気100以上で上がった者におひねり(場からの湧き出し)。要件 roguelike-run 4-2
  const ooiriBonus = draft.heat >= 100 ? entryFee * 3 : 0;
  if (ooiriBonus > 0) {
    draft.chips[winner] += ooiriBonus;
    draft.heat = 0;
  }
  // 派手な上がりは場を沸かせる(次の大入りへの積み上げ)
  if (multiplier >= 3) draft.heat += 10 * multiplier;
  if (shunCount === 4) draft.heat += 10;

  const settlement: Settlement = {
    winner,
    base,
    multiplier,
    shunCount,
    shunBonus,
    koikoiFee,
    kubikakeDoubled,
    gross,
    transfer,
    ooiriBonus,
  };
  events.push({ type: "roundEnd", settlement });

  // 精算時細工(呪いなど)。取っていた側それぞれに発動する
  fireEffects(draft, round, "settle", round.captured.A, "A", events);
  fireEffects(draft, round, "settle", round.captured.B, "B", events);

  if (draft.chips.A <= 0 || draft.chips.B <= 0) {
    const bustWinner = draft.chips.A <= 0 ? "B" : "A";
    endTable(draft, round, { kind: "bust", winner: bustWinner }, events);
    return;
  }
  draft.dealer = winner;
  round.phase = "roundOver";
}

function fail(reason: string): ApplyResult {
  return { ok: false, reason };
}

/**
 * アクションを適用する。純関数(元の state は変更しない)。
 * 不正な操作は ok:false で拒否し、状態を変えない(P2P の検証に使う)。
 */
export function applyAction(state: TableState, action: Action): ApplyResult {
  const draft = structuredClone(state) as TableState;
  const round = draft.round;
  const events: GameEvent[] = [];
  if (round === null) return fail("局が開始されていない");

  switch (action.type) {
    case "playCard": {
      if (round.phase !== "awaitPlay") return fail("今は打牌できない");
      if (round.turn !== action.player) return fail("手番ではない");
      const hand = round.hands[action.player];
      if (!hand.includes(action.card)) return fail("手札にない札");

      const matches = fieldMatches(round, action.card);
      round.hands[action.player] = hand.filter((c) => c !== action.card);
      fireEffects(draft, round, "play", [action.card], action.player, events);

      if (matches.length === 0) {
        if (action.target !== undefined) return fail("合わせられる場札がない");
        round.field.push(action.card);
        events.push({ type: "toField", player: action.player, card: action.card });
      } else if (matches.length === 3) {
        round.field = round.field.filter((f) => !matches.includes(f));
        capture(draft, round, action.player, [action.card, ...matches], events);
      } else {
        const target = action.target ?? (matches.length === 1 ? matches[0] : undefined);
        if (target === undefined) return fail("合わせ先の選択が必要");
        if (!matches.includes(target)) return fail("その場札とは合わせられない");
        round.field = round.field.filter((f) => f !== target);
        capture(draft, round, action.player, [action.card, target], events);
      }

      if (flipFromDeck(draft, round, events)) {
        finishTurn(draft, round, events);
      }
      return { ok: true, state: draft, events };
    }

    case "chooseFlipTarget": {
      if (round.phase !== "awaitFlipTarget") return fail("合わせ先の選択待ちではない");
      if (round.turn !== action.player) return fail("手番ではない");
      const flipped = round.pendingFlip;
      if (flipped === null) return fail("めくり札がない");
      const matches = fieldMatches(round, flipped);
      if (!matches.includes(action.target)) return fail("その場札とは合わせられない");
      round.field = round.field.filter((f) => f !== action.target);
      round.pendingFlip = null;
      capture(draft, round, action.player, [flipped, action.target], events);
      finishTurn(draft, round, events);
      return { ok: true, state: draft, events };
    }

    case "declareKoikoi": {
      if (round.phase !== "awaitDecision") return fail("こいこいを宣言できる局面ではない");
      if (round.turn !== action.player) return fail("手番ではない");
      round.koikoiCount[action.player] += 1;
      round.multiplier += 1;
      round.yakuBase[action.player] = totalPoints(round.captured[action.player]);
      draft.heat += 15;
      events.push({ type: "koikoi", player: action.player, multiplier: round.multiplier });
      passTurn(draft, round, events);
      return { ok: true, state: draft, events };
    }

    case "declareShobu": {
      if (round.phase !== "awaitDecision") return fail("勝負を宣言できる局面ではない");
      if (round.turn !== action.player) return fail("手番ではない");
      settleRound(draft, round, action.player, events);
      return { ok: true, state: draft, events };
    }

    case "nextRound": {
      if (round.phase !== "roundOver") return fail("局が終わっていない");
      if (draft.result !== null) return fail("賭場戦は終了している");
      draft.roundNumber += 1;
      draft.heat = Math.max(0, draft.heat - 20); // 局をまたぐと熱気は冷める
      const next = dealRound(draft);
      return { ok: true, state: next.state, events: next.events };
    }

    case "retreat": {
      if (round.phase !== "roundOver") return fail("撤退は局と局の間でのみ可能");
      if (draft.result !== null) return fail("賭場戦は終了している");
      if (action.player !== draft.config.entrant) return fail("撤退できるのは入場側のみ");
      endTable(draft, round, { kind: "retreat", winner: null }, events);
      return { ok: true, state: draft, events };
    }
  }
}

/** 全ゾーンの札数が48で保たれているか(テスト・同期検証用) */
export function countAllCards(state: TableState): number {
  const r = state.round;
  if (r === null) return 0;
  return (
    r.deck.length +
    r.field.length +
    r.hands.A.length +
    r.hands.B.length +
    r.captured.A.length +
    r.captured.B.length +
    (r.pendingFlip !== null ? 1 : 0)
  );
}
