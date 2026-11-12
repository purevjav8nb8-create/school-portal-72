'use client';

import { FormEvent, useEffect, useState } from 'react';
import { backendBaseUrl, fetchWithAuth } from '../../../../lib/backendApi';
import { supabase } from '../../../../lib/supabaseClient';
import SurveyComposer from './SurveyComposer';
import SurveyAnswerDialog from './SurveyAnswerDialog';
import SurveyResponsesDialog from './SurveyResponsesDialog';
import { Survey, SurveyAnswer, SurveyQuestion } from './surveyTypes';
import { formatTeacherName } from '../../utils/teacherName';

function localDateTime(value: Date) {
  return new Date(value.getTime() - value.getTimezoneOffset() * 60_000).toISOString().slice(0, 16);
}

export default function SurveyBoard() {
  const [surveys, setSurveys] = useState<Survey[]>([]);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [questions, setQuestions] = useState<SurveyQuestion[]>([{ text: '', type: 'single_choice', options: ['', ''] }]);
  const [targetUnits, setTargetUnits] = useState<string[]>([]);
  const [startsAt, setStartsAt] = useState(() => localDateTime(new Date()));
  const [endsAt, setEndsAt] = useState(() => {
    const end = new Date();
    end.setDate(end.getDate() + 7);
    return localDateTime(end);
  });
  const [message, setMessage] = useState('');
  const [selectedSurveyId, setSelectedSurveyId] = useState<string>();
  const [answerDrafts, setAnswerDrafts] = useState<Record<string, SurveyAnswer>>({});
  const [savingSurvey, setSavingSurvey] = useState(false);
  const [downloadingSurveyId, setDownloadingSurveyId] = useState<string>();
  const [deletingSurveyId, setDeletingSurveyId] = useState<string>();

  const request = async (path: string, method = 'GET', body?: object) => {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) throw new Error('Дахин нэвтэрнэ үү.');
    const response = await fetchWithAuth(`${backendBaseUrl}${path}`, {
      method,
      headers: { Authorization: `Bearer ${session.access_token}`, ...(body ? { 'Content-Type': 'application/json' } : {}) },
      ...(body ? { body: JSON.stringify(body) } : {}),
    });
    const result = await response.json();
    if (!response.ok) throw new Error(result.detail ?? 'Судалгааны хүсэлт амжилтгүй боллоо.');
    return result;
  };

  const load = async () => {
    try {
      setSurveys(await request('/api/teachers/surveys') as Survey[]);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Судалгаа уншигдсангүй.');
    }
  };
  useEffect(() => { void load(); }, []);

  const create = async (event: FormEvent<HTMLFormElement>, close: () => void) => {
    event.preventDefault();
    try {
      if (targetUnits.length === 0) throw new Error('“Бүгд” эсвэл дор хаяж нэг нэгж сонгоно уу.');
      if (new Date(endsAt) <= new Date(startsAt)) throw new Error('Дуусах хугацаа эхлэх хугацаанаас хойш байх ёстой.');
      await request('/api/teachers/surveys', 'POST', {
        title, description, questions, target_units: targetUnits,
        starts_at: new Date(startsAt).toISOString(), ends_at: new Date(endsAt).toISOString(),
      });
      setTitle('');
      setDescription('');
      setQuestions([{ text: '', type: 'single_choice', options: ['', ''] }]);
      setTargetUnits([]);
      setStartsAt(localDateTime(new Date()));
      const end = new Date();
      end.setDate(end.getDate() + 7);
      setEndsAt(localDateTime(end));
      await load();
      close();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Судалгаа үүссэнгүй.');
    }
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
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Хариулт хадгалагдсангүй.');
    } finally {
      setSavingSurvey(false);
    }
  };

  const downloadAnswers = async (survey: Survey) => {
    setDownloadingSurveyId(survey.id);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error('Дахин нэвтэрнэ үү.');
      const response = await fetchWithAuth(`${backendBaseUrl}/api/teachers/surveys/${survey.id}/export`, {
        headers: { Authorization: `Bearer ${session.access_token}` },
      });
      if (!response.ok) throw new Error((await response.json()).detail ?? 'Excel файл татаж чадсангүй.');
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

  const deleteSurvey = async (survey: Survey) => {
    if (!window.confirm(`“${survey.title}” судалгааг устгах уу?`)) return;
    setDeletingSurveyId(survey.id);
    try {
      await request(`/api/teachers/surveys/${survey.id}`, 'DELETE');
      setSurveys((current) => current.filter((item) => item.id !== survey.id));
      setSelectedSurveyId((current) => current === survey.id ? undefined : current);
      setMessage('Судалгаа устгагдлаа.');
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Судалгаа устгагдсангүй.');
    } finally {
      setDeletingSurveyId(undefined);
    }
  };

  const deleteButton = (survey: Survey) => survey.can_delete && <button
    type="button"
    disabled={deletingSurveyId === survey.id}
    onClick={() => void deleteSurvey(survey)}
    style={{ padding: '7px 10px', border: 0, borderRadius: 6, background: '#dc2626', color: '#fff', cursor: 'pointer' }}
  >
    {deletingSurveyId === survey.id ? 'Устгаж байна...' : 'Устгах'}
  </button>;

  const selectedSurvey = surveys.find((survey) => survey.id === selectedSurveyId);
  return <section>
    <h2 style={{ marginTop: 0 }}>Судалгаа</h2>
    <SurveyComposer
      title={title} description={description} questions={questions} targetUnits={targetUnits}
      startsAt={startsAt} endsAt={endsAt} setTitle={setTitle} setDescription={setDescription}
      setQuestions={setQuestions} setTargetUnits={setTargetUnits} setStartsAt={setStartsAt}
      setEndsAt={setEndsAt} onSubmit={create}
    />
    {message && <p role="alert" style={{ color: '#b91c1c' }}>{message}</p>}
    {surveys.length === 0 ? <p>Одоогоор судалгаа алга.</p> : <div style={{ display: 'grid', gap: 10 }}>{surveys.map((survey) => survey.can_view_results ? (
      <article key={survey.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 10, padding: 12, border: '1px solid #dbe3ee', borderRadius: 8, background: '#fff' }}>
        <div style={{ flex: 1 }}>
          <button type="button" onClick={() => setSelectedSurveyId(survey.id)} style={{ padding: 0, border: 0, background: 'transparent', color: '#0f172a', textAlign: 'left', fontWeight: 700, cursor: 'pointer' }}>
            {survey.title}
          </button>
          {survey.description && <p style={{ margin: '5px 0', color: '#475569' }}>{survey.description}</p>}
          {survey.author && <span style={{ color: '#64748b', fontSize: 12 }}>Оруулсан: {formatTeacherName(survey.author)}</span>}
          <button type="button" onClick={() => setSelectedSurveyId(survey.id)} style={{ display: 'block', marginTop: 6, padding: 0, border: 0, background: 'transparent', color: '#2563eb', fontSize: 13, cursor: 'pointer' }}>{survey.response_ids?.length ?? 0} хариулт · Хариултыг харах →</button>
        </div>
        {deleteButton(survey)}
      </article>
    ) : <article key={survey.id} style={{ padding: 12, border: '1px solid #e2e8f0', borderRadius: 8 }}>
      <b>{survey.title}</b><p style={{ margin: '5px 0' }}>{survey.description}</p>
      {survey.starts_at && survey.ends_at && <p style={{ margin: '5px 0', color: '#64748b', fontSize: 12 }}>Судалгаа авах хугацаа: {new Date(survey.starts_at).toLocaleString('mn-MN')} – {new Date(survey.ends_at).toLocaleString('mn-MN')}</p>}
      {survey.author && <p style={{ margin: '5px 0', color: '#475569', fontSize: 12 }}>Оруулсан: {formatTeacherName(survey.author)}</p>}
      <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginTop: 8 }}>
        <button type="button" onClick={() => setSelectedSurveyId(survey.id)} style={{ padding: '8px 12px', border: 0, borderRadius: 6, background: '#2563eb', color: '#fff', cursor: 'pointer' }}>
          {survey.responses && Object.keys(survey.responses).length >= (survey.questions?.length ?? 1) ? 'Бөглөсөн хариуг харах' : !survey.accepts_responses ? 'Судалгааны хугацаа дууссан' : Object.keys(survey.responses ?? {}).length > 0 ? 'Үргэлжлүүлэн бөглөх' : 'Судалгаа бөглөх'}
        </button>
        {deleteButton(survey)}
      </div>
    </article>)}</div>}
    {selectedSurvey?.can_view_results && <SurveyResponsesDialog survey={selectedSurvey} downloading={downloadingSurveyId === selectedSurvey.id} onDownload={() => void downloadAnswers(selectedSurvey)} onClose={() => setSelectedSurveyId(undefined)} />}
    {selectedSurvey && !selectedSurvey.can_view_results && <SurveyAnswerDialog survey={selectedSurvey} drafts={answerDrafts} message={message} saving={savingSurvey} setDrafts={setAnswerDrafts} onSubmit={(item, questionsToAnswer) => void submitAnswers(item, questionsToAnswer)} onClose={() => setSelectedSurveyId(undefined)} />}
  </section>;
}
