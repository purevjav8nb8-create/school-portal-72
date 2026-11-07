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


def list_announcements() -> list[dict[str, Any]]:
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
            feed.extend({**item, "type": "announcement"} for item in (user.app_metadata or {}).get("school_announcements", []))
        if metadata.get("role") == "teacher" or (email.endswith("@moes.edu.mn") and email != admin_email):
            portal = metadata.get("teacher_portal", {})
            teacher_name = f"{metadata.get('last_name', '')} {metadata.get('first_name', '')}".strip() or user.email
            feed.extend(
                {**item, "type": "announcement", "author": item.get("author") or teacher_name}
                for item in portal.get("announcements", [])
            )
            for activity in portal.get("activities", []):
                if activity.get("category") != "Амжилт":
                    continue
                feed.append({
                    "id": activity.get("id"),
                    "type": "achievement",
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


def create_announcement(admin_user, announcement: AnnouncementCreate) -> dict[str, Any]:
    is_admin = _is_admin(admin_user)
    email = (admin_user.email or "").lower()
    is_teacher = (admin_user.user_metadata or {}).get("role") == "teacher" or email.endswith("@moes.edu.mn")
    if not is_admin and not is_teacher:
        raise HTTPException(status_code=403, detail="Зар оруулах эрхгүй байна.")
    item = {
        "id": str(uuid4()),
        "title": announcement.title,
        "body": announcement.body,
        "attachments": [attachment.model_dump() for attachment in announcement.attachments],
        "createdAt": datetime.now(timezone.utc).isoformat(),
        "author": admin_user.email or "Админ",
    }
    try:
        if is_admin:
            app_metadata = dict(admin_user.app_metadata or {})
            app_metadata["school_announcements"] = [item, *app_metadata.get("school_announcements", [])]
            supabase.auth.admin.update_user_by_id(admin_user.id, {"app_metadata": app_metadata})
        else:
            user_metadata = dict(admin_user.user_metadata or {})
            portal = dict(user_metadata.get("teacher_portal", {}))
            portal["announcements"] = [item, *portal.get("announcements", [])]
            user_metadata["teacher_portal"] = portal
            supabase.auth.admin.update_user_by_id(admin_user.id, {"user_metadata": user_metadata})
    except Exception as error:
        raise HTTPException(status_code=503, detail="Зарыг хадгалж чадсангүй.") from error
    return item
