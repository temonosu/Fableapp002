from fastapi.testclient import TestClient

from app.main import app
from app.routers.rooms import WS_ROOM_FULL, WS_ROOM_NOT_FOUND, get_room_service
from app.services.room_service import CODE_LENGTH, RoomService


def _client() -> TestClient:
    # 各テストで独立したインメモリ台帳を使う
    service = RoomService()
    app.dependency_overrides[get_room_service] = lambda: service
    return TestClient(app)


def teardown_function() -> None:
    app.dependency_overrides.clear()


def _create_code(client: TestClient) -> str:
    response = client.post("/api/v1/rooms")
    assert response.status_code == 201
    code = response.json()["code"]
    assert isinstance(code, str) and len(code) == CODE_LENGTH
    return code


def test_create_room() -> None:
    client = _client()
    code1 = _create_code(client)
    code2 = _create_code(client)
    assert code1 != code2


def test_signaling_relay_between_two_peers() -> None:
    client = _client()
    code = _create_code(client)
    with client.websocket_connect(f"/api/v1/rooms/{code}/ws") as host:
        with client.websocket_connect(f"/api/v1/rooms/{code}/ws") as guest:
            # 2人目の入室がホストに通知される
            assert host.receive_json() == {"type": "peer-joined"}
            # 中継は素通し(内容は解釈しない)
            host.send_text('{"sdp": "offer"}')
            assert guest.receive_json() == {"sdp": "offer"}
            guest.send_text('{"sdp": "answer"}')
            assert host.receive_json() == {"sdp": "answer"}
        # ゲストが抜けるとホストに通知される
        assert host.receive_json() == {"type": "peer-left"}


def test_unknown_room_is_rejected() -> None:
    client = _client()
    with client.websocket_connect("/api/v1/rooms/ZZZZZ/ws") as ws:
        message = ws.receive()
        assert message["type"] == "websocket.close"
        assert message["code"] == WS_ROOM_NOT_FOUND


def test_third_peer_is_rejected() -> None:
    client = _client()
    code = _create_code(client)
    with client.websocket_connect(f"/api/v1/rooms/{code}/ws"):
        with client.websocket_connect(f"/api/v1/rooms/{code}/ws"):
            with client.websocket_connect(f"/api/v1/rooms/{code}/ws") as third:
                message = third.receive()
                assert message["type"] == "websocket.close"
                assert message["code"] == WS_ROOM_FULL


def test_room_can_be_rejoined_after_leaving() -> None:
    client = _client()
    code = _create_code(client)
    with client.websocket_connect(f"/api/v1/rooms/{code}/ws") as host:
        with client.websocket_connect(f"/api/v1/rooms/{code}/ws"):
            assert host.receive_json() == {"type": "peer-joined"}
        assert host.receive_json() == {"type": "peer-left"}
        # 相手が抜けても同じコードで入り直せる(復帰)
        with client.websocket_connect(f"/api/v1/rooms/{code}/ws"):
            assert host.receive_json() == {"type": "peer-joined"}
