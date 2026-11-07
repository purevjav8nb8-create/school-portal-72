'use client';

interface Props {
  activeUnit: string;
  setActiveUnit: (
    unit: 'НИЙТ' | 'БАЗАН' | 'БУЗАН' | 'НУЗАН'
  ) => void;

  totalTeachers: number;
  activeTeachers: number;

  bazanTotal: number;
  bazanActive: number;

  buzanTotal: number;
  buzanActive: number;

  nuzanTotal: number;
  nuzanActive: number;
}

export default function UnitTabs({
  activeUnit,
  setActiveUnit,
  totalTeachers,
  activeTeachers,
  bazanTotal,
  bazanActive,
  buzanTotal,
  buzanActive,
  nuzanTotal,
  nuzanActive,
}: Props) {
  const tabs = [
    {
      key: 'НИЙТ',
      label: 'НИЙТ',
      value: `${totalTeachers}-${activeTeachers}`,
    },
    {
      key: 'БУЗАН',
      label: 'БУЗАН',
      value: `${buzanTotal}-${buzanActive}`,
    },
    {
      key: 'НУЗАН',
      label: 'НУЗАН',
      value: `${nuzanTotal}-${nuzanActive}`,
    },
    {
      key: 'БАЗАН',
      label: 'БАЗАН',
      value: `${bazanTotal}-${bazanActive}`,
    },
  ] as const;

  return (
    <div
      style={{
        display: 'flex',
        justifyContent: 'space-around',
        alignItems: 'center',
        marginBottom: '8px',
        borderBottom: '1px solid #e2e8f0',
        paddingBottom: '7px',
      }}
    >
      {tabs.map((tab) => (
        <button
          key={tab.key}
          onClick={() =>
            setActiveUnit(
              tab.key as
                | 'НИЙТ'
                | 'БАЗАН'
                | 'БУЗАН'
                | 'НУЗАН'
            )
          }
          style={{
            background: 'none',
            border: 'none',
            cursor: 'pointer',
            textAlign: 'center',
            color:
              activeUnit === tab.key
                ? '#111827'
                : '#94a3b8',
            fontWeight: '700',
          }}
        >
          <div
  style={{
    fontSize: '14px',
    fontWeight: '700',
  }}
>
  {tab.label}
</div>

<div
  style={{
    marginTop: '2px',
    fontSize: '10px',
    opacity: 0.8,
  }}
>
  {tab.value}
</div>
        </button>
      ))}
    </div>
  );
}