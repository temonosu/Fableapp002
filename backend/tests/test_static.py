import importlib
from pathlib import Path

from fastapi.testclient import TestClient
from pytest import MonkeyPatch

import app.main
from app.config import get_settings


def _reload_app_with_static(static_dir: str | None, monkeypatch: MonkeyPatch) -> TestClient:
    """STATIC_DIR を差し替えて app.main を再構築する(マウントは import 時に決まるため)"""
    if static_dir is None:
        monkeypatch.delenv("STATIC_DIR", raising=False)
    else:
        monkeypatch.setenv("STATIC_DIR", static_dir)
    get_settings.cache_clear()
    module = importlib.reload(app.main)
    return TestClient(module.app)


def teardown_module() -> None:
    # 環境を汚さないように既定設定で再ロードして戻す
    get_settings.cache_clear()
    importlib.reload(app.main)


def test_spa_serving_and_fallback(tmp_path: Path, monkeypatch: MonkeyPatch) -> None:
    (tmp_path / "index.html").write_text("<html>SPA</html>")
    (tmp_path / "app.js").write_text("console.log(1)")
    client = _reload_app_with_static(str(tmp_path), monkeypatch)

    # 実ファイルはそのまま配信
    assert client.get("/").text == "<html>SPA</html>"
    assert client.get("/app.js").status_code == 200
    # クライアントルートは index.html にフォールバック(要件 1-2)
    for route in ["/run", "/match", "/pvp"]:
        response = client.get(route)
        assert response.status_code == 200
        assert response.text == "<html>SPA</html>"
    # API はマウントより優先される(要件 1-3)
    assert client.post("/api/v1/rooms").status_code == 201


def test_without_static_dir_root_is_404(monkeypatch: MonkeyPatch) -> None:
    client = _reload_app_with_static(None, monkeypatch)
    assert client.get("/").status_code == 404
    assert client.post("/api/v1/rooms").status_code == 201
