import unittest
import os
from types import SimpleNamespace
from unittest.mock import Mock, patch

import httpx
from fastapi import HTTPException
from supabase_auth.errors import AuthApiError, AuthRetryableError

from services.mock_school_data import mock_data_enabled
from services.teacher_auth import get_authenticated_user, require_primary_admin


class TeacherAuthTests(unittest.TestCase):
    def test_primary_admin_guard_rejects_manager(self):
        manager = SimpleNamespace(
            id="manager-id",
            email="manager@moes.edu.mn",
            app_metadata={"role": "manager"},
        )
        with patch("services.teacher_auth.get_authenticated_user", return_value=manager):
            with self.assertRaises(HTTPException) as raised:
                require_primary_admin("Bearer manager-token")

        self.assertEqual(raised.exception.status_code, 403)

    def test_primary_admin_guard_accepts_admin_role(self):
        admin = SimpleNamespace(
            id="admin-id",
            email="admin@moes.edu.mn",
            app_metadata={"role": "admin"},
        )
        with patch("services.teacher_auth.get_authenticated_user", return_value=admin):
            self.assertIs(require_primary_admin("Bearer admin-token"), admin)

    def test_mock_data_is_rejected_in_production(self):
        with patch.dict(os.environ, {"ENVIRONMENT": "production", "USE_MOCK_DATA": "true"}):
            with self.assertRaisesRegex(RuntimeError, "production"):
                mock_data_enabled()

    def test_invalid_jwt_remains_unauthorized(self):
        auth = SimpleNamespace(
            get_user=Mock(side_effect=AuthApiError("Invalid JWT", 401, "invalid_jwt"))
        )
        with (
            patch("services.teacher_auth.supabase", SimpleNamespace(auth=auth)),
            patch("services.teacher_auth.mock_data_enabled", return_value=False),
        ):
            with self.assertRaises(HTTPException) as raised:
                get_authenticated_user("Bearer invalid-token")

        self.assertEqual(raised.exception.status_code, 401)
        self.assertEqual(raised.exception.detail, "Нэвтрэх эрх хүчингүй байна.")

    def test_auth_service_unavailable_is_not_reported_as_invalid_login(self):
        auth = SimpleNamespace(
            get_user=Mock(side_effect=AuthRetryableError("Auth unavailable", 503))
        )
        with (
            patch("services.teacher_auth.supabase", SimpleNamespace(auth=auth)),
            patch("services.teacher_auth.mock_data_enabled", return_value=False),
        ):
            with self.assertRaises(HTTPException) as raised:
                get_authenticated_user("Bearer valid-token")

        self.assertEqual(raised.exception.status_code, 503)
        self.assertIn("түр холбогдохгүй", raised.exception.detail)

    def test_auth_network_failure_is_reported_as_service_unavailable(self):
        request = httpx.Request("GET", "https://auth.example.test/user")
        auth = SimpleNamespace(
            get_user=Mock(side_effect=httpx.ConnectError("Connection failed", request=request))
        )
        with (
            patch("services.teacher_auth.supabase", SimpleNamespace(auth=auth)),
            patch("services.teacher_auth.mock_data_enabled", return_value=False),
        ):
            with self.assertRaises(HTTPException) as raised:
                get_authenticated_user("Bearer valid-token")

        self.assertEqual(raised.exception.status_code, 503)
        self.assertIn("түр холбогдохгүй", raised.exception.detail)


if __name__ == "__main__":
    unittest.main()
