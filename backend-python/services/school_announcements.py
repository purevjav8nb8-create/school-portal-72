import os
from datetime import datetime, timezone
from typing import Any
from uuid import uuid4

from fastapi import HTTPException

from database import supabase
from schemas.teacher_records import AnnouncementCreate


def _is_admin(user) -> bool:
    email = (user.email or "").lower()
    configured_email = os.getenv("ADMIN_EMAIL", "admin@moes.edu.mn").lower()
    return (user.app_metadata or {}).get("role") == "admin" or email == configured_email


def list_announcements(current_user=None, kind: str | None = None) -> list[dict[str, Any]]:
    try:
        users = supabase.auth.admin.list_users(per_page=1000)
    except Exception as error:
        raise HTTPException(status_code=503, detail="Зар уншигдсангүй.") from error

    feed = []
    admin_email = os.getenv("ADMIN_EMAIL", "admin@moes.edu.mn").lower()
    for user in users:
        metadata = user.user_metadata or {}
        email = (user.email or "").lower()
        if _is_admin(user):
            for item in (user.app_metadata or {}).get("school_announcements", []):
                targets = item.get("target_units", [])
                current_unit = str((current_user.user_metadata or {}).get("unit", "")).strip().upper() if current_user else ""
                if targets and current_unit not in targets and not (current_user and _is_admin(current_user)):
                    continue
                if kind and item.get("kind", "Зар") != kind:
                    continue
                feed.append({**item, "type": "achievement" if item.get("kind") == "Мэдээлэл" else "announcement"})
        if metadata.get("role") == "teacher" or (email.endswith("@moes.edu.mn") and email != admin_email):
            portal = metadata.get("teacher_portal", {})
            teacher_name = f"{metadata.get('last_name', '')} {metadata.get('first_name', '')}".strip() or user.email
            feed.extend(
                {
                    **item,
                    "type": "achievement" if item.get("kind") == "Мэдээлэл" else "announcement",
                    "author": item.get("author") or teacher_name,
                }
                for item in portal.get("announcements", [])
                if not kind or item.get("kind", "Зар") == kind
                if not item.get("target_units")
                or not current_user
                or _is_admin(current_user)
                or str((current_user.user_metadata or {}).get("unit", "")).strip().upper() in item.get("target_units", [])
            )
            for activity in portal.get("activities", []):
                if activity.get("category") not in {"Амжилт", "Оролцоо"} or (kind and kind != "Мэдээлэл"):
                    continue
                feed.append({
                    "id": activity.get("id"),
                    "type": "achievement",
                    "kind": "Мэдээлэл",
                    "info_type": activity.get("category"),
                    "title": activity.get("title", "Амжилт"),
                    "body": activity.get("note", ""),
                    "createdAt": activity.get("submittedAt", ""),
                    "author": teacher_name,
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
        "target_units": announcement.target_units,
        "kind": announcement.kind,
        "info_type": announcement.info_type,
    }
    try:
        if _is_admin(author_user):
            app_metadata = dict(author_user.app_metadata or {})
            app_metadata["school_announcements"] = [item, *app_metadata.get("school_announcements", [])]
            supabase.auth.admin.update_user_by_id(author_user.id, {"app_metadata": app_metadata})
        else:
            user_metadata = dict(author_user.user_metadata or {})
            portal = dict(user_metadata.get("teacher_portal", {}))
            portal["announcements"] = [item, *portal.get("announcements", [])]
            user_metadata["teacher_portal"] = portal
            supabase.auth.admin.update_user_by_id(author_user.id, {"user_metadata": user_metadata})
    except Exception as error:
        raise HTTPException(status_code=503, detail="Зарыг хадгалж чадсангүй.") from error
    return item
