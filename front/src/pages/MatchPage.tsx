import { useCallback, useState } from "react";
import { Link } from "react-router-dom";
import { TableBoard, describeEvents } from "../components/TableBoard";
import { cardOf } from "../game/cards";
import { applyAction, createTable } from "../game/match";
import { mulberry32 } from "../game/rng";
import type { Action, CardId, EffectId, Month, TableConfig, TableState } from "../game/types";
import { useAiTurn } from "../hooks/useAiTurn";

// 腕試し(単発の賭場戦)。ランは /run(RunPage)から

const AI_AGGRESSION = 0.6;

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

export function MatchPage() {
  const [table, setTable] = useState<TableState>(() => newTable(Date.now() >>> 0));
  const [log, setLog] = useState<string[]>([]);

  const dispatch = useCallback(
    (action: Action) => {
      const result = applyAction(table, action);
      if (!result.ok) return;
      setTable(result.state);
      setLog((prev) => [...prev, ...describeEvents(result.state, result.events)].slice(-6));
    },
    [table],
  );

  useAiTurn(table, dispatch, AI_AGGRESSION);

  const round = table.round;
  if (round === null) return null;

  return (
    <main className="mx-auto max-w-[640px] p-3 pb-[calc(1rem+env(safe-area-inset-bottom))]">
      <header className="flex items-center justify-between text-xs">
        <Link to="/" className="py-2 text-neutral-500">
          ← 帰る
        </Link>
        <span className="text-neutral-500">腕試し(単発対局)</span>
      </header>

      <TableBoard table={table} onAction={dispatch} log={log} />

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
