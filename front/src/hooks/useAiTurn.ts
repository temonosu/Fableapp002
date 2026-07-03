import { useEffect } from "react";
import { chooseAiAction } from "../game/ai";
import type { Action, TableState } from "../game/types";

/** 相手(B)の手番になったら少し間を置いて AI の手を打つ */
export function useAiTurn(
  table: TableState | null,
  onAction: (action: Action) => void,
  aggression: number,
  delayMs = 700,
): void {
  useEffect(() => {
    if (table === null) return;
    const action = chooseAiAction(table, "B", { aggression });
    if (action === null) return;
    const timer = setTimeout(() => onAction(action), delayMs);
    return () => clearTimeout(timer);
  }, [table, onAction, aggression, delayMs]);
}
