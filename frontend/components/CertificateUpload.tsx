'use client';

import { useState } from 'react';
import LosslessCloudinaryUpload from './LosslessCloudinaryUpload';

interface CertificateUploadProps {
  label?: string;
  onUploadSuccess: (url: string) => void;
  onRemove?: () => void;
  required?: boolean;
  resetKey?: string | number;
}

export default function CertificateUpload({ label = 'Сертификат (PDF эсвэл зураг)', onUploadSuccess, onRemove, required = false, resetKey }: CertificateUploadProps) {
  return (
    <div className="flex flex-col gap-1">
      <LosslessCloudinaryUpload
        label={label}
        formats={['pdf', 'png', 'jpeg', 'jpg']}
        required={required}
        resetKey={resetKey}
        onUploaded={(file) => {
          onUploadSuccess(file.url);
        }}
        onRemoved={() => onRemove?.()}
      />
    </div>
  );
}