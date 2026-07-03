import { combineSeeds, mulberry32 } from "../game/rng";
import type { Month } from "../game/types";
import type { BoardColumn, NodeKind } from "./types";

export const COLUMNS_PER_REGION = 8;
export const BOSS_COLUMN = COLUMNS_PER_REGION - 1;

export const REGION_NAMES: readonly string[] = ["春の街道", "夏秋の峠", "冬の湊"];

/** 地方 r の4ヶ月(0=春: 1〜4月, 1=夏秋: 5〜8月, 2=冬: 9〜12月) */
export function regionMonths(region: number): Month[] {
  const start = region * 4 + 1;
  return [start, start + 1, start + 2, start + 3] as Month[];
}

/**
 * 1地方分の盤面を生成する。決定論(seed + counter 起点)。
 * 列0〜6: 月 = 4ヶ月を2列ずつ進む / 60%で2レーン / 賭場50%・市場25%・イベント25%
 * 列7: 関所(ボス)1レーン
 */
export function generateRegionBoard(
  seed: number,
  counterStart: number,
  region: number,
): BoardColumn[] {
  const rng = mulberry32(combineSeeds(seed, counterStart + region * 1000));
  const months = regionMonths(region);
  const columns: BoardColumn[] = [];
  for (let column = 0; column < COLUMNS_PER_REGION; column++) {
    const month = months[Math.min(3, Math.floor(column / 2))] ?? months[3] ?? 12;
    if (column === BOSS_COLUMN) {
      columns.push([{ column, lane: 0, month, kind: "sekisho" }]);
      continue;
    }
    const lanes = rng() < 0.6 ? 2 : 1;
    const nodes: BoardColumn = [];
    for (let lane = 0; lane < lanes; lane++) {
      const roll = rng();
      const kind: NodeKind = roll < 0.5 ? "tobaku" : roll < 0.75 ? "market" : "event";
      nodes.push({ column, lane, month, kind });
    }
    columns.push(nodes);
  }
  return columns;
}
