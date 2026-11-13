export type ChatConversation = {
  conversation_id: string;
  kind: 'private' | 'broadcast';
  title: string;
  teacher_id?: string | null;
  unit?: string | null;
  last_message: string;
  latest_at: string;
  unread_count: number;
};

export type ChatMessage = {
  id: string;
  sender_id: string;
  sender_name: string;
  body: string;
  created_at: string;
  is_mine: boolean;
  is_read: boolean;
};

export type ChatUser = {
  user_id: string;
  conversation_id: string;
  name: string;
  email: string;
  role: string;
  unit: string;
};

export const chatFieldStyle = {
  width: '100%',
  padding: 10,
  border: '1px solid #cbd5e1',
  borderRadius: 8,
  boxSizing: 'border-box' as const,
};
