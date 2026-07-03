import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { MONTH_FLOWERS, cardOf } from "../game/cards";
import { EFFECTS } from "../game/effects";
import { fieldMatches, other } from "../game/match";
import type {
  Action,
  CardId,
  EffectId,
  GameEvent,
  Month,
  PlayerId,
  TableState,
} from "../game/types";
import { evaluateYaku } from "../game/yaku";
import { CardArt } from "./CardArt";

// 対局の共通ビュー。MatchPage(単発)・RunPage(ラン)・PvpPage(P2P対戦)で共用する。
// self でどちらのプレイヤー視点でも表示・操作できる。
// 手札は扇状表示+場へのドラッグで打牌(docs/spec/game-core/design.md「対局画面の表現」)

export const PLAYER_NAME: Record<PlayerId, string> = { A: "あなた", B: "胴元" };

const DRAG_TAP_THRESHOLD = 8; // これ未満の移動はタップとして扱う(px)

export function monthLabel(month: Month): string {
  return `${month}月・${MONTH_FLOWERS[month - 1] ?? ""}`;
}

export function describeEvents(
  state: TableState,
  events: GameEvent[],
  names: Record<PlayerId, string> = PLAYER_NAME,
): string[] {
  const lines: string[] = [];
  for (const e of events) {
    switch (e.type) {
      case "deal":
        lines.push(`第${state.roundNumber}局 開始(先手: ${names[e.dealer]})`);
        break;
      case "yaku":
        lines.push(`${names[e.player]}に役: ${e.names.join("・")}`);
        break;
      case "koikoi":
        lines.push(`${names[e.player]}「こいこい!」(倍率 ×${e.multiplier})`);
        break;
      case "effect": {
        const chip = e.chipDelta !== 0 ? ` ${e.chipDelta > 0 ? "+" : ""}${e.chipDelta}文` : "";
        const mult = e.multiplierDelta !== 0 ? ` 倍率+${e.multiplierDelta}` : "";
        lines.push(`細工「${EFFECTS[e.effect].name}」発動(${names[e.player]}${chip}${mult})`);
        break;
      }
      case "roundEnd":
        if (e.settlement === null) {
          lines.push("流局。親を交代して次の局へ");
        } else {
          const s = e.settlement;
          const fee = s.koikoiFee > 0 ? ` + こいこい料${s.koikoiFee}文` : "";
          const ooiri = s.ooiriBonus > 0 ? ` + 大入り${s.ooiriBonus}文!` : "";
          lines.push(
            `${names[s.winner]}の上がり! ${s.base}文 ×${s.multiplier}` +
              `${s.shunBonus > 0 ? ` + 旬${s.shunBonus}文` : ""}${fee} → ${s.transfer}文${ooiri}`,
          );
        }
        break;
      case "tableEnd":
        lines.push(
          e.result.kind === "retreat"
            ? "賭場から撤退した"
            : `勝負あり! ${e.result.winner !== null ? names[e.result.winner] : ""}の総取り`,
        );
        break;
      default:
        break;
    }
  }
  return lines;
}

const KIND_BORDER: Record<string, string> = {
  hikari: "border-amber-500",
  tane: "border-rose-400",
  tanzaku: "border-violet-400",
  kasu: "border-neutral-300",
};

const EFFECT_BADGE: Record<EffectId, string> = {
  kinmekki: "金",
  noroi: "呪",
  sainome: "賽",
};

interface CardTileProps {
  id: CardId;
  table: TableState;
  highlighted?: boolean;
  selected?: boolean;
  onTap?: (id: CardId) => void;
  /** 指定するとタップの代わりにポインタ操作(ドラッグ)を受け付ける */
  onPointerDown?: (id: CardId, e: React.PointerEvent<HTMLButtonElement>) => void;
  /** 場札: ドラッグの合わせ先判定用の data 属性を付ける */
  droppable?: boolean;
}

export function CardTile({
  id,
  table,
  highlighted,
  selected,
  onTap,
  onPointerDown,
  droppable,
}: CardTileProps) {
  const card = cardOf(id);
  const effect = table.config.effects[id];
  const isShun = card.month === table.config.month;
  const interactive = onTap !== undefined || onPointerDown !== undefined;
  return (
    <button
      type="button"
      onClick={onTap !== undefined ? () => onTap(id) : undefined}
      onPointerDown={onPointerDown !== undefined ? (e) => onPointerDown(id, e) : undefined}
      disabled={!interactive}
      {...(droppable === true ? { "data-fieldcard": id } : {})}
      className={`relative h-full w-full overflow-hidden rounded border-2 bg-[#f7f1e3] ${
        KIND_BORDER[card.kind] ?? ""
      } ${selected === true ? "ring-2 ring-blue-500" : ""} ${
        highlighted === true ? "ring-2 ring-emerald-500" : ""
      }`}
    >
      <CardArt card={card} />
      {/* 月の視認性: 常時バッジ表示 */}
      <span className="absolute top-0 left-0 rounded-br bg-neutral-800/85 px-0.5 text-[9px] leading-tight font-bold text-white">
        {card.month}月
      </span>
      <span className="absolute inset-x-0 bottom-0 bg-white/80 text-center text-[8px] leading-tight text-neutral-700">
        {card.kind === "kasu" ? MONTH_FLOWERS[card.month - 1] : card.name}
      </span>
      {effect !== undefined && (
        <span className="absolute -top-1 -right-1 rounded-full bg-yellow-400 px-1 text-[10px] font-bold">
          {EFFECT_BADGE[effect]}
        </span>
      )}
      {isShun && <span className="absolute top-0 right-0 text-[10px]">🌸</span>}
    </button>
  );
}

function CapturedSummary({ table, player }: { table: TableState; player: "A" | "B" }) {
  const captured = table.round?.captured[player] ?? [];
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

interface DragState {
  card: CardId;
  startX: number;
  startY: number;
  dx: number;
  dy: number;
}

interface TableBoardProps {
  table: TableState;
  onAction: (action: Action) => void; // self の操作
  log: string[];
  self?: PlayerId; // 操作・手前表示するプレイヤー(既定: A)
  opponentName?: string; // 相手の表示名(既定: 胴元)
}

/** 対局盤面(相手・場・手札・熱気・ログ・こいこい判断)。局間/終了の操作は呼び出し側が置く */
export function TableBoard({ table, onAction, log, self = "A", opponentName }: TableBoardProps) {
  const [selected, setSelected] = useState<CardId | null>(null);
  const [drag, setDrag] = useState<DragState | null>(null);
  const [dragOverField, setDragOverField] = useState(false);
  const fieldRef = useRef<HTMLDivElement | null>(null);
  const round = table.round;
  const opp = other(self);
  const oppName = opponentName ?? "胴元";

  const humanTurn = round !== null && round.turn === self && table.result === null;
  const canPlay = humanTurn && round.phase === "awaitPlay";

  const playableTargets = useMemo(() => {
    if (round === null) return new Set<CardId>();
    if (round.phase === "awaitFlipTarget" && round.pendingFlip !== null) {
      return new Set(fieldMatches(round, round.pendingFlip));
    }
    const source = drag?.card ?? selected;
    if (source !== null && source !== undefined) return new Set(fieldMatches(round, source));
    return new Set<CardId>();
  }, [round, selected, drag]);

  const act = useCallback(
    (action: Action) => {
      setSelected(null);
      onAction(action);
    },
    [onAction],
  );

  const onTapHand = useCallback(
    (card: CardId) => {
      if (!canPlay || round === null) return;
      const matches = fieldMatches(round, card);
      if (matches.length === 2) {
        setSelected((prev) => (prev === card ? null : card)); // 合わせ先を選んでもらう
        return;
      }
      act({ type: "playCard", player: self, card });
    },
    [act, canPlay, round, self],
  );

  const onHandPointerDown = useCallback(
    (card: CardId, e: React.PointerEvent<HTMLButtonElement>) => {
      if (!canPlay) return;
      e.preventDefault();
      setDrag({ card, startX: e.clientX, startY: e.clientY, dx: 0, dy: 0 });
    },
    [canPlay],
  );

  // ドラッグ追従とドロップ(要素は pointer-events を切ってあるので elementFromPoint で場札を拾える)
  useEffect(() => {
    if (drag === null) return;
    const inField = (x: number, y: number): boolean => {
      const rect = fieldRef.current?.getBoundingClientRect();
      return (
        rect !== undefined && x >= rect.left && x <= rect.right && y >= rect.top && y <= rect.bottom
      );
    };
    const onMove = (e: PointerEvent) => {
      setDrag((d) =>
        d === null ? null : { ...d, dx: e.clientX - d.startX, dy: e.clientY - d.startY },
      );
      setDragOverField(inField(e.clientX, e.clientY));
    };
    const onUp = (e: PointerEvent) => {
      const d = drag;
      setDrag(null);
      setDragOverField(false);
      if (d === null || round === null) return;
      const distance = Math.hypot(e.clientX - d.startX, e.clientY - d.startY);
      if (distance < DRAG_TAP_THRESHOLD) {
        onTapHand(d.card);
        return;
      }
      if (!inField(e.clientX, e.clientY)) return; // 場の外 → 手札に戻す
      const matches = fieldMatches(round, d.card);
      const el = document.elementFromPoint(e.clientX, e.clientY)?.closest("[data-fieldcard]");
      const targetId =
        el instanceof HTMLElement && el.dataset.fieldcard !== undefined
          ? Number(el.dataset.fieldcard)
          : null;
      if (targetId !== null && matches.includes(targetId)) {
        act({ type: "playCard", player: self, card: d.card, target: targetId });
        return;
      }
      if (matches.length === 2) {
        setSelected(d.card); // 場札の上以外に落とした → タップで合わせ先を選ぶ
        return;
      }
      act({ type: "playCard", player: self, card: d.card });
    };
    const onCancel = () => {
      setDrag(null);
      setDragOverField(false);
    };
    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
    window.addEventListener("pointercancel", onCancel);
    return () => {
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
      window.removeEventListener("pointercancel", onCancel);
    };
  }, [drag, round, act, onTapHand, self]);

  if (round === null) return null;

  const onTapField = (target: CardId) => {
    if (!humanTurn) return;
    if (round.phase === "awaitFlipTarget") {
      act({ type: "chooseFlipTarget", player: self, target });
      return;
    }
    if (round.phase === "awaitPlay" && selected !== null && playableTargets.has(target)) {
      act({ type: "playCard", player: self, card: selected, target });
    }
  };

  const heat = Math.min(100, table.heat);
  const hand = round.hands[self];
  const fanMid = (hand.length - 1) / 2;

  return (
    <div>
      <div className="flex items-center justify-between gap-2 text-xs text-neutral-600">
        <span>
          旬: {monthLabel(table.config.month)} / レート{table.config.rate}文 / 倍率×
          {round.multiplier}
        </span>
        <span className="flex items-center gap-1">
          熱気
          <span className="inline-block h-2 w-16 overflow-hidden rounded bg-neutral-200 align-middle">
            <span
              className={`block h-full ${heat >= 100 ? "bg-red-500" : "bg-orange-400"}`}
              style={{ width: `${heat}%` }}
            />
          </span>
          {table.heat}
        </span>
      </div>

      {/* 相手 */}
      <section className="mt-2 rounded bg-neutral-100 p-2">
        <div className="flex items-center justify-between text-sm">
          <span className="font-semibold">{oppName}</span>
          <span>{table.chips[opp]}文</span>
        </div>
        <div className="mt-1 flex flex-wrap gap-1">
          {round.hands[opp].map((id) => (
            <div key={id} className="h-9 w-6 rounded border border-neutral-400 bg-neutral-600" />
          ))}
        </div>
        <CapturedSummary table={table} player={opp} />
      </section>

      {/* 場 */}
      <section
        ref={fieldRef}
        className={`mt-2 rounded border bg-emerald-50 p-2 transition-colors ${
          dragOverField ? "border-emerald-500 ring-2 ring-emerald-300" : "border-emerald-200"
        }`}
      >
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
            <div key={id} className="h-16 w-11">
              <CardTile
                id={id}
                table={table}
                highlighted={playableTargets.has(id)}
                onTap={onTapField}
                droppable
              />
            </div>
          ))}
          {round.pendingFlip !== null && (
            <div className="h-16 w-11">
              <CardTile id={round.pendingFlip} table={table} selected />
            </div>
          )}
        </div>
      </section>

      {/* 自分(扇状の手札。ドラッグで場に出す) */}
      <section className="mt-2 rounded bg-neutral-100 p-2 pb-3">
        <div className="flex items-center justify-between text-sm">
          <span className="font-semibold">
            あなた
            {canPlay && (
              <span className="ml-2 text-xs text-emerald-700">あなたの番(場へドラッグ)</span>
            )}
          </span>
          <span>{table.chips[self]}文</span>
        </div>
        <div className="relative mt-2 flex h-28 items-start justify-center overflow-visible">
          {hand.map((id, i) => {
            const o = i - fanMid;
            const isDragging = drag?.card === id;
            const lift = Math.abs(o) * Math.abs(o) * 1.6 + (selected === id ? -12 : 0);
            const transform = isDragging
              ? `translate(${drag.dx}px, ${drag.dy}px) scale(1.08)`
              : `rotate(${o * 5}deg) translateY(${lift}px)`;
            return (
              <div
                key={id}
                className={`h-20 w-14 shrink-0 ${isDragging ? "pointer-events-none" : ""} ${
                  drag === null ? "transition-transform duration-150" : ""
                }`}
                style={{
                  marginLeft: i === 0 ? 0 : -18,
                  transform,
                  transformOrigin: "50% 130%",
                  zIndex: isDragging ? 50 : i,
                  touchAction: canPlay ? "none" : "auto",
                }}
              >
                <CardTile
                  id={id}
                  table={table}
                  selected={selected === id}
                  onPointerDown={canPlay ? onHandPointerDown : undefined}
                />
              </div>
            );
          })}
        </div>
        <CapturedSummary table={table} player={self} />
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
            {evaluateYaku(round.captured[self])
              .map((y) => `${y.name}${y.points}文`)
              .join("・")}
          </p>
          <div className="mt-3 flex gap-3">
            <button
              type="button"
              onClick={() => act({ type: "declareKoikoi", player: self })}
              className="flex-1 rounded bg-rose-600 py-3 font-bold text-white active:bg-rose-700"
            >
              こいこい(倍率×{round.multiplier + 1})
            </button>
            <button
              type="button"
              onClick={() => act({ type: "declareShobu", player: self })}
              className="flex-1 rounded bg-emerald-600 py-3 font-bold text-white active:bg-emerald-700"
            >
              勝負
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
