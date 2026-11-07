'use client';

import { cloneElement, ReactElement, ReactNode, useState } from 'react';
import { Plus, X } from 'lucide-react';

interface Props {
  title: string;
  label: string;
  trigger?: ReactElement<{ onClick?: () => void }>;
  headerAction?: ReactNode;
  children: (close: () => void) => ReactNode;
}

export default function FloatingComposer({ title, label, trigger, headerAction, children }: Props) {
  const [open, setOpen] = useState(false);
  const close = () => setOpen(false);

  return (
    <>
      {trigger ? cloneElement(trigger, { onClick: () => setOpen(true) }) : (
        <button
          type="button"
          aria-label={label}
          title={label}
          onClick={() => setOpen(true)}
          style={{
            position: 'fixed',
            right: 24,
            bottom: 24,
            zIndex: 30,
            width: 56,
            height: 56,
            display: 'grid',
            placeItems: 'center',
            border: 0,
            borderRadius: '50%',
            background: '#0f766e',
            color: '#fff',
            boxShadow: '0 6px 20px rgba(15, 118, 110, 0.3)',
            cursor: 'pointer',
          }}
        >
          <Plus size={24} />
        </button>
      )}
      {open && (
        <div
          role="presentation"
          onMouseDown={(event) => { if (event.target === event.currentTarget) close(); }}
          style={{ position: 'fixed', inset: 0, zIndex: 40, display: 'grid', placeItems: 'center', padding: 16, background: 'rgba(15, 23, 42, 0.45)' }}
        >
          <section role="dialog" aria-modal="true" aria-label={title} style={{ width: 'min(640px, 100%)', maxHeight: '90vh', display: 'flex', flexDirection: 'column', overflow: 'hidden', padding: 24, background: '#fff', border: '1px solid #e2e8f0', borderRadius: 16, boxShadow: '0 24px 70px rgba(15, 23, 42, 0.3)' }}>
            <header style={{ flex: '0 0 auto', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12, paddingBottom: 16, borderBottom: '1px solid #e2e8f0' }}>
              <h2 style={{ margin: 0, color: '#172554', fontSize: 20, fontWeight: 800 }}>{title}</h2>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                {headerAction}
                <button type="button" aria-label="Цонх хаах" title="Цонх хаах" onClick={close} style={{ display: 'grid', placeItems: 'center', width: 32, height: 32, border: 0, borderRadius: 8, background: '#f1f5f9', color: '#334155', cursor: 'pointer' }}>
                  <X size={19} />
                </button>
              </div>
            </header>
            <div style={{ flex: '1 1 auto', minHeight: 0, overflowY: 'auto', paddingTop: 20 }}>
              {children(close)}
            </div>
          </section>
        </div>
      )}
    </>
  );
}
