# 設計: p2p-match(P2P対戦)

> ステータス: **確定**(観戦・観戦者ベット(要件4・5)は M4 で追記する)
> 対応する要件: [requirements.md](./requirements.md)

## 概要

backend はルームコード発行と WebSocket シグナリングのみを担い、対局は
WebRTC DataChannel 上でアクションを送り合って両クライアントが同一の
game-core エンジンを回す(ロックステップ)。山札はコミット&リビールで
合成したシードから決まり、どちらのピアも単独では操作できない。

## 全体フロー

```
ホスト                     backend                    ゲスト
  │ POST /api/v1/rooms       │                          │
  │ ←──── {code} ────────    │                          │
  │ WS /rooms/{code}/ws      │      WS /rooms/{code}/ws │
  │ ←──── peer-joined ────── │ ←──────────────────────  │
  │ ←─ SDP offer/answer・ICE candidate を相互中継 ─→    │
  │                          │                          │
  │ ====== 以降 WebRTC DataChannel(P2P直結) ======     │
  │ commit(seedのハッシュ) ─→   ←─ commit               │
  │ reveal(seed+nonce)   ─→   ←─ reveal → 検証・合成    │
  │ pvp アクション        ─→   ←─ pvp アクション        │
```

## backend 設計

### API

| メソッド | パス | 説明 |
|----------|------|------|
| POST | /api/v1/rooms | ルーム作成。`{"code": "ABC23"}` を返す |
| WS | /api/v1/rooms/{code}/ws | シグナリング。同室の相手ピアへ JSON を素通しで中継 |

- レイヤ: `routers/rooms.py` → `services/room_service.py`(インメモリのルーム台帳)。
  DB は使わない(repository 層なし)
- ルームは2ピアまで。3人目の接続と存在しないコードは 4400 系で close
- ピアが切断したら相手に `{"type": "peer-left"}` を通知。全員抜けたらルーム削除。
  同一ルームへの再接続(復帰)は可
- WS メッセージはサイズ上限(8KB)のみ検査し、内容は解釈しない(素通し)

## front 設計

### モジュール構成

```
front/src/net/
├── protocol.ts   # DataChannel 上のメッセージ型(バージョン付き)と型ガード
├── signaling.ts  # シグナリング WS クライアント
├── rtc.ts        # RTCPeerConnection / DataChannel のラッパー(公開STUN使用)
└── seed.ts       # コミット&リビール(SHA-256)とシード合成
front/src/game/
└── pvp.ts        # PvP 試合の純TS reducer(下記)
```

### PvP 試合ルール(pvp.ts)— 要件3

- 両者 **30文**・細工/レリックなし・**場代の徴収なし**(こいこい料・大入りの basis
  としての「場代」は レート×5 を使う)
- 1局ごとに賭場(TableState)を作り直す: 局 i のレートは i(1→5 で漸増)。
  シードは `combineSeeds(matchSeed, i)`、旬の月もシードから決まる
- 親は前局の勝者(エンジンの dealer 継承)。初局は matchSeed から決定
- **残文 < 次局のレート×5 のプレイヤーは自動的に首賭け**(両者該当なら少ない方)
- 決着: 飛び(0文)で即終了 / 5局終了時は残文勝負(同数は引き分け)

エンジン変更: `TableConfig.entrant` を `PlayerId | null` に拡張する。
`null` = 場代の徴収なし・撤退不可(PvP 用)。既存の呼び出しは影響なし。

### 同期モデル(要件2)

- 役割: ホスト = A、ゲスト = B(固定)。UI は `self` 視点で反転表示する
- コミット&リビール: 各自 `(seed, nonce)` を生成し `sha256(seed:nonce)` を先に交換 →
  双方コミット受領後に reveal → ハッシュ検証 → `matchSeed = combineSeeds(seedA, seedB)`
- 以降は PvpAction(`{type:"table",action}` / `{type:"nextGame"}`)を連番付きで送信。
  受信側は自分の reducer に適用し、`ok:false` なら不正として対局を中断する
- 手番の持ち時間はクライアント側で自走: 自分の手番で 10秒+予備45秒
  (こいこい判断は+10秒)を超えたら、自クライアントが安全手(AI の手)を打って送信する。
  相手側の時間は表示のみ(信頼モデル)

### プロトコル(DataChannel, JSON)

```ts
type NetMessage =
  | { v: 1; t: "commit"; hash: string }
  | { v: 1; t: "reveal"; seed: number; nonce: string }
  | { v: 1; t: "pvp"; seq: number; action: PvpAction }
  | { v: 1; t: "bye" };
```

- `seq` は 0 始まりの連番。抜け・重複を検出したら対局を中断する(再送は M4 以降)

### 画面(PvpPage, /pvp)

- 入口: [ルームを作る](コード表示・相手待ち)/ [コードで参加](入力)
- 接続状態表示(シグナリング中 → P2P接続中 → 対局)
- 対局: TableBoard(self 視点)+ 残り時間 + 局数/レート表示。
  局間は「次の局へ」をホストが進行(nextGame はホストのみ送信)
- 終了: 勝敗と残文を表示、[もう一度](同じルームで再戦: matchSeed を取り直し)

## エラーハンドリング

- シグナリング切断: 同じコードで再接続 → WebRTC を張り直す(対局状態は両者のローカルに
  残っているため、seq の続きから再開。完全な復帰プロトコルは M4)
- 不正メッセージ・検証失敗・seq 不整合: エラーバナーを出して対局中断

## セキュリティ考慮

- 信頼モデルは requirements.md の通り(フレンド対戦前提)。シード合成で山札の
  操作のみ防ぎ、覗き見チートは防がない
- backend はメッセージ内容を解釈せず、ルームコード(5文字英数)以外の入力を受けない

## 未決事項

- [ ] TURN サーバー(つながらない回線対応)
- [ ] 切断からの完全復帰(状態ハッシュ照合+再送)
- [ ] 観戦(要件4・5)の中継設計 — M4 でこの design に追記
