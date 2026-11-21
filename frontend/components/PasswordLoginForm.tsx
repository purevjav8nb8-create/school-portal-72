'use client';

import { FormEvent, useEffect, useState } from 'react';
import { Eye, EyeOff, LockKeyhole, UserRound } from 'lucide-react';
import { backendBaseUrl } from '../lib/backendApi';
import { supabase } from '../lib/supabaseClient';

export default function PasswordLoginForm() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [remember, setRemember] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const savedLogin = window.localStorage.getItem('school-portal-remember-login');
    if (savedLogin) {
      setEmail(savedLogin);
      setRemember(true);
    }
  }, []);

  const handleLogin = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setErrorMessage('');
    setLoading(true);
    const enteredLogin = email.trim().toLowerCase();
    if (!enteredLogin) {
      setErrorMessage('Нэвтрэх нэр эсвэл и-мэйл хаягаа оруулна уу.');
      setLoading(false);
      return;
    }
    const isEmailAddress = enteredLogin.includes('@');
    if (isEmailAddress && !/^[^@\s]+@moes\.edu\.mn$/.test(enteredLogin)) {
      setErrorMessage('Зөвхөн @moes.edu.mn хаягаар нэвтэрнэ үү.');
      setLoading(false);
      return;
    }
    const loginEmail = enteredLogin === 'admin'
      ? 'admin@moes.edu.mn'
      : isEmailAddress ? enteredLogin : `${enteredLogin}@moes.edu.mn`;

    try {
      if (remember) window.localStorage.setItem('school-portal-remember-login', enteredLogin);
      else window.localStorage.removeItem('school-portal-remember-login');
      const { data, error } = await supabase.auth.signInWithPassword({ email: loginEmail, password });
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
      window.localStorage.removeItem('school-portal-mock-token');
      const isAdmin = data.user?.app_metadata?.role === 'admin' || data.user?.app_metadata?.role === 'manager'
        || data.user?.email?.toLowerCase() === 'admin@moes.edu.mn';
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
        <p role="alert" className="login-error">
          {errorMessage}
        </p>
      )}
      <form onSubmit={handleLogin} className="login-form">
        <label className="login-field">
          <UserRound size={22} aria-hidden="true" />
          <input
            type="text"
            placeholder="Хэрэглэгчийн нэр"
            aria-label="Нэвтрэх нэр эсвэл И-мэйл"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            required
            className="login-input"
          />
        </label>
        <label className="login-field">
          <LockKeyhole size={21} aria-hidden="true" />
          <input
            type={showPassword ? 'text' : 'password'}
            placeholder="Нууц үг"
            aria-label="Нууц үг"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            required
            className="login-input login-password-input"
          />
          <button
            type="button"
            aria-label={showPassword ? 'Нууц үг нуух' : 'Нууц үг харах'}
            onClick={() => setShowPassword((shown) => !shown)}
            className="login-password-toggle"
          >
            {showPassword ? <EyeOff size={20} /> : <Eye size={20} />}
          </button>
        </label>
        <div className="login-options">
          <label>
            <input type="checkbox" checked={remember} onChange={(event) => setRemember(event.target.checked)} />
            <span>Намайг сана</span>
          </label>
        </div>
        <button type="submit" disabled={loading} className="login-submit">
          <span>{loading ? 'Нэвтэрч байна...' : 'Нэвтрэх'}</span>
        </button>
      </form>
    </>
  );
}
