'use client';

import { CldUploadButton } from 'next-cloudinary';
import { useState } from 'react';

interface CertificateUploadProps {
  onUploadSuccess: (url: string) => void;
}

export default function CertificateUpload({ onUploadSuccess }: CertificateUploadProps) {
  const [fileUrl, setFileUrl] = useState<string | null>(null);

  return (
    <div className="flex flex-col gap-2 p-3 border border-gray-200 rounded-lg bg-gray-50">
      <CldUploadButton
        uploadPreset={process.env.NEXT_PUBLIC_CLOUDINARY_UPLOAD_PRESET}
        onSuccess={(result: any) => {
          const uploadedUrl = result?.info?.secure_url;
          if (uploadedUrl) {
            setFileUrl(uploadedUrl);
            onUploadSuccess(uploadedUrl);
          }
        }}
        options={{
          maxFiles: 1,
          clientAllowedFormats: ['pdf', 'png', 'jpeg', 'jpg'],
        }}
        className="w-fit bg-blue-600 hover:bg-blue-700 text-white font-medium px-3 py-1.5 rounded-lg transition text-xs cursor-pointer flex items-center gap-2"
      >
        <span>📁</span> Файл сонгох / Хуулах
      </CldUploadButton>

      {fileUrl && (
        <div className="text-xs text-green-600 font-medium flex items-center gap-1 mt-1">
          <span>✅</span> Файл амжилттай хуулагдлаа!
        </div>
      )}
    </div>
  );
}