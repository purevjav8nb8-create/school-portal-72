'use client';

import { FormEvent, useCallback, useEffect, useState } from 'react';
import { backendBaseUrl, fetchWithAuth } from '../../../../lib/backendApi';
import { supabase } from '../../../../lib/supabaseClient';

type ChatConversation = {
  conversation_id: string;
  kind: 'private' | 'broadcast';
  title: string;
  teacher_id?: string | null;
  unit?: string | null;
  last_message: string;
  latest_at: string;
  unread_count: number;
};

type ChatMessage = {
  id: string;
  sender_id: string;
  sender_name: string;
  body: string;
  created_at: string;
  is_mine: boolean;
  is_read: boolean;
};

type ChatUser = {
  user_id: string;
  conversation_id: string;
  name: string;
  email: string;
  role: string;
  unit: string;
};

const units = ['БАЗАН', 'БУЗАН', 'НУЗАН'] as const;
const fieldStyle = {
  width: '100%',
  padding: 10,
  border: '1px solid #cbd5e1',
  borderRadius: 8,
  boxSizing: 'border-box' as const,
};

async function chatRequest<T>(path: string, init?: RequestInit): Promise<T> {
  const { data: { session } } = await supabase.auth.getSession();
  const token = session?.access_token ?? window.localStorage.getItem('school-portal-mock-token');
  if (!token) throw new Error('Дахин нэвтэрнэ үү.');
  const response = await fetchWithAuth(`${backendBaseUrl}${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${token}`,
      ...(init?.body ? { 'Content-Type': 'application/json' } : {}),
      ...init?.headers,
    },
  });
  let result: unknown;
  try {
    result = await response.json();
  } catch {
    throw new Error(`Чатын серверийн хариу буруу байна (${response.status}).`);
  }
  if (!response.ok) {
    const detail = typeof result === 'object' && result !== null && 'detail' in result
      ? String(result.detail)
      : 'Чатын хүсэлт амжилтгүй боллоо.';
    throw new Error(detail);
  }
  return result as T;
}

export default function ChatBoard({ isAdmin = false }: { isAdmin?: boolean }) {
  const [conversations, setConversations] = useState<ChatConversation[]>([]);
  const [selectedId, setSelectedId] = useState('');
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [userQuery, setUserQuery] = useState('');
  const [searchResults, setSearchResults] = useState<ChatUser[]>([]);
  const [selectedUser, setSelectedUser] = useState<ChatUser | null>(null);
  const [searching, setSearching] = useState(false);
  const [draft, setDraft] = useState('');
  const [targetUnits, setTargetUnits] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');

  const loadConversations = useCallback(async () => {
    const result = await chatRequest<ChatConversation[]>('/api/teachers/chat/conversations');
    setConversations(result);
    setSelectedId((current) =>
      current || result[0]?.conversation_id || '',
    );
    return result;
  }, []);

  useEffect(() => {
    const query = userQuery.trim();
    if (query.length < 2) {
      setSearchResults([]);
      setSearching(false);
      return;
    }

    let active = true;
    setSearching(true);
    const timer = window.setTimeout(async () => {
      try {
        const result = await chatRequest<ChatUser[]>(
          `/api/teachers/chat/users?q=${encodeURIComponent(query)}`,
        );
        if (active) {
          setSearchResults(result);
          setErrorMessage('');
        }
      } catch (error) {
        if (active) setErrorMessage(error instanceof Error ? error.message : 'Хэрэглэгч хайх боломжгүй байна.');
      } finally {
        if (active) setSearching(false);
      }
    }, 250);
    return () => {
      active = false;
      window.clearTimeout(timer);
    };
  }, [userQuery]);

  useEffect(() => {
    let active = true;
    let markExistingRead = true;
    const refresh = async () => {
      try {
        const result = await loadConversations();
        if (markExistingRead) {
          markExistingRead = false;
          await Promise.all(result.filter((conversation) => conversation.unread_count > 0).map((conversation) =>
            chatRequest<{ read: number }>('/api/teachers/chat/read', {
              method: 'POST',
              body: JSON.stringify({ conversation_id: conversation.conversation_id }),
            }),
          ));
          if (active) await loadConversations();
        }
        if (active) setErrorMessage('');
      } catch (error) {
        if (active) setErrorMessage(error instanceof Error ? error.message : 'Чатын жагсаалт уншигдсангүй.');
      } finally {
        if (active) setLoading(false);
      }
    };
    void refresh();
    const interval = window.setInterval(() => { void refresh(); }, 15_000);
    return () => {
      active = false;
      window.clearInterval(interval);
    };
  }, [loadConversations]);

  useEffect(() => {
    if (!selectedId) return;
    let active = true;
    let loadingMessages = false;
    const refreshMessages = async () => {
      if (loadingMessages) return;
      loadingMessages = true;
      try {
        const result = await chatRequest<ChatMessage[]>(
          `/api/teachers/chat/messages?conversation_id=${encodeURIComponent(selectedId)}`,
        );
        if (!active) return;
        setMessages(result);
        await chatRequest<{ read: number }>('/api/teachers/chat/read', {
          method: 'POST',
          body: JSON.stringify({ conversation_id: selectedId }),
        });
        await loadConversations();
      } catch (error) {
        if (active) setErrorMessage(error instanceof Error ? error.message : 'Чатын мессеж уншигдсангүй.');
      } finally {
        loadingMessages = false;
      }
    };
    void refreshMessages();
    const interval = window.setInterval(() => { void refreshMessages(); }, 8_000);
    return () => {
      active = false;
      window.clearInterval(interval);
    };
  }, [loadConversations, selectedId]);

  const send = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!selectedId) return;
    if (!draft.trim()) {
      setErrorMessage('Мессеж бичнэ үү.');
      return;
    }
    setSending(true);
    setErrorMessage('');
    try {
      await chatRequest<{ message: ChatMessage }>('/api/teachers/chat/messages', {
        method: 'POST',
        body: JSON.stringify({
          conversation_id: selectedId,
          body: draft,
          target_units: selectedId === 'broadcast' ? targetUnits : [],
        }),
      });
      setDraft('');
      setSelectedUser(null);
      await loadConversations();
      const updated = await chatRequest<ChatMessage[]>(
        `/api/teachers/chat/messages?conversation_id=${encodeURIComponent(selectedId)}`,
      );
      setMessages(updated);
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : 'Мессеж илгээгдсэнгүй.');
    } finally {
      setSending(false);
    }
  };

  const selectedConversation = conversations.find((item) => item.conversation_id === selectedId)
    ?? (selectedUser?.conversation_id === selectedId ? {
      conversation_id: selectedUser.conversation_id,
      kind: 'private' as const,
      title: selectedUser.name,
      teacher_id: selectedUser.user_id,
      unit: selectedUser.unit,
      last_message: '',
      latest_at: '',
      unread_count: 0,
    } : undefined);

  return (
    <section style={{ display: 'grid', gap: 8, minHeight: 360 }}>
      <header>
        <h2 style={{ margin: 0 }}>Чат</h2>
        <p style={{ margin: '5px 0 0', color: '#64748b', fontSize: 13 }}>
          Хэрэглэгч хайж хувийн чат эхлүүлэх боломжтой.
        </p>
      </header>
      {errorMessage && <p role="alert" style={{ margin: 0, color: '#b91c1c' }}>{errorMessage}</p>}
      {loading ? <p>Чат ачаалж байна...</p> : (
        <div className="chat-layout" style={{ display: 'grid', gridTemplateColumns: 'minmax(180px, 250px) minmax(0, 1fr)', minHeight: 360, border: '1px solid #e2e8f0', borderRadius: 8, overflow: 'hidden' }}>
          <nav aria-label="Чатын жагсаалт" style={{ borderRight: '1px solid #e2e8f0', background: '#f8fafc', overflowY: 'auto' }}>
            <div style={{ display: 'grid', gap: 6, padding: 8, borderBottom: '1px solid #e2e8f0' }}>
              <label htmlFor="chat-user-search" style={{ fontSize: 12, fontWeight: 700, color: '#334155' }}>Хэрэглэгч хайх</label>
              <input
                id="chat-user-search"
                type="search"
                value={userQuery}
                onChange={(event) => setUserQuery(event.target.value)}
                placeholder="Нэр, имэйл эсвэл нэгж..."
                style={{ ...fieldStyle, padding: '7px 8px', borderRadius: 6 }}
              />
              {searching && <small role="status" style={{ color: '#64748b' }}>Хайж байна...</small>}
              {!searching && userQuery.trim().length >= 2 && searchResults.length === 0 && <small style={{ color: '#64748b' }}>Хэрэглэгч олдсонгүй.</small>}
              {searchResults.map((item) => (
                <button
                  type="button"
                  key={item.user_id}
                  onClick={() => {
                    setSelectedUser(item);
                    setSelectedId(item.conversation_id);
                    setMessages([]);
                  }}
                  style={{ display: 'grid', gap: 2, padding: '6px 8px', border: '1px solid #dbeafe', borderRadius: 6, background: '#fff', textAlign: 'left', cursor: 'pointer' }}
                >
                  <strong style={{ color: '#1e3a8a', fontSize: 12 }}>{item.name}</strong>
                  <small style={{ color: '#64748b' }}>{[item.role, item.unit, item.email].filter(Boolean).join(' · ')}</small>
                </button>
              ))}
            </div>
            {conversations.map((conversation) => (
              <button
                type="button"
                key={conversation.conversation_id}
                onClick={() => {
                  setSelectedUser(null);
                  setSelectedId(conversation.conversation_id);
                }}
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
                  <span>{conversation.title}</span>
                  {!!conversation.unread_count && <span style={{ color: '#dc2626' }}>{conversation.unread_count}</span>}
                </span>
                {conversation.unit && <small style={{ color: '#64748b' }}>{conversation.unit}</small>}
                <small style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', color: '#64748b' }}>{conversation.last_message || 'Шинэ чат эхлүүлэх'}</small>
              </button>
            ))}
            {conversations.length === 0 && <p style={{ padding: 12, color: '#64748b' }}>Чат алга.</p>}
          </nav>
          <div style={{ display: 'grid', gridTemplateRows: 'auto minmax(180px, 1fr) auto', minWidth: 0 }}>
            <header style={{ padding: '10px 12px', borderBottom: '1px solid #e2e8f0' }}>
              <strong>{selectedConversation?.title ?? 'Чат сонгоно уу'}</strong>
              {selectedConversation?.kind === 'private' && selectedConversation.unit && <small style={{ display: 'block', marginTop: 2, color: '#64748b' }}>{selectedConversation.unit}</small>}
              {selectedConversation?.kind === 'broadcast' && <small style={{ display: 'block', marginTop: 3, color: '#64748b' }}>Хоосон шүүлтүүрээр бүх багшид хүргэнэ.</small>}
            </header>
            <div aria-live="polite" style={{ display: 'flex', flexDirection: 'column', gap: 8, padding: 12, overflowY: 'auto', background: '#fff' }}>
              {messages.map((message) => (
                <article key={message.id} style={{ maxWidth: '90%', alignSelf: message.is_mine ? 'flex-end' : 'flex-start', padding: '8px 10px', borderRadius: 10, background: message.is_mine ? '#dbeafe' : '#f1f5f9', overflowWrap: 'anywhere' }}>
                  <small style={{ display: 'block', marginBottom: 3, color: '#64748b' }}>{message.sender_name} · {new Date(message.created_at).toLocaleString()}</small>
                  <span style={{ whiteSpace: 'pre-wrap' }}>{message.body}</span>
                </article>
              ))}
              {messages.length === 0 && <p style={{ margin: 'auto', color: '#94a3b8' }}>Мессеж байхгүй байна.</p>}
            </div>
            {selectedConversation && (selectedConversation.kind !== 'broadcast' || isAdmin) ? (
              <form onSubmit={(event) => void send(event)} style={{ display: 'grid', gap: 8, padding: 10, borderTop: '1px solid #e2e8f0' }}>
                {selectedConversation.kind === 'broadcast' && isAdmin && <fieldset style={{ margin: 0, padding: '5px 8px', border: '1px solid #cbd5e1', borderRadius: 7 }}>
                  <legend style={{ fontSize: 12 }}>Хүлээн авах нэгж</legend>
                  {units.map((unit) => <label key={unit} style={{ marginRight: 10, fontSize: 12 }}>
                    <input type="checkbox" checked={targetUnits.includes(unit)} onChange={(event) => setTargetUnits((current) => event.target.checked ? [...current, unit] : current.filter((value) => value !== unit))} /> {unit}
                  </label>)}
                </fieldset>}
                <label style={{ display: 'grid', gap: 4, fontWeight: 600 }}>Мессеж
                  <textarea required maxLength={5000} rows={2} value={draft} onChange={(event) => setDraft(event.target.value)} placeholder="Мессеж бичих..." style={fieldStyle} />
                </label>
                <button type="submit" disabled={sending} style={{ justifySelf: 'end', padding: '8px 14px', border: 0, borderRadius: 7, background: sending ? '#94a3b8' : '#2563eb', color: '#fff', cursor: sending ? 'wait' : 'pointer' }}>
                  {sending ? 'Илгээж байна...' : 'Илгээх'}
                </button>
              </form>
            ) : <p style={{ margin: 0, padding: 12, borderTop: '1px solid #e2e8f0', color: '#64748b', fontSize: 13 }}>Энэ нь админаас ирсэн нийтэд хүргэх мессеж. Хариулах бол хувийн чатыг сонгоно уу.</p>}
          </div>
        </div>
      )}
    </section>
  );
}
