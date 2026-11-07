import json
import os
from pathlib import Path
from typing import Any


DEFAULT_DATA_PATH = Path(__file__).resolve().parents[1] / "seed" / "mock_school_data.json"


def mock_data_enabled() -> bool:
    return os.getenv("USE_MOCK_DATA", "false").strip().lower() in {"1", "true", "yes"}


def load_mock_school_data() -> dict[str, Any]:
    path = Path(os.getenv("MOCK_DATA_FILE", str(DEFAULT_DATA_PATH)))
    try:
        with path.open(encoding="utf-8") as file:
            data = json.load(file)
    except (OSError, json.JSONDecodeError) as error:
        raise RuntimeError(f"Туршилтын өгөгдлийн файл уншигдсангүй: {path}") from error
    if not isinstance(data, dict) or not isinstance(data.get("teachers"), list):
        raise RuntimeError("Туршилтын өгөгдлийн формат буруу байна.")
    return data


def get_mock_teacher_by_email(email: str) -> dict[str, Any] | None:
    normalized_email = email.strip().lower()
    return next(
        (
            teacher
            for teacher in load_mock_school_data()["teachers"]
            if teacher.get("email", "").lower() == normalized_email
        ),
        None,
    )


def get_mock_teacher_by_id(auth_id: str) -> dict[str, Any] | None:
    return next(
        (
            teacher
            for teacher in load_mock_school_data()["teachers"]
            if teacher.get("auth_id") == auth_id
        ),
        None,
    )


def update_mock_teacher_attendance(auth_id: str, record: dict[str, str]) -> dict[str, str]:
    data = load_mock_school_data()
    for teacher in data["teachers"]:
        if teacher.get("auth_id") == auth_id:
            records = [item for item in teacher.get("attendance", []) if item.get("date") != record["date"]]
            records.append(record)
            teacher["attendance"] = sorted(records, key=lambda item: item.get("date", ""))
            path = Path(os.getenv("MOCK_DATA_FILE", str(DEFAULT_DATA_PATH)))
            with path.open("w", encoding="utf-8") as file:
                json.dump(data, file, ensure_ascii=False, indent=2)
            return record
    raise KeyError(auth_id)


def update_mock_teacher_classes(auth_id: str, classes: list[dict[str, Any]]) -> list[dict[str, Any]]:
    data = load_mock_school_data()
    for teacher in data["teachers"]:
        if teacher.get("auth_id") == auth_id:
            teacher["teaching_classes"] = classes
            path = Path(os.getenv("MOCK_DATA_FILE", str(DEFAULT_DATA_PATH)))
            with path.open("w", encoding="utf-8") as file:
                json.dump(data, file, ensure_ascii=False, indent=2)
            return classes
    raise KeyError(auth_id)


def update_mock_teacher_portal(auth_id: str, updates: dict[str, Any]) -> dict[str, Any]:
    data = load_mock_school_data()
    for teacher in data["teachers"]:
        if teacher.get("auth_id") == auth_id:
            for key, value in updates.items():
                teacher[key] = value
            path = Path(os.getenv("MOCK_DATA_FILE", str(DEFAULT_DATA_PATH)))
            with path.open("w", encoding="utf-8") as file:
                json.dump(data, file, ensure_ascii=False, indent=2)
            return teacher
    raise KeyError(auth_id)
