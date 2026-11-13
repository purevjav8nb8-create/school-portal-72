'use client';

import { FormEvent } from 'react';
import UnitTargetSelector from './UnitTargetSelector';
import { formatTeacherName } from '../../utils/teacherName';
import { ChatConversation, ChatMessage, chatFieldStyle } from './chatTypes';

interface Props {
  conversation?: ChatConversation;
  messages: ChatMessage[];
  isAdmin: boolean;
  draft: string;
  targetUnits: string[];
  sending: boolean;
  onDraftChange: (draft: string) => void;
  onTargetUnitsChange: (units: string[]) => void;
  onSend: (event: FormEvent<HTMLFormElement>) => void;
}

export default function ChatMessagesPane({
  conversation,
  messages,
  isAdmin,
  draft,
  targetUnits,
  sending,
  onDraftChange,
  onTargetUnitsChange,
  onSend,
}: Props) {
  return (
    <div style={{ display: 'grid', gridTemplateRows: 'auto minmax(180px, 1fr) auto', minWidth: 0 }}>
      <header style={{ padding: '10px 12px', borderBottom: '1px solid #e2e8f0' }}>
        <strong>{conversation ? conversation.kind === 'private' ? formatTeacherName(conversation.title) : conversation.title : 'Чат сонгоно уу'}</strong>
        {conversation?.kind === 'private' && conversation.unit && <small style={{ display: 'block', marginTop: 2, color: '#64748b' }}>{conversation.unit}</small>}
        {conversation?.kind === 'broadcast' && <small style={{ display: 'block', marginTop: 3, color: '#64748b' }}>Хоосон шүүлтүүрээр бүх багшид хүргэнэ.</small>}
      </header>
      <div aria-live="polite" style={{ display: 'flex', flexDirection: 'column', gap: 8, padding: 12, overflowY: 'auto', background: '#fff' }}>
        {messages.map((message) => (
          <article key={message.id} style={{ maxWidth: '90%', alignSelf: message.is_mine ? 'flex-end' : 'flex-start', padding: '8px 10px', borderRadius: 10, background: message.is_mine ? '#dbeafe' : '#f1f5f9', overflowWrap: 'anywhere' }}>
            <small style={{ display: 'block', marginBottom: 3, color: '#64748b' }}>{formatTeacherName(message.sender_name)} · {new Date(message.created_at).toLocaleString()}</small>
            <span style={{ whiteSpace: 'pre-wrap' }}>{message.body}</span>
          </article>
        ))}
        {messages.length === 0 && <p style={{ margin: 'auto', color: '#94a3b8' }}>Мессеж байхгүй байна.</p>}
      </div>
      {conversation && (conversation.kind !== 'broadcast' || isAdmin) ? (
        <form onSubmit={onSend} style={{ display: 'grid', gap: 8, padding: 10, borderTop: '1px solid #e2e8f0' }}>
          {conversation.kind === 'broadcast' && isAdmin && <UnitTargetSelector
            selectedUnits={targetUnits}
            setSelectedUnits={onTargetUnitsChange}
            label="Хүлээн авах нэгж"
            compact
          />}
          <label style={{ display: 'grid', gap: 4, fontWeight: 600 }}>Мессеж
            <textarea required maxLength={5000} rows={2} value={draft} onChange={(event) => onDraftChange(event.target.value)} placeholder="Мессеж бичих..." style={chatFieldStyle} />
          </label>
          <button type="submit" disabled={sending} style={{ justifySelf: 'end', padding: '8px 14px', border: 0, borderRadius: 7, background: sending ? '#94a3b8' : '#2563eb', color: '#fff', cursor: sending ? 'wait' : 'pointer' }}>
            {sending ? 'Илгээж байна...' : 'Илгээх'}
          </button>
        </form>
      ) : <p style={{ margin: 0, padding: 12, borderTop: '1px solid #e2e8f0', color: '#64748b', fontSize: 13 }}>Энэ нь админаас ирсэн нийтэд хүргэх мессеж. Хариулах бол хувийн чатыг сонгоно уу.</p>}
    </div>
  );
}
