'use client';

import { useEffect, useState } from 'react';
import { PenLine } from 'lucide-react';
import { backendBaseUrl, fetchWithAuth } from '../../../../lib/backendApi';
import { supabase } from '../../../../lib/supabaseClient';
import { uploadCloudinaryFile } from '../../../../components/LosslessCloudinaryUpload';
import ApprovalAssetsDialog from './ApprovalAssetsDialog';
import EvaluationSummary from './EvaluationSummary';
import PlanReviewList from './PlanReviewList';
import { ApprovalAssets, GradeBand, SubmittedPlanRecord, TeacherRecords } from './adminReviewTypes';

const evaluationLevels = ['VIII', 'VII', 'VI', 'V', 'IV', 'III', 'II', 'I'] as const;

interface Props {
  summaryOnly?: boolean;
  selectedBand: GradeBand;
  setSelectedBand: (band: GradeBand) => void;
  selectedSubject: string;
  setSelectedSubject: (subject: string) => void;
}

export default function AdminReviewPanel({
  summaryOnly = false,
  selectedBand,
  setSelectedBand,
  selectedSubject,
  setSelectedSubject,
}: Props) {
  const [records, setRecords] = useState<TeacherRecords[]>([]);
  const [loading, setLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState('');
  const [approvalAssets, setApprovalAssets] = useState<ApprovalAssets>({ signature_url: '', stamp_url: '' });
  const [approvalAssetsDraft, setApprovalAssetsDraft] = useState(approvalAssets);
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
        evaluations: Array.isArray(record.evaluations) ? record.evaluations.filter((evaluation) => {
          const grade = Number(evaluation.grade);
          const studentsCount = Number(evaluation.students_count);
          const averageScore = Number(evaluation.average_score);
          return Number.isInteger(grade)
            && grade > 0
            && String(evaluation.section ?? '').trim().length > 0
            && String(evaluation.subject ?? '').trim().length > 0
            && evaluationLevels.includes(evaluation.level as typeof evaluationLevels[number])
            && Number.isFinite(studentsCount)
            && studentsCount > 0
            && Number.isFinite(averageScore);
        }) : [],
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

  useEffect(() => {
    void loadRecords();
    if (!summaryOnly) void loadApprovalAssets();
  }, []);

  const saveApprovalAssets = async () => {
    if (!approvalAssetsDraft.signature_url || !approvalAssetsDraft.stamp_url) {
      setErrorMessage('Гарын үсэг, тамганы зургийг хоёуланг нь оруулна уу.');
      return;
    }
    setSavingApprovalAssets(true);
    try {
      const saved = await request('/api/teachers/review/program-plan/approval-assets', 'PUT', approvalAssetsDraft) as ApprovalAssets;
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
    if (approved && (!approvalAssets.signature_url || !approvalAssets.stamp_url)) {
      setErrorMessage('Батлахын өмнө хянах хуудасны гарын үсэг, тамганы тохиргоог хадгална уу.');
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
          headers: { Authorization: `Bearer ${session.access_token}`, 'Content-Type': 'application/json' },
          body: JSON.stringify(approvalAssets),
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
        onChange={setApprovalAssetsDraft}
        onClose={() => setApprovalAssetsOpen(false)}
        onSave={() => void saveApprovalAssets()}
      />}
      {summaryOnly && <EvaluationSummary
        records={records}
        selectedBand={selectedBand}
        setSelectedBand={setSelectedBand}
        selectedSubject={selectedSubject}
        setSelectedSubject={setSelectedSubject}
      />}
      {!summaryOnly && <PlanReviewList
        records={submittedRecords}
        approvalAssetsReady={!!approvalAssets.signature_url && !!approvalAssets.stamp_url}
        reviewingPlan={reviewingPlan}
        onReview={(userId, approved) => void reviewPlan(userId, approved)}
        onReturn={(userId) => void returnPlan(userId)}
        onDelete={(userId) => void deletePlan(userId)}
      />}
    </section>
  );
}
