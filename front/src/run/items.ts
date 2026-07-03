import { EFFECTS } from "../game/effects";
import type { EffectId } from "../game/types";
import type { MarketItem, RelicId } from "./types";

export interface RelicDef {
  id: RelicId;
  name: string;
  description: string;
  price: number;
}

export const RELICS: Readonly<Record<RelicId, RelicDef>> = {
  kidogomen: {
    id: "kidogomen",
    name: "木戸御免",
    description: "賭場の場代が半額になる(切り上げ)",
    price: 25,
  },
  manekineko: {
    id: "manekineko",
    name: "招き猫",
    description: "自分が受けた大入りのおひねりと同額を、賭場を出るときにもう一度もらえる",
    price: 20,
  },
  saikubako: {
    id: "saikubako",
    name: "細工箱",
    description: "細工を仕込める札の上限が +2(6→8枚)",
    price: 15,
  },
  saifuri: {
    id: "saifuri",
    name: "賽振りの腕",
    description: "移動のサイコロを3個振って選べる",
    price: 30,
  },
  haramaki: {
    id: "haramaki",
    name: "胴巻き",
    description: "飛ばされても一度だけ10文を隠し持って生き残る(使い切り)",
    price: 25,
  },
};

export const SAIKU_PRICES: Readonly<Record<EffectId, number>> = {
  kinmekki: 12,
  sainome: 18,
  noroi: 10,
};

export const SAIKU_LIMIT_BASE = 6;

export function saikuName(effect: EffectId): string {
  return EFFECTS[effect].name;
}

/** 市場の品揃え候補(所持済みレリックは並ばない) */
export function marketPool(owned: readonly RelicId[]): MarketItem[] {
  const pool: MarketItem[] = (Object.keys(SAIKU_PRICES) as EffectId[]).map((effect) => ({
    kind: "saiku",
    effect,
    price: SAIKU_PRICES[effect],
  }));
  for (const relic of Object.values(RELICS)) {
    if (!owned.includes(relic.id)) {
      pool.push({ kind: "relic", relic: relic.id, price: relic.price });
    }
  }
  return pool;
}

export interface RunEvent {
  text: string;
  chipDelta: number;
}

export const RUN_EVENTS: readonly RunEvent[] = [
  { text: "道端で財布を拾った(+15文)", chipDelta: 15 },
  { text: "関銭を取られた(-10文)", chipDelta: -10 },
  { text: "茶屋で一服。旅の噂話を聞いた(増減なし)", chipDelta: 0 },
];
