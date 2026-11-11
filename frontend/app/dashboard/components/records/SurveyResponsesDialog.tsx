'use client';

import { Survey, normalizeQuestion } from './surveyTypes';

export default function SurveyResponsesDialog({
  survey,
  downloading,
  onDownload,
  onClose,
}: {
  survey: Survey;
  downloading: boolean;
  onDownload: () => void;
  onClose: () => void;
}) {
  const questions = survey.questions?.length ? survey.questions : [{ text: 'Асуулт 1', options: survey.options ?? [] }];
  return <div role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }} style={overlayStyle}>
    <section role="dialog" aria-modal="true" aria-label="Судалгааны хариулт" style={{ width: 'min(900px, 100%)', maxHeight: '85vh', overflow: 'auto', padding: 20, background: '#fff', borderRadius: 10, boxShadow: '0 20px 60px rgba(15, 23, 42, 0.25)' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12 }}>
        <div><h3 style={{ margin: 0 }}>{survey.title}</h3><p style={{ margin: '5px 0 12px', color: '#475569' }}>{survey.description}</p></div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button type="button" disabled={downloading} onClick={onDownload}>{downloading ? 'Татаж байна...' : 'Excel татах'}</button>
          <button type="button" onClick={onClose}>Буцах</button>
        </div>
      </div>
      <section>
        <strong>Хариултын нэгтгэл · {survey.response_ids?.length ?? 0} багш</strong>
        {!!survey.respondent_names?.length && <p style={{ margin: '6px 0', fontSize: 13 }}><strong>Хариулсан багш:</strong> {survey.respondent_names.join(', ')}</p>}
        {questions.map((question, index) => {
          const normalized = normalizeQuestion(question, survey.options);
          const counts = survey.response_summary?.[index] ?? {};
          const values = normalized.type === 'rating' ? Array.from({ length: 11 }, (_, rating) => String(rating))
            : normalized.type === 'short_text' ? Object.keys(counts) : normalized.options;
          const max = Math.max(1, ...values.map((value) => counts[value] ?? 0));
          return <div key={`${survey.id}-summary-${index}`} style={{ marginTop: 14, padding: 12, background: '#f8fafc', borderRadius: 8 }}>
            <strong>{normalized.text}</strong>
            {values.length === 0 ? <p style={{ margin: '8px 0', color: '#64748b' }}>Одоогоор хариулт алга.</p> : values.map((value) => <div key={value} style={{ display: 'grid', gridTemplateColumns: 'minmax(90px, 120px) 1fr 28px', gap: 8, alignItems: 'center', marginTop: 5, fontSize: 13 }}>
              <span style={{ overflowWrap: 'anywhere' }}>{value}</span>
              <div role="img" aria-label={`${value}: ${counts[value] ?? 0}`} style={{ height: 14, background: '#e2e8f0', borderRadius: 99, overflow: 'hidden' }}><div style={{ width: `${((counts[value] ?? 0) / max) * 100}%`, height: '100%', background: '#2563eb', borderRadius: 99 }} /></div>
              <span>{counts[value] ?? 0}</span>
            </div>)}
          </div>;
        })}
      </section>
    </section>
  </div>;
}

const overlayStyle = { position: 'fixed' as const, inset: 0, zIndex: 50, display: 'grid', placeItems: 'center', padding: 16, background: 'rgba(15, 23, 42, 0.5)' };
