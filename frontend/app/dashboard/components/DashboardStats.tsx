type Props = {
  totalTeachers: number;
  activeTeachers: number;

  bazanTotal: number;
  bazanActive: number;

  buzanTotal: number;
  buzanActive: number;

  nuzanTotal: number;
  nuzanActive: number;
};

export default function DashboardStats({
  totalTeachers,
  activeTeachers,
  bazanTotal,
  bazanActive,
  buzanTotal,
  buzanActive,
  nuzanTotal,
  nuzanActive,
}: Props) {
  return (
    <div
      style={{
        display: 'grid',
        gridTemplateColumns:
          'repeat(4, 1fr)',
        gap: '12px',
        marginBottom: '16px',
      }}
    >
      <StatCard
        title="НИЙТ"
        total={totalTeachers}
        active={activeTeachers}
      />

      <StatCard
        title="БАЗАН"
        total={bazanTotal}
        active={bazanActive}
      />

      <StatCard
        title="БУЗАН"
        total={buzanTotal}
        active={buzanActive}
      />

      <StatCard
        title="НУЗАН"
        total={nuzanTotal}
        active={nuzanActive}
      />
    </div>
  );
}

function StatCard({
  title,
  total,
  active,
}: {
  title: string;
  total: number;
  active: number;
}) {
  return (
    <div
      style={{
        backgroundColor: 'white',
        borderRadius: '14px',
        padding: '16px',
        boxShadow:
          '0 2px 10px rgba(0,0,0,0.05)',
      }}
    >
      <h3>{title}</h3>
      <div>Нийт: {total}</div>
      <div>Идэвхтэй: {active}</div>
    </div>
  );
}