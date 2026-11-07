'use client';

import { UserProfile } from '../types';

interface Props {
  user: UserProfile | null;
  onLogout: () => void;
}

export default function Header({
  user,
  onLogout,
}: Props) {
  return (
    <div
      style={{
        display: 'grid',
        gridTemplateColumns: '110px 1fr auto',
        alignItems: 'center',
        marginBottom: '10px',
        backgroundColor: 'white',
        borderRadius: '16px',
        padding: '0 4px',
        boxShadow:
          '0 2px 10px rgba(0,0,0,0.06)',
      }}
    >
      <div>
        <img
          src="/logo.png"
          alt="Logo"
          style={{
            width: '56px',
            height: '56px',
            objectFit: 'contain',
          }}
        />
      </div>

      <div
        style={{
          textAlign: 'center',
        }}
      >
        <h1
          style={{
            margin: 0,
            fontSize: '20px',
            fontWeight: 800,
            color: '#0f172a',
            lineHeight: 1.1,
          }}
        >
          {user?.role === 'admin' ? 'Админ хяналт самбар' : 'Багшийн самбар'}
        </h1>

        <div
          style={{
            marginTop: '2px',
            fontSize: '11px',
            color: '#64748b',
            fontWeight: 500,
          }}
        >
          72-р сургуулийн нэгдсэн систем
        </div>
      </div>

      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '16px',
        }}
      >
        {user && (
          <div style={{ textAlign: 'right' }}>
            <span
              style={{
                fontSize: '13px',
                fontWeight: 'bold',
                display: 'block',
                color: '#1e293b',
              }}
            >
              👤 {user.last_name} {user.first_name}
            </span>

            <small
              style={{
                color: '#64748b',
                fontSize: '11px',
              }}
            >
              {user.role === 'admin'
                ? '🔑 Системийн Админ'
                : `👨‍🏫 ${user.unit} - ${user.subject}`}
            </small>
          </div>
        )}

        <button
          onClick={onLogout}
          style={{
            backgroundColor: '#ef4444',
            color: 'white',
            border: 'none',
            padding: '2px 4px',
            borderRadius: '8px',
            cursor: 'pointer',
            fontWeight: 'bold',
          }}
        >
          Гарах
        </button>
      </div>
    </div>
  );
}