'use client';

import { useState } from 'react';
import CertificateUpload from '../../../../components/CertificateUpload';
import FloatingComposer from '../records/FloatingComposer';

interface Props {
  onAddTraining: (training: {
    name: string;
    startDate: string;
    endDate: string;
    trainingType: 'Үндсэн' | 'Төрөлжсөн' | 'Сонголтот' | 'Ажлын байран дээрх сургалт' | 'Бусад';
    certificateUrl: string;
    imageUrl?: string;
  }) => void;
}

export default function TrainingForm({ onAddTraining }: Props) {
  const [name, setName] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [trainingType, setTrainingType] = useState<'' | 'Үндсэн' | 'Төрөлжсөн' | 'Сонголтот' | 'Ажлын байран дээрх сургалт' | 'Бусад'>('');
  const [certificateUrl, setCertificateUrl] = useState('');
  const [imageUrl, setImageUrl] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name || !trainingType || !startDate || !endDate || !certificateUrl) {
      alert('Сургалтын нэр, төрөл, огноо болон сертификатын файлыг заавал оруулна уу!');
      return;
    }

    onAddTraining({
      name,
      startDate,
      endDate,
      trainingType,
      certificateUrl,
      imageUrl: imageUrl || undefined,
    });

    setName('');
    setStartDate('');
    setEndDate('');
    setTrainingType('');
    setCertificateUrl('');
    setImageUrl('');
  };

  return (
    <FloatingComposer title="Шинэ сургалт бүртгэх" label="Шинэ сургалт бүртгэх">
    {(close) => <form onSubmit={(event) => { handleSubmit(event); if (name && trainingType && startDate && endDate && certificateUrl) close(); }} style={{ display: 'grid', gap: 12, backgroundColor: '#f8fafc', padding: '16px', borderRadius: '8px', border: '1px solid #cbd5e1' }}>
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
        <label style={{ fontSize: '12px', fontWeight: 'bold', display: 'grid', gap: 4 }}>
          Сургалтын төрөл *
          <select required value={trainingType} onChange={(event) => setTrainingType(event.target.value as typeof trainingType)} style={{ width: '100%', padding: '8px 12px', borderRadius: '6px', border: '1px solid #cbd5e1', boxSizing: 'border-box' }}>
            <option value="" disabled>Сургалтын төрөл сонгох</option>
            {['Үндсэн', 'Төрөлжсөн', 'Сонголтот', 'Ажлын байран дээрх сургалт', 'Бусад'].map((item) => <option key={item}>{item}</option>)}
          </select>
        </label>

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
            📄 Сертификат *
          </label>
          <CertificateUpload onUploadSuccess={(url) => setCertificateUrl(url)} />
        </div>

        <div>
          <label style={{ fontSize: '12px', fontWeight: 'bold', display: 'block', marginBottom: '4px', color: '#475569' }}>
            🖼️ Зурган файл
          </label>
          <CertificateUpload onUploadSuccess={(url) => setImageUrl(url)} />
        </div>
      </div>

      <button 
        type="submit"
        disabled={!certificateUrl || !trainingType}
        style={{
          backgroundColor: certificateUrl && trainingType ? '#ea580c' : '#cbd5e1',
          color: 'white',
          border: 'none',
          padding: '10px 20px',
          borderRadius: '6px',
          fontWeight: 'bold',
          cursor: certificateUrl && trainingType ? 'pointer' : 'not-allowed',
          width: '100%',
        }}
      >
        Нэмэх & Хадгалах
      </button>
    </form>}
    </FloatingComposer>
  );
}