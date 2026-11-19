import unittest
from types import SimpleNamespace
from unittest.mock import Mock, patch

from schemas.teachers import TeacherCreate
from services.teacher_account_mutations import create_teacher_account


class TeacherAccountMutationTests(unittest.TestCase):
    def test_account_without_password_sends_invitation_and_never_returns_password(self):
        created_user = SimpleNamespace(id="teacher-id")
        admin = SimpleNamespace(
            invite_user_by_email=Mock(return_value=SimpleNamespace(user=created_user)),
            create_user=Mock(),
        )
        client = SimpleNamespace(auth=SimpleNamespace(admin=admin))
        teacher = TeacherCreate(
            first_name="Test",
            last_name="Teacher",
            email="teacher@moes.edu.mn",
            unit="БАЗАН",
            subject="Математик",
        )

        with (
            patch("services.teacher_account_mutations.supabase", client),
            patch("services.teacher_account_mutations.save_teacher_profile"),
        ):
            result = create_teacher_account(teacher)

        admin.invite_user_by_email.assert_called_once()
        admin.create_user.assert_not_called()
        self.assertEqual(result["auth_id"], "teacher-id")
        self.assertTrue(result["invitation_sent"])
        self.assertNotIn("password", result)


if __name__ == "__main__":
    unittest.main()
