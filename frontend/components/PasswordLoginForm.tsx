'use client';

import { FormEvent, useState } from 'react';
import { Eye, EyeOff } from 'lucide-react';
import { backendBaseUrl } from '../lib/backendApi';
import { supabase } from '../lib/supabaseClient';

export default function PasswordLoginForm() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [loading, setLoading] = useState(false);

  const handleLogin = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setErrorMessage('');
    setLoading(true);
    const loginEmail = email.trim().toLowerCase() === 'admin'
      ? 'admin@moes.edu.mn'
      : email.trim().toLowerCase();

    try {
      const { error } = await supabase.auth.signInWithPassword({ email: loginEmail, password });
      if (error) {
        const mockResponse = await fetch(`${backendBaseUrl}/api/teachers/mock-login`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email: loginEmail, password }),
        });
        if (!mockResponse.ok) {
          setErrorMessage(error.message === 'Invalid login credentials'
            ? 'Нэвтрэх нэр эсвэл нууц үг буруу байна. Бүртгэлээ админаар шалгуулна уу.'
            : error.message);
          return;
        }
        const mockSession = await mockResponse.json() as { access_token: string };
        await supabase.auth.signOut();
        window.localStorage.setItem('school-portal-mock-token', mockSession.access_token);
        window.location.href = '/dashboard/teacher';
        return;
      }
      const { data: { user } } = await supabase.auth.getUser();
      window.localStorage.removeItem('school-portal-mock-token');
      const isAdmin = user?.app_metadata?.role === 'admin' || user?.app_metadata?.role === 'manager'
        || user?.email?.toLowerCase() === 'admin@moes.edu.mn';
      window.location.href = isAdmin ? '/dashboard/admin' : '/dashboard/teacher';
    } catch {
      setErrorMessage('Сүлжээний алдаа гарлаа. Дахин оролдоно уу.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      {errorMessage && (
        <p role="alert" style={{ margin: '0 0 16px', padding: 12, borderRadius: 8, background: '#fef2f2', border: '1px solid #fecaca', color: '#dc2626' }}>
          {errorMessage}
        </p>
      )}
      <form onSubmit={handleLogin} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
        <label style={{ display: 'grid', gap: 6, fontWeight: 600 }}>
          Нэвтрэх нэр эсвэл И-мэйл:
          <input
            type="text"
            placeholder="@moes.edu.mn хаягаа оруулна уу"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            required
            className="login-input"
            style={{ width: '100%', padding: 12, borderRadius: 8, border: '1px solid #cbd5e1', boxSizing: 'border-box' }}
          />
        </label>
        <label style={{ display: 'grid', gap: 6, fontWeight: 600 }}>
          Нууц үг:
          <span style={{ position: 'relative' }}>
            <input
              type={showPassword ? 'text' : 'password'}
              placeholder="••••••••"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              required
              className="login-input login-password-input"
              style={{ width: '100%', padding: '12px 48px 12px 12px', borderRadius: 8, border: '1px solid #cbd5e1', boxSizing: 'border-box' }}
            />
            <button
              type="button"
              aria-label={showPassword ? 'Нууц үг нуух' : 'Нууц үг харах'}
              onClick={() => setShowPassword((shown) => !shown)}
              style={{ position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 0, cursor: 'pointer' }}
            >
              {showPassword ? <EyeOff size={20} color="#64748b" /> : <Eye size={20} color="#64748b" />}
            </button>
          </span>
        </label>
        <button
          type="submit"
          disabled={loading}
          style={{ width: '100%', padding: 12, background: '#2563eb', color: '#fff', border: 0, borderRadius: 8, fontWeight: 600, cursor: loading ? 'wait' : 'pointer' }}
        >
          {loading ? 'Нэвтэрч байна...' : 'Нэвтрэх'}
        </button>
        <p style={{ margin: '-6px 0 0', color: '#64748b', fontSize: 13, textAlign: 'center' }}>
          @moes.edu.mn хаягаар нэвтэрнэ.
        </p>
      </form>
    </>
  );
}
