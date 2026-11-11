'use client';

import { LINKS } from '../constants/links';

function buttonStyle(color: string) {
  return {
    backgroundColor: color,
    color: 'white',
    border: 'none',
    padding: '9px 10px',
    borderRadius: '10px',
    fontWeight: 'bold' as const,
    cursor: 'pointer',
    fontSize: '12px',
    width: '100%',
  };
}

export default function ExternalLoginLinks() {
  const links = [
    { label: '📧 Gmail', url: LINKS.gmail, color: '#2563eb' },
    { label: '🏢 Medle Office', url: LINKS.medle, color: '#0f766e' },
    { label: '📖 Mozaik', url: LINKS.mozaik, color: '#ea580c' },
    { label: '📚 Их Нүүдэл LMS', url: LINKS.lms, color: '#7c3aed' },
  ];

  return (
    <>
      {links.map((link) => (
        <button
          key={link.label}
          style={buttonStyle(link.color)}
          onClick={() => window.open(link.url, '_blank')}
        >
          {link.label}
        </button>
      ))}
    </>
  );
}
