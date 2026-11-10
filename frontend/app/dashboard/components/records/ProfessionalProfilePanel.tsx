'use client';

import { FormEvent, useState } from 'react';
import LosslessCloudinaryUpload from '../../../../components/LosslessCloudinaryUpload';

type Award = { id: string; name: string; certificate_number: string; certificate_url: string; organization: string; status?: string; application_url?: string; meeting_minutes_url?: string; reference_url?: string; justification?: string; awarded_date?: string };
type Degree = { id: string; name: string; certificate_number: string; certificate_url: string; status: string; issued_date?: string };

export default function ProfessionalProfilePanel({ mode, awards, degrees, onSave }: { mode: 'award' | 'degree'; awards: Award[]; degrees: Degree[]; onSave: (path: string, payload: object) => Promise<void> }) {
  const [award, setAward] = useState({ name: '', custom_name: '', certificate_number: '', certificate_url: '', organization: '', awarded_date: '' });
  const [requestedAward, setRequestedAward] = useState('');
  const [customRequestedAward, setCustomRequestedAward] = useState('');
  const [awardRequestFiles, setAwardRequestFiles] = useState({ application_url: '', meeting_minutes_url: '', reference_url: '' });
  const [awardJustification, setAwardJustification] = useState('');
  const [degree, setDegree] = useState({ name: '', certificate_number: '', certificate_url: '', status: 'Одоо байгаа зэрэг', issued_date: '' });
  const [requestedDegree, setRequestedDegree] = useState('');
  const [requestOpen, setRequestOpen] = useState<'award' | 'degree' | null>(null);
  const [message, setMessage] = useState('');
  const [messageIsError, setMessageIsError] = useState(false);
  const [uploadResetKey, setUploadResetKey] = useState(0);
  const submit = async (event: FormEvent<HTMLFormElement>, path: string, payload: object, reset: () => void) => {
    event.preventDefault();
    try {
      const normalized = { ...payload, ...('awarded_date' in payload ? { awarded_date: payload.awarded_date || null } : {}), ...('issued_date' in payload ? { issued_date: payload.issued_date || null } : {}) };
      await onSave(path, normalized);
      reset();
      setMessageIsError(false);
      setMessage('Мэдээлэл хадгалагдлаа.');
    } catch (error) {
      setMessageIsError(true);
      setMessage(error instanceof Error ? error.message : 'Мэдээлэл хадгалагдсангүй.');
    }
  };
  const submitDegreeRequest = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    try {
      await onSave('/api/teachers/me/professional-degrees', {
        name: requestedDegree,
        certificate_number: '',
        certificate_url: '',
        status: 'Хүсэлт',
        issued_date: null,
      });
      setRequestedDegree('');
      setRequestOpen(null);
      setMessageIsError(false);
      setMessage('Зэргийн хүсэлт илгээгдлээ.');
    } catch (error) {
      setMessageIsError(true);
      setMessage(error instanceof Error ? error.message : 'Зэргийн хүсэлт илгээгдсэнгүй.');
    }
  };
  const submitAwardRequest = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!awardRequestFiles.application_url || !awardRequestFiles.meeting_minutes_url || !awardRequestFiles.reference_url) {
      setMessageIsError(true);
      setMessage('Анкет, хурлын протокол болон тодорхойлолтын PDF файлыг хавсаргана уу.');
      return;
    }
    try {
      await onSave('/api/teachers/me/awards', {
        name: requestedAward === 'Бусад' ? customRequestedAward.trim() : requestedAward,
        certificate_number: '',
        certificate_url: '',
        organization: '',
        status: 'Хүсэлт',
        ...awardRequestFiles,
        justification: awardJustification,
      });
      setRequestedAward('');
      setCustomRequestedAward('');
      setAwardRequestFiles({ application_url: '', meeting_minutes_url: '', reference_url: '' });
      setAwardJustification('');
      setRequestOpen(null);
      setMessageIsError(false);
      setMessage('Шагналын хүсэлт илгээгдлээ.');
    } catch (error) {
      setMessageIsError(true);
      setMessage(error instanceof Error ? error.message : 'Шагналын хүсэлт илгээгдсэнгүй.');
    }
  };
  const field = { padding: 8, border: '1px solid #cbd5e1', borderRadius: 6, background: '#fff' };
  return (
    <section>
      <h2 style={{ marginTop: 0 }}>{mode === 'award' ? 'Шагнал' : 'Мэргэжлийн зэрэг'}</h2>
      {message && <p role={messageIsError ? 'alert' : 'status'} style={{ color: messageIsError ? '#b91c1c' : '#047857' }}>{message}</p>}
      {mode === 'award' ? (
        <>
          <h3>Шагнал бүртгэх</h3>
          <form onSubmit={(event) => {
            if (!award.certificate_url) {
              event.preventDefault();
              setMessageIsError(true);
              setMessage('Шагналын үнэмлэхний PDF файлыг хавсаргана уу.');
              return;
            }
            void submit(event, '/api/teachers/me/awards', { ...award, name: award.name === 'Бусад' ? award.custom_name : award.name }, () => {
              setAward({ name: '', custom_name: '', certificate_number: '', certificate_url: '', organization: '', awarded_date: '' });
              setUploadResetKey((current) => current + 1);
            });
          }} style={{ display: 'grid', gap: 8 }}>
            <label style={{ display: 'grid', gap: 4, fontWeight: 600 }}>Шагналын нэр
              <select required value={award.name} onChange={(event) => setAward({ ...award, name: event.target.value })} style={field}><option value="">Шагналын нэр сонгох</option>{['Арга зүйч багш', 'Ахлах багш', 'Багшийн алдар', 'Жуух бичиг', 'Боловсролын тэргүүний ажилтан', 'Хөдөлмөрийн хүндэт медаль', 'Алтан гадас', 'Хөдөлмөрийн гавьяаны Улаан тугийн одон', 'Бусад'].map((name) => <option key={name}>{name}</option>)}</select>
            </label>
            {award.name === 'Бусад' && <label style={{ display: 'grid', gap: 4, fontWeight: 600 }}>Шагналын нэр
              <input required placeholder="Шагналын нэр" value={award.custom_name} onChange={(event) => setAward({ ...award, custom_name: event.target.value })} style={field} />
            </label>}
            <label style={{ display: 'grid', gap: 4, fontWeight: 600 }}>Шагналын үнэмлэхний дугаар
              <input required placeholder="Үнэмлэхний дугаар" value={award.certificate_number} onChange={(event) => setAward({ ...award, certificate_number: event.target.value })} style={field} />
            </label>
            <LosslessCloudinaryUpload
              label="Шагналын үнэмлэх (зөвхөн PDF)"
              formats={['pdf']}
              required
              resetKey={uploadResetKey}
              onUploaded={(file) => setAward({ ...award, certificate_url: file.url })}
              onRemoved={() => setAward((current) => ({ ...current, certificate_url: '' }))}
            />
            <label style={{ display: 'grid', gap: 4, fontWeight: 600 }}>Олгосон байгууллага
              <select required value={award.organization} onChange={(event) => setAward({ ...award, organization: event.target.value })} style={field}><option value="">Олгосон байгууллага сонгох</option>{['Нийслэлийн боловсролын газар', 'Боловсролын яам', 'Засгийн газар', 'Төрийн', 'Бусад'].map((name) => <option key={name}>{name}</option>)}</select>
            </label>
            <input type="date" value={award.awarded_date} onChange={(event) => setAward({ ...award, awarded_date: event.target.value })} style={field} />
            <button type="submit">Шагнал хадгалах</button>
          </form>
          <button type="button" onClick={() => setRequestOpen('award')} style={{ marginTop: 12, padding: '8px 12px', border: 0, borderRadius: 6, background: '#2563eb', color: '#fff', cursor: 'pointer' }}>Шагналд хүсэлт гаргах</button>
          {awards.map((item) => <p key={item.id}>Шагнал: {item.name}{item.certificate_number && ` · №${item.certificate_number}`}{item.status === 'Хүсэлт' ? ' · Хүсэлт' : ''}</p>)}
          {requestOpen === 'award' && <div role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) setRequestOpen(null); }} style={{ position: 'fixed', inset: 0, zIndex: 60, display: 'grid', placeItems: 'center', padding: 16, background: 'rgba(15, 23, 42, 0.55)' }}>
            <section role="dialog" aria-modal="true" aria-label="Шагналын хүсэлт" style={{ width: 'min(560px, 100%)', maxHeight: '85vh', overflowY: 'auto', padding: 20, background: '#fff', borderRadius: 12, boxShadow: '0 20px 60px rgba(15, 23, 42, 0.3)' }}>
              <h3 style={{ margin: '0 0 14px' }}>Шагналд хүсэлт гаргах</h3>
              <form onSubmit={(event) => void submitAwardRequest(event)} style={{ display: 'grid', gap: 12 }}>
                <label style={{ display: 'grid', gap: 6, fontWeight: 700 }}>Хүсэлт гаргах шагнал
                  <select required value={requestedAward} onChange={(event) => setRequestedAward(event.target.value)} style={field}>
                    <option value="">Шагнал сонгох</option>{['Арга зүйч багш', 'Ахлах багш', 'Багшийн алдар', 'Жуух бичиг', 'Боловсролын тэргүүний ажилтан', 'Хөдөлмөрийн хүндэт медаль', 'Алтан гадас', 'Хөдөлмөрийн гавьяаны Улаан тугийн одон', 'Бусад'].map((name) => <option key={name} value={name}>{name}</option>)}
                  </select>
                </label>
                {requestedAward === 'Бусад' && <input required placeholder="Хүсэлт гаргах шагналын нэр" value={customRequestedAward} onChange={(event) => setCustomRequestedAward(event.target.value)} style={field} />}
                <LosslessCloudinaryUpload label="Анкет (зөвхөн PDF)" formats={['pdf']} required onUploaded={(file) => setAwardRequestFiles((current) => ({ ...current, application_url: file.url }))} onRemoved={() => setAwardRequestFiles((current) => ({ ...current, application_url: '' }))} />
                <LosslessCloudinaryUpload label="Хамт олны хурлын протокол (зөвхөн PDF)" formats={['pdf']} required onUploaded={(file) => setAwardRequestFiles((current) => ({ ...current, meeting_minutes_url: file.url }))} onRemoved={() => setAwardRequestFiles((current) => ({ ...current, meeting_minutes_url: '' }))} />
                <LosslessCloudinaryUpload label="Тодорхойлолт (зөвхөн PDF)" formats={['pdf']} required onUploaded={(file) => setAwardRequestFiles((current) => ({ ...current, reference_url: file.url }))} onRemoved={() => setAwardRequestFiles((current) => ({ ...current, reference_url: '' }))} />
                <label style={{ display: 'grid', gap: 6, fontWeight: 700 }}>Шагнуулах үндэслэл
                  <textarea required value={awardJustification} onChange={(event) => setAwardJustification(event.target.value)} rows={4} style={{ ...field, resize: 'vertical' }} placeholder="Шагналд тодорхойлох үндэслэлээ бичнэ үү" />
                </label>
                <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
                  <button type="button" onClick={() => setRequestOpen(null)}>Буцах</button>
                  <button type="submit">Хүсэлт илгээх</button>
                </div>
              </form>
            </section>
          </div>}
        </>
      ) : (
        <>
          <h3>Одоо байгаа зэргийг бүртгэх</h3>
          <form onSubmit={(event) => {
            if (!degree.certificate_url) {
              event.preventDefault();
              setMessageIsError(true);
              setMessage('Зэргийн үнэмлэхний PDF файлыг хавсаргана уу.');
              return;
            }
            void submit(event, '/api/teachers/me/professional-degrees', degree, () => {
              setDegree({ name: '', certificate_number: '', certificate_url: '', status: 'Одоо байгаа зэрэг', issued_date: '' });
              setUploadResetKey((current) => current + 1);
            });
          }} style={{ display: 'grid', gap: 8 }}>
            <label style={{ display: 'grid', gap: 4, fontWeight: 600 }}>Мэргэжлийн зэрэг
            <select required value={degree.name} onChange={(event) => setDegree({ ...degree, name: event.target.value })} style={field}>
              <option value="">Зэрэг сонгох</option>{['Заах аргач', 'Тэргүүлэх', 'Зөвлөх'].map((name) => <option key={name} value={name}>{name}</option>)}
            </select>
            </label>
            <label style={{ display: 'grid', gap: 4, fontWeight: 600 }}>Зэргийн үнэмлэхний дугаар
              <input required placeholder="Үнэмлэхний дугаар" value={degree.certificate_number} onChange={(event) => setDegree({ ...degree, certificate_number: event.target.value })} style={field} />
            </label>
            <LosslessCloudinaryUpload
              label="Зэргийн үнэмлэх (зөвхөн PDF)"
              formats={['pdf']}
              required
              resetKey={uploadResetKey}
              onUploaded={(file) => setDegree({ ...degree, certificate_url: file.url })}
              onRemoved={() => setDegree((current) => ({ ...current, certificate_url: '' }))}
            />
            <input type="date" value={degree.issued_date} onChange={(event) => setDegree({ ...degree, issued_date: event.target.value })} style={field} />
            <button type="submit">Зэрэг бүртгэх</button>
          </form>
          <button type="button" onClick={() => setRequestOpen('degree')} style={{ marginTop: 12, padding: '8px 12px', border: 0, borderRadius: 6, background: '#2563eb', color: '#fff', cursor: 'pointer' }}>Хүсэлт гаргах</button>
          {degrees.map((item) => <p key={item.id}>Зэрэг: {item.name}{item.certificate_number && ` · №${item.certificate_number}`} · {item.status}</p>)}
          {requestOpen === 'degree' && <div role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) setRequestOpen(null); }} style={{ position: 'fixed', inset: 0, zIndex: 60, display: 'grid', placeItems: 'center', padding: 16, background: 'rgba(15, 23, 42, 0.55)' }}>
            <section role="dialog" aria-modal="true" aria-label="Мэргэжлийн зэргийн хүсэлт" style={{ width: 'min(460px, 100%)', padding: 20, background: '#fff', borderRadius: 12, boxShadow: '0 20px 60px rgba(15, 23, 42, 0.3)' }}>
              <h3 style={{ margin: '0 0 14px' }}>Зэрэг хүсэх</h3>
              <form onSubmit={(event) => void submitDegreeRequest(event)} style={{ display: 'grid', gap: 12 }}>
                <label style={{ display: 'grid', gap: 6, fontWeight: 700 }}>Хүсэлт гаргах зэрэг
                  <select required value={requestedDegree} onChange={(event) => setRequestedDegree(event.target.value)} style={field}>
                    <option value="">Зэрэг сонгох</option>{['Заах аргач', 'Тэргүүлэх', 'Зөвлөх'].map((name) => <option key={name} value={name}>{name}</option>)}
                  </select>
                </label>
                <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
                  <button type="button" onClick={() => setRequestOpen(null)}>Буцах</button>
                  <button type="submit">Хүсэлт илгээх</button>
                </div>
              </form>
            </section>
          </div>}
        </>
      )}
    </section>
  );
}
