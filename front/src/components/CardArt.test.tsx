import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { CARDS } from "../game/cards";
import { CardArt } from "./CardArt";

describe("CardArt", () => {
  it("全48枚がクラッシュせずに SVG として描画される", () => {
    for (const card of CARDS) {
      const markup = renderToStaticMarkup(<CardArt card={card} />);
      expect(markup.startsWith("<svg")).toBe(true);
      expect(markup).toContain("</svg>");
    }
  });

  it("種別の見分けが絵に反映される(短冊の色・光札の固有絵)", () => {
    const akatan = CARDS.find((c) => c.tag === "akatan");
    const aotan = CARDS.find((c) => c.tag === "aotan");
    const moon = CARDS.find((c) => c.tag === "moon");
    if (akatan === undefined || aotan === undefined || moon === undefined) {
      throw new Error("札が見つからない");
    }
    expect(renderToStaticMarkup(<CardArt card={akatan} />)).toContain("#c43a3a"); // 赤短
    expect(renderToStaticMarkup(<CardArt card={aotan} />)).toContain("#3d5a97"); // 青短
    expect(renderToStaticMarkup(<CardArt card={moon} />)).toContain("circle"); // 月
  });
});
