'use client';

import { UserProfile } from '../types';

interface Props {
  user: UserProfile | null;
  onLogout: () => void;
}

export default function Header({ user, onLogout }: Props) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
        <img 
          src="/logo.png" 
          alt="Logo" 
          style={{ width: '48px', height: '48px', objectFit: 'contain' }} 
          onError={(e) => { e.currentTarget.style.display = 'none'; }} 
        />
        <div>
          <h1 style={{ margin: 0, fontSize: '22px', color: '#0f172a' }}>
            {user?.role === 'admin' ? 'Админ панел' : 'Багшийн систем'} - Хянах самбар
          </h1>
          <p style={{ margin: '2px 0 0 0', color: '#64748b', fontSize: '13px' }}>72-р сургуулийн нэгдсэн систем</p>
        </div>
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
        {user && (
          <div style={{ textAlign: 'right' }}>
            <span style={{ fontSize: '14px', fontWeight: 'bold', display: 'block', color: '#1e293b' }}>
              👤 {user.last_name} {user.first_name}
            </span>
            <small style={{ color: '#64748b', fontSize: '12px' }}>
              {user.role === 'admin' ? '🔑 Системийн Админ' : `👨‍🏫 ${user.unit} - ${user.subject}`}
            </small>
          </div>
        )}
        <button 
          onClick={onLogout} 
          style={{ backgroundColor: '#ef4444', color: 'white', border: 'none', padding: '8px 18px', borderRadius: '8px', cursor: 'pointer', fontWeight: 'bold' }}
        >
          Гарах
        </button>
      </div>
    </div>
  );
}