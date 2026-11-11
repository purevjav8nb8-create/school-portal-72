'use client';

import { Dispatch, SetStateAction } from 'react';

export const SCHOOL_UNITS = ['БАЗАН', 'БУЗАН', 'НУЗАН'] as const;

export default function UnitTargetSelector({
  selectedUnits,
  setSelectedUnits,
  label,
  compact = false,
}: {
  selectedUnits: string[];
  setSelectedUnits: Dispatch<SetStateAction<string[]>>;
  label?: string;
  compact?: boolean;
}) {
  const allSelected = SCHOOL_UNITS.every((unit) => selectedUnits.includes(unit));

  const selectAll = () => setSelectedUnits([...SCHOOL_UNITS]);
  const toggleUnit = (unit: string, checked: boolean) => {
    setSelectedUnits((current) => {
      return checked
        ? [...new Set([...current, unit])]
        : current.filter((item) => item !== unit);
    });
  };

  return (
    <fieldset style={{ margin: 0, padding: compact ? '5px 8px' : 8, border: '1px solid #cbd5e1', borderRadius: 8 }}>
      {label && <legend style={{ fontSize: compact ? 12 : undefined }}>{label}</legend>}
      <button
        type="button"
        aria-pressed={allSelected}
        onClick={selectAll}
        style={{
          marginRight: compact ? 8 : 10,
          padding: compact ? '2px 6px' : '3px 8px',
          border: `1px solid ${allSelected ? '#0f766e' : '#cbd5e1'}`,
          borderRadius: 5,
          background: allSelected ? '#ccfbf1' : '#fff',
          color: '#134e4a',
          cursor: 'pointer',
        }}
      >
        Бүгд
      </button>
      {SCHOOL_UNITS.map((unit) => (
        <label key={unit} style={{ marginRight: compact ? 8 : 10, fontSize: compact ? 12 : undefined }}>
          <input
            type="checkbox"
            checked={selectedUnits.includes(unit)}
            onChange={(event) => toggleUnit(unit, event.target.checked)}
          />{' '}
          {unit}
        </label>
      ))}
      {selectedUnits.length === 0 && (
        <small style={{ display: 'block', marginTop: 4, color: '#64748b' }}>
          Хүлээн авагчийн нэгжийг сонгоно уу.
        </small>
      )}
    </fieldset>
  );
}
