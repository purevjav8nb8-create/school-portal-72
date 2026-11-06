'use client';

import { LINKS } from '../constants/links';

function buttonStyle(color: string) {
  return {
    backgroundColor: color,
    color: 'white',
    border: 'none',
    padding: '12px',
    borderRadius: '10px',
    fontWeight: 'bold' as const,
    cursor: 'pointer',
    fontSize: '14px',
    width: '100%',
  };
}

export default function QuickActions() {
  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        gap: '12px',
      }}
    >
      <button style={buttonStyle('#107c41')}>
        📊 Excel Тайлан
      </button>

      <button style={buttonStyle('#dc2626')}>
        📄 PDF Тайлан
      </button>

      <button
        style={buttonStyle('#2563eb')}
        onClick={() =>
          window.open(
            LINKS.gmail,
            '_blank'
          )
        }
      >
        📧 Gmail
      </button>

      <button
        style={buttonStyle('#0f766e')}
        onClick={() =>
          window.open(
            LINKS.medle,
            '_blank'
          )
        }
      >
        🏢 Medle Office
      </button>

      <button
        style={buttonStyle('#ea580c')}
        onClick={() =>
          window.open(
            LINKS.mozaik,
            '_blank'
          )
        }
      >
        📖 Mozaik
      </button>

      <button
        style={buttonStyle('#7c3aed')}
        onClick={() =>
          window.open(
            LINKS.lms,
            '_blank'
          )
        }
      >
        📚 Их Нүүдэл LMS
      </button>
    </div>
  );
}
