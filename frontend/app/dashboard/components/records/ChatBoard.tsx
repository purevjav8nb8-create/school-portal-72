'use client';

import { FormEvent, useCallback, useEffect, useState } from 'react';
import { backendBaseUrl, fetchWithAuth } from '../../../../lib/backendApi';
import ChatMessagesPane from './ChatMessagesPane';
import ChatSidebar from './ChatSidebar';
import { ChatConversation, ChatMessage, ChatUser } from './chatTypes';

async function chatRequest<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetchWithAuth(`${backendBaseUrl}${path}`, {
    ...init,
    headers: {
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
    setSelectedId((current) => current || result[0]?.conversation_id || '');
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
        const result = await chatRequest<ChatUser[]>(`/api/teachers/chat/users?q=${encodeURIComponent(query)}`);
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
        const result = await chatRequest<ChatMessage[]>(`/api/teachers/chat/messages?conversation_id=${encodeURIComponent(selectedId)}`);
        if (!active) return;
        setMessages(result);
        setErrorMessage('');
        await chatRequest<{ read: number }>('/api/teachers/chat/read', {
          method: 'POST',
          body: JSON.stringify({ conversation_id: selectedId }),
        });
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
    if (selectedId === 'broadcast' && targetUnits.length === 0) {
      setErrorMessage('“Бүгд” эсвэл дор хаяж нэг нэгж сонгоно уу.');
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
      if (selectedId === 'broadcast') setTargetUnits([]);
      await loadConversations();
      setMessages(await chatRequest<ChatMessage[]>(
        `/api/teachers/chat/messages?conversation_id=${encodeURIComponent(selectedId)}`,
      ));
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
        <p style={{ margin: '5px 0 0', color: '#64748b', fontSize: 13 }}>Хэрэглэгч хайж хувийн чат эхлүүлэх боломжтой.</p>
      </header>
      {errorMessage && <p role="alert" style={{ margin: 0, color: '#b91c1c' }}>{errorMessage}</p>}
      {loading ? <p>Чат ачаалж байна...</p> : (
        <div className="chat-layout" style={{ display: 'grid', gridTemplateColumns: 'minmax(180px, 250px) minmax(0, 1fr)', minHeight: 360, border: '1px solid #e2e8f0', borderRadius: 8, overflow: 'hidden' }}>
          <ChatSidebar
            conversations={conversations}
            selectedId={selectedId}
            userQuery={userQuery}
            searchResults={searchResults}
            searching={searching}
            onSearch={setUserQuery}
            onUserSelect={(user) => {
              setSelectedUser(user);
              setSelectedId(user.conversation_id);
              setMessages([]);
            }}
            onConversationSelect={(id) => {
              setSelectedUser(null);
              setSelectedId(id);
            }}
          />
          <ChatMessagesPane
            conversation={selectedConversation}
            messages={messages}
            isAdmin={isAdmin}
            draft={draft}
            targetUnits={targetUnits}
            sending={sending}
            onDraftChange={setDraft}
            onTargetUnitsChange={setTargetUnits}
            onSend={(event) => void send(event)}
          />
        </div>
      )}
    </section>
  );
}
