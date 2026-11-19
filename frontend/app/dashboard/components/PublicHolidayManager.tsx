'use client';

import { FormEvent, useEffect, useState } from 'react';
import styles from './TeacherDetailModal.module.css';
import { listPublicHolidays, PublicHoliday, removePublicHoliday, savePublicHoliday, savePublicHolidays } from './publicHolidaysApi';
import { parsePublicHolidayText } from './publicHolidayImport';

interface Props {
  initialYear: number;
  onChanged?: () => void;
}

export default function PublicHolidayManager({ initialYear, onChanged }: Props) {
  const [open, setOpen] = useState(false);
  const [yearText, setYearText] = useState(String(initialYear));
  const [holidayDate, setHolidayDate] = useState(`${initialYear}-01-01`);
  const [name, setName] = useState('Бүх нийтийн амралт');
  const [bulkText, setBulkText] = useState('');
  const [holidays, setHolidays] = useState<PublicHoliday[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [deletingDate, setDeletingDate] = useState('');
  const [errorMessage, setErrorMessage] = useState('');
  const [successMessage, setSuccessMessage] = useState('');
  const year = Number(yearText);
  const validYear = /^\d{4}$/.test(yearText) && Number.isInteger(year) && year >= 1900 && year <= 2200;

  useEffect(() => {
    setYearText(String(initialYear));
    setHolidayDate(`${initialYear}-01-01`);
  }, [initialYear]);

  useEffect(() => {
    if (!open || !validYear) {
      setHolidays([]);
      setLoading(false);
      return;
    }
    let active = true;
    setLoading(true);
    setErrorMessage('');
    setHolidays([]);
    void listPublicHolidays(year)
      .then((result) => {
        if (active) setHolidays(result);
      })
      .catch((error: unknown) => {
        if (active) setErrorMessage(error instanceof Error ? error.message : 'Амралтын өдрүүд уншигдсангүй.');
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => { active = false; };
  }, [open, validYear, year]);

  const addHoliday = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!validYear || !holidayDate.startsWith(`${year}-`)) {
      setErrorMessage('Огноо сонгосон онтой таарах ёстой.');
      return;
    }
    setSaving(true);
    setErrorMessage('');
    setSuccessMessage('');
    try {
      const saved = await savePublicHoliday(year, { holiday_date: holidayDate, name });
      setHolidays((current) => [...current.filter((item) => item.date !== saved.date), saved].sort((a, b) => a.date.localeCompare(b.date)));
      setName('Бүх нийтийн амралт');
      setSuccessMessage('Амралтын өдөр хадгалагдлаа.');
      onChanged?.();
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : 'Амралтын өдрийг хадгалж чадсангүй.');
    } finally {
      setSaving(false);
    }
  };

  const importHolidays = async () => {
    if (!validYear) {
      setErrorMessage('Оны утга буруу байна.');
      return;
    }
    let imported: ReturnType<typeof parsePublicHolidayText>;
    try {
      imported = parsePublicHolidayText(year, bulkText);
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : 'Жагсаалтыг уншиж чадсангүй.');
      setSuccessMessage('');
      return;
    }

    setSaving(true);
    setErrorMessage('');
    setSuccessMessage('');
    try {
      const saved = await savePublicHolidays(year, imported);
      setHolidays((current) => {
        const byDate = new Map(current.map((holiday) => [holiday.date, holiday]));
        saved.forEach((holiday) => byDate.set(holiday.date, holiday));
        return [...byDate.values()].sort((first, second) => first.date.localeCompare(second.date));
      });
      setBulkText('');
      setSuccessMessage(`${saved.length} амралтын өдөр хадгалагдлаа.`);
      onChanged?.();
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : 'Жагсаалтыг хадгалж чадсангүй.');
    } finally {
      setSaving(false);
    }
  };

  const deleteHoliday = async (holiday: PublicHoliday) => {
    setDeletingDate(holiday.date);
    setErrorMessage('');
    setSuccessMessage('');
    try {
      await removePublicHoliday(year, holiday.date);
      setHolidays((current) => current.filter((item) => item.date !== holiday.date));
      onChanged?.();
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : 'Амралтын өдрийг устгаж чадсангүй.');
    } finally {
      setDeletingDate('');
    }
  };

  return (
    <div>
      <button type="button" className={styles.secondaryButton} onClick={() => setOpen((current) => !current)}>
        {open ? 'Тохиргоо хаах' : 'Амралтын өдөр оруулах'}
      </button>
      {open && <section aria-label="Бүх нийтийн амралтын өдөр тохируулах" style={{ margin: '0 0 12px', padding: 14, border: '1px solid #dbeafe', borderRadius: 12, background: '#f8fbff' }}>
        <h4 style={{ margin: '0 0 10px', fontSize: 14 }}>{validYear ? `${year} оны бүх нийтийн амралтын өдрүүд` : 'Он сонгоно уу'}</h4>
        <label className={styles.field} style={{ maxWidth: 180, marginBottom: 10 }}>
          Жил
          <input
            className={styles.input}
            type="number"
            min={1900}
            max={2200}
            step={1}
            value={yearText}
            onChange={(event) => {
              const nextYear = event.target.value;
              setYearText(nextYear);
              if (/^\d{4}$/.test(nextYear)) setHolidayDate(`${nextYear}-01-01`);
            }}
          />
        </label>
        <label className={styles.field} style={{ marginBottom: 10 }}>
          Жилийн амралтын өдрүүдийг жагсаалтаар оруулах
          <textarea
            className={styles.input}
            rows={7}
            value={bulkText}
            onChange={(event) => setBulkText(event.target.value)}
            placeholder={'1-р сарын 1 - Пүрэв гараг\n7-р сарын 10-15 /Үндэсний их баяр наадам/ - Баасан, Бямба, Ням, Даваа, Мягмар, Лхагва гараг'}
            style={{ resize: 'vertical' }}
          />
          <small style={{ fontWeight: 400 }}>Мөр бүрийг жишээний хэлбэрээр оруулна. Жилийг дээрх талбараас авна; `/.../` доторх нэрийг амралтын өдөрт хадгална.</small>
        </label>
        <button type="button" className={styles.primaryButton} disabled={!validYear || saving || loading || !bulkText.trim()} onClick={() => void importHolidays()}>
          {saving ? 'Хадгалж байна...' : 'Жагсаалтыг хадгалах'}
        </button>
        <form onSubmit={(event) => void addHoliday(event)} style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', alignItems: 'end', gap: 10 }}>
          <label className={styles.field}>
            Огноо
            <input
              className={styles.input}
              required
              type="date"
              min={validYear ? `${year}-01-01` : undefined}
              max={validYear ? `${year}-12-31` : undefined}
              value={holidayDate}
              onChange={(event) => setHolidayDate(event.target.value)}
            />
          </label>
          <label className={styles.field}>
            Нэр
            <input className={styles.input} required maxLength={120} value={name} onChange={(event) => setName(event.target.value)} />
          </label>
          <button type="submit" className={styles.primaryButton} disabled={!validYear || saving || loading}>
            {saving ? 'Хадгалж байна...' : 'Өдөр нэмэх'}
          </button>
        </form>
        {errorMessage && <p role="alert" className={styles.error} style={{ marginTop: 10 }}>{errorMessage}</p>}
        {successMessage && <p role="status" style={{ margin: '10px 0 0', color: '#15803d', fontSize: 13 }}>{successMessage}</p>}
        {loading ? <p style={{ margin: '12px 0 0', color: '#64748b' }}>Жагсаалт ачаалж байна...</p>
          : !validYear ? null
            : holidays.length === 0 ? <p className={styles.empty} style={{ marginTop: 12 }}>Энэ жил амралтын өдөр бүртгээгүй байна.</p>
              : <ul style={{ display: 'grid', gap: 6, margin: '12px 0 0', padding: 0, listStyle: 'none' }}>
                {holidays.map((holiday) => <li key={holiday.date} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8, padding: '7px 10px', border: '1px solid #e2e8f0', borderRadius: 8, background: '#fff' }}>
                  <span><strong>{holiday.date}</strong> · {holiday.name}</span>
                  <button type="button" className={styles.button} disabled={deletingDate === holiday.date} onClick={() => void deleteHoliday(holiday)}>
                    {deletingDate === holiday.date ? 'Устгаж байна...' : 'Устгах'}
                  </button>
                </li>)}
              </ul>}
      </section>}
    </div>
  );
}
