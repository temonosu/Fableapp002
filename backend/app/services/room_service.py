"""P2P対戦のシグナリング用ルーム台帳(docs/spec/p2p-match/design.md)。

backend はメッセージを解釈せず、同室の相手ピアへ素通しで中継するだけ。
状態はインメモリ(DB を使わないため repository 層はない)。
"""

import secrets

from fastapi import WebSocket

# 紛らわしい文字(0/O, 1/I/L)を除いたルームコード用アルファベット
CODE_ALPHABET = "ABCDEFGHJKMNPQRSTUVWXYZ23456789"
CODE_LENGTH = 5
MAX_PEERS = 2
MAX_MESSAGE_BYTES = 8 * 1024


class RoomService:
    def __init__(self) -> None:
        self._rooms: dict[str, dict[int, WebSocket]] = {}
        self._next_peer_id = 0

    def create_room(self) -> str:
        while True:
            code = "".join(secrets.choice(CODE_ALPHABET) for _ in range(CODE_LENGTH))
            if code not in self._rooms:
                self._rooms[code] = {}
                return code

    def exists(self, code: str) -> bool:
        return code in self._rooms

    def is_full(self, code: str) -> bool:
        return len(self._rooms.get(code, {})) >= MAX_PEERS

    def add_peer(self, code: str, websocket: WebSocket) -> int:
        self._next_peer_id += 1
        self._rooms[code][self._next_peer_id] = websocket
        return self._next_peer_id

    def remove_peer(self, code: str, peer_id: int) -> None:
        room = self._rooms.get(code)
        if room is None:
            return
        room.pop(peer_id, None)
        if not room:
            del self._rooms[code]

    async def send_to_others(self, code: str, sender_id: int, text: str) -> None:
        """同室の相手ピアへ送信する。切断済みピアへの送信失敗は無視する"""
        for peer_id, websocket in list(self._rooms.get(code, {}).items()):
            if peer_id == sender_id:
                continue
            try:
                await websocket.send_text(text)
            except Exception:  # noqa: BLE001 - 相手切断時の失敗は中継では致命的でない
                continue


# アプリ全体で共有するインメモリ台帳(テストでは dependency_overrides で差し替える)
room_service = RoomService()
