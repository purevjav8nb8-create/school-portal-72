'use client';

import { useState } from 'react';
import CertificateUpload from '../../../../components/CertificateUpload';

interface Props {
  onAddTraining: (training: {
    name: string;
    startDate: string;
    endDate: string;
    certificateUrl: string;
    imageUrl?: string;
  }) => void;
}

export default function TrainingForm({ onAddTraining }: Props) {
  const [name, setName] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [certificateUrl, setCertificateUrl] = useState('');
  const [imageUrl, setImageUrl] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name || !startDate || !endDate || !certificateUrl) {
      alert('Сургалтын нэр, огноо болон сертификатын файлыг заавал оруулна уу!');
      return;
    }

    onAddTraining({
      name,
      startDate,
      endDate,
      certificateUrl,
      imageUrl: imageUrl || undefined,
    });

    setName('');
    setStartDate('');
    setEndDate('');
    setCertificateUrl('');
    setImageUrl('');
  };

  return (
    <form onSubmit={handleSubmit} style={{ backgroundColor: '#f8fafc', padding: '16px', borderRadius: '8px', marginBottom: '20px', border: '1px solid #cbd5e1' }}>
      <h4 style={{ margin: '0 0 12px 0', fontSize: '14px', color: '#334155' }}>➕ Шинэ сургалт бүртгэх</h4>
      
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '12px' }}>
        <div>
          <label style={{ fontSize: '12px', fontWeight: 'bold', display: 'block', marginBottom: '4px' }}>Сургалтын нэр *</label>
          <input 
            type="text" 
            placeholder="Сургалтын нэр оруулах..."
            value={name}
            onChange={(e) => setName(e.target.value)}
            required
            style={{ width: '100%', padding: '8px 12px', borderRadius: '6px', border: '1px solid #cbd5e1', boxSizing: 'border-box' }}
          />
        </div>

        <div style={{ display: 'flex', gap: '8px' }}>
          <div style={{ flex: 1 }}>
            <label style={{ fontSize: '12px', fontWeight: 'bold', display: 'block', marginBottom: '4px' }}>Эхэлсэн огноо *</label>
            <input 
              type="date" 
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              required
              style={{ width: '100%', padding: '8px 10px', borderRadius: '6px', border: '1px solid #cbd5e1', boxSizing: 'border-box' }}
            />
          </div>
          <div style={{ flex: 1 }}>
            <label style={{ fontSize: '12px', fontWeight: 'bold', display: 'block', marginBottom: '4px' }}>Дууссан огноо *</label>
            <input 
              type="date" 
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              required
              style={{ width: '100%', padding: '8px 10px', borderRadius: '6px', border: '1px solid #cbd5e1', boxSizing: 'border-box' }}
            />
          </div>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '16px' }}>
        <div>
          <label style={{ fontSize: '12px', fontWeight: 'bold', display: 'block', marginBottom: '4px', color: '#dc2626' }}>
            📄 Сертификат (Cloudinary-аар заавал) *
          </label>
          <CertificateUpload onUploadSuccess={(url) => setCertificateUrl(url)} />
        </div>

        <div>
          <label style={{ fontSize: '12px', fontWeight: 'bold', display: 'block', marginBottom: '4px', color: '#475569' }}>
            🖼️ Зурган файл (Сонголттой)
          </label>
          <CertificateUpload onUploadSuccess={(url) => setImageUrl(url)} />
        </div>
      </div>

      <button 
        type="submit"
        disabled={!certificateUrl}
        style={{
          backgroundColor: certificateUrl ? '#ea580c' : '#cbd5e1',
          color: 'white',
          border: 'none',
          padding: '10px 20px',
          borderRadius: '6px',
          fontWeight: 'bold',
          cursor: certificateUrl ? 'pointer' : 'not-allowed',
          width: '100%',
        }}
      >
        Нэмэх & Хадгалах
      </button>
    </form>
  );
}