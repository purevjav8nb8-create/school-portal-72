'use client';

import { useState } from 'react';
import { Download, Eye } from 'lucide-react';
import FileAttachmentActions from './FileAttachmentActions';
import { AnnouncementAttachment } from './AnnouncementAttachments';

export type Announcement = {
  id: string;
  type: 'announcement' | 'achievement';
  title: string;
  body: string;
  createdAt: string;
  author: string;
  attachments: AnnouncementAttachment[];
  review_status?: 'pending' | 'approved' | 'rejected';
  target_units?: string[];
  kind?: 'Мэдээлэл' | 'Зар';
  info_type?: 'Амжилт' | 'Оролцоо' | 'Олимпиад' | 'Уралдаан, тэмцээн';
};

export default function AnnouncementFeed({ announcements }: { announcements: Announcement[] }) {
  const [selected, setSelected] = useState<Announcement | null>(null);

  return (
    <>
      {announcements.length === 0 ? <p>Одоогоор зар алга.</p> : (
        <div style={{ display: 'grid', gap: 8 }}>
          {announcements.map((announcement) => (
            <article key={announcement.id} onClick={() => setSelected(announcement)} style={{ display: 'flex', gap: 10, alignItems: 'stretch', padding: 9, border: '1px solid #e2e8f0', borderRadius: 8, cursor: 'pointer', background: '#fff' }}>
              {announcement.attachments?.filter((attachment) => attachment.file_type === 'image').slice(0, 1).map((attachment) => (
                <div key={attachment.url} style={{ flex: '0 0 96px', display: 'flex', alignItems: 'center' }}>
                  <div className="announcement-image-preview" style={{ position: 'relative', width: 96, height: 68 }}>
                    <img src={attachment.url} alt={attachment.name} style={{ width: '100%', height: '100%', objectFit: 'cover', borderRadius: 8 }} />
                    <div className="announcement-image-actions" style={{ position: 'absolute', right: 4, bottom: 4, display: 'flex', gap: 3, opacity: 0.45, transition: 'opacity .2s' }}>
                      <button type="button" onClick={(event) => { event.stopPropagation(); setSelected(announcement); }} aria-label="Зураг харах" title="Зураг харах" style={imageActionButton}><Eye size={14} /></button>
                      <a href={attachment.url} download onClick={(event) => event.stopPropagation()} aria-label="Зураг татах" title="Зураг татах" style={imageActionButton}><Download size={14} /></a>
                    </div>
                  </div>
                </div>
              ))}
              <div style={{ minWidth: 0, flex: 1 }}>
                <small style={{ color: announcement.type === 'achievement' ? '#047857' : '#2563eb' }}>
                  {announcement.kind === 'Мэдээлэл' ? announcement.info_type ?? 'Мэдээлэл' : 'Зар'}
                </small>
                <h3 style={{ margin: '2px 0 4px', fontSize: 16 }}>{announcement.title}</h3>
                <p style={{ margin: '0 0 5px', whiteSpace: 'pre-wrap' }}>{announcement.body}</p>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 4 }}>
                  {announcement.attachments?.filter((attachment) => attachment.file_type !== 'image').map((attachment) => <FileAttachmentActions key={attachment.url} attachment={attachment} showName={false} />)}
                </div>
                <small style={{ color: '#64748b' }}>{new Date(announcement.createdAt).toLocaleString('mn-MN')} · {announcement.author}</small>
              </div>
            </article>
          ))}
        </div>
      )}
      {selected && <div role="presentation" onMouseDown={(event) => event.target === event.currentTarget && setSelected(null)} style={{ position: 'fixed', inset: 0, zIndex: 50, display: 'grid', placeItems: 'center', padding: 16, background: 'rgba(15,23,42,.5)' }}>
        <section role="dialog" aria-modal="true" style={{ width: 'min(680px,100%)', maxHeight: '90vh', overflowY: 'auto', padding: 16, borderRadius: 14, background: '#fff', boxShadow: '0 24px 70px rgba(15,23,42,.3)' }}>
          <header style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid #e2e8f0', paddingBottom: 10 }}><h2 style={{ margin: 0 }}>{selected.title}</h2><button type="button" onClick={() => setSelected(null)} aria-label="Цонх хаах" style={{ border: 0, borderRadius: 8, padding: 8, cursor: 'pointer' }}>×</button></header>
          <p style={{ whiteSpace: 'pre-wrap', lineHeight: 1.6 }}>{selected.body}</p>
          {selected.attachments?.filter((attachment) => attachment.file_type === 'image').map((attachment) => <img key={attachment.url} src={attachment.url} alt={attachment.name} style={{ display: 'block', maxWidth: '100%', maxHeight: 300, objectFit: 'contain', margin: '8px auto', borderRadius: 8 }} />)}
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>{selected.attachments?.filter((attachment) => attachment.file_type !== 'image').map((attachment) => <FileAttachmentActions key={attachment.url} attachment={attachment} />)}</div>
          <small style={{ color: '#64748b' }}>{selected.author} · {new Date(selected.createdAt).toLocaleString('mn-MN')}</small>
        </section>
      </div>}
    </>
  );
}

const imageActionButton = {
  display: 'grid',
  placeItems: 'center',
  width: 20,
  height: 20,
  padding: 0,
  border: '1px solid rgba(255,255,255,.75)',
  borderRadius: 4,
  background: 'rgba(15,23,42,.72)',
  color: '#fff',
  cursor: 'pointer',
};
