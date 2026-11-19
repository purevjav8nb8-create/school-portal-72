import unittest
from unittest.mock import patch

from fastapi import HTTPException

from services.school_chat_conversations import delete_private_conversation


class SchoolChatDeletionTests(unittest.TestCase):
    def setUp(self):
        self.conversation_id = "private:teacher-1:teacher-2"
        self.rows = [{"sender_id": "teacher-1", "recipient_id": "teacher-2"}]
        self.directory = [
            {"id": "teacher-1", "email": "one@moes.edu.mn"},
            {"id": "teacher-2", "email": "two@moes.edu.mn"},
            {"id": "teacher-3", "email": "three@moes.edu.mn"},
        ]

    @patch("services.school_chat_conversations._delete_conversation_rows")
    @patch("services.school_chat_access._chat_directory")
    @patch("services.school_chat_access._load_conversation_rows")
    def test_participant_can_delete_private_conversation(
        self, load_rows, chat_directory, delete_rows
    ):
        load_rows.return_value = self.rows
        chat_directory.return_value = self.directory

        delete_private_conversation({"id": "teacher-1"}, self.conversation_id)

        delete_rows.assert_called_once_with(self.conversation_id)

    @patch("services.school_chat_conversations._delete_conversation_rows")
    @patch("services.school_chat_access._chat_directory")
    @patch("services.school_chat_access._load_conversation_rows")
    def test_nonparticipant_cannot_delete_private_conversation(
        self, load_rows, chat_directory, delete_rows
    ):
        load_rows.return_value = self.rows
        chat_directory.return_value = self.directory

        with self.assertRaises(HTTPException) as raised:
            delete_private_conversation({"id": "teacher-3"}, self.conversation_id)

        self.assertEqual(raised.exception.status_code, 403)
        delete_rows.assert_not_called()

    @patch("services.school_chat_conversations._delete_conversation_rows")
    def test_broadcast_conversation_cannot_be_deleted(self, delete_rows):
        with self.assertRaises(HTTPException) as raised:
            delete_private_conversation({"id": "teacher-1"}, "broadcast")

        self.assertEqual(raised.exception.status_code, 422)
        delete_rows.assert_not_called()


if __name__ == "__main__":
    unittest.main()
