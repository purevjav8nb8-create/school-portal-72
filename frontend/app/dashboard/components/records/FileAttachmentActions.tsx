'use client';

import { useState } from 'react';
import { Download, Eye, X } from 'lucide-react';
import { AnnouncementAttachment } from './AnnouncementAttachments';

interface Props {
  attachment: AnnouncementAttachment;
  inlinePreview?: boolean;
  showName?: boolean;
}

function normalizeCloudinaryUrl(url: string) {
  return url
    .replace('/upload/fl_inline/', '/upload/')
    .replace('/upload/fl_attachment/', '/upload/');
}

function cloudinaryFlag(url: string, flag: string) {
  const normalizedUrl = normalizeCloudinaryUrl(url);
  return normalizedUrl.includes('/upload/') ? normalizedUrl.replace('/upload/', `/upload/${flag}/`) : normalizedUrl;
}

function cloudinaryPdfPreview(url: string) {
  const normalizedUrl = normalizeCloudinaryUrl(url);
  return normalizedUrl.includes('/image/upload/')
    ? normalizedUrl.replace('/image/upload/', '/image/upload/pg_1,f_jpg/')
    : normalizedUrl;
}

export default function FileAttachmentActions({ attachment, inlinePreview = false, showName = true }: Props) {
  const [open, setOpen] = useState(false);
  const extension = attachment.name.split('.').pop()?.toLowerCase();
  const isImage = attachment.file_type === 'image';
  const isPdf = extension === 'pdf' || attachment.file_type === 'document';
  const canPreview = isImage || isPdf;
  const previewUrl = isPdf ? cloudinaryPdfPreview(attachment.url) : normalizeCloudinaryUrl(attachment.url);
  const downloadUrl = cloudinaryFlag(attachment.url, 'fl_attachment');

  if (inlinePreview && canPreview) {
    return (
      <div style={{ display: 'grid', gap: 4, minWidth: 0 }}>
        {isImage ? (
          <img src={previewUrl} alt={attachment.name} style={{ display: 'block', width: '100%', maxWidth: 220, height: 110, objectFit: 'contain', borderRadius: 5, background: '#f8fafc' }} />
        ) : (
          <img src={previewUrl} alt={`${attachment.name} preview`} style={{ display: 'block', width: '100%', maxWidth: 220, height: 110, objectFit: 'contain', borderRadius: 5, background: '#f8fafc' }} />
        )}
        <a href={downloadUrl} title="Файл татах" aria-label={`${attachment.name} татах`} style={{ width: 'fit-content', color: '#0f766e', fontSize: 11, fontWeight: 700 }}>Татах</a>
      </div>
    );
  }

  return (
    <>
      <div style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
        {showName && <span>{attachment.name}</span>}
        {canPreview && (
          <button type="button" title="Файлыг харах" aria-label={`${attachment.name} харах`} onClick={() => setOpen(true)} style={{ display: 'grid', placeItems: 'center', width: 28, height: 28, border: '1px solid #cbd5e1', borderRadius: 6, background: '#fff', cursor: 'pointer' }}>
            <Eye size={16} />
          </button>
        )}
        <a href={downloadUrl} title="Файл татах" aria-label={`${attachment.name} татах`} style={{ display: 'grid', placeItems: 'center', width: 28, height: 28, border: '1px solid #cbd5e1', borderRadius: 6, color: '#0f766e' }}>
          <Download size={16} />
        </a>
      </div>
      {open && (
        <div role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) setOpen(false); }} style={{ position: 'fixed', inset: 0, zIndex: 60, display: 'grid', placeItems: 'center', padding: 16, background: 'rgba(15, 23, 42, 0.55)' }}>
          <section role="dialog" aria-modal="true" aria-label={attachment.name} style={{ width: 'min(1000px, 100%)', height: 'min(85vh, 900px)', display: 'flex', flexDirection: 'column', overflow: 'hidden', borderRadius: 10, background: '#fff' }}>
            <header style={{ flex: '0 0 auto', display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 16px', borderBottom: '1px solid #e2e8f0' }}>
              <strong>{attachment.name}</strong>
              <button type="button" title="Хаах" aria-label="Хаах" onClick={() => setOpen(false)} style={{ display: 'grid', placeItems: 'center', width: 34, height: 34, border: '1px solid #cbd5e1', borderRadius: 6, background: '#fff' }}><X size={18} /></button>
            </header>
            <div style={{ flex: '1 1 auto', minHeight: 0, overflow: 'auto', display: 'grid', placeItems: 'center', padding: 12 }}>
              {isImage || extension === 'pdf'
                ? <img src={previewUrl} alt={attachment.name} style={{ width: extension === 'pdf' ? '75%' : 'auto', maxWidth: '100%', maxHeight: '100%', objectFit: 'contain' }} />
                : <iframe title={attachment.name} src={previewUrl} style={{ width: '100%', height: '100%', minHeight: 360, border: 0 }} />}
            </div>
          </section>
        </div>
      )}
    </>
  );
}
