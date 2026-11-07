'use client';

import { ChangeEvent, useState } from 'react';

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
  onUploaded: (file: UploadedFile) => void;
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
    const apiUrl = process.env.NEXT_PUBLIC_BACKEND_URL ?? 'http://127.0.0.1:8000';
    const formData = new FormData();
    formData.append('file', file);
    const response = await fetch(`${apiUrl}/api/files/compress`, { method: 'POST', body: formData });
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

export default function LosslessCloudinaryUpload({
  label,
  formats,
  multiple = false,
  maxFiles = 1,
  onUploaded,
}: Props) {
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const accept = formats.map((format) => `.${format}`).join(',');

  const uploadFile = async (file: File) => {
    const cloudName = process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME;
    const uploadPreset = process.env.NEXT_PUBLIC_CLOUDINARY_UPLOAD_PRESET;
    if (!cloudName || !uploadPreset) throw new Error('Cloudinary cloud name эсвэл upload preset тохируулаагүй байна.');

    const uploadFile = await compressFile(file);
    const isPdf = uploadFile.type === 'application/pdf' || uploadFile.name.toLowerCase().endsWith('.pdf');
    const resourceType = uploadFile.type.startsWith('image/') || isPdf ? 'image' : 'raw';
    const formData = new FormData();
    formData.append('file', uploadFile);
    formData.append('upload_preset', uploadPreset);
    const response = await fetch(`https://api.cloudinary.com/v1_1/${cloudName}/${resourceType}/upload`, {
      method: 'POST',
      body: formData,
    });
    const result = await response.json();
    if (!response.ok || !result.secure_url) {
      throw new Error(result.error?.message ?? 'Файл upload хийгдсэнгүй.');
    }
    onUploaded({
      name: file.name,
      url: result.secure_url,
      file_type: resourceType === 'image' ? 'image' : 'document',
    });
    setMessage(file.name);
  };

  const handleFiles = async (event: ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(event.target.files ?? []).slice(0, maxFiles);
    if (!files.length) return;
    setBusy(true);
    setMessage('Файл бэлтгэж байна...');
    try {
      for (const file of files) await uploadFile(file);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Файл upload хийгдсэнгүй.');
    } finally {
      setBusy(false);
      event.target.value = '';
    }
  };

  return (
    <div style={{ display: 'grid', gap: 6 }}>
      <label style={{ display: 'inline-flex', width: 'fit-content', alignItems: 'center', padding: '9px 14px', borderRadius: 8, background: busy ? '#94a3b8' : '#0f766e', color: '#fff', fontWeight: 700, cursor: busy ? 'wait' : 'pointer' }}>
        {busy ? 'Upload хийж байна...' : label}
        <input type="file" accept={accept} multiple={multiple} disabled={busy} onChange={(event) => void handleFiles(event)} style={{ display: 'none' }} />
      </label>
      {message && <small role="status" style={{ color: '#64748b' }}>{message}</small>}
    </div>
  );
}
