import { useCallback, useState } from "react";
import { Link } from "react-router-dom";
import { TableBoard, describeEvents } from "../components/TableBoard";
import { CARDS, cardOf } from "../game/cards";
import type { Action, EffectId } from "../game/types";
import { useAiTurn } from "../hooks/useAiTurn";
import { REGION_NAMES } from "../run/board";
import { RELICS, saikuName } from "../run/items";
import { applyRunAction, createRun, saikuLimit } from "../run/run";
import type { BoardNode, RunAction, RunState } from "../run/types";

const NODE_LABEL: Record<BoardNode["kind"], string> = {
  tobaku: "賭",
  market: "市",
  event: "縁",
  sekisho: "関",
};

const NODE_STYLE: Record<BoardNode["kind"], string> = {
  tobaku: "bg-rose-100 border-rose-400 text-rose-900",
  market: "bg-sky-100 border-sky-400 text-sky-900",
  event: "bg-amber-100 border-amber-400 text-amber-900",
  sekisho: "bg-neutral-800 border-neutral-800 text-white",
};

function BoardView({ run, onLane }: { run: RunState; onLane: (lane: number) => void }) {
  return (
    <div className="mt-2 overflow-x-auto rounded border border-neutral-200 bg-neutral-50 p-2">
      <div className="flex items-stretch gap-2">
        <div className="flex flex-col justify-center">
          <div
            className={`flex h-11 w-11 items-center justify-center rounded border text-xs ${
              run.column === -1 ? "ring-2 ring-blue-500" : ""
            } border-neutral-300 bg-white`}
          >
            出発
          </div>
        </div>
        {run.board.map((column, ci) => (
          <div key={ci} className="flex flex-col justify-center gap-2">
            {column.map((node) => {
              const here = run.column === ci && run.lane === node.lane;
              const selectable = run.status === "chooseLane" && run.pendingColumn === ci;
              return (
                <button
                  key={node.lane}
                  type="button"
                  disabled={!selectable}
                  onClick={() => onLane(node.lane)}
                  className={`flex h-11 w-11 flex-col items-center justify-center rounded border text-sm font-bold ${
                    NODE_STYLE[node.kind]
                  } ${here ? "ring-2 ring-blue-500" : ""} ${
                    selectable ? "ring-2 ring-emerald-500 active:scale-95" : ""
                  }`}
                >
                  {NODE_LABEL[node.kind]}
                  <span className="text-[10px] font-normal">{node.month}月</span>
                </button>
              );
            })}
          </div>
        ))}
      </div>
    </div>
  );
}

function MarketView({ run, dispatch }: { run: RunState; dispatch: (action: RunAction) => void }) {
  const [picking, setPicking] = useState<EffectId | null>(null);
  const placedCount = Object.keys(run.saiku.placed).length;

  if (picking !== null && run.battle === null) {
    return (
      <div className="mt-2 rounded border border-sky-200 bg-white p-2">
        <p className="text-sm font-semibold">
          「{saikuName(picking)}」をどの札に仕込む?(仕込み {placedCount}/{saikuLimit(run)})
        </p>
        <div className="mt-2 flex flex-wrap gap-1">
          {CARDS.map((card) => {
            const taken = run.saiku.placed[card.id] !== undefined;
            return (
              <button
                key={card.id}
                type="button"
                disabled={taken}
                onClick={() => {
                  dispatch({ type: "assignSaiku", effect: picking, card: card.id });
                  setPicking(null);
                }}
                className={`flex h-14 w-11 flex-col items-center justify-center rounded border text-[10px] leading-tight ${
                  taken
                    ? "border-neutral-200 bg-neutral-100 text-neutral-300"
                    : "border-neutral-300 bg-white active:scale-95"
                }`}
              >
                <span className="text-xs font-bold">{card.month}月</span>
                {card.name}
              </button>
            );
          })}
        </div>
        <button
          type="button"
          onClick={() => setPicking(null)}
          className="mt-2 w-full rounded border border-neutral-400 py-3 font-semibold active:bg-neutral-100"
        >
          やめる
        </button>
      </div>
    );
  }

  return (
    <div className="mt-2 rounded border border-sky-200 bg-white p-2">
      <p className="font-semibold">市場</p>
      <ul className="mt-1 divide-y divide-neutral-100">
        {(run.market ?? []).map((item, i) => {
          const name =
            item.kind === "saiku" ? `細工「${saikuName(item.effect)}」` : RELICS[item.relic].name;
          const desc =
            item.kind === "saiku"
              ? "任意の札に仕込める(市場でのみ配置可)"
              : RELICS[item.relic].description;
          return (
            <li key={`${name}-${i}`} className="flex items-center gap-2 py-2">
              <div className="flex-1">
                <p className="text-sm font-semibold">{name}</p>
                <p className="text-xs text-neutral-500">{desc}</p>
              </div>
              <button
                type="button"
                disabled={run.chips < item.price}
                onClick={() => dispatch({ type: "buy", index: i })}
                className="rounded bg-sky-600 px-3 py-2 text-sm font-bold text-white disabled:bg-neutral-300 active:bg-sky-700"
              >
                {item.price}文
              </button>
            </li>
          );
        })}
      </ul>
      {run.saiku.inventory.length > 0 && (
        <div className="mt-2 border-t border-neutral-200 pt-2">
          <p className="text-xs text-neutral-500">
            手持ちの細工(仕込み {placedCount}/{saikuLimit(run)})
          </p>
          <div className="mt-1 flex flex-wrap gap-2">
            {run.saiku.inventory.map((effect, i) => (
              <button
                key={`${effect}-${i}`}
                type="button"
                onClick={() => setPicking(effect)}
                className="rounded border border-amber-400 bg-amber-50 px-3 py-2 text-sm font-semibold active:bg-amber-100"
              >
                {saikuName(effect)}を仕込む
              </button>
            ))}
          </div>
        </div>
      )}
      <button
        type="button"
        onClick={() => dispatch({ type: "leaveMarket" })}
        className="mt-3 w-full rounded bg-emerald-600 py-3 font-bold text-white active:bg-emerald-700"
      >
        市場を出る
      </button>
    </div>
  );
}

export function RunPage() {
  const [run, setRun] = useState<RunState>(() => createRun(Date.now() >>> 0));
  const [log, setLog] = useState<string[]>([]);

  const dispatch = useCallback(
    (action: RunAction) => {
      const result = applyRunAction(run, action);
      if (!result.ok) return;
      const lines = [...result.log];
      if (result.events !== undefined && result.state.battle !== null) {
        lines.push(...describeEvents(result.state.battle, result.events));
      }
      setRun(result.state);
      if (lines.length > 0) setLog((prev) => [...prev, ...lines].slice(-6));
    },
    [run],
  );

  const battleAction = useCallback(
    (action: Action) => dispatch({ type: "battle", action }),
    [dispatch],
  );

  useAiTurn(run.battle?.result === null ? run.battle : null, battleAction, run.enemyAggression);

  const restart = () => {
    setLog([]);
    setRun(createRun(Date.now() >>> 0));
  };

  const battle = run.battle;
  const placedList = Object.entries(run.saiku.placed);

  return (
    <main className="mx-auto max-w-[640px] p-3 pb-[calc(1rem+env(safe-area-inset-bottom))]">
      <header className="flex items-center justify-between text-xs">
        <Link to="/" className="py-2 text-neutral-500">
          ← 帰る
        </Link>
        <span className="text-neutral-600">
          {REGION_NAMES[run.region] ?? ""}({run.region + 1}/3) / 持ち文{" "}
          <span className="font-bold">{run.chips}文</span>
        </span>
      </header>

      {run.status === "battle" && battle !== null ? (
        <>
          <TableBoard table={battle} onAction={battleAction} log={log} />
          {battle.round?.phase === "roundOver" && battle.result === null && (
            <div className="mt-3 flex gap-3">
              <button
                type="button"
                onClick={() => battleAction({ type: "nextRound", player: "A" })}
                className="flex-1 rounded bg-emerald-600 py-3 font-bold text-white active:bg-emerald-700"
              >
                次の局へ
              </button>
              <button
                type="button"
                onClick={() => battleAction({ type: "retreat", player: "A" })}
                className="flex-1 rounded border border-neutral-400 py-3 font-semibold active:bg-neutral-100"
              >
                撤退する
              </button>
            </div>
          )}
          {battle.result !== null && (
            <div className="mt-3 rounded bg-neutral-800 p-4 text-center text-white">
              <p className="font-bold">
                {battle.result.kind === "retreat"
                  ? `撤退 — ${battle.chips.A}文を持って賭場を出る`
                  : battle.result.winner === "A"
                    ? `相手を飛ばした! ${battle.chips.A}文`
                    : "飛ばされた…"}
              </p>
              <button
                type="button"
                onClick={() => dispatch({ type: "continueAfterBattle" })}
                className="mt-3 w-full rounded bg-white py-3 font-bold text-neutral-900 active:bg-neutral-200"
              >
                盤面へ戻る
              </button>
            </div>
          )}
        </>
      ) : (
        <>
          <BoardView run={run} onLane={(lane) => dispatch({ type: "chooseLane", lane })} />

          {(run.status === "board" || run.status === "chooseLane") && (
            <div className="mt-3">
              {run.status === "chooseLane" ? (
                <p className="text-center text-sm font-semibold text-emerald-700">
                  止まるマスを選んでください
                </p>
              ) : run.dice === null ? (
                <button
                  type="button"
                  onClick={() => dispatch({ type: "roll" })}
                  className="w-full rounded bg-rose-700 py-3 font-bold text-white active:bg-rose-800"
                >
                  サイコロを振る
                </button>
              ) : (
                <div className="flex gap-3">
                  {run.dice.map((d, i) => (
                    <button
                      key={i}
                      type="button"
                      onClick={() => dispatch({ type: "chooseDie", index: i })}
                      className="flex-1 rounded bg-neutral-800 py-3 text-xl font-bold text-white active:bg-neutral-900"
                    >
                      {d}
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}

          {run.status === "market" && <MarketView run={run} dispatch={dispatch} />}

          {run.status === "event" && (
            <div className="mt-3 rounded border border-amber-300 bg-amber-50 p-4">
              <p className="text-sm font-semibold">{run.eventText}</p>
              <button
                type="button"
                onClick={() => dispatch({ type: "ackEvent" })}
                className="mt-3 w-full rounded bg-emerald-600 py-3 font-bold text-white active:bg-emerald-700"
              >
                先へ進む
              </button>
            </div>
          )}

          {(run.status === "gameover" || run.status === "clear") && (
            <div className="mt-3 rounded bg-neutral-800 p-4 text-center text-white">
              <p className="text-lg font-bold">
                {run.status === "clear"
                  ? `全地方制覇! ${run.chips}文を持ち帰った`
                  : "路銀が尽きた…旅はここまで"}
              </p>
              <button
                type="button"
                onClick={restart}
                className="mt-3 w-full rounded bg-white py-3 font-bold text-neutral-900 active:bg-neutral-200"
              >
                新しい旅に出る
              </button>
            </div>
          )}

          {/* 所持品 */}
          <section className="mt-3 rounded bg-neutral-50 p-2 text-xs text-neutral-700">
            <p>
              レリック:{" "}
              {run.relics.length > 0 ? run.relics.map((r) => RELICS[r].name).join("・") : "なし"}
            </p>
            {placedList.length > 0 && (
              <p className="mt-1">
                細工:{" "}
                {placedList
                  .map(([cardId, effect]) => {
                    const card = cardOf(Number(cardId));
                    return `${card.month}月「${card.name}」に${effect !== undefined ? saikuName(effect) : ""}`;
                  })
                  .join(" / ")}
              </p>
            )}
            <div className="mt-1 min-h-10">
              {log.map((line, i) => (
                <p key={i}>{line}</p>
              ))}
            </div>
          </section>
        </>
      )}
    </main>
  );
}
