# タスク一覧: p2p-match(P2P対戦)

> 対応する設計: [design.md](./design.md)
> 進め方: 上から順に1タスクずつ。完了したら `[x]` を付ける。
> 観戦・観戦者ベット(要件4・5)は M4 のタスクとして実装時に追記する。

- [x] 1. エンジンの entrant を nullable 化
  - `TableConfig.entrant: PlayerId | null`。null は場代なし・撤退不可。既存テストの維持
  - _要件: 3-1_
- [x] 2. PvP 試合ラッパー
  - `src/game/pvp.ts`。30文・レート漸増・5局打ち切り・飛び・自動首賭け・親継承。
    決定論と通し対局のテスト
  - _要件: 3-1〜3-4_
- [x] 3. backend: ルーム発行とシグナリング
  - `routers/rooms.py` + `services/room_service.py`。POST /rooms と WS 中継。
    pytest(作成・中継・満室・不在コード)
  - _要件: 1-1, 1-2_
- [x] 4. front: シード合成とプロトコル
  - `net/seed.ts`(SHA-256 コミット&リビール)、`net/protocol.ts`(型と検証)。単体テスト
  - _要件: 2-1, 2-3_
- [x] 5. front: シグナリングと WebRTC
  - `net/signaling.ts` / `net/rtc.ts`。公開 STUN、DataChannel 確立
  - _要件: 1-2, 1-3_
- [x] 6. TableBoard の視点対応
  - `self: PlayerId` プロパティで A/B どちら視点でも表示・操作できるようにする
  - _要件: 2-2_
- [x] 7. PvpPage
  - `/pvp` ルート。ルーム作成/参加 → 接続 → 対局 → 決着。持ち時間(自走式)
  - _要件: 2-2, 2-4, 3-1〜3-4_
