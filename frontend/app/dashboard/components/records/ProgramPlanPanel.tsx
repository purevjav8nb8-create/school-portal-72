'use client';

import { FormEvent, useState } from 'react';
import LosslessCloudinaryUpload from '../../../../components/LosslessCloudinaryUpload';
import ClassFields from './ClassFields';
import FileAttachmentActions from './FileAttachmentActions';
import FloatingComposer from './FloatingComposer';

export type ProgramPlan = {
  documentUrl: string;
  note: string;
  grade: number;
  section: string;
  subject: string;
  approved: boolean;
  submittedAt: string;
  reviewedAt?: string;
};

interface Props {
  programPlan?: ProgramPlan;
  unit: string;
  subjects: string[];
  onSubmit: (documentUrl: string, note: string, grade: number, section: string, subject: string) => Promise<void>;
}

export default function ProgramPlanPanel({ programPlan, unit, subjects, onSubmit }: Props) {
  const [documentUrl, setDocumentUrl] = useState('');
  const [note, setNote] = useState('');
  const [grade, setGrade] = useState(0);
  const [section, setSection] = useState('');
  const [subject, setSubject] = useState('');
  const [busy, setBusy] = useState(false);
  const [uploadError, setUploadError] = useState('');
  const [uploadResetKey, setUploadResetKey] = useState(0);
  const fieldStyle = {
    width: '100%',
    padding: '11px 12px',
    border: '1px solid #cbd5e1',
    borderRadius: 8,
    background: '#fff',
    color: '#172033',
    boxSizing: 'border-box' as const,
  };

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!documentUrl) {
      setUploadError('PDF файл заавал хавсаргана.');
      return;
    }
    setUploadError('');
    setBusy(true);
    try {
      await onSubmit(documentUrl, note, grade, section, subject);
      setDocumentUrl('');
      setNote('');
      setUploadResetKey((current) => current + 1);
    } finally {
      setBusy(false);
    }
  };

  return (
    <section style={{ display: 'grid', gap: 18, maxWidth: 720 }}>
      <header>
        <h2 style={{ margin: 0, fontSize: 22, color: '#172033' }}>Хөтөлбөр, төлөвлөгөө</h2>
        <p style={{ margin: '6px 0 0', color: '#64748b' }}>Материалаа илгээгээд баталгаажуулалтын төлөвөө эндээс харна.</p>
      </header>
      <div style={{ padding: 16, background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: 8 }}>
        <span style={{ display: 'inline-flex', padding: '5px 10px', borderRadius: 999, background: programPlan?.approved ? '#dcfce7' : programPlan ? '#fef3c7' : '#e2e8f0', color: programPlan?.approved ? '#166534' : programPlan ? '#92400e' : '#475569', fontWeight: 700, fontSize: 13 }}>
          {programPlan?.approved ? 'Батлагдсан' : programPlan ? 'Админаар хянагдаж байна' : 'Илгээгээгүй'}
        </span>
        {programPlan?.documentUrl && <p style={{ margin: '12px 0 0' }}><FileAttachmentActions attachment={{ name: 'Хөтөлбөр, төлөвлөгөө.pdf', url: programPlan.documentUrl, file_type: 'document' }} /></p>}
        {programPlan && <p style={{ margin: '8px 0 0' }}>{programPlan.grade}-р анги {programPlan.section} бүлэг · {programPlan.subject}</p>}
        {programPlan?.note && <p style={{ margin: '10px 0 0', color: '#475569' }}>{programPlan.note}</p>}
      </div>
      <FloatingComposer title="Хөтөлбөр, төлөвлөгөө оруулах" label="Хөтөлбөр, төлөвлөгөө оруулах">
      {(close) => <form onSubmit={async (event) => { await submit(event); if (documentUrl && grade && section && subject) close(); }} style={{ display: 'grid', gap: 12, padding: 16, border: '1px solid #e2e8f0', borderRadius: 8 }}>
        <h3 style={{ margin: 0, fontSize: 16 }}>Хөтөлбөр илгээх</h3>
        <ClassFields
          unit={unit}
          subjects={subjects}
          grade={grade}
          section={section}
          subject={subject}
          onGradeChange={setGrade}
          onSectionChange={setSection}
          onSubjectChange={setSubject}
        />
          <LosslessCloudinaryUpload
            label="Хөтөлбөр, төлөвлөгөөний файл (зөвхөн PDF)"
            formats={['pdf']}
            required
            resetKey={uploadResetKey}
            onUploaded={(file) => { setDocumentUrl(file.url); setUploadError(''); }}
            onRemoved={() => setDocumentUrl('')}
          />
          {uploadError && <small role="alert" style={{ color: '#b91c1c' }}>{uploadError}</small>}
        <textarea rows={3} value={note} onChange={(event) => setNote(event.target.value)} placeholder="Тайлбар (заавал биш)" style={fieldStyle} />
        <button type="submit" disabled={busy} style={{ padding: '8px 12px', border: 0, borderRadius: 6, background: busy ? '#cbd5e1' : '#0f766e', color: '#fff', fontWeight: 700, cursor: busy ? 'not-allowed' : 'pointer' }}>
          {busy ? 'Илгээж байна...' : 'Хөтөлбөр илгээх'}
        </button>
      </form>}
      </FloatingComposer>
    </section>
  );
}
