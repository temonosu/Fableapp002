import type { Card, Month } from "../game/types";

// 48枚の札絵を軽量なインライン SVG で手続き的に描画する(画像アセットなし)。
// 構成 = 地(生成り) + 月の植物モチーフ + 種別オーバーレイ(光/タネ/短冊)。
// viewBox は 40×56 固定で、表示サイズはラッパー側で決める

const INK = "#3a2e2a"; // 輪郭などの墨色

/** 月ごとの植物モチーフ(下半分〜全面に描く) */
function Plant({ month }: { month: Month }) {
  switch (month) {
    case 1: // 松
      return (
        <g stroke="#1e6b40" strokeWidth="2" strokeLinecap="round">
          <path d="M20 52 V30" />
          <path d="M20 38 L10 30 M20 38 L30 30" />
          <path d="M20 46 L8 40 M20 46 L32 40" />
        </g>
      );
    case 2: // 梅
      return (
        <g>
          <path d="M8 52 Q20 40 32 46" stroke="#7a4a2b" strokeWidth="2" fill="none" />
          {[
            [14, 42],
            [24, 38],
            [30, 44],
          ].map(([x, y], i) => (
            <circle key={i} cx={x} cy={y} r="4.5" fill="#e0526e" />
          ))}
          <circle cx="24" cy="38" r="1.5" fill="#ffd23e" />
        </g>
      );
    case 3: // 桜
      return (
        <g fill="#f4a7bd">
          {[0, 72, 144, 216, 288].map((deg) => (
            <ellipse key={deg} cx="20" cy="40" rx="4" ry="6.5" transform={`rotate(${deg} 20 44)`} />
          ))}
          <circle cx="20" cy="44" r="2.5" fill="#d84a6e" />
        </g>
      );
    case 4: // 藤
      return (
        <g fill="#8f6fc2">
          {[0, 1, 2, 3].map((i) => (
            <ellipse key={i} cx={14 + i * 4} cy={34 + i * 6} rx="4" ry="3" />
          ))}
          <path d="M10 28 Q22 26 32 30" stroke="#5c8a3c" strokeWidth="2" fill="none" />
        </g>
      );
    case 5: // 菖蒲
      return (
        <g>
          <path d="M16 52 V32 M24 52 V30 M20 52 V36" stroke="#4c8f3f" strokeWidth="2" />
          <path d="M20 28 Q15 22 17 18 Q20 22 20 26 Q20 22 23 18 Q25 23 20 28Z" fill="#7b5bb5" />
        </g>
      );
    case 6: // 牡丹
      return (
        <g>
          <circle cx="20" cy="42" r="8" fill="#d1447c" />
          <circle cx="20" cy="42" r="4.5" fill="#ee7fa6" />
          <path d="M8 52 Q14 46 20 50 Q26 46 32 52" stroke="#4c8f3f" strokeWidth="2" fill="none" />
        </g>
      );
    case 7: // 萩
      return (
        <g>
          <path
            d="M8 52 Q16 36 30 30 M12 52 Q20 40 32 36"
            stroke="#5c8a3c"
            strokeWidth="1.8"
            fill="none"
          />
          {[
            [22, 34],
            [27, 32],
            [25, 40],
            [30, 38],
          ].map(([x, y], i) => (
            <circle key={i} cx={x} cy={y} r="2.2" fill="#c2477e" />
          ))}
        </g>
      );
    case 8: // 芒(坊主)
      return <path d="M4 56 Q20 30 36 56 Z" fill="#c9a24d" />;
    case 9: // 菊
      return (
        <g>
          {[0, 30, 60, 90, 120, 150, 180, 210, 240, 270, 300, 330].map((deg) => (
            <ellipse
              key={deg}
              cx="20"
              cy="42"
              rx="2"
              ry="6"
              transform={`rotate(${deg} 20 42)`}
              fill="#f2c744"
            />
          ))}
          <circle cx="20" cy="42" r="3" fill="#a3701c" />
        </g>
      );
    case 10: // 紅葉
      return (
        <g fill="#d1502e">
          {[0, 60, 120, 180, 240, 300].map((deg) => (
            <ellipse key={deg} cx="20" cy="42" rx="2.4" ry="7" transform={`rotate(${deg} 20 42)`} />
          ))}
          <circle cx="20" cy="42" r="2.4" fill="#8f2f16" />
        </g>
      );
    case 11: // 柳
      return (
        <g stroke="#5c8a3c" strokeWidth="1.8" fill="none">
          <path d="M12 20 Q10 36 12 52" />
          <path d="M20 18 Q18 36 21 52" />
          <path d="M28 20 Q27 36 30 52" />
        </g>
      );
    case 12: // 桐
      return (
        <g>
          <path d="M20 34 L12 44 H28 Z" fill="#3f7d4e" />
          <path d="M14 46 L10 54 H18 Z M26 46 L22 54 H30 Z" fill="#3f7d4e" />
          <path
            d="M17 30 V24 M20 32 V22 M23 30 V24"
            stroke="#8f6fc2"
            strokeWidth="2.4"
            strokeLinecap="round"
          />
        </g>
      );
  }
}

/** 種別・個性のオーバーレイ */
function Overlay({ card }: { card: Card }) {
  if (card.kind === "tanzaku") {
    const blue = card.tag === "aotan";
    return (
      <g>
        <rect x="6" y="6" width="9" height="34" rx="1" fill={blue ? "#3d5a97" : "#c43a3a"} />
        {card.tag === "akatan" && (
          <path d="M10.5 10 V24" stroke="#fff" strokeWidth="1.4" strokeLinecap="round" />
        )}
      </g>
    );
  }
  switch (card.tag) {
    case "rain": // 柳に小野道風(傘の人と雨)
      return (
        <g>
          <path d="M6 6 L16 20 M16 4 L26 18 M26 6 L36 20" stroke="#5b7fb4" strokeWidth="1.6" />
          <circle cx="13" cy="34" r="3.5" fill={INK} />
          <path d="M8 46 Q13 38 18 46 Z" fill="#7a4a2b" />
        </g>
      );
    case "curtain": // 桜に幕
      return (
        <g>
          <path d="M4 10 H36 V22 Q20 28 4 22 Z" fill="#d84a3a" />
          <path d="M10 11 V23 M20 12 V25 M30 11 V23" stroke="#f6e7c9" strokeWidth="2" />
        </g>
      );
    case "moon": // 芒に月
      return <circle cx="26" cy="16" r="9" fill="#f6e7c9" stroke="#c9a24d" strokeWidth="1" />;
    case "sake": // 菊に盃
      return (
        <g>
          <path d="M10 14 H30 L26 24 H14 Z" fill="#c43a3a" />
          <path d="M18 24 H22 V28 H18 Z" fill="#8f2f16" />
        </g>
      );
    case "boar": // 萩に猪
      return (
        <g fill="#6b4a2f">
          <ellipse cx="20" cy="18" rx="10" ry="6.5" />
          <circle cx="29" cy="17" r="3.5" />
          <path d="M12 24 V27 M18 24 V27 M24 24 V27" stroke="#6b4a2f" strokeWidth="2" />
        </g>
      );
    case "deer": // 紅葉に鹿
      return (
        <g fill="#a3702e">
          <ellipse cx="19" cy="20" rx="9" ry="6" />
          <circle cx="27" cy="15" r="3.2" />
          <path d="M28 12 L31 5 M29 12 L34 8" stroke="#6b4a2f" strokeWidth="1.6" fill="none" />
        </g>
      );
    case "butterfly": // 牡丹に蝶
      return (
        <g fill="#e8a33d">
          <ellipse cx="15" cy="14" rx="5.5" ry="7" transform="rotate(-20 15 14)" />
          <ellipse cx="25" cy="14" rx="5.5" ry="7" transform="rotate(20 25 14)" />
          <rect x="19" y="8" width="2" height="12" rx="1" fill={INK} />
        </g>
      );
  }
  if (card.kind === "hikari") {
    if (card.month === 1) {
      // 松に鶴
      return (
        <g>
          <circle cx="27" cy="12" r="6" fill="#d84a3a" opacity="0.9" />
          <ellipse cx="16" cy="22" rx="8" ry="5" fill="#fff" stroke={INK} strokeWidth="1" />
          <path d="M22 20 Q28 16 30 22" stroke={INK} strokeWidth="1.6" fill="none" />
        </g>
      );
    }
    // 桐に鳳凰
    return (
      <g fill="#d88a2e">
        <path d="M10 12 Q20 4 30 12 Q24 14 22 20 Q18 14 10 12Z" />
        <circle cx="27" cy="10" r="2.5" />
      </g>
    );
  }
  if (card.kind === "tane") {
    // 汎用の鳥(鶯・不如帰・雁・燕)と八橋
    if (card.month === 5) {
      return <path d="M6 16 H20 V20 H34 V24 H20 V20 H6 Z" fill="#7a4a2b" />;
    }
    const bird =
      card.month === 2
        ? "#7a8f3c"
        : card.month === 8
          ? "#4a4a4a"
          : card.month === 11
            ? "#2b2b2b"
            : "#8a6a4a";
    return (
      <g fill={bird}>
        <ellipse cx="20" cy="16" rx="8" ry="5" />
        <circle cx="27" cy="13" r="3" />
        <path d="M12 16 L6 20 L12 19 Z" />
      </g>
    );
  }
  return null;
}

export function CardArt({ card }: { card: Card }) {
  return (
    <svg viewBox="0 0 40 56" className="h-full w-full" aria-hidden="true" role="presentation">
      <rect x="0" y="0" width="40" height="56" rx="3" fill="#f7f1e3" />
      <Plant month={card.month} />
      <Overlay card={card} />
    </svg>
  );
}
