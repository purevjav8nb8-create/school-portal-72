'use client';

import { useEffect, useState } from 'react';
import { PenLine } from 'lucide-react';
import { backendBaseUrl, fetchWithAuth } from '../../../../lib/backendApi';
import { supabase } from '../../../../lib/supabaseClient';
import { uploadCloudinaryFile } from '../../../../components/LosslessCloudinaryUpload';
import { isValidEvaluationRecord } from '../../hooks/notificationData';
import ApprovalAssetsDialog from './ApprovalAssetsDialog';
import EvaluationSummary from './EvaluationSummary';
import PlanReviewList from './PlanReviewList';
import { ApprovalAssets, GradeBand, ManagerApprovalAsset, SubmittedPlanRecord, TeacherRecords } from './adminReviewTypes';

interface Props {
  summaryOnly?: boolean;
  isPrimaryAdmin?: boolean;
  selectedBand: GradeBand;
  setSelectedBand: (band: GradeBand) => void;
  selectedSubject: string;
  setSelectedSubject: (subject: string) => void;
  unreadNotificationKeys?: ReadonlySet<string>;
  onPlanViewed?: (userId: string, submittedAt: string) => void;
  onEvaluationViewed?: (ids: string[]) => void;
}

export default function AdminReviewPanel({
  summaryOnly = false,
  isPrimaryAdmin = false,
  selectedBand,
  setSelectedBand,
  selectedSubject,
  setSelectedSubject,
  unreadNotificationKeys = new Set(),
  onPlanViewed,
  onEvaluationViewed,
}: Props) {
  const [records, setRecords] = useState<TeacherRecords[]>([]);
  const [loading, setLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState('');
  const [approvalAssets, setApprovalAssets] = useState<ApprovalAssets>({ signature_url: '', stamp_url: '', composite_url: '' });
  const [approvalAssetsDraft, setApprovalAssetsDraft] = useState(approvalAssets);
  const [managerApprovalAssets, setManagerApprovalAssets] = useState<ManagerApprovalAsset[]>([]);
  const [approvalAssetsOpen, setApprovalAssetsOpen] = useState(false);
  const [savingApprovalAssets, setSavingApprovalAssets] = useState(false);
  const [reviewingPlan, setReviewingPlan] = useState('');

  const request = async (path: string, method = 'GET', body?: object) => {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) throw new Error('Дахин нэвтэрнэ үү.');
    const response = await fetchWithAuth(`${backendBaseUrl}${path}`, {
      method,
      headers: {
        Authorization: `Bearer ${session.access_token}`,
        ...(body ? { 'Content-Type': 'application/json' } : {}),
      },
      ...(body ? { body: JSON.stringify(body) } : {}),
    });
    const result = await response.json();
    if (!response.ok) throw new Error(result.detail ?? 'Хүсэлт амжилтгүй боллоо.');
    return result;
  };

  const loadRecords = async () => {
    setLoading(true);
    try {
      const result = await request('/api/teachers/review');
      setRecords(Array.isArray(result) ? (result as TeacherRecords[]).map((record) => ({
        ...record,
        evaluations: Array.isArray(record.evaluations) ? record.evaluations.filter(isValidEvaluationRecord) : [],
        awards: Array.isArray(record.awards) ? record.awards : [],
        professional_degrees: Array.isArray(record.professional_degrees) ? record.professional_degrees : [],
      })) : []);
      setErrorMessage('');
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : 'Материал уншигдсангүй.');
    } finally {
      setLoading(false);
    }
  };

  const loadApprovalAssets = async () => {
    try {
      const assets = await request('/api/teachers/review/program-plan/approval-assets') as ApprovalAssets;
      setApprovalAssets(assets);
      setApprovalAssetsDraft(assets);
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : 'Гарын үсэг, тамганы тохиргоо уншигдсангүй.');
    }
  };

  const loadManagerApprovalAssets = async () => {
    if (!isPrimaryAdmin) return;
    try {
      const assets = await request('/api/teachers/review/program-plan/approval-assets/managers') as ManagerApprovalAsset[];
      setManagerApprovalAssets(assets);
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : 'Менежерүүдийн гарын үсэг, тамганы зураг уншигдсангүй.');
    }
  };

  useEffect(() => {
    void loadRecords();
    if (!summaryOnly) {
      void loadApprovalAssets();
      void loadManagerApprovalAssets();
    }
  }, []);

  const saveApprovalAssets = async () => {
    if (!approvalAssetsDraft.signature_url || !approvalAssetsDraft.stamp_url) {
      setErrorMessage('Гарын үсэг, тамганы зургийг хоёуланг нь оруулна уу.');
      return;
    }
    setSavingApprovalAssets(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error('Дахин нэвтэрнэ үү.');
      const compositeResponse = await fetchWithAuth(`${backendBaseUrl}/api/teachers/review/program-plan/approval-assets/composite`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${session.access_token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          signature_url: approvalAssetsDraft.signature_url,
          stamp_url: approvalAssetsDraft.stamp_url,
        }),
      });
      if (!compositeResponse.ok) {
        const result = await compositeResponse.json();
        throw new Error(result.detail ?? 'Тунгалаг гарын үсэг, тамганы зураг үүсгэсэнгүй.');
      }
      const compositeFile = new File([await compositeResponse.blob()], 'approval-signature-stamp.png', { type: 'image/png' });
      const compositeUrl = (await uploadCloudinaryFile(compositeFile, ['png'])).url;
      const saved = await request('/api/teachers/review/program-plan/approval-assets', 'PUT', {
        ...approvalAssetsDraft,
        composite_url: compositeUrl,
      }) as ApprovalAssets;
      setApprovalAssets(saved);
      setApprovalAssetsDraft(saved);
      setApprovalAssetsOpen(false);
      setErrorMessage('');
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : 'Гарын үсэг, тамга хадгалагдсангүй.');
    } finally {
      setSavingApprovalAssets(false);
    }
  };

  const reviewPlan = async (userId: string, approved: boolean) => {
    if (approved && (!approvalAssets.signature_url || !approvalAssets.stamp_url || !approvalAssets.composite_url)) {
      setErrorMessage('Батлахын өмнө гарын үсэг, тамгаа оруулаад “Хадгалах” товчийг дарна уу.');
      return;
    }
    setReviewingPlan(userId);
    try {
      let signedDocumentUrl: string | undefined;
      if (approved) {
        const { data: { session } } = await supabase.auth.getSession();
        if (!session) throw new Error('Дахин нэвтэрнэ үү.');
        const response = await fetchWithAuth(`${backendBaseUrl}/api/teachers/review/${userId}/program-plan/approved-pdf`, {
          method: 'POST',
          headers: { Authorization: `Bearer ${session.access_token}` },
        });
        if (!response.ok) {
          const result = await response.json();
          throw new Error(result.detail ?? 'PDF-д гарын үсэг, тамга нэгтгэсэнгүй.');
        }
        const pdf = new File([await response.blob()], `approved-program-plan-${userId}.pdf`, { type: 'application/pdf' });
        signedDocumentUrl = (await uploadCloudinaryFile(pdf, ['pdf'])).url;
      }
      await request(`/api/teachers/review/${userId}/program-plan`, 'PATCH', {
        approved,
        ...(signedDocumentUrl ? { signed_document_url: signedDocumentUrl } : {}),
      });
      await loadRecords();
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : 'Төлөвлөгөөний төлөв хадгалагдсангүй.');
    } finally {
      setReviewingPlan('');
    }
  };

  const deletePlan = async (userId: string) => {
    if (!window.confirm('Энэ багшийн хөтөлбөр, төлөвлөгөөг устгах уу?')) return;
    setReviewingPlan(userId);
    try {
      await request(`/api/teachers/review/${userId}/program-plan`, 'DELETE');
      setErrorMessage('');
      await loadRecords();
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : 'Хөтөлбөр, төлөвлөгөө устгагдсангүй.');
    } finally {
      setReviewingPlan('');
    }
  };

  const returnPlan = async (userId: string) => {
    if (!window.confirm('Энэ хөтөлбөр, төлөвлөгөөг засуулахаар багшид буцаах уу?')) return;
    setReviewingPlan(userId);
    try {
      const result = await request(`/api/teachers/review/${userId}/program-plan/return`, 'POST');
      setErrorMessage('');
      setRecords((current) => current.map((record) => record.user_id === userId
        ? { ...record, program_plan: result.program_plan }
        : record));
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : 'Хөтөлбөр, төлөвлөгөөг буцааж чадсангүй.');
    } finally {
      setReviewingPlan('');
    }
  };

  if (loading) return <p>Материал ачаалж байна...</p>;

  const submittedRecords = records.filter((record): record is SubmittedPlanRecord =>
    !!record.program_plan && !record.program_plan.returned && record.program_plan.review_status !== 'returned',
  );

  return (
    <section>
      <header style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 10 }}>
        <h2 style={{ marginTop: 0 }}>{summaryOnly ? 'Үнэлгээний нэгтгэл' : 'Багшийн материал хянах'}</h2>
        {!summaryOnly && <button type="button" aria-label="Гарын үсэг, тамганы тохиргоо" title="Гарын үсэг, тамганы тохиргоо" onClick={() => { setApprovalAssetsDraft(approvalAssets); setApprovalAssetsOpen(true); }} style={{ display: 'grid', placeItems: 'center', width: 36, height: 36, border: '1px solid #cbd5e1', borderRadius: 9, background: '#fff', color: '#1d4ed8', cursor: 'pointer' }}>
          <PenLine size={18} />
        </button>}
      </header>
      {errorMessage && <p role="alert" style={{ color: '#b91c1c' }}>{errorMessage}</p>}
      {!summaryOnly && <ApprovalAssetsDialog
        open={approvalAssetsOpen}
        assets={approvalAssetsDraft}
        saving={savingApprovalAssets}
        onChange={(assets) => setApprovalAssetsDraft({ ...assets, composite_url: '' })}
        onClose={() => setApprovalAssetsOpen(false)}
        onSave={() => void saveApprovalAssets()}
      />}
      {!summaryOnly && managerApprovalAssets.length > 0 && <details style={{ margin: '0 0 16px', padding: '10px 12px', border: '1px solid #dbeafe', borderRadius: 10, background: '#f8fbff' }}>
        <summary style={{ color: '#1e40af', fontWeight: 700, cursor: 'pointer' }}>
          Менежерүүдийн нэгтгэсэн гарын үсэг, тамга ({managerApprovalAssets.length})
        </summary>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 12, marginTop: 12 }}>
          {managerApprovalAssets.map((manager) => (
            <figure key={manager.user_id} style={{ margin: 0, display: 'grid', alignContent: 'start', justifyItems: 'center', gap: 6, padding: 10, border: '1px solid #e2e8f0', borderRadius: 8, background: '#fff' }}>
              <figcaption style={{ textAlign: 'center', fontSize: 12, fontWeight: 700, color: '#334155' }}>
                {manager.name || manager.email}
                <small style={{ display: 'block', fontWeight: 400 }}>{manager.email}</small>
              </figcaption>
              {manager.composite_url
                ? <img src={manager.composite_url} alt={`${manager.name || manager.email} гарын үсэг, тамганы нийлмэл зураг`} style={{ width: '100%', maxWidth: 240, height: 140, objectFit: 'contain', background: '#fff' }} />
                : <p style={{ margin: 0, color: '#64748b', fontSize: 12 }}>Одоогоор зураг хадгалаагүй.</p>}
            </figure>
          ))}
        </div>
      </details>}
      {summaryOnly && <EvaluationSummary
        records={records}
        selectedBand={selectedBand}
        setSelectedBand={setSelectedBand}
        selectedSubject={selectedSubject}
        setSelectedSubject={setSelectedSubject}
        unreadNotificationKeys={unreadNotificationKeys}
        onEvaluationViewed={onEvaluationViewed}
      />}
      {!summaryOnly && <PlanReviewList
        records={submittedRecords}
        reviewingPlan={reviewingPlan}
        unreadNotificationKeys={unreadNotificationKeys}
        onPlanViewed={onPlanViewed}
        onReview={(userId, approved) => void reviewPlan(userId, approved)}
        onReturn={(userId) => void returnPlan(userId)}
        onDelete={(userId) => void deletePlan(userId)}
      />}
    </section>
  );
}
