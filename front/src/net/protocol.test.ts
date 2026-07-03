import { describe, expect, it } from "vitest";
import { decodeMessage, encodeMessage } from "./protocol";
import type { NetMessage } from "./protocol";

describe("protocol", () => {
  it("全メッセージ型がラウンドトリップする", () => {
    const messages: NetMessage[] = [
      { v: 1, t: "commit", hash: "abc123" },
      { v: 1, t: "reveal", seed: 42, nonce: "deadbeef" },
      { v: 1, t: "pvp", seq: 3, action: { type: "nextGame" } },
      {
        v: 1,
        t: "pvp",
        seq: 4,
        action: { type: "table", action: { type: "declareKoikoi", player: "A" } },
      },
      { v: 1, t: "bye" },
    ];
    for (const message of messages) {
      expect(decodeMessage(encodeMessage(message))).toEqual(message);
    }
  });

  it("不正な入力は null", () => {
    expect(decodeMessage("not json")).toBeNull();
    expect(decodeMessage("null")).toBeNull();
    expect(decodeMessage('{"v":2,"t":"bye"}')).toBeNull(); // バージョン不一致
    expect(decodeMessage('{"v":1,"t":"unknown"}')).toBeNull();
    expect(decodeMessage('{"v":1,"t":"commit"}')).toBeNull(); // hash 欠落
    expect(decodeMessage('{"v":1,"t":"reveal","seed":"x","nonce":"y"}')).toBeNull();
    expect(decodeMessage('{"v":1,"t":"pvp","seq":0,"action":{"type":"hack"}}')).toBeNull();
  });
});
