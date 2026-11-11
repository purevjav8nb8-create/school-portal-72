'use client';

import { Dispatch, SetStateAction } from 'react';
import { Survey, SurveyAnswer, SurveyQuestion, normalizeQuestion } from './surveyTypes';

export default function SurveyAnswerDialog({
  survey,
  drafts,
  message,
  saving,
  setDrafts,
  onSubmit,
  onClose,
}: {
  survey: Survey;
  drafts: Record<string, SurveyAnswer>;
  message: string;
  saving: boolean;
  setDrafts: Dispatch<SetStateAction<Record<string, SurveyAnswer>>>;
  onSubmit: (survey: Survey, questions: SurveyQuestion[]) => void;
  onClose: () => void;
}) {
  const questions = survey.questions?.length ? survey.questions : [{ text: 'Асуулт 1', options: survey.options ?? [] }];
  const normalizedQuestions = questions.map((question) => normalizeQuestion(question, survey.options));
  const answeredCount = Object.keys(survey.responses ?? {}).length;
  const complete = answeredCount >= questions.length;
  const expiredIncomplete = !survey.accepts_responses && !complete;
  const hasMissingAnswers = normalizedQuestions.some((question, index) => {
    const value = drafts[`${survey.id}:${index}`] ?? survey.responses?.[index] ?? (question.type === 'rating' ? '5' : undefined);
    return value === undefined || value === '' || (Array.isArray(value) && value.length === 0);
  });

  return <div role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }} style={overlayStyle}>
    <section role="dialog" aria-modal="true" aria-label="Судалгаа бөглөх" style={{ width: 'min(760px, 100%)', maxHeight: '85vh', overflow: 'auto', padding: 20, background: '#fff', borderRadius: 10, boxShadow: '0 20px 60px rgba(15, 23, 42, 0.25)' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12 }}>
        <div><h3 style={{ margin: 0 }}>{survey.title}</h3><p style={{ margin: '5px 0 12px', color: '#475569' }}>{survey.description}</p></div>
        <button type="button" onClick={onClose} style={{ padding: '6px 10px', border: '1px solid #cbd5e1', borderRadius: 6, background: '#fff', cursor: 'pointer' }}>Буцах</button>
      </div>
      {normalizedQuestions.map((question, index) => {
        const key = `${survey.id}:${index}`;
        const savedAnswer = survey.responses?.[index];
        const answer = drafts[key] ?? savedAnswer ?? (question.type === 'rating' ? '5' : undefined);
        const alreadyAnswered = savedAnswer !== undefined;
        return <fieldset key={`${survey.id}-modal-${index}`} style={{ margin: '12px 0', padding: 12, border: '1px solid #e2e8f0', borderRadius: 8 }}>
          <legend style={{ fontWeight: 700 }}>{question.text} <span aria-label="Заавал хариулна" style={{ color: '#dc2626' }}>*</span></legend>
          {question.type === 'single_choice' && question.options.map((option) => <label key={option} style={{ display: 'block', margin: '8px 0' }}>
            <input type="radio" name={`modal-${survey.id}-${index}`} checked={answer === option} disabled={alreadyAnswered} onChange={() => setDrafts((current) => ({ ...current, [key]: option }))} /> {option}
          </label>)}
          {question.type === 'multiple_choice' && question.options.map((option) => {
            const selected = Array.isArray(answer) ? answer : [];
            return <label key={option} style={{ display: 'block', margin: '8px 0' }}>
              <input type="checkbox" checked={selected.includes(option)} disabled={alreadyAnswered} onChange={(event) => setDrafts((current) => ({ ...current, [key]: event.target.checked ? [...selected, option] : selected.filter((item) => item !== option) }))} /> {option}
            </label>;
          })}
          {question.type === 'short_text' && <input type="text" maxLength={1000} value={typeof answer === 'string' ? answer : ''} disabled={alreadyAnswered} onChange={(event) => setDrafts((current) => ({ ...current, [key]: event.target.value }))} placeholder="Хариултаа бичнэ үү" style={fieldStyle} />}
          {question.type === 'rating' && <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}><span>0</span><input type="range" min="0" max="10" step="1" value={typeof answer === 'string' ? answer : '5'} disabled={alreadyAnswered} onChange={(event) => setDrafts((current) => ({ ...current, [key]: event.target.value }))} style={{ flex: 1 }} /><span>10</span><strong>{typeof answer === 'string' ? answer : '5'}</strong></div>}
        </fieldset>;
      })}
      {message && <p role="alert" style={{ color: '#b91c1c' }}>{message}</p>}
      <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 16 }}>
        <button type="button" disabled={saving || complete || expiredIncomplete || hasMissingAnswers} onClick={() => onSubmit(survey, normalizedQuestions)} style={{ padding: '8px 14px', border: 0, borderRadius: 6, background: saving ? '#94a3b8' : '#2563eb', color: '#fff', cursor: saving ? 'default' : 'pointer' }}>
          {saving ? 'Хадгалж байна...' : complete ? 'Хадгалсан' : 'Судалгаа хадгалах'}
        </button>
      </div>
    </section>
  </div>;
}

const fieldStyle = { width: '100%', padding: 9, border: '1px solid #cbd5e1', borderRadius: 7, boxSizing: 'border-box' as const };
const overlayStyle = { position: 'fixed' as const, inset: 0, zIndex: 50, display: 'grid', placeItems: 'center', padding: 16, background: 'rgba(15, 23, 42, 0.5)' };
