'use client';
import { Eye, EyeOff } from 'lucide-react';
import { useState } from 'react';
import { supabase } from '../lib/supabaseClient';

export default function LoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [loading, setLoading] = useState(false);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();

    setErrorMsg('');
    setLoading(true);

    const loginEmail =
          email.trim().toLowerCase() === 'admin'
          ? 'admin@moes.edu.mn'
          : email.trim().toLowerCase();

    try {
      const { error } = await supabase.auth.signInWithPassword({
        email: loginEmail,
        password,
      });

     if (error) {
        console.log(error);
        setErrorMsg(error.message);
        } else {
                 window.location.href = '/dashboard';
                }
    } catch (err) {
      setErrorMsg('Сүлжээний алдаа гарлаа. Дахин оролдоно уу.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        minHeight: '100vh',
        backgroundColor: '#f1f5f9',
      }}
    >
      <div
        style={{
          width: '100%',
          maxWidth: '420px',
          padding: '32px',
          backgroundColor: '#ffffff',
          borderRadius: '16px',
          boxShadow: '0 10px 25px rgba(0,0,0,0.08)',
          border: '1px solid #e2e8f0',
        }}
      >
        <div
  style={{
    textAlign: 'center',
    marginBottom: '24px',
  }}
>
  <img
    src="/logo.png"
    alt="School Logo"
    style={{
      width: '90px',
      height: '90px',
      objectFit: 'contain',
      marginBottom: '12px',
    }}
  />

  <h2
    style={{
      fontSize: '30px',
      fontWeight: '700',
      color: '#0f172a',
      margin: 0,
      lineHeight: '1.3',
    }}
  >
    72 дугаар сургууль
    <br />
    Багшийн систем
  </h2>
</div>

        {errorMsg && (
          <div
            style={{
              marginBottom: '16px',
              padding: '12px',
              borderRadius: '8px',
              backgroundColor: '#fef2f2',
              border: '1px solid #fecaca',
              color: '#dc2626',
            }}
          >
            {errorMsg}
          </div>
        )}

        <form
          onSubmit={handleLogin}
          style={{
            display: 'flex',
            flexDirection: 'column',
            gap: '16px',
          }}
        >
          <div>
            <label
              style={{
                display: 'block',
                marginBottom: '6px',
                fontWeight: '600',
              }}
            >
              Нэвтрэх нэр эсвэл И-мэйл:
            </label>

            <input
              type="text"
              placeholder="admin эсвэл teacher@moes.edu.mn"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              style={{
                width: '100%',
                padding: '12px',
                borderRadius: '8px',
                border: '1px solid #cbd5e1',
              }}
            />
          </div>

          <div>
            <label
              style={{
                display: 'block',
                marginBottom: '6px',
                fontWeight: '600',
              }}
            >
              Нууц үг:
            </label>

            <div
              style={{
                position: 'relative',
              }}
            >
              <input
                type={showPassword ? 'text' : 'password'}
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                style={{
                  width: '100%',
                  padding: '12px 48px 12px 12px',
                  borderRadius: '8px',
                  border: '1px solid #cbd5e1',
                }}
              />

              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                style={{
                  position: 'absolute',
                  right: '10px',
                  top: '50%',
                  transform: 'translateY(-50%)',
                  background: 'none',
                  border: 'none',
                  cursor: 'pointer',
                  fontSize: '20px',
                }}
              >
                {showPassword ? (
                   <EyeOff size={20} color="#64748b" />
                  ) : (
                   <Eye size={20} color="#64748b" />
                  )}
              </button>
            </div>
          </div>

          <button
            type="submit"
            disabled={loading}
            style={{
              width: '100%',
              padding: '12px',
              backgroundColor: '#2563eb',
              color: 'white',
              border: 'none',
              borderRadius: '8px',
              fontWeight: '600',
              cursor: 'pointer',
            }}
          >
            {loading ? 'Нэвтэрч байна...' : 'Нэвтрэх'}
          </button>
        </form>
      </div>
    </div>
  );
}