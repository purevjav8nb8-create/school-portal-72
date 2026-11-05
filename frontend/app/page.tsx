'use client';

import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabaseClient';


export default function DashboardPage() {
  const [user, setUser] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Session бэлэн болохыг шалгах
    const getInitialSession = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      
      if (session?.user) {
        setUser(session.user);
        setLoading(false);
      } else {
        // Хэрэв session байхгүй бол 0.5 секунд хүлээгээд дахин шалгана
        setTimeout(async () => {
          const { data: { session: retrySession } } = await supabase.auth.getSession();
          if (retrySession?.user) {
            setUser(retrySession.user);
          } else {
            window.location.href = '/';
          }
          setLoading(false);
        }, 500);
      }
    };

    getInitialSession();

    // Auth төлөв өөрчлөгдөх үед чагнаж унших
    const { data: authListener } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === 'SIGNED_IN' && session) {
        setUser(session.user);
        setLoading(false);
      } else if (event === 'SIGNED_OUT') {
        window.location.href = '/';
      }
    });

    return () => {
      authListener.subscription.unsubscribe();
    };
  }, []);

  const handleLogout = async () => {
    await supabase.auth.signOut();
    window.location.href = '/';
  };

  if (loading) {
    return (
      <div style={{
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center',
        minHeight: '100vh',
        fontFamily: 'sans-serif'
      }}>
        <h2>Ачаалж байна...</h2>
      </div>
    );
  }

  return (
    <div style={{ padding: '32px', fontFamily: 'sans-serif' }}>
      <div style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: '24px',
        borderBottom: '1px solid #e2e8f0',
        paddingBottom: '16px'
      }}>
        <h1 style={{ fontSize: '24px', fontWeight: 'bold', margin: 0 }}>
          72 дугаар сургууль - Багшийн систем
        </h1>
        <button
          onClick={handleLogout}
          style={{
            padding: '8px 16px',
            backgroundColor: '#ef4444',
            color: 'white',
            border: 'none',
            borderRadius: '6px',
            cursor: 'pointer'
          }}
        >
          Гарчлах
        </button>
      </div>

      <div style={{
        backgroundColor: '#f8fafc',
        padding: '20px',
        borderRadius: '8px',
        border: '1px solid #e2e8f0'
      }}>
        <h2>Тавтай морил!</h2>
        <p>И-мэйл: <strong>{user?.email}</strong></p>
        <p>Системд амжилттай нэвтэрлээ.</p>
      </div>
    </div>
  );
}