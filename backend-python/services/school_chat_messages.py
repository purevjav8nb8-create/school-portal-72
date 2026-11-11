from datetime import datetime, timezone
from typing import Any
from uuid import uuid4
from fastapi import HTTPException
from database import supabase
from schemas.school_chat import ChatMessageCreate
from services.school_announcements import _is_admin
from services.school_chat_access import _conversation_messages, _private_participants
from services.school_chat_common import _CHAT_TABLE, _CHAT_UNITS, _READ_TABLE, _chat_user_by_id, _load_conversation_rows, _read_ids, _require_database, _user_id, _user_name

def create_chat_message(user, submission: ChatMessageCreate) -> dict[str, Any]:
    is_admin = _is_admin(user)
    user_id = _user_id(user)
    conversation_id = submission.conversation_id.strip()
    body = submission.body.strip()
    if not body or len(body) > 5000:
        raise HTTPException(status_code=422, detail="Мессеж 1-5000 тэмдэгт байна.")

    if conversation_id == "broadcast":
        if not is_admin:
            raise HTTPException(status_code=403, detail="Нийт мессежийг зөвхөн админ илгээнэ.")
        if any(unit not in _CHAT_UNITS for unit in submission.target_units):
            raise HTTPException(status_code=422, detail="Нэгжийн сонголт буруу байна.")
        recipient_id = None
        conversation_type = "broadcast"
        target_units = list(dict.fromkeys(submission.target_units))
    else:
        if not conversation_id.startswith("private:"):
            raise HTTPException(status_code=422, detail="Чатын дугаар буруу байна.")
        existing_rows = _load_conversation_rows(conversation_id)
        participants = _private_participants(conversation_id, existing_rows)
        if user_id not in participants:
            raise HTTPException(status_code=403, detail="Энэ чатаар мессеж илгээх эрхгүй байна.")
        other_ids = participants - {user_id}
        if len(other_ids) != 1:
            raise HTTPException(status_code=422, detail="Хүлээн авагчийг тодорхойлж чадсангүй.")
        recipient_id = next(iter(other_ids))
        if _chat_user_by_id(recipient_id) is None:
            raise HTTPException(status_code=404, detail="Хэрэглэгч олдсонгүй.")
        conversation_type = "private"
        target_units = []

    message = {
        "id": str(uuid4()),
        "conversation_id": conversation_id,
        "conversation_type": conversation_type,
        "sender_id": user_id,
        "sender_name": _user_name(user),
        "recipient_id": recipient_id,
        "target_units": target_units,
        "body": body,
        "created_at": datetime.now(timezone.utc).isoformat(),
    }
    _require_database()
    try:
        result = supabase.table(_CHAT_TABLE).insert(message).execute()
    except Exception as error:
        raise HTTPException(status_code=503, detail="Мессеж хадгалагдсангүй. Supabase migration-аа шалгана уу.") from error
    saved = (result.data or [message])[0]
    return {**saved, "sender_name": _user_name(user), "is_mine": True, "is_read": True}

def mark_chat_read(user, conversation_id: str) -> dict[str, int]:
    messages = _conversation_messages(conversation_id, user)
    user_id = _user_id(user)
    unread = [
        row for row in messages
        if row.get("id")
        and str(row.get("sender_id")) != user_id
        and (
            conversation_id == "broadcast"
            or str(row.get("recipient_id")) == user_id
        )
    ]
    read_ids = _read_ids(user_id, [str(row["id"]) for row in unread])
    new_reads = [
        {"message_id": str(row["id"]), "user_id": user_id, "read_at": datetime.now(timezone.utc).isoformat()}
        for row in unread
        if str(row["id"]) not in read_ids
    ]
    if new_reads:
        try:
            supabase.table(_READ_TABLE).upsert(
                new_reads,
                on_conflict="message_id,user_id",
            ).execute()
        except Exception as error:
            raise HTTPException(status_code=503, detail="Чатын уншсан төлөв хадгалагдсангүй.") from error
    return {"read": len(new_reads)}
