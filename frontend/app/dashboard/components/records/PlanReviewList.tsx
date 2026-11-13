'use client';

import FileAttachmentActions from './FileAttachmentActions';
import { formatTeacherName } from '../../utils/teacherName';
import { SubmittedPlanRecord } from './adminReviewTypes';

interface Props {
  records: SubmittedPlanRecord[];
  approvalAssetsReady: boolean;
  reviewingPlan: string;
  onReview: (userId: string, approved: boolean) => void;
  onReturn: (userId: string) => void;
  onDelete: (userId: string) => void;
}

export default function PlanReviewList({
  records,
  approvalAssetsReady,
  reviewingPlan,
  onReview,
  onReturn,
  onDelete,
}: Props) {
  if (!records.length) return <p>Илгээсэн материал алга.</p>;

  return (
    <div style={{ display: 'grid', gap: 8 }}>
      {records.map((record) => {
        const plan = record.program_plan;
        const busy = reviewingPlan === record.user_id;
        return (
          <article key={record.user_id} style={{ display: 'flex', alignItems: 'flex-start', gap: 10, padding: 9, border: '1px solid #e2e8f0', borderRadius: 8, background: '#fff' }}>
            <div style={{ flex: '0 0 112px', minWidth: 0 }}>
              <FileAttachmentActions attachment={{ name: 'Хөтөлбөр, төлөвлөгөө.pdf', url: plan.documentUrl, file_type: 'document' }} inlinePreview previewWidth={112} previewHeight={104} />
            </div>
            <div style={{ minWidth: 0, flex: 1 }}>
              <small style={{ color: '#047857' }}>Хянах · Хөтөлбөр, төлөвлөгөө</small>
              <h3 style={{ margin: '2px 0 3px', color: '#0f172a', fontSize: 16 }}>{formatTeacherName(record.teacher.name)}</h3>
              <small style={{ color: '#64748b' }}>{record.teacher.email} · {record.teacher.unit} · {record.teacher.subject}</small>
              {(plan.grade || plan.section || plan.subject) && <p style={{ margin: '7px 0 3px', color: '#475569' }}>{plan.grade}-р анги {plan.section} бүлэг · {plan.subject}</p>}
              {plan.note && <p style={{ margin: '5px 0', whiteSpace: 'pre-wrap', lineHeight: 1.5 }}>{plan.note}</p>}
              {plan.returned && <strong style={{ color: '#b91c1c' }}>Засуулахаар буцаасан</strong>}
              {plan.submittedAt && <small style={{ display: 'block', marginTop: 6, color: '#64748b' }}>{new Date(plan.submittedAt).toLocaleString('mn-MN')}</small>}
              <PlanActions
                approved={plan.approved}
                returned={!!plan.returned}
                busy={busy}
                approvalAssetsReady={approvalAssetsReady}
                onReview={() => onReview(record.user_id, !plan.approved)}
                onReturn={() => onReturn(record.user_id)}
                onDelete={() => onDelete(record.user_id)}
              />
              <SubmittedCredentials record={record} />
            </div>
          </article>
        );
      })}
    </div>
  );
}

function PlanActions({
  approved,
  returned,
  busy,
  approvalAssetsReady,
  onReview,
  onReturn,
  onDelete,
}: {
  approved: boolean;
  returned: boolean;
  busy: boolean;
  approvalAssetsReady: boolean;
  onReview: () => void;
  onReturn: () => void;
  onDelete: () => void;
}) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: 8, marginTop: 8 }}>
      {approved && <strong style={{ color: '#15803d' }}>Батлагдсан</strong>}
      <button type="button" disabled={busy || (!approved && !approvalAssetsReady)} onClick={onReview} style={actionStyle(approved ? '#64748b' : '#15803d', busy)}>
        {busy ? 'Хадгалж байна...' : approved ? 'Баталгааг цуцлах' : 'Батлах'}
      </button>
      {!approved && !returned && <button type="button" disabled={busy} onClick={onReturn} style={actionStyle('#d97706', busy)}>Багшид буцаах</button>}
      <button type="button" disabled={busy} onClick={onDelete} style={actionStyle('#dc2626', busy)}>Устгах</button>
    </div>
  );
}

function SubmittedCredentials({ record }: { record: SubmittedPlanRecord }) {
  const hasCredentials = record.awards.length > 0 || record.professional_degrees.length > 0;
  if (!hasCredentials) return null;

  return (
    <div style={{ marginTop: 8, paddingTop: 8, borderTop: '1px solid #e2e8f0' }}>
      <strong>Шагнал, мэргэжлийн зэрэг</strong>
      {record.awards.map((award) => (
        <div key={award.id} style={{ margin: '6px 0' }}>
          <p style={{ margin: '2px 0' }}>Шагнал: {award.name}{award.certificate_number && ` · №${award.certificate_number}`} {award.organization && `· ${award.organization}`} {award.status === 'Хүсэлт' ? '· Хүсэлт' : null}</p>
          {award.justification && <p style={{ margin: '2px 0' }}>Үндэслэл: {award.justification}</p>}
          {award.certificate_url && <FileAttachmentActions attachment={{ name: 'Үнэмлэх PDF', url: award.certificate_url, file_type: 'document' }} />}
          {award.application_url && <FileAttachmentActions attachment={{ name: 'Анкет PDF', url: award.application_url, file_type: 'document' }} />}
          {award.meeting_minutes_url && <FileAttachmentActions attachment={{ name: 'Хамт олны хурлын протокол PDF', url: award.meeting_minutes_url, file_type: 'document' }} />}
          {award.reference_url && <FileAttachmentActions attachment={{ name: 'Тодорхойлолт PDF', url: award.reference_url, file_type: 'document' }} />}
        </div>
      ))}
      {record.professional_degrees.map((degree) => (
        <p key={degree.id} style={{ margin: '6px 0' }}>
          Зэрэг: {degree.name}{degree.certificate_number && ` · №${degree.certificate_number}`} · {degree.status}
          {degree.certificate_url && <FileAttachmentActions attachment={{ name: 'Үнэмлэх PDF', url: degree.certificate_url, file_type: 'document' }} />}
        </p>
      ))}
    </div>
  );
}

const actionStyle = (background: string, disabled: boolean) => ({
  padding: '7px 12px',
  border: 0,
  borderRadius: 7,
  background: disabled ? '#cbd5e1' : background,
  color: '#fff',
  fontWeight: 700,
  cursor: disabled ? 'not-allowed' : 'pointer',
});
