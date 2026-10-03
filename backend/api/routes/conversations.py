from datetime import datetime
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException

from api.auth import AuthUser, get_current_user
from api.dependencies import get_travel_service
from api.schemas import RenameRequest
from services.travel_service import TravelService


router = APIRouter(prefix="/conversations", tags=["Conversations"])


def _serialize(record: dict) -> dict:
    payload = {}
    for key, value in record.items():
        if isinstance(value, datetime):
            payload[key] = value.isoformat()
        elif isinstance(value, UUID):
            payload[key] = str(value)
        else:
            payload[key] = value
    return payload


@router.get("")
async def list_conversations(
    user: AuthUser = Depends(get_current_user),
    service: TravelService = Depends(get_travel_service),
):
    rows = await service._product().list_conversations(str(user.id))
    return [_serialize(row) for row in rows]


@router.get("/{conversation_id}")
async def get_conversation(
    conversation_id: str,
    user: AuthUser = Depends(get_current_user),
    service: TravelService = Depends(get_travel_service),
):
    record = await service._product().get_conversation(conversation_id, str(user.id))
    if record is None:
        raise HTTPException(status_code=404, detail="Conversation not found")
    messages = await service._product().list_messages(conversation_id)
    return {
        **_serialize(record),
        "messages": [_serialize(message) for message in messages],
    }


@router.patch("/{conversation_id}")
async def rename_conversation(
    conversation_id: str,
    payload: RenameRequest,
    user: AuthUser = Depends(get_current_user),
    service: TravelService = Depends(get_travel_service),
):
    try:
        record = await service._product().rename(
            conversation_id, str(user.id), payload.title.strip()
        )
        return _serialize(record)
    except LookupError as exc:
        raise HTTPException(status_code=404, detail="Conversation not found") from exc


@router.delete("/{conversation_id}")
async def delete_conversation(
    conversation_id: str,
    user: AuthUser = Depends(get_current_user),
    service: TravelService = Depends(get_travel_service),
):
    try:
        await service._product().soft_delete(conversation_id, str(user.id))
        return {"status": "deleted"}
    except LookupError as exc:
        raise HTTPException(status_code=404, detail="Conversation not found") from exc
