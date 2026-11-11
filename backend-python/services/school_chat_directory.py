from services.school_chat_common import _chat_directory, _metadata, _private_conversation_id, _user_email, _user_id, _user_name, _user_role

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
