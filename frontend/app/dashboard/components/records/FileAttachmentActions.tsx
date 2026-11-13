'use client';

import { useState } from 'react';
import { Download, Eye, FileText, X } from 'lucide-react';
import { AnnouncementAttachment, isPdfAttachment } from './AnnouncementAttachments';
import { cloudinaryFlag, cloudinaryPdfPreview, normalizeCloudinaryUrl } from './cloudinaryUrls';

interface Props {
  attachment: AnnouncementAttachment;
  inlinePreview?: boolean;
  showName?: boolean;
  previewWidth?: number;
  previewHeight?: number;
}

function fitPdfUrl(url: string) {
  return `${url.split('#', 1)[0]}#view=FitH&zoom=page-fit`;
}

function AttachmentPreviewDialog({
  attachment,
  previewUrl,
  isImage,
  isPdfPreviewImage,
  onPreviewError,
  onClose,
}: {
  attachment: AnnouncementAttachment;
  previewUrl: string;
  isImage: boolean;
  isPdfPreviewImage: boolean;
  onPreviewError: () => void;
  onClose: () => void;
}) {
  return (
    <div role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }} style={{ position: 'fixed', inset: 0, zIndex: 60, display: 'grid', placeItems: 'center', padding: 16, background: 'rgba(15, 23, 42, 0.55)' }}>
      <section role="dialog" aria-modal="true" aria-label={attachment.name} style={{ width: 'min(1100px, 100%)', height: 'min(92vh, 1000px)', display: 'flex', flexDirection: 'column', overflow: 'hidden', borderRadius: 10, background: '#fff' }}>
        <header style={{ flex: '0 0 auto', display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 16px', borderBottom: '1px solid #e2e8f0' }}>
          <strong>{attachment.name}</strong>
          <button type="button" title="Хаах" aria-label="Хаах" onClick={onClose} style={{ display: 'grid', placeItems: 'center', width: 34, height: 34, border: '1px solid #cbd5e1', borderRadius: 6, background: '#fff' }}><X size={18} /></button>
        </header>
        <div style={{ flex: '1 1 auto', minHeight: 0, overflow: 'hidden', display: 'grid', placeItems: 'center', padding: 12 }}>
          {isImage || isPdfPreviewImage
            ? <img src={previewUrl} alt={attachment.name} onError={() => { if (isPdfPreviewImage) onPreviewError(); }} style={{ display: 'block', width: 'auto', height: 'auto', maxWidth: '100%', maxHeight: '100%', objectFit: 'contain' }} />
            : <iframe title={attachment.name} src={fitPdfUrl(previewUrl)} style={{ width: '100%', height: '100%', minHeight: 0, border: 0 }} />}
        </div>
      </section>
    </div>
  );
}

export default function FileAttachmentActions({
  attachment,
  inlinePreview = false,
  showName = true,
  previewWidth = 220,
  previewHeight = 110,
}: Props) {
  const [open, setOpen] = useState(false);
  const [previewFailed, setPreviewFailed] = useState(false);
  const isPdf = isPdfAttachment(attachment) || attachment.file_type === 'document';
  const isImage = attachment.file_type === 'image' && !isPdf;
  const canPreview = isImage || isPdf;
  const originalPreviewUrl = normalizeCloudinaryUrl(attachment.url);
  const cloudinaryPreviewUrl = isPdf ? cloudinaryPdfPreview(originalPreviewUrl) : originalPreviewUrl;
  const previewUrl = isPdf && previewFailed ? originalPreviewUrl : cloudinaryPreviewUrl;
  const downloadUrl = cloudinaryFlag(attachment.url, 'fl_attachment');
  const isPdfPreviewImage = isPdf && !previewFailed && cloudinaryPreviewUrl.includes('/pg_1,f_jpg/');
  const previewDialog = open && canPreview && <AttachmentPreviewDialog
    attachment={attachment}
    previewUrl={previewUrl}
    isImage={isImage}
    isPdfPreviewImage={isPdfPreviewImage}
    onPreviewError={() => setPreviewFailed(true)}
    onClose={() => setOpen(false)}
  />;

  if (inlinePreview && canPreview) {
    return (
      <>
        <div style={{ position: 'relative', width: previewWidth, maxWidth: '100%', height: previewHeight, overflow: 'hidden', borderRadius: 8, background: '#eff6ff' }}>
          {isImage || isPdfPreviewImage
            ? <img
              src={previewUrl}
              alt={attachment.name}
              onError={() => { if (isPdfPreviewImage) setPreviewFailed(true); }}
              style={{ display: 'block', width: '100%', height: '100%', objectFit: isImage ? 'cover' : 'contain', background: '#fff' }}
            />
            : isPdf
              ? <iframe title={`${attachment.name} preview`} src={fitPdfUrl(previewUrl)} style={{ display: 'block', width: '100%', height: '100%', border: 0 }} />
              : <div aria-hidden="true" style={{ width: '100%', height: '100%', display: 'grid', placeItems: 'center', color: '#2563eb' }}><FileText size={28} /></div>}
          <div style={{ position: 'absolute', right: 4, bottom: 4, display: 'flex', gap: 3, opacity: 0.85 }}>
            <button type="button" onClick={(event) => { event.stopPropagation(); setOpen(true); }} aria-label={`${attachment.name} харах`} title="Файлыг харах" style={imageActionButton}><Eye size={14} /></button>
            <a href={downloadUrl} onClick={(event) => event.stopPropagation()} aria-label={`${attachment.name} татах`} title="Файл татах" style={imageActionButton}><Download size={14} /></a>
          </div>
        </div>
        {previewDialog}
      </>
    );
  }

  return (
    <>
      <div style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
        {showName && <span>{attachment.name}</span>}
        {canPreview && (
          <button type="button" title="Файлыг харах" aria-label={`${attachment.name} харах`} onClick={() => setOpen(true)} style={imageActionButton}>
            <Eye size={16} />
          </button>
        )}
        <a href={downloadUrl} title="Файл татах" aria-label={`${attachment.name} татах`} style={imageActionButton}>
          <Download size={16} />
        </a>
      </div>
      {previewDialog}
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
