from typing import Any
from services.school_chat_access import _conversation_messages, _private_participants, _visible_broadcast
from services.school_chat_common import _CHAT_TABLE, _MAX_MESSAGES, _chat_directory, _load_rows, _metadata, _read_ids, _user_id, _user_name

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
