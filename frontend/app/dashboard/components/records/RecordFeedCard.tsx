'use client';

import { ReactNode } from 'react';
import { FileText } from 'lucide-react';
import FileAttachmentActions from './FileAttachmentActions';
import { AnnouncementAttachment, isPdfAttachment } from './AnnouncementAttachments';
import { formatTeacherName } from '../../utils/teacherName';

interface Props {
  label: string;
  title: string;
  description?: string;
  metadata?: string;
  date?: string;
  author?: string;
  status?: string;
  imageUrl?: string;
  attachments?: AnnouncementAttachment[];
  action?: ReactNode;
}

function formatDate(value: string) {
  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return new Date(`${value}T00:00:00`).toLocaleDateString('mn-MN');
  }
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : date.toLocaleString('mn-MN');
}

export default function RecordFeedCard({
  label,
  title,
  description,
  metadata,
  date,
  author,
  status,
  imageUrl,
  attachments = [],
  action,
}: Props) {
  const preview = imageUrl
    ? { name: 'Зураг', url: imageUrl, file_type: 'image' as const }
    : attachments.find((attachment) => attachment.file_type === 'image' && !isPdfAttachment(attachment));
  const pdfPreview = attachments.filter(isPdfAttachment);
  const previewPdf = !preview ? pdfPreview[0] : undefined;
  const otherPdfPreviews = previewPdf ? pdfPreview.slice(1) : pdfPreview;
  const otherAttachments = attachments.filter((attachment) =>
    attachment.url !== preview?.url && attachment.url !== previewPdf?.url && !pdfPreview.includes(attachment),
  );

  return (
    <article style={{ display: 'flex', alignItems: 'stretch', gap: 10, padding: 9, border: '1px solid #e2e8f0', borderRadius: 8, background: '#fff' }}>
      <div style={{ flex: '0 0 96px', width: 96, height: 68, display: 'grid', placeItems: 'center', overflow: 'hidden', borderRadius: 8, background: '#eff6ff', color: '#2563eb' }}>
        {preview
          ? <FileAttachmentActions attachment={preview} inlinePreview previewWidth={96} previewHeight={68} />
          : previewPdf
            ? <FileAttachmentActions attachment={previewPdf} inlinePreview previewWidth={96} previewHeight={68} />
          : <FileText size={28} />}
      </div>
      <div style={{ minWidth: 0, flex: 1 }}>
        <small style={{ color: '#047857' }}>{label}</small>
        <h3 style={{ margin: '2px 0 4px', fontSize: 16 }}>{title}</h3>
        {description && <p style={{ margin: '0 0 5px', whiteSpace: 'pre-wrap', lineHeight: 1.5 }}>{description}</p>}
        {metadata && <p style={{ margin: '0 0 5px', color: '#475569', whiteSpace: 'pre-wrap' }}>{metadata}</p>}
        {status && <span style={{ display: 'inline-block', marginBottom: 5, padding: '3px 8px', borderRadius: 999, background: '#f1f5f9', color: '#475569', fontSize: 12, fontWeight: 700 }}>{status}</span>}
        {otherPdfPreviews.length > 0 && <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 5 }}>
          {otherPdfPreviews.map((attachment) => <FileAttachmentActions key={attachment.url} attachment={attachment} inlinePreview previewWidth={144} previewHeight={100} />)}
        </div>}
        {otherAttachments.length > 0 && <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 5 }}>
          {otherAttachments.map((attachment) => <FileAttachmentActions key={attachment.url} attachment={attachment} showName={false} />)}
        </div>}
        <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
          {(date || author) && <small style={{ color: '#64748b' }}>{date ? formatDate(date) : ''}{date && author ? ' · ' : ''}{author ? formatTeacherName(author) : ''}</small>}
          {action}
        </div>
      </div>
    </article>
  );
}
