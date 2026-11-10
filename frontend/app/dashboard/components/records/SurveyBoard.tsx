'use client';

import { FormEvent, useEffect, useState } from 'react';
import { backendBaseUrl, fetchWithAuth } from '../../../../lib/backendApi';
import { supabase } from '../../../../lib/supabaseClient';
import FloatingComposer from './FloatingComposer';

type SurveyQuestionType = 'single_choice' | 'multiple_choice' | 'short_text' | 'rating';
type SurveyQuestion = { text: string; type: SurveyQuestionType; options: string[] };
type SurveyAnswer = string | string[];
type Survey = { id: string; title: string; description: string; author?: string; questions?: (Partial<SurveyQuestion> | string)[]; options?: string[]; target_units: string[]; responses?: Record<string, SurveyAnswer>; response_ids?: string[]; respondent_names?: string[]; response_summary?: Record<string, Record<string, number>> };

function normalizeQuestion(question: Partial<SurveyQuestion> | string, surveyOptions: string[] = []): SurveyQuestion {
  if (typeof question === 'string') return { text: question, type: 'single_choice', options: surveyOptions };
  return { text: question.text ?? '', type: question.type ?? 'single_choice', options: question.options ?? surveyOptions };
}

export default function SurveyBoard({ isAdmin = false }: { isAdmin?: boolean }) {
  const [surveys, setSurveys] = useState<Survey[]>([]);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [questions, setQuestions] = useState<SurveyQuestion[]>([{ text: '', type: 'single_choice', options: ['', ''] }]);
  const [targetUnits, setTargetUnits] = useState<string[]>([]);
  const [message, setMessage] = useState('');
  const [selectedSurveyId, setSelectedSurveyId] = useState<string>();
  const [answerDrafts, setAnswerDrafts] = useState<Record<string, SurveyAnswer>>({});
  const [savingSurvey, setSavingSurvey] = useState(false);
  const [downloadingSurveyId, setDownloadingSurveyId] = useState<string>();
  const field = { width: '100%', padding: 9, border: '1px solid #cbd5e1', borderRadius: 7, boxSizing: 'border-box' as const };
  const request = async (path: string, method = 'GET', body?: object) => {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) throw new Error('Дахин нэвтэрнэ үү.');
    const response = await fetchWithAuth(`${backendBaseUrl}${path}`, {
      method, headers: { Authorization: `Bearer ${session.access_token}`, ...(body ? { 'Content-Type': 'application/json' } : {}) },
      ...(body ? { body: JSON.stringify(body) } : {}),
    });
    const result = await response.json();
    if (!response.ok) throw new Error(result.detail ?? 'Судалгааны хүсэлт амжилтгүй боллоо.');
    return result;
  };
  const load = async () => { try { setSurveys(await request('/api/teachers/surveys') as Survey[]); } catch (error) { setMessage(error instanceof Error ? error.message : 'Судалгаа уншигдсангүй.'); } };
  useEffect(() => { void load(); }, []);
  const create = async (event: FormEvent<HTMLFormElement>, close: () => void) => {
    event.preventDefault();
    try {
      await request('/api/teachers/surveys', 'POST', { title, description, questions, target_units: targetUnits });
      setTitle(''); setDescription(''); setQuestions([{ text: '', type: 'single_choice', options: ['', ''] }]); setTargetUnits([]); await load(); close();
    } catch (error) { setMessage(error instanceof Error ? error.message : 'Судалгаа үүссэнгүй.'); }
  };
  const submitAnswers = async (survey: Survey, questionsToAnswer: SurveyQuestion[]) => {
    setSavingSurvey(true);
    try {
      const answers = questionsToAnswer.map((question, questionIndex) => ({
        question_index: questionIndex,
        option: answerDrafts[`${survey.id}:${questionIndex}`] ?? survey.responses?.[questionIndex] ?? (question.type === 'rating' ? '5' : ''),
      }));
      await request(`/api/teachers/surveys/${survey.id}/submit`, 'POST', { answers });
      setSurveys((current) => current.map((item) => item.id === survey.id
        ? { ...item, responses: Object.fromEntries(answers.map((answer) => [answer.question_index, answer.option])) }
        : item));
      setMessage('');
    }
    catch (error) { setMessage(error instanceof Error ? error.message : 'Хариулт хадгалагдсангүй.'); }
    finally { setSavingSurvey(false); }
  };
  const downloadAnswers = async (survey: Survey) => {
    setDownloadingSurveyId(survey.id);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error('Дахин нэвтэрнэ үү.');
      const response = await fetchWithAuth(`${backendBaseUrl}/api/teachers/surveys/${survey.id}/export`, {
        headers: { Authorization: `Bearer ${session.access_token}` },
      });
      if (!response.ok) {
        const result = await response.json();
        throw new Error(result.detail ?? 'Excel файл татаж чадсангүй.');
      }
      const url = URL.createObjectURL(await response.blob());
      const link = document.createElement('a');
      link.href = url;
      link.download = `${survey.title.replace(/[^\w\u0400-\u04FF-]+/g, '_')}-хариулт.xlsx`;
      link.click();
      window.setTimeout(() => URL.revokeObjectURL(url), 1000);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Excel файл татаж чадсангүй.');
    } finally {
      setDownloadingSurveyId(undefined);
    }
  };
  return <section>
    <h2 style={{ marginTop: 0 }}>Судалгаа</h2>
    <FloatingComposer title="Судалгаа үүсгэх" label="Судалгаа үүсгэх">{(close) => <form onSubmit={(event) => void create(event, close)} style={{ display: 'grid', gap: 8 }}>
      <label style={{ display: 'grid', gap: 4, fontWeight: 600 }}>Судалгааны нэр
        <input required value={title} onChange={(event) => setTitle(event.target.value)} placeholder="Судалгааны нэр" style={field} />
      </label>
      <textarea value={description} onChange={(event) => setDescription(event.target.value)} placeholder="Тайлбар" style={field} />
      {questions.map((question, questionIndex) => <fieldset key={`question-${questionIndex}`} style={{ display: 'grid', gap: 6, padding: 8, border: '1px solid #cbd5e1', borderRadius: 7 }}>
        <legend>Асуулт {questionIndex + 1}</legend>
        <label style={{ display: 'grid', gap: 4, fontWeight: 600 }}>Асуулт
          <input required value={question.text} onChange={(event) => setQuestions((current) => current.map((item, index) => index === questionIndex ? { ...item, text: event.target.value } : item))} placeholder={`Асуулт ${questionIndex + 1}`} style={field} />
        </label>
        <select value={question.type} onChange={(event) => setQuestions((current) => current.map((item, index) => index === questionIndex ? { ...item, type: event.target.value as SurveyQuestionType, options: ['single_choice', 'multiple_choice'].includes(event.target.value) ? (item.options.length ? item.options : ['', '']) : [] } : item))} style={field}>
          <option value="single_choice">Нэг сонголт</option>
          <option value="multiple_choice">Олон сонголт</option>
          <option value="short_text">Богино текст</option>
          <option value="rating">0–10 үнэлгээ</option>
        </select>
        {['single_choice', 'multiple_choice'].includes(question.type) && <>
          {question.options.map((option, optionIndex) => <label key={optionIndex} style={{ display: 'grid', gap: 4, fontWeight: 600 }}>Сонголт {optionIndex + 1}
            <input required value={option} onChange={(event) => setQuestions((current) => current.map((item, index) => index === questionIndex ? { ...item, options: item.options.map((value, choiceIndex) => choiceIndex === optionIndex ? event.target.value : value) } : item))} placeholder={`Сонголт ${optionIndex + 1}`} style={field} />
          </label>)}
          <button type="button" onClick={() => setQuestions((current) => current.map((item, index) => index === questionIndex ? { ...item, options: [...item.options, ''] } : item))}>+ Сонголт нэмэх</button>
        </>}
      </fieldset>)}
      <button type="button" onClick={() => setQuestions((current) => [...current, { text: '', type: 'single_choice', options: ['', ''] }])}>+ Асуулт нэмэх</button>
      <div>{['БАЗАН', 'БУЗАН', 'НУЗАН'].map((unit) => <label key={unit} style={{ marginRight: 8 }}><input type="checkbox" checked={targetUnits.includes(unit)} onChange={(event) => setTargetUnits((current) => event.target.checked ? [...current, unit] : current.filter((item) => item !== unit))} /> {unit}</label>)}</div>
      <button type="submit">Судалгаа нийтлэх</button>
    </form>}</FloatingComposer>
    {message && <p role="alert" style={{ color: '#b91c1c' }}>{message}</p>}
    {surveys.length === 0 ? <p>Одоогоор судалгаа алга.</p> : isAdmin ? <div style={{ display: 'grid', gap: 8 }}>{surveys.map((survey) => <button key={survey.id} type="button" onClick={() => setSelectedSurveyId(survey.id)} style={{ width: '100%', padding: 12, border: '1px solid #dbe3ee', borderRadius: 8, background: '#fff', textAlign: 'left', cursor: 'pointer' }}>
      <strong>{survey.title}</strong>
      {survey.description && <p style={{ margin: '5px 0', color: '#475569' }}>{survey.description}</p>}
      {survey.author && <span style={{ color: '#64748b', fontSize: 12 }}>Оруулсан: {survey.author}</span>}
      <span style={{ display: 'block', marginTop: 6, color: '#2563eb', fontSize: 13 }}>{survey.response_ids?.length ?? 0} хариулт · Хариултыг харах →</span>
    </button>)}</div> : <div style={{ display: 'grid', gap: 10 }}>{surveys.map((survey) => <article key={survey.id} style={{ padding: 12, border: '1px solid #e2e8f0', borderRadius: 8 }}>
      <b>{survey.title}</b>
      <p style={{ margin: '5px 0' }}>{survey.description}</p>
      {survey.author && <p style={{ margin: '5px 0', color: '#475569', fontSize: 12 }}>Оруулсан: {survey.author}</p>}
      {!isAdmin && <button type="button" onClick={() => setSelectedSurveyId(survey.id)} style={{ marginTop: 8, padding: '8px 12px', border: 0, borderRadius: 6, background: '#2563eb', color: '#fff', cursor: 'pointer' }}>
        {survey.responses && Object.keys(survey.responses).length >= (survey.questions?.length ?? 1) ? 'Бөглөсөн хариуг харах' : Object.keys(survey.responses ?? {}).length > 0 ? 'Үргэлжлүүлэн бөглөх' : 'Судалгаа бөглөх'}
      </button>}
    </article>)}</div>}
    {isAdmin && selectedSurveyId && (() => {
      const selectedSurvey = surveys.find((survey) => survey.id === selectedSurveyId);
      if (!selectedSurvey) return null;
      const selectedQuestions = selectedSurvey.questions?.length
        ? selectedSurvey.questions
        : [{ text: 'Асуулт 1', options: selectedSurvey.options ?? [] }];
      return <div role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) setSelectedSurveyId(undefined); }} style={{ position: 'fixed', inset: 0, zIndex: 50, display: 'grid', placeItems: 'center', padding: 16, background: 'rgba(15, 23, 42, 0.5)' }}>
        <section role="dialog" aria-modal="true" aria-label="Судалгааны хариулт" style={{ width: 'min(900px, 100%)', maxHeight: '85vh', overflow: 'auto', padding: 20, background: '#fff', borderRadius: 10, boxShadow: '0 20px 60px rgba(15, 23, 42, 0.25)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12 }}>
            <div><h3 style={{ margin: 0 }}>{selectedSurvey.title}</h3><p style={{ margin: '5px 0 12px', color: '#475569' }}>{selectedSurvey.description}</p></div>
            <div style={{ display: 'flex', gap: 8 }}>
              <button type="button" disabled={downloadingSurveyId === selectedSurvey.id} onClick={() => void downloadAnswers(selectedSurvey)}>{downloadingSurveyId === selectedSurvey.id ? 'Татаж байна...' : 'Excel татах'}</button>
              <button type="button" onClick={() => setSelectedSurveyId(undefined)}>Буцах</button>
            </div>
          </div>
          <strong>Хариултын нэгтгэл · {selectedSurvey.response_ids?.length ?? 0} багш</strong>
          {!!selectedSurvey.respondent_names?.length && <p style={{ margin: '6px 0', fontSize: 13 }}><strong>Хариулсан багш:</strong> {selectedSurvey.respondent_names.join(', ')}</p>}
          {selectedQuestions.map((question, questionIndex) => {
            const normalized = normalizeQuestion(question, selectedSurvey.options);
            const counts = selectedSurvey.response_summary?.[questionIndex] ?? {};
            const values = normalized.type === 'rating' ? Array.from({ length: 11 }, (_, rating) => String(rating))
              : normalized.type === 'short_text' ? Object.keys(counts) : normalized.options;
            const max = Math.max(1, ...values.map((value) => counts[value] ?? 0));
            return <div key={`${selectedSurvey.id}-summary-${questionIndex}`} style={{ marginTop: 14, padding: 12, background: '#f8fafc', borderRadius: 8 }}>
              <strong>{normalized.text}</strong>
              {values.length === 0 ? <p style={{ margin: '8px 0', color: '#64748b' }}>Одоогоор хариулт алга.</p> : values.map((value) => <div key={value} style={{ display: 'grid', gridTemplateColumns: 'minmax(90px, 120px) 1fr 28px', gap: 8, alignItems: 'center', marginTop: 5, fontSize: 13 }}>
                <span style={{ overflowWrap: 'anywhere' }}>{value}</span>
                <div role="img" aria-label={`${value}: ${counts[value] ?? 0}`} style={{ height: 14, background: '#e2e8f0', borderRadius: 99, overflow: 'hidden' }}><div style={{ width: `${((counts[value] ?? 0) / max) * 100}%`, height: '100%', background: '#2563eb', borderRadius: 99 }} /></div>
                <span>{counts[value] ?? 0}</span>
              </div>)}
            </div>;
          })}
        </section>
      </div>;
    })()}
    {!isAdmin && selectedSurveyId && (() => {
      const selectedSurvey = surveys.find((survey) => survey.id === selectedSurveyId);
      if (!selectedSurvey) return null;
      const selectedQuestions = selectedSurvey.questions?.length
        ? selectedSurvey.questions
        : [{ text: 'Асуулт 1', options: selectedSurvey.options ?? [] }];
      return <div role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) setSelectedSurveyId(undefined); }} style={{ position: 'fixed', inset: 0, zIndex: 50, display: 'grid', placeItems: 'center', padding: 16, background: 'rgba(15, 23, 42, 0.5)' }}>
        <section role="dialog" aria-modal="true" aria-label="Судалгаа бөглөх" style={{ width: 'min(760px, 100%)', maxHeight: '85vh', overflow: 'auto', padding: 20, background: '#fff', borderRadius: 10, boxShadow: '0 20px 60px rgba(15, 23, 42, 0.25)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12 }}>
            <div><h3 style={{ margin: 0 }}>{selectedSurvey.title}</h3><p style={{ margin: '5px 0 12px', color: '#475569' }}>{selectedSurvey.description}</p></div>
            <button type="button" onClick={() => setSelectedSurveyId(undefined)} style={{ padding: '6px 10px', border: '1px solid #cbd5e1', borderRadius: 6, background: '#fff', cursor: 'pointer' }}>Буцах</button>
          </div>
          {selectedQuestions.map((question, questionIndex) => {
            const normalized = normalizeQuestion(question, selectedSurvey.options);
            const answerKey = `${selectedSurvey.id}:${questionIndex}`;
            const savedAnswer = selectedSurvey.responses?.[questionIndex];
            const draftAnswer = answerDrafts[answerKey] ?? savedAnswer ?? (normalized.type === 'rating' ? '5' : undefined);
            const alreadyAnswered = savedAnswer !== undefined;
                return <fieldset key={`${selectedSurvey.id}-modal-${questionIndex}`} style={{ margin: '12px 0', padding: 12, border: '1px solid #e2e8f0', borderRadius: 8 }}>
                  <legend style={{ fontWeight: 700 }}>{normalized.text} <span aria-label="Заавал хариулна" style={{ color: '#dc2626' }}>*</span></legend>
              {normalized.type === 'single_choice' && normalized.options.map((option) => <label key={option} style={{ display: 'block', margin: '8px 0' }}>
                <input type="radio" name={`modal-${selectedSurvey.id}-${questionIndex}`} checked={draftAnswer === option} disabled={alreadyAnswered} onChange={() => setAnswerDrafts((current) => ({ ...current, [answerKey]: option }))} /> {option}
              </label>)}
              {normalized.type === 'multiple_choice' && normalized.options.map((option) => {
                const selected = Array.isArray(draftAnswer) ? draftAnswer : [];
                return <label key={option} style={{ display: 'block', margin: '8px 0' }}>
                  <input type="checkbox" checked={selected.includes(option)} disabled={alreadyAnswered} onChange={(event) => {
                    const next = event.target.checked ? [...selected, option] : selected.filter((item) => item !== option);
                    setAnswerDrafts((current) => ({ ...current, [answerKey]: next }));
                  }} /> {option}
                </label>;
              })}
              {normalized.type === 'short_text' && <input type="text" maxLength={1000} value={typeof draftAnswer === 'string' ? draftAnswer : ''} disabled={alreadyAnswered} onChange={(event) => setAnswerDrafts((current) => ({ ...current, [answerKey]: event.target.value }))} placeholder="Хариултаа бичнэ үү" style={field} />}
              {normalized.type === 'rating' && <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                <span>0</span><input type="range" min="0" max="10" step="1" value={typeof draftAnswer === 'string' ? draftAnswer : '5'} disabled={alreadyAnswered} onChange={(event) => setAnswerDrafts((current) => ({ ...current, [answerKey]: event.target.value }))} style={{ flex: 1 }} /><span>10</span>
                <strong>{typeof draftAnswer === 'string' ? draftAnswer : '5'}</strong>
              </div>}
            </fieldset>;
          })}
          {message && <p role="alert" style={{ color: '#b91c1c' }}>{message}</p>}
          <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 16 }}>
            <button type="button" disabled={savingSurvey || Object.keys(selectedSurvey.responses ?? {}).length >= selectedQuestions.length || selectedQuestions.some((question, questionIndex) => {
              const normalized = normalizeQuestion(question, selectedSurvey.options);
              const value = answerDrafts[`${selectedSurvey.id}:${questionIndex}`] ?? selectedSurvey.responses?.[questionIndex] ?? (normalized.type === 'rating' ? '5' : undefined);
              return value === undefined || value === '' || (Array.isArray(value) && value.length === 0);
            })} onClick={() => void submitAnswers(selectedSurvey, selectedQuestions.map((question) => normalizeQuestion(question, selectedSurvey.options)))} style={{ padding: '8px 14px', border: 0, borderRadius: 6, background: savingSurvey ? '#94a3b8' : '#2563eb', color: '#fff', cursor: savingSurvey ? 'default' : 'pointer' }}>
              {savingSurvey ? 'Хадгалж байна...' : Object.keys(selectedSurvey.responses ?? {}).length >= selectedQuestions.length ? 'Хадгалсан' : 'Судалгаа хадгалах'}
            </button>
          </div>
        </section>
      </div>;
    })()}
  </section>;
}
