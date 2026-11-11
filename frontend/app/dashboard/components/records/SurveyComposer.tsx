'use client';

import { Dispatch, FormEvent, SetStateAction } from 'react';
import FloatingComposer from './FloatingComposer';
import { SurveyQuestion, SurveyQuestionType } from './surveyTypes';
import UnitTargetSelector from './UnitTargetSelector';

const field = { width: '100%', padding: 9, border: '1px solid #cbd5e1', borderRadius: 7, boxSizing: 'border-box' as const };

export default function SurveyComposer({
  title, description, questions, targetUnits, startsAt, endsAt,
  setTitle, setDescription, setQuestions, setTargetUnits, setStartsAt, setEndsAt, onSubmit,
}: {
  title: string;
  description: string;
  questions: SurveyQuestion[];
  targetUnits: string[];
  startsAt: string;
  endsAt: string;
  setTitle: Dispatch<SetStateAction<string>>;
  setDescription: Dispatch<SetStateAction<string>>;
  setQuestions: Dispatch<SetStateAction<SurveyQuestion[]>>;
  setTargetUnits: Dispatch<SetStateAction<string[]>>;
  setStartsAt: Dispatch<SetStateAction<string>>;
  setEndsAt: Dispatch<SetStateAction<string>>;
  onSubmit: (event: FormEvent<HTMLFormElement>, close: () => void) => void;
}) {
  return <FloatingComposer title="Судалгаа үүсгэх" label="Судалгаа үүсгэх">{(close) => <form onSubmit={(event) => onSubmit(event, close)} style={{ display: 'grid', gap: 8 }}>
    <label style={{ display: 'grid', gap: 4, fontWeight: 600 }}>Судалгааны нэр
      <input required value={title} onChange={(event) => setTitle(event.target.value)} placeholder="Судалгааны нэр" style={field} />
    </label>
    <textarea value={description} onChange={(event) => setDescription(event.target.value)} placeholder="Тайлбар" style={field} />
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: 8 }}>
      <label style={{ display: 'grid', gap: 4, fontWeight: 600 }}>Эхлэх хугацаа<input required type="datetime-local" value={startsAt} onChange={(event) => setStartsAt(event.target.value)} style={field} /></label>
      <label style={{ display: 'grid', gap: 4, fontWeight: 600 }}>Дуусах хугацаа<input required type="datetime-local" min={startsAt} value={endsAt} onChange={(event) => setEndsAt(event.target.value)} style={field} /></label>
    </div>
    {questions.map((question, questionIndex) => <fieldset key={`question-${questionIndex}`} style={{ display: 'grid', gap: 6, padding: 8, border: '1px solid #cbd5e1', borderRadius: 7 }}>
      <legend>Асуулт {questionIndex + 1}</legend>
      <label style={{ display: 'grid', gap: 4, fontWeight: 600 }}>Асуулт<input required value={question.text} onChange={(event) => setQuestions((current) => current.map((item, index) => index === questionIndex ? { ...item, text: event.target.value } : item))} placeholder={`Асуулт ${questionIndex + 1}`} style={field} /></label>
      <select value={question.type} onChange={(event) => setQuestions((current) => current.map((item, index) => index === questionIndex ? { ...item, type: event.target.value as SurveyQuestionType, options: ['single_choice', 'multiple_choice'].includes(event.target.value) ? (item.options.length ? item.options : ['', '']) : [] } : item))} style={field}>
        <option value="single_choice">Нэг сонголт</option><option value="multiple_choice">Олон сонголт</option><option value="short_text">Богино текст</option><option value="rating">0–10 үнэлгээ</option>
      </select>
      {['single_choice', 'multiple_choice'].includes(question.type) && <>
        {question.options.map((option, optionIndex) => <label key={optionIndex} style={{ display: 'grid', gap: 4, fontWeight: 600 }}>Сонголт {optionIndex + 1}
          <input required value={option} onChange={(event) => setQuestions((current) => current.map((item, index) => index === questionIndex ? { ...item, options: item.options.map((value, choiceIndex) => choiceIndex === optionIndex ? event.target.value : value) } : item))} placeholder={`Сонголт ${optionIndex + 1}`} style={field} />
        </label>)}
        <button type="button" onClick={() => setQuestions((current) => current.map((item, index) => index === questionIndex ? { ...item, options: [...item.options, ''] } : item))}>+ Сонголт нэмэх</button>
      </>}
    </fieldset>)}
    <button type="button" onClick={() => setQuestions((current) => [...current, { text: '', type: 'single_choice', options: ['', ''] }])}>+ Асуулт нэмэх</button>
    <UnitTargetSelector selectedUnits={targetUnits} setSelectedUnits={setTargetUnits} label="Судалгаа авах нэгж" />
    <button type="submit">Судалгаа нийтлэх</button>
  </form>}</FloatingComposer>;
}
