import { describe, expect, it } from "vitest";
import { findByTag, findCard } from "./cards";
import type { CardId } from "./types";
import { evaluateYaku, totalPoints } from "./yaku";

const hikari = (month: 1 | 3 | 8 | 11 | 12): CardId => findCard(month, "hikari").id;

function ids(yaku: ReturnType<typeof evaluateYaku>): string[] {
  return yaku.map((y) => y.id);
}

describe("光役(排他)", () => {
  it("五光 = 10文", () => {
    const captured = [hikari(1), hikari(3), hikari(8), hikari(11), hikari(12)];
    expect(evaluateYaku(captured)).toEqual([{ id: "goko", name: "五光", points: 10 }]);
  });

  it("四光(雨抜き) = 8文", () => {
    const captured = [hikari(1), hikari(3), hikari(8), hikari(12)];
    expect(ids(evaluateYaku(captured))).toEqual(["shiko"]);
    expect(totalPoints(captured)).toBe(8);
  });

  it("雨四光 = 7文", () => {
    const captured = [hikari(1), hikari(3), hikari(8), hikari(11)];
    expect(ids(evaluateYaku(captured))).toEqual(["ameshiko"]);
    expect(totalPoints(captured)).toBe(7);
  });

  it("三光 = 5文(雨は数えない)", () => {
    expect(ids(evaluateYaku([hikari(1), hikari(3), hikari(12)]))).toEqual(["sanko"]);
    // 雨を含む3枚は三光にならない(雨は数から除く)
    expect(evaluateYaku([hikari(1), hikari(11), hikari(8)])).toEqual([]);
  });
});

describe("固定役", () => {
  it("花見で一杯・月見で一杯は併立する", () => {
    const captured = [findByTag("curtain").id, findByTag("moon").id, findByTag("sake").id];
    const result = ids(evaluateYaku(captured));
    expect(result).toContain("hanami");
    expect(result).toContain("tsukimi");
  });

  it("猪鹿蝶 = 5文", () => {
    const captured = [findByTag("boar").id, findByTag("deer").id, findByTag("butterfly").id];
    expect(ids(evaluateYaku(captured))).toEqual(["inoshikacho"]);
    expect(totalPoints(captured)).toBe(5);
  });

  it("赤短・青短", () => {
    const akatan = [
      findCard(1, "tanzaku").id,
      findCard(2, "tanzaku").id,
      findCard(3, "tanzaku").id,
    ];
    expect(ids(evaluateYaku(akatan))).toEqual(["akatan"]);
    const aotan = [
      findCard(6, "tanzaku").id,
      findCard(9, "tanzaku").id,
      findCard(10, "tanzaku").id,
    ];
    expect(ids(evaluateYaku(aotan))).toEqual(["aotan"]);
  });
});

describe("枚数役", () => {
  it("タネは5枚で1文、以降+1文/枚", () => {
    const tane5 = [2, 4, 5, 6, 8].map((m) => findCard(m as 2 | 4 | 5 | 6 | 8, "tane").id);
    expect(evaluateYaku(tane5).find((y) => y.id === "tane")?.points).toBe(1);
    const tane7 = [...tane5, findCard(9, "tane").id, findCard(11, "tane").id];
    expect(evaluateYaku(tane7).find((y) => y.id === "tane")?.points).toBe(3);
  });

  it("タンは5枚で1文(赤短と併立する)", () => {
    const captured = [
      findCard(1, "tanzaku").id,
      findCard(2, "tanzaku").id,
      findCard(3, "tanzaku").id,
      findCard(4, "tanzaku").id,
      findCard(5, "tanzaku").id,
    ];
    const result = evaluateYaku(captured);
    expect(ids(result)).toEqual(["akatan", "tan"]);
    expect(totalPoints(captured)).toBe(6);
  });

  it("カスは10枚で1文、以降+1文/枚", () => {
    const kasu = (n: number): CardId[] => {
      const all = [];
      for (let m = 1; m <= 12 && all.length < n; m++) {
        for (let i = 0; i < 4 && all.length < n; i++) {
          try {
            all.push(findCard(m as 1, "kasu", i).id);
          } catch {
            break;
          }
        }
      }
      return all;
    };
    expect(evaluateYaku(kasu(9))).toEqual([]);
    expect(evaluateYaku(kasu(10)).find((y) => y.id === "kasu")?.points).toBe(1);
    expect(evaluateYaku(kasu(12)).find((y) => y.id === "kasu")?.points).toBe(3);
  });

  it("役なしは空配列", () => {
    expect(evaluateYaku([])).toEqual([]);
    expect(evaluateYaku([findCard(1, "kasu").id])).toEqual([]);
  });
});
