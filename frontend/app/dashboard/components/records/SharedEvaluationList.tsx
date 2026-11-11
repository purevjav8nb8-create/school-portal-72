import { EvaluationRecord } from './evaluationTypes';

export default function SharedEvaluationList({ evaluations }: { evaluations: (EvaluationRecord & { evaluator?: string })[] }) {
  if (!evaluations.length) return null;
  return <section style={{ padding: 12, border: '1px solid #bfdbfe', borderRadius: 10, background: 'linear-gradient(120deg, #eff6ff, #fff)' }}>
    <h3 style={{ margin: '0 0 8px', color: '#1e40af' }}>Миний даасан ангийн үнэлгээ · {evaluations.length}</h3>
    <div style={{ display: 'grid', gap: 6 }}>
      {evaluations.map((item) => <article key={item.id} style={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'space-between', gap: 8, padding: 9, borderRadius: 8, background: '#fff', border: '1px solid #dbeafe' }}>
        <strong>{item.grade}-{item.section} · {item.subject} · {item.level}</strong>
        <span>{item.students_count} хүүхэд · дундаж {item.average_score}</span>
        <small style={{ width: '100%', color: '#64748b' }}>{item.evaluator || 'Багш'} · {item.evaluation_date}</small>
      </article>)}
    </div>
  </section>;
}
