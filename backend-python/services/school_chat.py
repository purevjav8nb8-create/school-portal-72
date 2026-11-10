from datetime import datetime, timezone
import os
from typing import Any
from uuid import uuid4

from fastapi import HTTPException

from database import supabase
from schemas.school_chat import ChatMessageCreate
from services.mock_school_data import load_mock_school_data, mock_data_enabled
from services.school_announcements import _is_admin


_CHAT_TABLE = "school_chat_messages"
_READ_TABLE = "school_chat_reads"
_MAX_MESSAGES = 500
_CHAT_UNITS = {"БАЗАН", "БУЗАН", "НУЗАН"}


def _metadata(user) -> dict[str, Any]:
    return user if isinstance(user, dict) else (getattr(user, "user_metadata", None) or {})


def _user_id(user) -> str:
    return str(user.get("auth_id") if isinstance(user, dict) else user.id)


def _user_email(user) -> str:
    return str(user.get("email", "") if isinstance(user, dict) else getattr(user, "email", "") or "")


def _user_name(user) -> str:
    metadata = _metadata(user)
    return (
        f'{metadata.get("last_name", "")} {metadata.get("first_name", "")}'.strip()
        or _user_email(user)
        or "Нэргүй хэрэглэгч"
    )


def _user_role(user) -> str:
    configured_email = os.getenv("ADMIN_EMAIL", "admin@moes.edu.mn").lower()
    app_metadata = user.get("app_metadata", {}) if isinstance(user, dict) else (getattr(user, "app_metadata", None) or {})
    if (
        _metadata(user).get("role") == "admin"
        or app_metadata.get("role") == "admin"
        or _user_email(user).lower() == configured_email
    ):
        return "Админ"
    if _metadata(user).get("role") == "teacher" or _user_email(user).lower().endswith("@moes.edu.mn"):
        return "Багш"
    return "Хэрэглэгч"


def _chat_directory() -> list[Any]:
    if mock_data_enabled():
        try:
            return load_mock_school_data()["teachers"]
        except RuntimeError as error:
            raise HTTPException(status_code=503, detail="Хэрэглэгчдийн жагсаалт уншигдсангүй.") from error
    return _list_auth_users()


def _chat_user_by_id(user_id: str):
    return next((item for item in _chat_directory() if _user_id(item) == user_id), None)


def _private_conversation_id(first_user_id: str, second_user_id: str) -> str:
    first, second = sorted((first_user_id, second_user_id))
    return f"private:{first}:{second}"


def list_chat_users(user, query: str) -> list[dict[str, str]]:
    normalized_query = query.strip().casefold()
    if not normalized_query:
        return []

    current_user_id = _user_id(user)
    matches = []
    for candidate in _chat_directory():
        candidate_id = _user_id(candidate)
        if candidate_id == current_user_id:
            continue
        name = _user_name(candidate)
        email = _user_email(candidate)
        unit = str(_metadata(candidate).get("unit", "")).strip()
        search_text = f"{name} {email} {unit}".casefold()
        if normalized_query not in search_text:
            continue
        matches.append({
            "user_id": candidate_id,
            "conversation_id": _private_conversation_id(current_user_id, candidate_id),
            "name": name,
            "email": email,
            "role": _user_role(candidate),
            "unit": unit,
        })
    return sorted(matches, key=lambda item: (item["name"].casefold(), item["email"].casefold()))[:30]


def _require_database() -> None:
    if supabase is None:
        raise HTTPException(status_code=503, detail="Чатын өгөгдлийн сан тохируулагдаагүй байна.")


def _list_auth_users() -> list[Any]:
    _require_database()
    try:
        return supabase.auth.admin.list_users(per_page=1000)
    except Exception as error:
        raise HTTPException(status_code=503, detail="Чатын хэрэглэгчдийн жагсаалт уншигдсангүй.") from error


def _load_rows(table: str, limit: int = 2000) -> list[dict[str, Any]]:
    _require_database()
    try:
        result = supabase.table(table).select("*").order("created_at", desc=True).limit(limit).execute()
    except Exception as error:
        raise HTTPException(
            status_code=503,
            detail="Чатын хүснэгт олдсонгүй эсвэл унших боломжгүй байна. Supabase migration ажиллуулна уу.",
        ) from error
    return result.data or []


def _load_conversation_rows(conversation_id: str) -> list[dict[str, Any]]:
    _require_database()
    try:
        result = (
            supabase.table(_CHAT_TABLE)
            .select("*")
            .eq("conversation_id", conversation_id)
            .order("created_at", desc=True)
            .limit(_MAX_MESSAGES)
            .execute()
        )
    except Exception as error:
        raise HTTPException(
            status_code=503,
            detail="Чатын хүснэгт олдсонгүй эсвэл унших боломжгүй байна. Supabase migration ажиллуулна уу.",
        ) from error
    return result.data or []


def _read_ids(user_id: str, message_ids: list[str]) -> set[str]:
    if not message_ids:
        return set()
    message_id_set = set(message_ids)
    read_message_ids: set[str] = set()
    try:
        for offset in range(0, 10000, 1000):
            result = (
                supabase.table(_READ_TABLE)
                .select("message_id")
                .eq("user_id", user_id)
                .range(offset, offset + 999)
                .execute()
            )
            read_message_ids.update(
                str(item["message_id"])
                for item in (result.data or [])
                if str(item.get("message_id")) in message_id_set
            )
            if len(result.data or []) < 1000:
                break
    except Exception as error:
        raise HTTPException(status_code=503, detail="Чатын уншсан төлөв уншигдсангүй.") from error
    return read_message_ids


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


def list_chat_messages(user, conversation_id: str) -> list[dict[str, Any]]:
    rows = _conversation_messages(conversation_id, user)
    rows = sorted(rows, key=lambda row: row.get("created_at", ""))[-_MAX_MESSAGES:]
    user_id = _user_id(user)
    read_ids = _read_ids(user_id, [str(row["id"]) for row in rows if row.get("id")])
    return [
        {
            **row,
            "sender_name": row.get("sender_name") or "Нэргүй хэрэглэгч",
            "is_mine": str(row.get("sender_id")) == user_id,
            "is_read": str(row.get("id")) in read_ids or str(row.get("sender_id")) == user_id,
        }
        for row in rows
    ]


def list_chat_conversations(user) -> list[dict[str, Any]]:
    user_id = _user_id(user)
    rows = _load_rows(_CHAT_TABLE)
    directory_by_id = {_user_id(candidate): candidate for candidate in _chat_directory()}
    visible = [
        row for row in rows
        if (
            row.get("conversation_id") == "broadcast"
            and _visible_broadcast(row, user)
        )
        or (
            str(row.get("sender_id")) == user_id
            or str(row.get("recipient_id")) == user_id
        )
    ]

    message_ids = [str(row["id"]) for row in visible if row.get("id")]
    read_ids = _read_ids(user_id, message_ids)
    by_conversation: dict[str, list[dict[str, Any]]] = {}
    for row in visible:
        by_conversation.setdefault(str(row.get("conversation_id", "")), []).append(row)

    broadcast_messages = sorted(
        by_conversation.get("broadcast", []),
        key=lambda row: row.get("created_at", ""),
    )
    broadcast_unread = [
        row for row in broadcast_messages
        if row.get("id")
        and str(row["id"]) not in read_ids
        and str(row.get("sender_id")) != user_id
    ]
    latest_broadcast = broadcast_messages[-1] if broadcast_messages else None
    conversations = [{
        "conversation_id": "broadcast",
        "kind": "broadcast",
        "title": "Сургуулийн мэдээлэл",
        "teacher_id": None,
        "unit": None,
        "last_message": latest_broadcast.get("body", "") if latest_broadcast else "",
        "latest_at": latest_broadcast.get("created_at", "") if latest_broadcast else "",
        "unread_message_ids": [str(row["id"]) for row in broadcast_unread],
        "unread_count": len(broadcast_unread),
    }]
    for conversation_id, messages in by_conversation.items():
        if not conversation_id.startswith("private:"):
            continue
        participants = _private_participants(conversation_id, messages)
        if user_id not in participants:
            continue
        other_id = next((participant_id for participant_id in participants if participant_id != user_id), "")
        other = directory_by_id.get(other_id)
        if other is None:
            continue
        messages = sorted(
            messages,
            key=lambda row: row.get("created_at", ""),
        )
        unread_ids = [
            str(row["id"])
            for row in messages
            if row.get("id")
            and str(row.get("id")) not in read_ids
            and str(row.get("sender_id")) != user_id
            and str(row.get("recipient_id")) == user_id
        ]
        latest = messages[-1] if messages else None
        conversations.append({
            "conversation_id": conversation_id,
            "kind": "private",
            "title": _user_name(other),
            "teacher_id": other_id,
            "unit": str(_metadata(other).get("unit", "")),
            "last_message": latest.get("body", "") if latest else "",
            "latest_at": latest.get("created_at", "") if latest else "",
            "unread_message_ids": unread_ids,
            "unread_count": len(unread_ids),
        })

    private = [item for item in conversations if item["kind"] == "private"]
    private.sort(key=lambda item: (item["latest_at"], item["title"]), reverse=True)
    return [conversations[0], *private]


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
