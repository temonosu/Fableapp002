from typing import Literal

from app.repositories.health_repository import HealthRepository
from app.schemas.health import HealthResponse


class HealthService:
    def __init__(self, repository: HealthRepository) -> None:
        self._repository = repository

    def check(self) -> HealthResponse:
        database: Literal["ok", "unavailable"] = "ok" if self._repository.ping() else "unavailable"
        return HealthResponse(status="ok", database=database)
