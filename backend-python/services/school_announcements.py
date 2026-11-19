import os
from datetime import datetime, timezone
from typing import Any
from uuid import uuid4

from fastapi import HTTPException

from schemas.teacher_records import AnnouncementCreate
from services.teacher_portal_storage import (
    list_portal_records,
    list_school_announcements,
    save_school_announcement,
)

_PUBLIC_INFO_TYPES = {"Амжилт", "Олимпиад", "Уралдаан, тэмцээн"}
_PRIVATE_INFO_TYPES = {"Оролцоо"}


def _is_admin(user) -> bool:
    email = (user.email or "").lower()
    configured_email = os.getenv("ADMIN_EMAIL", "admin@moes.edu.mn").lower()
    return (user.app_metadata or {}).get("role") in {"admin", "manager"} or email == configured_email


def _can_view_announcement(item: dict[str, Any], author_id: str, current_user) -> bool:
    if not current_user:
        return True
    if _is_admin(current_user):
        return True

    info_type = item.get("info_type")
    if item.get("kind") == "Мэдээлэл" and info_type in _PRIVATE_INFO_TYPES:
        return current_user.id == author_id
    if item.get("kind") == "Мэдээлэл" and info_type in _PUBLIC_INFO_TYPES:
        return True

    targets = item.get("target_units", [])
    current_unit = str((current_user.user_metadata or {}).get("unit", "")).strip().upper()
    return not targets or current_unit in targets


def list_announcements(current_user=None, kind: str | None = None) -> list[dict[str, Any]]:
    feed = []
    for row in list_school_announcements():
        item = row.get("payload") or {}
        owner_id = str(row.get("owner_id", ""))
        if kind and item.get("kind", "Зар") != kind:
            continue
        if not _can_view_announcement(item, owner_id, current_user):
            continue
        feed.append({**item, "type": "achievement" if item.get("kind") == "Мэдээлэл" else "announcement"})

    for row in list_portal_records("activities"):
        activity = row.get("payload") or {}
        if activity.get("category") not in _PUBLIC_INFO_TYPES or (kind and kind != "Мэдээлэл"):
            continue
        feed.append({
            "id": activity.get("id"),
            "type": "achievement",
            "kind": "Мэдээлэл",
            "info_type": activity.get("category"),
            "title": activity.get("title", "Амжилт"),
            "body": activity.get("note", ""),
            "createdAt": activity.get("submittedAt", ""),
            "author": row.get("teacher_name") or activity.get("author", ""),
            "attachments": activity.get("attachments", []) + [
                {"name": f"Зураг {index + 1}", "url": image, "file_type": "image"}
                for index, image in enumerate(activity.get("images", []))
            ],
            "review_status": activity.get("review_status", "pending"),
        })
    return sorted(feed, key=lambda item: item.get("createdAt", ""), reverse=True)


def create_announcement(author_user, announcement: AnnouncementCreate) -> dict[str, Any]:
    item = {
        "id": str(uuid4()),
        "title": announcement.title,
        "body": announcement.body,
        "attachments": [attachment.model_dump() for attachment in announcement.attachments],
        "createdAt": datetime.now(timezone.utc).isoformat(),
        "author": author_user.email or "Админ",
        "target_units": (
            []
            if announcement.kind == "Мэдээлэл" and announcement.info_type in _PUBLIC_INFO_TYPES
            else announcement.target_units
        ),
        "kind": announcement.kind,
        "info_type": announcement.info_type,
    }
    try:
        save_school_announcement(author_user, item)
    except Exception as error:
        raise HTTPException(status_code=503, detail="Зарыг хадгалж чадсангүй.") from error
    return item
