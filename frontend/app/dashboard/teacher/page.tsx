'use client';

import { useEffect, useMemo, useState } from 'react';
import { backendBaseUrl } from '../../../lib/backendApi';
import TeacherDashboardView, { TeacherTraining } from '../components/TeacherDashboardView';
import { ActivityInput } from '../components/records/ActivityForm';
import { TeacherActivity } from '../components/records/ActivityPanel';
import { ProgramPlan } from '../components/records/ProgramPlanPanel';
import { EvaluationRecord } from '../components/records/EvaluationPanel';
import { supabase } from '../../../lib/supabaseClient';
import { DashboardCategory, Teacher, UserProfile } from '../types';
import { AttendanceRecord } from '../utils/attendance';
import { useNotifications } from '../hooks/useNotifications';

const apiUrl = backendBaseUrl;

type TeacherWorkspace = {
	profile: UserProfile;
	attendance: AttendanceRecord[];
	trainings: TeacherTraining[];
	evaluations: EvaluationRecord[];
	program_plan?: ProgramPlan;
	activities: TeacherActivity[];
	awards: { id: string; name: string; certificate_number: string; certificate_url: string; organization: string; awarded_date?: string; note: string }[];
	professional_degrees: { id: string; name: string; certificate_number: string; certificate_url: string; status: string; issued_date?: string; note: string }[];
};

export default function TeacherDashboardPage() {
	const [user, setUser] = useState<UserProfile | null>(null);
	const [attendance, setAttendance] = useState<AttendanceRecord[]>([]);
	const [trainings, setTrainings] = useState<TeacherTraining[]>([]);
	const [evaluations, setEvaluations] = useState<TeacherWorkspace['evaluations']>([]);
	const [programPlan, setProgramPlan] = useState<ProgramPlan | undefined>();
	const [activities, setActivities] = useState<TeacherActivity[]>([]);
	const [awards, setAwards] = useState<TeacherWorkspace['awards']>([]);
	const [degrees, setDegrees] = useState<TeacherWorkspace['professional_degrees']>([]);
	const [activeCategory, setActiveCategory] = useState<DashboardCategory>('Ирц');
	const [selectedMonth, setSelectedMonth] = useState(() => {
		const now = new Date();
		return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
	});
	const [loading, setLoading] = useState(true);
	const [busy, setBusy] = useState(false);
	const [errorMessage, setErrorMessage] = useState('');
	const [successMessage, setSuccessMessage] = useState('');
	const personalNotificationItems = useMemo(() => [
		...awards.map((item) => ({ id: item.id, category: 'Шагнал' as const })),
		...degrees.map((item) => ({ id: item.id, category: 'Зэрэг' as const })),
	], [awards, degrees]);
	const { counts: notificationCounts, markRead } = useNotifications('teacher', personalNotificationItems);

	useEffect(() => {
		const loadProfile = async () => {
			const { data: { user: authUser } } = await supabase.auth.getUser();
			const mockToken = window.localStorage.getItem('school-portal-mock-token');
			if (!authUser && !mockToken) {
				window.location.href = '/';
				return;
			}
			if (mockToken && !authUser) {
				try {
					const response = await fetch(`${apiUrl}/api/teachers/me`, {
						headers: { Authorization: `Bearer ${mockToken}` },
					});
					const result = await response.json() as TeacherWorkspace;
					if (!response.ok) throw new Error('Загвар багшийн мэдээлэл уншигдсангүй.');
					setUser({ ...result.profile, unit: result.profile.unit.trim().toUpperCase(), role: 'teacher' });
					setAttendance(result.attendance);
					setTrainings(result.trainings);
					setEvaluations(result.evaluations);
					setProgramPlan(result.program_plan);
					setActivities(result.activities ?? []);
					setAwards(result.awards ?? []);
					setDegrees(result.professional_degrees ?? []);
				} catch (error) {
					window.localStorage.removeItem('school-portal-mock-token');
					window.location.href = '/';
				} finally {
					setLoading(false);
				}
				return;
			}
			if (authUser && mockToken) {
				window.localStorage.removeItem('school-portal-mock-token');
			}
			if (authUser.app_metadata?.role === 'admin' || authUser.email?.toLowerCase() === 'admin@moes.edu.mn') {
				window.location.href = '/dashboard/admin';
				return;
			}
			const { data: { session } } = await supabase.auth.getSession();
			if (!session) {
				window.location.href = '/';
				return;
			}
			try {
				const response = await fetch(`${apiUrl}/api/teachers/me`, {
					headers: { Authorization: `Bearer ${session.access_token}` },
				});
				const result = await response.json();
				if (!response.ok) throw new Error(result.detail ?? 'Багшийн мэдээлэл уншигдсангүй.');
				const workspace = result as TeacherWorkspace;
				setUser({
					...workspace.profile,
					unit: workspace.profile.unit.trim().toUpperCase(),
					role: 'teacher',
				});
				setAttendance(workspace.attendance);
				setTrainings(workspace.trainings);
				setEvaluations(workspace.evaluations);
				setProgramPlan(workspace.program_plan);
				setActivities(workspace.activities ?? []);
				setAwards(workspace.awards ?? []);
				setDegrees(workspace.professional_degrees ?? []);
			} catch (error) {
				const metadata = authUser.user_metadata ?? {};
				setUser({
					last_name: metadata.last_name ?? metadata.family_name ?? '',
					first_name: metadata.first_name ?? metadata.given_name ?? authUser.email?.split('@')[0] ?? 'Багш',
					email: authUser.email ?? '',
					unit: String(metadata.unit ?? 'Нэгж бүртгэгдээгүй').trim().toUpperCase(),
					subject: metadata.subject ?? 'Мэргэжил бүртгэгдээгүй',
					subjects: metadata.subjects ?? (metadata.subject ? [metadata.subject] : []),
					role: 'teacher',
				});
				setErrorMessage(
					error instanceof TypeError
						? 'Сервертэй холбогдож чадсангүй. Backend API-г асаана уу.'
						: error instanceof Error ? error.message : 'Мэдээлэл уншигдсангүй.'
				);
			} finally {
				setLoading(false);
			}
		};
		void loadProfile();
	}, []);

	const handleLogout = async () => {
		window.localStorage.removeItem('school-portal-mock-token');
		await supabase.auth.signOut();
		window.location.href = '/';
	};

	const saveRecord = async (path: string, payload: object, method = 'POST') => {
		let { data: { session } } = await supabase.auth.getSession();
		const mockToken = window.localStorage.getItem('school-portal-mock-token');
		if (!session && mockToken) session = { access_token: mockToken } as typeof session;
		if (!session && !mockToken) throw new Error('Дахин нэвтэрнэ үү.');
		const response = await fetch(`${apiUrl}${path}`, {
			method,
			headers: { Authorization: `Bearer ${session.access_token}`, 'Content-Type': 'application/json' },
			body: JSON.stringify(payload),
		});
		const responseText = await response.text();
		let result: { detail?: string; [key: string]: unknown };
		try {
			result = JSON.parse(responseText) as typeof result;
		} catch {
			throw new Error(`Серверийн хариу буруу байна (${response.status}). Backend-ээ restart хийнэ үү.`);
		}
		if (!response.ok) throw new Error(result.detail ?? 'Мэдээлэл хадгалагдсангүй.');
		return result;
	};

	const addTraining = async (training: Omit<TeacherTraining, 'id' | 'createdAt'>) => {
		setBusy(true);
		setErrorMessage('');
		setSuccessMessage('');
		try {
			const result = await saveRecord('/api/teachers/me/trainings', training);
			setTrainings((current) => [result.training as TeacherTraining, ...current]);
			setSuccessMessage('Сургалтын мэдээлэл хадгалагдлаа.');
		} catch (error) {
			setErrorMessage(error instanceof Error ? error.message : 'Сургалт хадгалагдсангүй.');
			throw error;
		} finally {
			setBusy(false);
		}
	};

	const addActivity = async (activity: ActivityInput) => {
		setBusy(true);
		setErrorMessage('');
		setSuccessMessage('');
		try {
			const result = await saveRecord('/api/teachers/me/activities', activity);
			setActivities((current) => [...current, result.activity as TeacherActivity]);
			setSuccessMessage('Тэмдэглэл админд хянуулахаар илгээгдлээ.');
		} catch (error) {
			setErrorMessage(error instanceof Error ? error.message : 'Тэмдэглэл хадгалагдсангүй.');
			throw error;
		} finally {
			setBusy(false);
		}
	};

	const saveProfessional = async (path: string, payload: object) => {
		setBusy(true);
		try {
			const result = await saveRecord(path, payload);
			if (path.includes('/awards')) setAwards((current) => [...current, result.award as TeacherWorkspace['awards'][number]]);
			else setDegrees((current) => [...current, result.degree as TeacherWorkspace['professional_degrees'][number]]);
		} finally {
			setBusy(false);
		}
	};

	const addEvaluation = async (evaluation: Omit<EvaluationRecord, 'id' | 'createdAt'>) => {
		setBusy(true);
		setErrorMessage('');
		setSuccessMessage('');
		try {
			const result = await saveRecord('/api/teachers/me/evaluations', evaluation);
			setEvaluations((current) => [...current, result.evaluation as EvaluationRecord]);
			setSuccessMessage('Үнэлгээ хадгалагдлаа.');
		} catch (error) {
			setErrorMessage(error instanceof Error ? error.message : 'Үнэлгээ хадгалагдсангүй.');
			throw error;
		} finally {
			setBusy(false);
		}
	};

	const deleteEvaluation = async (evaluationId: string) => {
		setBusy(true);
		setErrorMessage('');
		setSuccessMessage('');
		try {
			await saveRecord(`/api/teachers/me/evaluations/${evaluationId}`, {}, 'DELETE');
			setEvaluations((current) => current.filter((item) => item.id !== evaluationId));
			setSuccessMessage('Үнэлгээ устгагдлаа.');
		} catch (error) {
			setErrorMessage(error instanceof Error ? error.message : 'Үнэлгээ устгагдсангүй.');
			throw error;
		} finally {
			setBusy(false);
		}
	};

	const submitProgramPlan = async (documentUrl: string, note: string, grade: number, section: string, subject: string) => {
		setBusy(true);
		setErrorMessage('');
		setSuccessMessage('');
		try {
			const result = await saveRecord('/api/teachers/me/program-plan', { documentUrl, note, grade, section, subject }, 'PUT');
			setProgramPlan(result.program_plan as ProgramPlan);
			setSuccessMessage('Хөтөлбөр, төлөвлөгөөг админд илгээлээ.');
		} catch (error) {
			setErrorMessage(error instanceof Error ? error.message : 'Хөтөлбөр хадгалагдсангүй.');
			throw error;
		} finally {
			setBusy(false);
		}
	};

	if (loading) return <main style={{ padding: 32 }}>Ачаалж байна...</main>;
	if (!user) return <main style={{ padding: 32 }} role="alert">{errorMessage || 'Багшийн мэдээлэл олдсонгүй.'}</main>;

	const unit = ['БАЗАН', 'БУЗАН', 'НУЗАН'].includes(user.unit)
		? user.unit as Teacher['unit']
		: 'БАЗАН';
	const dailyRecords = attendance;
	const monthRecords = dailyRecords.filter((record) => record.date.startsWith(selectedMonth));
	const latestRecord = [...attendance].sort((a, b) => b.date.localeCompare(a.date))[0];
	const attendanceStatus = latestRecord?.status as Teacher['attendance'] | undefined;
	const teacher: Teacher = {
		id: 1,
		last_name: user.last_name,
		first_name: user.first_name,
		email: user.email,
		unit,
		subject: user.subject,
		attendance: attendanceStatus ?? 'Ирсэн',
		monthly_attendance_rate: monthRecords.length > 0
			? Math.round((monthRecords.filter((record) => record.status === 'Ирсэн').length / monthRecords.length) * 100)
			: 0,
		training_status: trainings.length > 0 ? 'Хамрагдсан' : 'Хамрагдаагүй',
		rating: evaluations.at(-1)?.average_score ?? 0,
		monthly_login_count: 0,
		teaching_classes: user.teaching_classes ?? [],
		daily_records: dailyRecords,
	};
	const visibleTeachers = [teacher];

	return (
		<TeacherDashboardView
			user={user}
			teacher={teacher}
			trainings={trainings}
			evaluations={evaluations}
			programPlan={programPlan}
			activities={activities}
			awards={awards}
			degrees={degrees}
			activeCategory={activeCategory}
			selectedMonth={selectedMonth}
			setSelectedMonth={setSelectedMonth}
			busy={busy}
			errorMessage={errorMessage}
			successMessage={successMessage}
			onCategoryChange={setActiveCategory}
			onLogout={handleLogout}
			onTraining={addTraining}
			onProgramPlan={submitProgramPlan}
			onActivity={addActivity}
			onEvaluation={addEvaluation}
			onDeleteEvaluation={deleteEvaluation}
			onProfessionalSave={saveProfessional}
			notificationCounts={notificationCounts}
			onNotificationCategoryChange={(category) => { markRead(category); setActiveCategory(category); }}
		/>
	);
}
