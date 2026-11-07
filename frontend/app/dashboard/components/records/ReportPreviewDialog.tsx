'use client';

import { X } from 'lucide-react';

type ReportData = {
  title: string;
  columns: string[];
  rows: Record<string, string | number>[];
};

interface Props {
  report?: ReportData;
  pdfUrl?: string;
  downloadLabel?: string;
  onDownload?: () => void;
  onClose: () => void;
}

export default function ReportPreviewDialog({ report, pdfUrl, downloadLabel = 'Татах', onDownload, onClose }: Props) {
  if (!report && !pdfUrl) return null;

  return (
    <div
      role="presentation"
      onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}
      style={{ position: 'fixed', inset: 0, zIndex: 50, display: 'grid', placeItems: 'center', padding: 16, background: 'rgba(15, 23, 42, 0.5)' }}
    >
      <section role="dialog" aria-modal="true" aria-label={report?.title ?? 'PDF тайлан'} style={{ width: 'min(1100px, 100%)', height: 'min(85vh, 900px)', display: 'flex', flexDirection: 'column', overflow: 'hidden', background: '#fff', borderRadius: 10, boxShadow: '0 20px 60px rgba(15, 23, 42, 0.25)' }}>
        <header style={{ flex: '0 0 auto', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, padding: '14px 18px', borderBottom: '1px solid #e2e8f0', background: '#fff' }}>
          <h2 style={{ margin: 0, fontSize: 18 }}>{report?.title ?? 'PDF тайлан'}</h2>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            {onDownload && <button type="button" onClick={onDownload} style={{ padding: '7px 12px', border: 0, borderRadius: 6, background: '#2563eb', color: '#fff', cursor: 'pointer', fontSize: 12 }}>{downloadLabel}</button>}
            <button type="button" title="Буцах" aria-label="Буцах" onClick={onClose} style={{ padding: '7px 12px', border: '1px solid #cbd5e1', borderRadius: 6, background: '#fff', cursor: 'pointer', fontSize: 12 }}>Буцах</button>
          </div>
        </header>
        <div style={{ flex: '1 1 auto', minHeight: 0, overflow: 'auto', padding: 16 }}>
          {pdfUrl ? <iframe title="PDF тайлан" src={pdfUrl} style={{ display: 'block', width: '100%', height: '100%', minHeight: 400, border: 0 }} /> : (
            <div style={{ overflow: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
                <thead style={{ position: 'sticky', top: 0, background: '#eaf1f5' }}>
                  <tr>{report?.columns.map((column) => <th key={column} style={{ padding: 10, borderBottom: '1px solid #cbd5e1' }}>{column}</th>)}</tr>
                </thead>
                <tbody>{report?.rows.map((row, index) => (
                  <tr key={index} style={{ borderBottom: '1px solid #e2e8f0' }}>
                    {report.columns.map((column) => <td key={column} style={{ padding: 10 }}>{row[column]}</td>)}
                  </tr>
                ))}</tbody>
              </table>
            </div>
          )}
        </div>
      </section>
    </div>
  );
}
