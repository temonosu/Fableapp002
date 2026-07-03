// 山札シードのコミット&リビール(docs/spec/p2p-match/design.md 要件2-1)。
// 双方が「シードのハッシュ」を先に交換してからシードを明かすことで、
// 相手のシードを見てから自分のシードを選ぶ(=山札を仕込む)ことを防ぐ

import { combineSeeds } from "../game/rng";

export interface SeedCommitment {
  seed: number;
  nonce: string;
  hash: string;
}

export async function sha256Hex(text: string): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(text));
  return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

/** 自分のシードとコミット(ハッシュ)を生成する */
export async function makeCommitment(): Promise<SeedCommitment> {
  const values = new Uint32Array(5);
  crypto.getRandomValues(values);
  const seed = (values[0] ?? 1) >>> 0;
  const nonce = [...values.slice(1)].map((v) => v.toString(16)).join("");
  return { seed, nonce, hash: await sha256Hex(`${seed}:${nonce}`) };
}

/** 相手の reveal がコミットと一致するか検証する */
export async function verifyReveal(hash: string, seed: number, nonce: string): Promise<boolean> {
  return (await sha256Hex(`${seed}:${nonce}`)) === hash;
}

/** ホスト(A)とゲスト(B)のシードから試合シードを合成する。役割順で固定 */
export function computeMatchSeed(hostSeed: number, guestSeed: number): number {
  return combineSeeds(hostSeed, guestSeed);
}
