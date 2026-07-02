import type { Card, CardId, CardKind, CardTag, Month } from "./types";

export const MONTH_FLOWERS: readonly string[] = [
  "松",
  "梅",
  "桜",
  "藤",
  "菖蒲",
  "牡丹",
  "萩",
  "芒",
  "菊",
  "紅葉",
  "柳",
  "桐",
];

type CardSpec = readonly [CardKind, string, CardTag?];

// 月ごとの4枚(本家の構成)。id = (月-1)*4 + 添字
const SPECS: readonly (readonly CardSpec[])[] = [
  [
    ["hikari", "鶴"],
    ["tanzaku", "赤短", "akatan"],
    ["kasu", "カス"],
    ["kasu", "カス"],
  ],
  [
    ["tane", "鶯"],
    ["tanzaku", "赤短", "akatan"],
    ["kasu", "カス"],
    ["kasu", "カス"],
  ],
  [
    ["hikari", "幕", "curtain"],
    ["tanzaku", "赤短", "akatan"],
    ["kasu", "カス"],
    ["kasu", "カス"],
  ],
  [
    ["tane", "不如帰"],
    ["tanzaku", "短冊"],
    ["kasu", "カス"],
    ["kasu", "カス"],
  ],
  [
    ["tane", "八橋"],
    ["tanzaku", "短冊"],
    ["kasu", "カス"],
    ["kasu", "カス"],
  ],
  [
    ["tane", "蝶", "butterfly"],
    ["tanzaku", "青短", "aotan"],
    ["kasu", "カス"],
    ["kasu", "カス"],
  ],
  [
    ["tane", "猪", "boar"],
    ["tanzaku", "短冊"],
    ["kasu", "カス"],
    ["kasu", "カス"],
  ],
  [
    ["hikari", "月", "moon"],
    ["tane", "雁"],
    ["kasu", "カス"],
    ["kasu", "カス"],
  ],
  [
    ["tane", "盃", "sake"],
    ["tanzaku", "青短", "aotan"],
    ["kasu", "カス"],
    ["kasu", "カス"],
  ],
  [
    ["tane", "鹿", "deer"],
    ["tanzaku", "青短", "aotan"],
    ["kasu", "カス"],
    ["kasu", "カス"],
  ],
  [
    ["hikari", "小野道風", "rain"],
    ["tane", "燕"],
    ["tanzaku", "短冊"],
    ["kasu", "カス"],
  ],
  [
    ["hikari", "鳳凰"],
    ["kasu", "カス"],
    ["kasu", "カス"],
    ["kasu", "カス"],
  ],
];

function buildCards(): readonly Card[] {
  const cards: Card[] = [];
  SPECS.forEach((monthSpecs, monthIndex) => {
    monthSpecs.forEach((spec, i) => {
      const [kind, name, tag] = spec;
      cards.push({
        id: monthIndex * 4 + i,
        month: (monthIndex + 1) as Month,
        kind,
        name,
        ...(tag !== undefined ? { tag } : {}),
      });
    });
  });
  return cards;
}

export const CARDS: readonly Card[] = buildCards();

export const ALL_CARD_IDS: readonly CardId[] = CARDS.map((c) => c.id);

export function cardOf(id: CardId): Card {
  const card = CARDS[id];
  if (card === undefined) {
    throw new Error(`不正な札ID: ${id}`);
  }
  return card;
}

export function findCard(month: Month, kind: CardKind, index = 0): Card {
  const found = CARDS.filter((c) => c.month === month && c.kind === kind);
  const card = found[index];
  if (card === undefined) {
    throw new Error(`札が見つからない: ${month}月 ${kind} [${index}]`);
  }
  return card;
}

export function findByTag(tag: CardTag): Card {
  const card = CARDS.find((c) => c.tag === tag);
  if (card === undefined) {
    throw new Error(`札が見つからない: tag=${tag}`);
  }
  return card;
}
