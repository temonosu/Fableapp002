import { describe, expect, it } from "vitest";
import { computeMatchSeed, makeCommitment, verifyReveal } from "./seed";

describe("コミット&リビール", () => {
  it("正しい reveal は検証を通る", async () => {
    const c = await makeCommitment();
    expect(await verifyReveal(c.hash, c.seed, c.nonce)).toBe(true);
  });

  it("シードや nonce を差し替えると検証に失敗する(山札の仕込み防止)", async () => {
    const c = await makeCommitment();
    expect(await verifyReveal(c.hash, c.seed + 1, c.nonce)).toBe(false);
    expect(await verifyReveal(c.hash, c.seed, `${c.nonce}x`)).toBe(false);
  });

  it("試合シードは役割(ホスト/ゲスト)順で決定的に合成される", () => {
    expect(computeMatchSeed(11, 22)).toBe(computeMatchSeed(11, 22));
    // 役割を入れ替えると別の試合になる(順序依存で固定)
    expect(computeMatchSeed(11, 22)).not.toBe(computeMatchSeed(22, 11));
  });

  it("毎回異なるコミットが生成される", async () => {
    const a = await makeCommitment();
    const b = await makeCommitment();
    expect(a.hash).not.toBe(b.hash);
  });
});
