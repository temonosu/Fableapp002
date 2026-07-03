from typing import Annotated

from fastapi import APIRouter, Depends, WebSocket, WebSocketDisconnect

from app.schemas.rooms import RoomResponse
from app.services.room_service import MAX_MESSAGE_BYTES, RoomService, room_service

router = APIRouter(tags=["rooms"])

# WebSocket の独自 close コード(4000番台はアプリケーション用)
WS_ROOM_NOT_FOUND = 4404
WS_ROOM_FULL = 4403


def get_room_service() -> RoomService:
    return room_service


@router.post("/rooms", response_model=RoomResponse, status_code=201)
def create_room(service: Annotated[RoomService, Depends(get_room_service)]) -> RoomResponse:
    return RoomResponse(code=service.create_room())


@router.websocket("/rooms/{code}/ws")
async def signaling(
    websocket: WebSocket,
    code: str,
    service: Annotated[RoomService, Depends(get_room_service)],
) -> None:
    await websocket.accept()
    if not service.exists(code):
        await websocket.close(code=WS_ROOM_NOT_FOUND)
        return
    if service.is_full(code):
        await websocket.close(code=WS_ROOM_FULL)
        return
    peer_id = service.add_peer(code, websocket)
    await service.send_to_others(code, peer_id, '{"type":"peer-joined"}')
    try:
        while True:
            text = await websocket.receive_text()
            if len(text.encode("utf-8")) > MAX_MESSAGE_BYTES:
                continue  # 巨大メッセージは黙って捨てる(中継の保護)
            await service.send_to_others(code, peer_id, text)
    except WebSocketDisconnect:
        pass
    finally:
        service.remove_peer(code, peer_id)
        await service.send_to_others(code, peer_id, '{"type":"peer-left"}')
