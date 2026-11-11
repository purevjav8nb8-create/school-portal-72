from typing import Any
from fastapi import HTTPException
from services.school_chat_common import _chat_directory, _load_conversation_rows, _metadata, _user_id
from services.school_announcements import _is_admin

def _visible_broadcast(message: dict[str, Any], user) -> bool:
    if _is_admin(user):
        return True
    targets = message.get("target_units") or []
    unit = str(_metadata(user).get("unit", "")).strip().upper()
    return not targets or unit in targets

def _private_participants(conversation_id: str, rows: list[dict[str, Any]]) -> set[str]:
    parts = conversation_id.split(":")
    if len(parts) == 3 and parts[0] == "private" and parts[1] and parts[2]:
        if parts[1] == parts[2]:
            raise HTTPException(status_code=422, detail="Өөртэйгөө чат эхлүүлэх боломжгүй.")
        return {parts[1], parts[2]}
    if len(parts) == 2 and parts[0] == "private" and parts[1]:
        participants = {parts[1]}
        for row in rows:
            if row.get("sender_id"):
                participants.add(str(row["sender_id"]))
            if row.get("recipient_id"):
                participants.add(str(row["recipient_id"]))
        return participants
    raise HTTPException(status_code=422, detail="Чатын дугаар буруу байна.")

def _conversation_messages(conversation_id: str, user) -> list[dict[str, Any]]:
    user_id = _user_id(user)
    if conversation_id == "broadcast":
        rows = _load_conversation_rows("broadcast")
        return [row for row in rows if _visible_broadcast(row, user)]

    if not conversation_id.startswith("private:"):
        raise HTTPException(status_code=422, detail="Чатын дугаар буруу байна.")
    rows = _load_conversation_rows(conversation_id)
    participants = _private_participants(conversation_id, rows)
    if user_id not in participants:
        raise HTTPException(status_code=403, detail="Энэ чатыг харах эрхгүй байна.")
    directory_ids = {_user_id(candidate) for candidate in _chat_directory()}
    if not (participants - {user_id}).issubset(directory_ids):
        raise HTTPException(status_code=404, detail="Хэрэглэгч олдсонгүй.")
    return rows
