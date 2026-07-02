from fastapi.testclient import TestClient

from app.main import app
from app.repositories.health_repository import HealthRepository
from app.routers.health import get_health_service
from app.services.health_service import HealthService


class FakeHealthRepository(HealthRepository):
    def __init__(self, alive: bool) -> None:
        self._alive = alive

    def ping(self) -> bool:
        return self._alive


def _client(db_alive: bool) -> TestClient:
    app.dependency_overrides[get_health_service] = lambda: HealthService(
        FakeHealthRepository(alive=db_alive)
    )
    return TestClient(app)


def teardown_function() -> None:
    app.dependency_overrides.clear()


def test_health_with_db() -> None:
    response = _client(db_alive=True).get("/api/v1/health")
    assert response.status_code == 200
    assert response.json() == {"status": "ok", "database": "ok"}


def test_health_without_db() -> None:
    response = _client(db_alive=False).get("/api/v1/health")
    assert response.status_code == 200
    assert response.json() == {"status": "ok", "database": "unavailable"}
