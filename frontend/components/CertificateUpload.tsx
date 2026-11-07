'use client';

import { useState } from 'react';
import LosslessCloudinaryUpload from './LosslessCloudinaryUpload';

interface CertificateUploadProps {
  onUploadSuccess: (url: string) => void;
}

export default function CertificateUpload({ onUploadSuccess }: CertificateUploadProps) {
  return (
    <div className="flex flex-col gap-2 p-3 border border-gray-200 rounded-lg bg-gray-50">
      <LosslessCloudinaryUpload
        label="Файл сонгох / Хуулах"
        formats={['pdf', 'png', 'jpeg', 'jpg']}
        onUploaded={(file) => {
          onUploadSuccess(file.url);
        }}
      />
    </div>
  );
}