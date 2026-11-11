'use client';

import { FormEvent, useEffect, useState } from 'react';
import { supabase } from '../../../lib/supabaseClient';

export default function ChangePasswordDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [message, setMessage] = useState('');
  const [saving, setSaving] = useState(false);
  useEffect(() => {
    if (open) setMessage('');
  }, [open]);

  const changePassword = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setMessage('');
    if (newPassword !== confirmPassword) {
      setMessage('Нууц үг таарахгүй байна.');
      return;
    }
    setSaving(true);
    try {
      const { error } = await supabase.auth.updateUser({ password: newPassword });
      if (error) throw error;
      setMessage('Нууц үг шинэчлэгдлээ.');
      setNewPassword('');
      setConfirmPassword('');
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Нууц үгийг шинэчилж чадсангүй.');
    } finally {
      setSaving(false);
    }
  };

  if (!open) return null;
  return (
    <div role="presentation" onMouseDown={(event) => event.target === event.currentTarget && onClose()} style={{ position: 'fixed', inset: 0, zIndex: 100, display: 'grid', placeItems: 'center', padding: 16, background: 'rgba(15, 23, 42, .5)' }}>
      <form role="dialog" aria-modal="true" aria-label="Нууц үг солих" onSubmit={(event) => void changePassword(event)} style={{ width: 'min(420px, 100%)', display: 'grid', gap: 12, padding: 20, borderRadius: 14, background: '#fff', boxShadow: '0 20px 60px rgba(15, 23, 42, .25)' }}>
        <h2 style={{ margin: 0, fontSize: 18 }}>Нууц үг солих</h2>
        <label style={{ display: 'grid', gap: 5 }}>Шинэ нууц үг (8+ тэмдэгт)
          <input required type="password" minLength={8} autoComplete="new-password" value={newPassword} onChange={(event) => setNewPassword(event.target.value)} style={{ padding: 9, border: '1px solid #cbd5e1', borderRadius: 7 }} />
        </label>
        <label style={{ display: 'grid', gap: 5 }}>Шинэ нууц үг давтах
          <input required type="password" minLength={8} autoComplete="new-password" value={confirmPassword} onChange={(event) => setConfirmPassword(event.target.value)} style={{ padding: 9, border: '1px solid #cbd5e1', borderRadius: 7 }} />
        </label>
        {message && <p role="status" style={{ margin: 0, color: message.includes('шинэчлэгдлээ') ? '#047857' : '#b91c1c' }}>{message}</p>}
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
          <button type="button" onClick={onClose} style={{ padding: '8px 12px', border: '1px solid #cbd5e1', borderRadius: 7, background: '#fff' }}>Болих</button>
          <button type="submit" disabled={saving} style={{ padding: '8px 12px', border: 0, borderRadius: 7, background: '#2563eb', color: '#fff' }}>{saving ? 'Хадгалж байна...' : 'Хадгалах'}</button>
        </div>
      </form>
    </div>
  );
}
