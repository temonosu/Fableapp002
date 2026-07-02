import { describe, expect, it } from "vitest";
import { ALL_CARD_IDS, CARDS, cardOf, findByTag, findCard } from "./cards";
import { mulberry32, shuffle } from "./rng";

describe("cards", () => {
  it("48枚で id は 0..47 の一意", () => {
    expect(CARDS).toHaveLength(48);
    expect(new Set(ALL_CARD_IDS).size).toBe(48);
    expect(Math.min(...ALL_CARD_IDS)).toBe(0);
    expect(Math.max(...ALL_CARD_IDS)).toBe(47);
  });

  it("種別の内訳は 光5・タネ9・短冊10・カス24", () => {
    const count = (kind: string): number => CARDS.filter((c) => c.kind === kind).length;
    expect(count("hikari")).toBe(5);
    expect(count("tane")).toBe(9);
    expect(count("tanzaku")).toBe(10);
    expect(count("kasu")).toBe(24);
  });

  it("各月ちょうど4枚", () => {
    for (let month = 1; month <= 12; month++) {
      expect(CARDS.filter((c) => c.month === month)).toHaveLength(4);
    }
  });

  it("役に必要なタグが揃っている", () => {
    expect(findByTag("rain").month).toBe(11);
    expect(findByTag("curtain").month).toBe(3);
    expect(findByTag("moon").month).toBe(8);
    expect(findByTag("sake").month).toBe(9);
    expect(findByTag("boar").month).toBe(7);
    expect(findByTag("deer").month).toBe(10);
    expect(findByTag("butterfly").month).toBe(6);
    expect(CARDS.filter((c) => c.tag === "akatan")).toHaveLength(3);
    expect(CARDS.filter((c) => c.tag === "aotan")).toHaveLength(3);
  });

  it("cardOf は不正IDで例外", () => {
    expect(() => cardOf(48)).toThrow();
    expect(findCard(1, "hikari").name).toBe("鶴");
  });
});

describe("rng", () => {
  it("同一シードで同一の乱数列", () => {
    const a = mulberry32(42);
    const b = mulberry32(42);
    for (let i = 0; i < 100; i++) {
      expect(a()).toBe(b());
    }
  });

  it("シャッフルは置換(要素を失わない)", () => {
    const shuffled = shuffle(ALL_CARD_IDS, mulberry32(7));
    expect([...shuffled].sort((x, y) => x - y)).toEqual([...ALL_CARD_IDS]);
    expect(shuffled).not.toEqual([...ALL_CARD_IDS]); // 42枚超で恒等になる確率は無視できる
  });
});
