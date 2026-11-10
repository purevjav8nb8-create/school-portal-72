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
  const [errorMessage, setErrorMessage] = useState('');
  const [uploadResetKey, setUploadResetKey] = useState(0);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name || !trainingType || !startDate || !endDate || !certificateUrl) {
      setErrorMessage('Сургалтын нэр, төрөл, огноо болон сертификатын файлыг заавал оруулна уу.');
      return;
    }
    setErrorMessage('');

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
    setUploadResetKey((current) => current + 1);
  };

  return (
    <FloatingComposer title="Шинэ сургалт бүртгэх" label="Шинэ сургалт бүртгэх">
    {(close) => <form onSubmit={(event) => { handleSubmit(event); if (name && trainingType && startDate && endDate && certificateUrl) close(); }} style={{ display: 'grid', gap: 12, backgroundColor: '#f8fafc', padding: '16px', borderRadius: '8px', border: '1px solid #cbd5e1' }}>
      <h4 style={{ margin: '0 0 12px 0', fontSize: '14px', color: '#334155' }}>➕ Шинэ сургалт бүртгэх</h4>
      
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '12px' }}>
        <label className="required-field-label" style={{ display: 'grid', gap: 4, fontSize: '12px', fontWeight: 'bold' }}>Сургалтын нэр
          <input 
            type="text" 
            placeholder="Сургалтын нэр оруулах..."
            value={name}
            onChange={(e) => setName(e.target.value)}
            required
            style={{ width: '100%', padding: '8px 12px', borderRadius: '6px', border: '1px solid #cbd5e1', boxSizing: 'border-box' }}
          />
        </label>
        <label style={{ fontSize: '12px', fontWeight: 'bold', display: 'grid', gap: 4 }}>
          Сургалтын төрөл
          <select required value={trainingType} onChange={(event) => setTrainingType(event.target.value as typeof trainingType)} style={{ width: '100%', padding: '8px 12px', borderRadius: '6px', border: '1px solid #cbd5e1', boxSizing: 'border-box' }}>
            <option value="" disabled>Сургалтын төрөл сонгох</option>
            {['Үндсэн', 'Төрөлжсөн', 'Сонголтот', 'Ажлын байран дээрх сургалт', 'Бусад'].map((item) => <option key={item}>{item}</option>)}
          </select>
        </label>

        <div style={{ display: 'flex', gap: '8px' }}>
          <label className="required-field-label" style={{ display: 'grid', flex: 1, gap: 4, fontSize: '12px', fontWeight: 'bold' }}>Эхэлсэн огноо
            <input 
              type="date" 
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              required
              style={{ width: '100%', padding: '8px 10px', borderRadius: '6px', border: '1px solid #cbd5e1', boxSizing: 'border-box' }}
            />
          </label>
          <label className="required-field-label" style={{ display: 'grid', flex: 1, gap: 4, fontSize: '12px', fontWeight: 'bold' }}>Дууссан огноо
            <input 
              type="date" 
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              required
              style={{ width: '100%', padding: '8px 10px', borderRadius: '6px', border: '1px solid #cbd5e1', boxSizing: 'border-box' }}
            />
          </label>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '16px' }}>
        <CertificateUpload required resetKey={uploadResetKey} onUploadSuccess={(url) => setCertificateUrl(url)} onRemove={() => setCertificateUrl('')} />
        <CertificateUpload label="Зургийн файл" onUploadSuccess={(url) => setImageUrl(url)} onRemove={() => setImageUrl('')} />
      </div>

      {errorMessage && <p role="alert" style={{ margin: 0, color: '#b91c1c' }}>{errorMessage}</p>}
      <button 
        type="submit"
        style={{
          backgroundColor: '#ea580c',
          color: 'white',
          border: 'none',
          padding: '10px 20px',
          borderRadius: '6px',
          fontWeight: 'bold',
          cursor: 'pointer',
          width: '100%',
        }}
      >
        Нэмэх & Хадгалах
      </button>
    </form>}
    </FloatingComposer>
  );
}