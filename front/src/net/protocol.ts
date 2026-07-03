import type { PvpAction } from "../game/pvp";

// WebRTC DataChannel 上のメッセージ(docs/spec/p2p-match/design.md)。
// バージョン付き。知らないメッセージは破棄せずエラーにする(プロトコル不一致の検出)

export const PROTOCOL_VERSION = 1;

export type NetMessage =
  | { v: 1; t: "commit"; hash: string }
  | { v: 1; t: "reveal"; seed: number; nonce: string }
  | { v: 1; t: "pvp"; seq: number; action: PvpAction }
  | { v: 1; t: "bye" };

export function encodeMessage(message: NetMessage): string {
  return JSON.stringify(message);
}

/** 受信文字列を NetMessage として検証する。不正なら null */
export function decodeMessage(text: string): NetMessage | null {
  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch {
    return null;
  }
  if (typeof parsed !== "object" || parsed === null) return null;
  const m = parsed as Record<string, unknown>;
  if (m.v !== PROTOCOL_VERSION) return null;
  switch (m.t) {
    case "commit":
      return typeof m.hash === "string" ? { v: 1, t: "commit", hash: m.hash } : null;
    case "reveal":
      return typeof m.seed === "number" && typeof m.nonce === "string"
        ? { v: 1, t: "reveal", seed: m.seed, nonce: m.nonce }
        : null;
    case "pvp": {
      if (typeof m.seq !== "number") return null;
      const action = m.action as PvpAction | undefined;
      if (action === undefined || typeof action !== "object") return null;
      if (action.type !== "table" && action.type !== "nextGame") return null;
      return { v: 1, t: "pvp", seq: m.seq, action };
    }
    case "bye":
      return { v: 1, t: "bye" };
    default:
      return null;
  }
}
