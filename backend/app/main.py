from pathlib import Path

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from starlette.exceptions import HTTPException as StarletteHTTPException
from starlette.responses import Response
from starlette.staticfiles import StaticFiles
from starlette.types import Scope

from app.config import get_settings
from app.routers import health, rooms

app = FastAPI(title="myapp API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=get_settings().cors_origins,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(health.router, prefix="/api/v1")
app.include_router(rooms.router, prefix="/api/v1")


class SpaStaticFiles(StaticFiles):
    """SPA 配信: 実ファイルがなければ index.html にフォールバックする
    (/run, /match, /pvp などのクライアントルートの直接アクセス対応)"""

    async def get_response(self, path: str, scope: Scope) -> Response:
        try:
            return await super().get_response(path, scope)
        except StarletteHTTPException as exc:
            if exc.status_code == 404:
                return await super().get_response("index.html", scope)
            raise


# STATIC_DIR 設定時のみ SPA を同居配信する(deploy spec 参照)。
# API ルートが先に登録されているため /api/v1/* はこのマウントに吸われない
_static_dir = get_settings().static_dir
if _static_dir is not None and Path(_static_dir).is_dir():
    app.mount("/", SpaStaticFiles(directory=_static_dir, html=True), name="spa")
