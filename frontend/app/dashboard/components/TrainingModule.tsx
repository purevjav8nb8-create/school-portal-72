'use client';

import { useState } from 'react';
import { Teacher } from '../types';
import TrainingForm from './training/TrainingForm';
import TrainingList, { TrainingItem } from './training/TrainingList';
import TrainingModal from './training/TrainingModal';

interface Props {
  displayTeachers: Teacher[];
  isTeacher: boolean;
  myTrainingStatus?: string;
}

export default function TrainingModule({ displayTeachers, isTeacher, myTrainingStatus }: Props) {
  const [selectedTraining, setSelectedTraining] = useState<TrainingItem | null>(null);

  const dummyPdfUrl = 'data:application/pdf;base64,JVBERi0xLjQKJSDi48jNCiAxIDAgb2JqCjw8L1R5cGUvQ2F0YWxvZy9QYWdlcyAyIDAgUj4+CmVuZG9iagoyIDAgb2JqCjw8L1R5cGUvUGFnZXMvQ291bnQgMS9LaWRzWzMgMCBSXT4+CmVuZG9iagozIDAgb2JqCjw8L1R5cGUvUGFnZS9QYXJlbnQgMiAwIFIvTWVkaWFCb3hbMCAwIDYxMiA3OTJdL0NvbnRlbnRzIDQgMCBSPj4KZW5kb2JqCjQgMCBvYmoKPDwvTGVuZ3RoIDI1Pj5zdHJlYW0KQlQKL0YxIDEyIFRmCjEwMCA3MDAgVGQKKFNlcnRpZmljYXRlKSBUagpFVAplbmRzdHJlYW0KZW5kb2JqCnhyZWYKMCA1CjAwMDAwMDAwMDAgNjU1MzUgZiAKMDAwMDAwMDAxNSAwMDAwMCBuIAowMDAwMDAwMDY4IDA0MDAwIG4gCjAwMDAwMDAxMjUgMDAwMDAgbiAKMDAwMDAwMDIxMyAwMDAwMCBuIAp0cmFpbGVyCjw8L1NpemUgNS9Sb290IDEgMCBSPj4Kc3RhcnR4cmVmCjI4OAolJUVPRg==';

  const [trainings, setTrainings] = useState<TrainingItem[]>([
    {
      id: 1,
      name: 'Цахим багшлах ур чадвар',
      startDate: '2026-02-01',
      endDate: '2026-02-15',
      pdfFileName: 'certificate_sample.pdf',
      pdfUrl: dummyPdfUrl,
      createdAt: '2026-02-15'
    }
  ]);

  const handleAddTraining = (data: { name: string; startDate: string; endDate: string; pdfFile: File; imagePreview?: string }) => {
    const pdfBlobUrl = URL.createObjectURL(data.pdfFile);

    const newItem: TrainingItem = {
      id: Date.now(),
      name: data.name,
      startDate: data.startDate,
      endDate: data.endDate,
      pdfFileName: data.pdfFile.name,
      pdfUrl: pdfBlobUrl,
      imagePreview: data.imagePreview,
      createdAt: new Date().toISOString().split('T')[0]
    };

    setTrainings([newItem, ...trainings]);
    alert('Сургалтын мэдээлэл болон сертификат амжилттай бүртгэгдлээ!');
  };

  const handleDeleteTraining = (e: React.MouseEvent, id: number) => {
    e.stopPropagation();
    setTrainings(trainings.filter(t => t.id !== id));
    if (selectedTraining?.id === id) {
      setSelectedTraining(null);
    }
  };

  return (
    <div>
      <h3 style={{ margin: '0 0 16px 0', color: '#0f172a' }}>📚 Сургалтын модуль болон бүртгэл</h3>
      
      <TrainingForm onAddTraining={handleAddTraining} />

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginBottom: '20px' }}>
        <div style={{ padding: '14px', backgroundColor: '#f0fdf4', borderRadius: '8px', border: '1px solid #bbf7d0' }}>
          <small style={{ color: '#166534', fontWeight: 'bold' }}>Хамрагдсан байдал</small>
          <h2 style={{ margin: '4px 0 0 0', color: '#15803d' }}>
            {isTeacher ? myTrainingStatus : `${displayTeachers.filter(t => t.training_status === 'Хамрагдсан').length} багш`}
          </h2>
        </div>
        {!isTeacher && (
          <div style={{ padding: '14px', backgroundColor: '#fef2f2', borderRadius: '8px', border: '1px solid #fecaca' }}>
            <small style={{ color: '#991b1b', fontWeight: 'bold' }}>Хамрагдаагүй багш нар</small>
            <h2 style={{ margin: '4px 0 0 0', color: '#b91c1c' }}>
              {displayTeachers.filter(t => t.training_status === 'Хамрагдаагүй').length} багш
            </h2>
          </div>
        )}
      </div>

      <TrainingList 
        trainings={trainings} 
        onSelectTraining={setSelectedTraining} 
        onDeleteTraining={handleDeleteTraining} 
      />

      <TrainingModal 
        training={selectedTraining} 
        onClose={() => setSelectedTraining(null)} 
      />
    </div>
  );
}