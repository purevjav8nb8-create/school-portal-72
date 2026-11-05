'use client';

import { useState } from 'react';
import { Teacher } from '../types';

interface Props {
  displayTeachers: Teacher[];
}

export default function RatingModule({ displayTeachers }: Props) {
  const [selectedClass, setSelectedClass] = useState<string>('10А');
  const [evalScore, setEvalScore] = useState<string>('');

  const handleSaveRating = () => {
    if (evalScore) {
      alert(`${selectedClass} ангид ${evalScore} онооны үнэлгээ хадгалагдлаа!`);
      setEvalScore('');
    }
  };

  return (
    <div>
      <h3 style={{ margin: '0 0 16px 0', color: '#0f172a' }}>⭐ Анги бүлгийн үнэлгээ оруулах</h3>
      
      {/* Анги бүлэг сонгож үнэлгээ оруулах хэсэг */}
      <div style={{ backgroundColor: '#f8fafc', padding: '16px', borderRadius: '8px', marginBottom: '20px', border: '1px solid #cbd5e1', display: 'flex', gap: '16px', alignItems: 'center' }}>
        <div>
          <label style={{ fontSize: '12px', fontWeight: 'bold', display: 'block', marginBottom: '4px' }}>Анги бүлэг сонгох:</label>
          <select value={selectedClass} onChange={(e) => setSelectedClass(e.target.value)} style={{ padding: '8px 12px', borderRadius: '6px', border: '1px solid #cbd5e1', fontWeight: 'bold' }}>
            <option value="10А">10А анги</option>
            <option value="10Б">10Б анги</option>
            <option value="11А">11А анги</option>
            <option value="12А">12А анги</option>
          </select>
        </div>

        <div style={{ flex: 1 }}>
          <label style={{ fontSize: '12px', fontWeight: 'bold', display: 'block', marginBottom: '4px' }}>Оноо/Үнэлгээ:</label>
          <input 
            type="number" 
            placeholder="Оноо оруулах (0-100)" 
            value={evalScore}
            onChange={(e) => setEvalScore(e.target.value)}
            style={{ width: '90%', padding: '8px 12px', borderRadius: '6px', border: '1px solid #cbd5e1' }}
          />
        </div>

        <button 
          onClick={handleSaveRating}
          style={{ backgroundColor: '#2563eb', color: 'white', border: 'none', padding: '10px 18px', borderRadius: '6px', fontWeight: 'bold', cursor: 'pointer', marginTop: '16px' }}
        >
          Хадгалах
        </button>
      </div>

      <div style={{ maxHeight: '200px', overflowY: 'auto' }}>
        {displayTeachers.map(t => (
          <div key={t.id} style={{ display: 'flex', justifyContent: 'space-between', padding: '10px', borderBottom: '1px solid #e2e8f0' }}>
            <span>{t.last_name} {t.first_name} ({t.subject})</span>
            <span style={{ fontWeight: 'bold', color: '#2563eb' }}>{t.rating} оноо</span>
          </div>
        ))}
      </div>
    </div>
  );
}