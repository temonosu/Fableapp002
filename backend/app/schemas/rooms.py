from pydantic import BaseModel


class RoomResponse(BaseModel):
    code: str
