'use client';

import { ChangeEvent, useEffect, useId, useState } from 'react';
import { Download, Eye, Paperclip, Trash2 } from 'lucide-react';
import { backendBaseUrl } from '../lib/backendApi';

export type UploadedFile = {
  name: string;
  url: string;
  file_type: 'image' | 'document';
};

interface Props {
  label: string;
  formats: string[];
  multiple?: boolean;
  maxFiles?: number;
  required?: boolean;
  resetKey?: string | number;
  onUploaded: (file: UploadedFile) => void;
  onRemoved?: (file: UploadedFile) => void;
}

async function optimizeImage(file: File): Promise<File> {
  if (!file.type.startsWith('image/') || file.type === 'image/svg+xml') return file;
  try {
    const bitmap = await createImageBitmap(file);
    const canvas = document.createElement('canvas');
    canvas.width = bitmap.width;
    canvas.height = bitmap.height;
    const context = canvas.getContext('2d', { alpha: true });
    if (!context) return file;
    context.drawImage(bitmap, 0, 0);
    bitmap.close();
    const outputType = file.type === 'image/png' ? 'image/png' : 'image/webp';
    const optimized = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, outputType, 0.82));
    if (!optimized || optimized.size >= file.size) return file;
    const extension = outputType === 'image/webp' ? 'webp' : 'png';
    const outputName = file.name.replace(/\.[^.]+$/, `.${extension}`);
    return new File([optimized], outputName, { type: outputType, lastModified: file.lastModified });
  } catch {
    throw new Error(`${file.name} зургийг шахаж чадсангүй.`);
  }
}

async function compressFile(file: File): Promise<File> {
  const extension = file.name.toLowerCase().split('.').pop();
  const serverCompressed = file.type === 'application/pdf'
    || extension === 'pdf'
    || extension === 'docx'
    || extension === 'xlsx'
    || extension === 'pptx';
  if (serverCompressed) {
    const formData = new FormData();
    formData.append('file', file);
    const response = await fetch(`${backendBaseUrl}/api/files/compress`, { method: 'POST', body: formData });
    if (!response.ok) {
      if (response.status === 404) return file;
      const result = await response.json().catch(() => ({}));
      throw new Error(result.detail ?? `${file.name} PDF шахалт амжилтгүй боллоо.`);
    }
    const compressed = await response.blob();
    return new File([compressed], file.name, { type: compressed.type || file.type, lastModified: file.lastModified });
  }
  return optimizeImage(file);
}

export async function uploadCloudinaryFile(file: File, formats: string[]): Promise<UploadedFile> {
  const extension = file.name.split('.').pop()?.toLowerCase() ?? '';
  if (!formats.map((format) => format.toLowerCase()).includes(extension)) {
    throw new Error(`${file.name}: зөвшөөрөгдсөн файлын төрөл биш байна.`);
  }
  const cloudName = process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME;
  const uploadPreset = process.env.NEXT_PUBLIC_CLOUDINARY_UPLOAD_PRESET;
  if (!cloudName || !uploadPreset) throw new Error('Cloudinary cloud name эсвэл upload preset тохируулаагүй байна.');

  const optimizedFile = await compressFile(file);
  const isPdf = optimizedFile.type === 'application/pdf' || optimizedFile.name.toLowerCase().endsWith('.pdf');
  const resourceType = optimizedFile.type.startsWith('image/') || isPdf ? 'image' : 'raw';
  const formData = new FormData();
  formData.append('file', optimizedFile);
  formData.append('upload_preset', uploadPreset);
  const response = await fetch(`https://api.cloudinary.com/v1_1/${cloudName}/${resourceType}/upload`, {
    method: 'POST',
    body: formData,
  });
  const result = await response.json();
  if (!response.ok || !result.secure_url) {
    throw new Error(result.error?.message ?? 'Файл upload хийгдсэнгүй.');
  }
  return {
    name: file.name,
    url: result.secure_url,
    file_type: resourceType === 'image' ? 'image' : 'document',
  };
}

export default function LosslessCloudinaryUpload({
  label,
  formats,
  multiple = false,
  maxFiles = 1,
  required = false,
  resetKey,
  onUploaded,
  onRemoved,
}: Props) {
  const inputId = useId();
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const [uploadedFiles, setUploadedFiles] = useState<UploadedFile[]>([]);
  const accept = formats.map((format) => `.${format}`).join(',');

  useEffect(() => {
    setUploadedFiles([]);
  }, [resetKey]);

  const uploadFile = async (file: File) => {
    const uploadedFile = await uploadCloudinaryFile(file, formats);
    setUploadedFiles((current) => multiple ? [...current, uploadedFile].slice(-maxFiles) : [uploadedFile]);
    onUploaded(uploadedFile);
    setMessage('');
  };

  const handleFiles = async (event: ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(event.target.files ?? []).slice(0, maxFiles);
    if (!files.length) return;
    setBusy(true);
    setMessage('');
    try {
      for (const file of files) await uploadFile(file);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Файл upload хийгдсэнгүй.');
    } finally {
      setBusy(false);
      event.target.value = '';
    }
  };

  const removeFile = (file: UploadedFile) => {
    setUploadedFiles((current) => current.filter((item) => item.url !== file.url));
    onRemoved?.(file);
  };

  return (
    <div style={{ display: 'grid', gap: 4, minWidth: 0 }}>
      <div style={{ color: '#334155', fontSize: 12, fontWeight: 600 }}>
        {label}{required && <span aria-hidden="true" style={{ color: '#dc2626', marginLeft: 3 }}>*</span>}
      </div>
      {(multiple || uploadedFiles.length === 0) && (
        <label
          htmlFor={inputId}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 6,
            minHeight: 28,
            padding: '4px 8px',
            border: '1px solid #cbd5e1',
            borderRadius: 4,
            background: busy ? '#f1f5f9' : '#fff',
            color: '#94a3b8',
            fontSize: 11,
            cursor: busy ? 'wait' : 'pointer',
          }}
        >
          <Paperclip size={13} />
          <span>{busy ? 'Файл байршуулж байна...' : 'Энд дарж файл хавсаргана уу.'}</span>
          <input
            id={inputId}
            type="file"
            accept={accept}
            multiple={multiple}
            disabled={busy}
            onChange={(event) => void handleFiles(event)}
            style={{ display: 'none' }}
          />
        </label>
      )}
      {!multiple && uploadedFiles.map((file) => (
        <div key={file.url} style={{ display: 'flex', alignItems: 'center', gap: 6, minWidth: 0, minHeight: 28, padding: '4px 6px', border: '1px solid #cbd5e1', borderRadius: 4, background: '#fff' }}>
          <a href={file.url} target="_blank" rel="noreferrer" title="Файлыг харах" aria-label={`${file.name} харах`} style={{ display: 'grid', placeItems: 'center', color: '#2563eb' }}><Eye size={13} /></a>
          <a href={file.url} target="_blank" rel="noreferrer" style={{ flex: 1, minWidth: 0, overflow: 'hidden', color: '#2563eb', fontSize: 11, textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{file.name}</a>
          <a href={file.url} download title="Файл татах" aria-label={`${file.name} татах`} style={{ display: 'grid', placeItems: 'center', color: '#2563eb' }}><Download size={13} /></a>
          <button type="button" onClick={() => removeFile(file)} title="Файлыг хасах" aria-label={`${file.name} хасах`} style={{ display: 'grid', placeItems: 'center', padding: 0, border: 0, background: 'transparent', color: '#dc2626', cursor: 'pointer' }}><Trash2 size={13} /></button>
        </div>
      ))}
      {message && <small role="alert" style={{ color: '#b91c1c' }}>{message}</small>}
    </div>
  );
}
