import type { EffectId, PlayerId } from "./types";

// 細工フック機構。docs/spec/game-core/design.md 参照。
// 効果は純関数で、状態を直接変更せず Outcome(差分)を返す。
// エンジン(match.ts)が各タイミングで対象札の効果を探して折り込む。

export type EffectTrigger = "capture" | "play" | "winWith" | "settle";

export interface EffectContext {
  owner: PlayerId; // 効果が発動する側(細工札を取った側)
  rate: number;
}

export interface EffectOutcome {
  chipDelta?: number; // owner の持ち文増減(相手との受け渡しではなく場からの増減)
  multiplierDelta?: number; // 局倍率の増減
}

export interface CardEffect {
  id: EffectId;
  name: string;
  description: string;
  trigger: EffectTrigger;
  apply(ctx: EffectContext): EffectOutcome;
}

export const EFFECTS: Readonly<Record<EffectId, CardEffect>> = {
  kinmekki: {
    id: "kinmekki",
    name: "金鍍金",
    description: "この札を取ると即 +3文×レート",
    trigger: "capture",
    apply: ({ rate }) => ({ chipDelta: 3 * rate }),
  },
  noroi: {
    id: "noroi",
    name: "呪い",
    description: "この札を取っていた側は局終了時 -3文×レート",
    trigger: "settle",
    apply: ({ rate }) => ({ chipDelta: -3 * rate }),
  },
  sainome: {
    id: "sainome",
    name: "賽の目",
    description: "この札を取った状態で上がると局倍率+1",
    trigger: "winWith",
    apply: () => ({ multiplierDelta: 1 }),
  },
};

export function effectOf(id: EffectId): CardEffect {
  return EFFECTS[id];
}
