'use client';

import { formatTeacherName } from '../../utils/teacherName';
import { ChatConversation, ChatUser, chatFieldStyle } from './chatTypes';

interface Props {
  conversations: ChatConversation[];
  selectedId: string;
  userQuery: string;
  searchResults: ChatUser[];
  searching: boolean;
  onSearch: (query: string) => void;
  onUserSelect: (user: ChatUser) => void;
  onConversationSelect: (id: string) => void;
}

export default function ChatSidebar({
  conversations,
  selectedId,
  userQuery,
  searchResults,
  searching,
  onSearch,
  onUserSelect,
  onConversationSelect,
}: Props) {
  return (
    <nav aria-label="Чатын жагсаалт" style={{ borderRight: '1px solid #e2e8f0', background: '#f8fafc', overflowY: 'auto' }}>
      <div style={{ display: 'grid', gap: 6, padding: 8, borderBottom: '1px solid #e2e8f0' }}>
        <label htmlFor="chat-user-search" style={{ fontSize: 12, fontWeight: 700, color: '#334155' }}>Хэрэглэгч хайх</label>
        <input
          id="chat-user-search"
          type="search"
          value={userQuery}
          onChange={(event) => onSearch(event.target.value)}
          placeholder="Нэр, имэйл эсвэл нэгж..."
          style={{ ...chatFieldStyle, padding: '7px 8px', borderRadius: 6 }}
        />
        {searching && <small role="status" style={{ color: '#64748b' }}>Хайж байна...</small>}
        {!searching && userQuery.trim().length >= 2 && searchResults.length === 0 && <small style={{ color: '#64748b' }}>Хэрэглэгч олдсонгүй.</small>}
        {searchResults.map((item) => (
          <button
            type="button"
            key={item.user_id}
            onClick={() => onUserSelect(item)}
            style={{ display: 'grid', gap: 2, padding: '6px 8px', border: '1px solid #dbeafe', borderRadius: 6, background: '#fff', textAlign: 'left', cursor: 'pointer' }}
          >
            <strong style={{ color: '#1e3a8a', fontSize: 12 }}>{formatTeacherName(item.name)}</strong>
            <small style={{ color: '#64748b' }}>{[item.role, item.unit, item.email].filter(Boolean).join(' · ')}</small>
          </button>
        ))}
      </div>
      {conversations.map((conversation) => (
        <button
          type="button"
          key={conversation.conversation_id}
          onClick={() => onConversationSelect(conversation.conversation_id)}
          style={{
            display: 'grid',
            gap: 4,
            width: '100%',
            padding: 11,
            border: 0,
            borderBottom: '1px solid #e2e8f0',
            background: selectedId === conversation.conversation_id ? '#dbeafe' : 'transparent',
            textAlign: 'left',
            cursor: 'pointer',
          }}
        >
          <span style={{ display: 'flex', justifyContent: 'space-between', gap: 6, fontWeight: 700, color: '#172554' }}>
            <span>{conversation.kind === 'private' ? formatTeacherName(conversation.title) : conversation.title}</span>
            {!!conversation.unread_count && <span style={{ color: '#dc2626' }}>{conversation.unread_count}</span>}
          </span>
          {conversation.unit && <small style={{ color: '#64748b' }}>{conversation.unit}</small>}
          <small style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', color: '#64748b' }}>{conversation.last_message || 'Шинэ чат эхлүүлэх'}</small>
        </button>
      ))}
      {conversations.length === 0 && <p style={{ padding: 12, color: '#64748b' }}>Чат алга.</p>}
    </nav>
  );
}
