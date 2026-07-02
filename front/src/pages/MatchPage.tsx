import { useCallback, useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { chooseAiAction } from "../game/ai";
import { MONTH_FLOWERS, cardOf } from "../game/cards";
import { EFFECTS } from "../game/effects";
import { applyAction, createTable, fieldMatches } from "../game/match";
import { mulberry32 } from "../game/rng";
import type {
  Action,
  CardId,
  EffectId,
  GameEvent,
  Month,
  TableConfig,
  TableState,
} from "../game/types";
import { evaluateYaku } from "../game/yaku";

// 対AI戦の最小UI(game-core タスク8)。ラン構造(盤面・市場)は roguelike-run で実装する

const AI = { aggression: 0.6 };
const PLAYER_NAME = { A: "あなた", B: "胴元" } as const;

function monthLabel(month: Month): string {
  return `${month}月・${MONTH_FLOWERS[month - 1] ?? ""}`;
}

/** シードから賭場をひとつ生成する(月・細工の配置もシードで決まる) */
function newTable(seed: number): TableState {
  const rng = mulberry32(seed);
  const month = (Math.floor(rng() * 12) + 1) as Month;
  const pick = (kind: "kasu" | "tane"): CardId => {
    for (;;) {
      const id = Math.floor(rng() * 48);
      if (cardOf(id).kind === kind) return id;
    }
  };
  const effects: Partial<Record<CardId, EffectId>> = {};
  effects[pick("kasu")] = "kinmekki";
  const cursed = pick("kasu");
  if (effects[cursed] === undefined) effects[cursed] = "noroi";
  effects[pick("tane")] = "sainome";
  const config: TableConfig = {
    seed,
    month,
    rate: 1,
    entryFee: 5,
    entrant: "A",
    effects,
    kubikake: null,
  };
  return createTable(config, { A: 100, B: 40 }, rng() < 0.5 ? "A" : "B").state;
}

function describeEvents(state: TableState, events: GameEvent[]): string[] {
  const lines: string[] = [];
  for (const e of events) {
    switch (e.type) {
      case "deal":
        lines.push(`第${state.roundNumber}局 開始(先手: ${PLAYER_NAME[e.dealer]})`);
        break;
      case "yaku":
        lines.push(`${PLAYER_NAME[e.player]}に役: ${e.names.join("・")}`);
        break;
      case "koikoi":
        lines.push(`${PLAYER_NAME[e.player]}「こいこい!」(倍率 ×${e.multiplier})`);
        break;
      case "effect": {
        const chip = e.chipDelta !== 0 ? ` ${e.chipDelta > 0 ? "+" : ""}${e.chipDelta}文` : "";
        const mult = e.multiplierDelta !== 0 ? ` 倍率+${e.multiplierDelta}` : "";
        lines.push(`細工「${EFFECTS[e.effect].name}」発動(${PLAYER_NAME[e.player]}${chip}${mult})`);
        break;
      }
      case "roundEnd":
        if (e.settlement === null) {
          lines.push("流局。親を交代して次の局へ");
        } else {
          const s = e.settlement;
          const fee = s.koikoiFee > 0 ? ` + こいこい料${s.koikoiFee}文` : "";
          lines.push(
            `${PLAYER_NAME[s.winner]}の上がり! ${s.base}文 ×${s.multiplier}` +
              `${s.shunBonus > 0 ? ` + 旬${s.shunBonus}文` : ""}${fee} → ${s.transfer}文`,
          );
        }
        break;
      case "tableEnd":
        lines.push(
          e.result.kind === "retreat"
            ? "賭場から撤退した"
            : `勝負あり! ${e.result.winner !== null ? PLAYER_NAME[e.result.winner] : ""}の総取り`,
        );
        break;
      default:
        break;
    }
  }
  return lines;
}

const KIND_STYLE: Record<string, string> = {
  hikari: "bg-amber-100 border-amber-400",
  tane: "bg-rose-50 border-rose-300",
  tanzaku: "bg-violet-50 border-violet-300",
  kasu: "bg-neutral-100 border-neutral-300",
};

const EFFECT_BADGE: Record<EffectId, string> = {
  kinmekki: "金",
  noroi: "呪",
  sainome: "賽",
};

interface CardTileProps {
  id: CardId;
  state: TableState;
  highlighted?: boolean;
  selected?: boolean;
  onTap?: (id: CardId) => void;
}

function CardTile({ id, state, highlighted, selected, onTap }: CardTileProps) {
  const card = cardOf(id);
  const effect = state.config.effects[id];
  const isShun = card.month === state.config.month;
  return (
    <button
      type="button"
      onClick={() => onTap?.(id)}
      disabled={onTap === undefined}
      className={`relative flex h-16 w-11 flex-col items-center justify-between rounded border p-0.5 text-xs leading-tight ${
        KIND_STYLE[card.kind] ?? ""
      } ${selected === true ? "ring-2 ring-blue-500" : ""} ${
        highlighted === true ? "ring-2 ring-emerald-500" : ""
      } ${onTap === undefined ? "" : "active:scale-95"}`}
    >
      <span className="font-bold">{MONTH_FLOWERS[card.month - 1]}</span>
      <span className="text-[10px] text-neutral-600">{card.name}</span>
      {effect !== undefined && (
        <span className="absolute -top-1 -right-1 rounded-full bg-yellow-400 px-1 text-[10px] font-bold">
          {EFFECT_BADGE[effect]}
        </span>
      )}
      {isShun && <span className="absolute -top-1 -left-1 text-[10px]">🌸</span>}
    </button>
  );
}

function CapturedSummary({ state, player }: { state: TableState; player: "A" | "B" }) {
  const captured = state.round?.captured[player] ?? [];
  const yaku = evaluateYaku(captured);
  const counts = { hikari: 0, tane: 0, tanzaku: 0, kasu: 0 };
  for (const id of captured) counts[cardOf(id).kind] += 1;
  return (
    <div className="text-xs text-neutral-600">
      光{counts.hikari} タネ{counts.tane} 短{counts.tanzaku} カス{counts.kasu}
      {yaku.length > 0 && (
        <span className="ml-2 font-semibold text-rose-700">
          {yaku.map((y) => `${y.name}${y.points}`).join("・")}
        </span>
      )}
    </div>
  );
}

export function MatchPage() {
  const [table, setTable] = useState<TableState>(() => newTable(Date.now() >>> 0));
  const [selected, setSelected] = useState<CardId | null>(null);
  const [log, setLog] = useState<string[]>([]);

  const round = table.round;

  const dispatch = useCallback(
    (action: Action) => {
      const result = applyAction(table, action);
      if (!result.ok) return;
      setSelected(null);
      setTable(result.state);
      setLog((prev) => [...prev, ...describeEvents(result.state, result.events)].slice(-6));
    },
    [table],
  );

  // AI(B)の手番を進める
  useEffect(() => {
    const action = chooseAiAction(table, "B", AI);
    if (action === null) return;
    const timer = setTimeout(() => dispatch(action), 700);
    return () => clearTimeout(timer);
  }, [table, dispatch]);

  const humanTurn = round !== null && round.turn === "A" && table.result === null;

  const playableTargets = useMemo(() => {
    if (round === null) return new Set<CardId>();
    if (round.phase === "awaitFlipTarget" && round.pendingFlip !== null) {
      return new Set(fieldMatches(round, round.pendingFlip));
    }
    if (selected !== null) return new Set(fieldMatches(round, selected));
    return new Set<CardId>();
  }, [round, selected]);

  if (round === null) return null;

  const onTapHand = (card: CardId) => {
    if (!humanTurn || round.phase !== "awaitPlay") return;
    const matches = fieldMatches(round, card);
    if (matches.length === 2) {
      setSelected(selected === card ? null : card); // 合わせ先を選んでもらう
      return;
    }
    dispatch({ type: "playCard", player: "A", card });
  };

  const onTapField = (target: CardId) => {
    if (!humanTurn) return;
    if (round.phase === "awaitFlipTarget") {
      dispatch({ type: "chooseFlipTarget", player: "A", target });
      return;
    }
    if (round.phase === "awaitPlay" && selected !== null && playableTargets.has(target)) {
      dispatch({ type: "playCard", player: "A", card: selected, target });
    }
  };

  return (
    <main className="mx-auto max-w-[640px] p-3 pb-[calc(1rem+env(safe-area-inset-bottom))]">
      <header className="flex items-center justify-between gap-2 text-xs">
        <Link to="/" className="shrink-0 py-2 text-neutral-500">
          ← 帰る
        </Link>
        <span className="text-right">
          旬: {monthLabel(table.config.month)} / レート{table.config.rate}文 / 倍率×
          {round.multiplier}
        </span>
      </header>

      {/* 相手 */}
      <section className="mt-2 rounded bg-neutral-100 p-2">
        <div className="flex items-center justify-between text-sm">
          <span className="font-semibold">{PLAYER_NAME.B}</span>
          <span>{table.chips.B}文</span>
        </div>
        <div className="mt-1 flex flex-wrap gap-1">
          {round.hands.B.map((id) => (
            <div key={id} className="h-9 w-6 rounded border border-neutral-400 bg-neutral-600" />
          ))}
        </div>
        <CapturedSummary state={table} player="B" />
      </section>

      {/* 場 */}
      <section className="mt-2 rounded border border-emerald-200 bg-emerald-50 p-2">
        <div className="flex items-center justify-between text-xs text-neutral-500">
          <span>場(山: {round.deck.length}枚)</span>
          {round.phase === "awaitFlipTarget" && round.pendingFlip !== null && (
            <span className="font-semibold text-emerald-700">
              めくり札「{cardOf(round.pendingFlip).name}」の合わせ先を選ぶ
            </span>
          )}
        </div>
        <div className="mt-1 flex flex-wrap gap-1.5">
          {round.field.map((id) => (
            <CardTile
              key={id}
              id={id}
              state={table}
              highlighted={playableTargets.has(id)}
              onTap={onTapField}
            />
          ))}
          {round.pendingFlip !== null && <CardTile id={round.pendingFlip} state={table} selected />}
        </div>
      </section>

      {/* 自分 */}
      <section className="mt-2 rounded bg-neutral-100 p-2">
        <div className="flex items-center justify-between text-sm">
          <span className="font-semibold">
            {PLAYER_NAME.A}
            {humanTurn && round.phase === "awaitPlay" && (
              <span className="ml-2 text-xs text-emerald-700">あなたの番</span>
            )}
          </span>
          <span>{table.chips.A}文</span>
        </div>
        <div className="mt-1 flex flex-wrap gap-1.5">
          {round.hands.A.map((id) => (
            <CardTile key={id} id={id} state={table} selected={selected === id} onTap={onTapHand} />
          ))}
        </div>
        <CapturedSummary state={table} player="A" />
      </section>

      {/* ログ */}
      <section className="mt-2 min-h-16 rounded bg-neutral-50 p-2 text-xs text-neutral-700">
        {log.map((line, i) => (
          <p key={i}>{line}</p>
        ))}
      </section>

      {/* こいこい / 勝負 */}
      {humanTurn && round.phase === "awaitDecision" && (
        <div className="fixed inset-x-0 bottom-0 border-t border-neutral-300 bg-white p-4 pb-[calc(1rem+env(safe-area-inset-bottom))]">
          <p className="text-sm font-semibold">
            役ができた:{" "}
            {evaluateYaku(round.captured.A)
              .map((y) => `${y.name}${y.points}文`)
              .join("・")}
          </p>
          <div className="mt-3 flex gap-3">
            <button
              type="button"
              onClick={() => dispatch({ type: "declareKoikoi", player: "A" })}
              className="flex-1 rounded bg-rose-600 py-3 font-bold text-white active:bg-rose-700"
            >
              こいこい(倍率×{round.multiplier + 1})
            </button>
            <button
              type="button"
              onClick={() => dispatch({ type: "declareShobu", player: "A" })}
              className="flex-1 rounded bg-emerald-600 py-3 font-bold text-white active:bg-emerald-700"
            >
              勝負
            </button>
          </div>
        </div>
      )}

      {/* 局間 / 終了 */}
      {round.phase === "roundOver" && table.result === null && (
        <div className="mt-3 flex gap-3">
          <button
            type="button"
            onClick={() => dispatch({ type: "nextRound", player: "A" })}
            className="flex-1 rounded bg-emerald-600 py-3 font-bold text-white active:bg-emerald-700"
          >
            次の局へ
          </button>
          <button
            type="button"
            onClick={() => dispatch({ type: "retreat", player: "A" })}
            className="flex-1 rounded border border-neutral-400 py-3 font-semibold active:bg-neutral-100"
          >
            撤退する({table.chips.A}文を持ち帰る)
          </button>
        </div>
      )}
      {table.result !== null && (
        <div className="mt-3 rounded bg-neutral-800 p-4 text-center text-white">
          <p className="font-bold">
            {table.result.kind === "retreat"
              ? `撤退 — ${table.chips.A}文を持ち帰った`
              : table.result.winner === "A"
                ? `胴元を飛ばした! 持ち文 ${table.chips.A}文`
                : "飛ばされた…(0文)"}
          </p>
          <button
            type="button"
            onClick={() => {
              setLog([]);
              setTable(newTable(Date.now() >>> 0));
            }}
            className="mt-3 w-full rounded bg-white py-3 font-bold text-neutral-900 active:bg-neutral-200"
          >
            新しい賭場へ
          </button>
        </div>
      )}
    </main>
  );
}
