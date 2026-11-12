'use client';

import LosslessCloudinaryUpload, { UploadedFile } from '../../../../components/LosslessCloudinaryUpload';

export type AnnouncementAttachment = {
  name: string;
  url: string;
  file_type: 'image' | 'document';
};

export function isPdfAttachment(attachment: Pick<AnnouncementAttachment, 'name' | 'url'>) {
  return /\.pdf(?:$|[?#])/i.test(attachment.name) || /\.pdf(?:$|[?#])/i.test(attachment.url);
}

interface Props {
  attachments: AnnouncementAttachment[];
  onChange: React.Dispatch<React.SetStateAction<AnnouncementAttachment[]>>;
}

const allowedFormats = ['png', 'jpg', 'jpeg', 'webp', 'pdf', 'doc', 'docx', 'xls', 'xlsx', 'ppt', 'pptx'];

export default function AnnouncementAttachments({ attachments, onChange }: Props) {
  return (
    <div style={{ display: 'grid', gap: 8 }}>
      <LosslessCloudinaryUpload
        label="Зураг, PDF эсвэл Office файл хавсаргах"
        formats={allowedFormats}
        multiple
        maxFiles={10}
        onUploaded={(attachment: UploadedFile) => onChange((current) => [...current, attachment])}
      />
      {attachments.map((attachment, index) => (
        <div key={attachment.url} style={{ display: 'flex', justifyContent: 'space-between', gap: 8 }}>
          <a href={attachment.url} target="_blank" rel="noreferrer">{attachment.name}</a>
          <button type="button" onClick={() => onChange((current) => current.filter((_, itemIndex) => itemIndex !== index))}>Хасах</button>
        </div>
      ))}
    </div>
  );
}
