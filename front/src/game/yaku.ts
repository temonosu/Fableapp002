import { cardOf } from "./cards";
import type { CardId } from "./types";

export type YakuId =
  | "goko"
  | "shiko"
  | "ameshiko"
  | "sanko"
  | "hanami"
  | "tsukimi"
  | "inoshikacho"
  | "akatan"
  | "aotan"
  | "tane"
  | "tan"
  | "kasu";

export interface Yaku {
  id: YakuId;
  name: string;
  points: number;
}

/**
 * 取り札から成立役を判定する。
 * 光役(五光/四光/雨四光/三光)は排他で最上位のみ。他は併立する。
 * 役表: docs/spec/game-core/requirements.md 要件3-1
 */
export function evaluateYaku(captured: readonly CardId[]): Yaku[] {
  const cards = captured.map(cardOf);
  const yaku: Yaku[] = [];

  const hikari = cards.filter((c) => c.kind === "hikari");
  const hasRain = hikari.some((c) => c.tag === "rain");
  const dryCount = hikari.length - (hasRain ? 1 : 0);

  if (hikari.length === 5) {
    yaku.push({ id: "goko", name: "五光", points: 10 });
  } else if (dryCount === 4) {
    yaku.push({ id: "shiko", name: "四光", points: 8 });
  } else if (hikari.length === 4) {
    yaku.push({ id: "ameshiko", name: "雨四光", points: 7 });
  } else if (dryCount === 3) {
    yaku.push({ id: "sanko", name: "三光", points: 5 });
  }

  const has = (tag: string): boolean => cards.some((c) => c.tag === tag);

  if (has("curtain") && has("sake")) {
    yaku.push({ id: "hanami", name: "花見で一杯", points: 5 });
  }
  if (has("moon") && has("sake")) {
    yaku.push({ id: "tsukimi", name: "月見で一杯", points: 5 });
  }
  if (has("boar") && has("deer") && has("butterfly")) {
    yaku.push({ id: "inoshikacho", name: "猪鹿蝶", points: 5 });
  }

  const akatan = cards.filter((c) => c.tag === "akatan").length;
  const aotan = cards.filter((c) => c.tag === "aotan").length;
  if (akatan === 3) {
    yaku.push({ id: "akatan", name: "赤短", points: 5 });
  }
  if (aotan === 3) {
    yaku.push({ id: "aotan", name: "青短", points: 5 });
  }

  const tane = cards.filter((c) => c.kind === "tane").length;
  if (tane >= 5) {
    yaku.push({ id: "tane", name: "タネ", points: 1 + (tane - 5) });
  }
  const tan = cards.filter((c) => c.kind === "tanzaku").length;
  if (tan >= 5) {
    yaku.push({ id: "tan", name: "タン", points: 1 + (tan - 5) });
  }
  const kasu = cards.filter((c) => c.kind === "kasu").length;
  if (kasu >= 10) {
    yaku.push({ id: "kasu", name: "カス", points: 1 + (kasu - 10) });
  }

  return yaku;
}

/** 成立役の文数合計 */
export function totalPoints(captured: readonly CardId[]): number {
  return evaluateYaku(captured).reduce((sum, y) => sum + y.points, 0);
}
