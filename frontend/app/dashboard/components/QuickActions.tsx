'use client';

import { useState } from 'react';
import { backendBaseUrl, fetchWithAuth } from '../../../lib/backendApi';
import { supabase } from '../../../lib/supabaseClient';
import { DashboardCategory } from '../types';
import ReportPreviewDialog from './records/ReportPreviewDialog';
import { LINKS } from '../constants/links';

function buttonStyle(color: string) {
  return {
    backgroundColor: color,
    color: 'white',
    border: 'none',
    padding: '9px 10px',
    borderRadius: '10px',
    fontWeight: 'bold' as const,
    cursor: 'pointer',
    fontSize: '12px',
    width: '100%',
  };
}

interface Props {
  unit: string;
  category: DashboardCategory;
  month: string;
  showReports?: boolean;
}

type PreviewData = {
  title: string;
  columns: string[];
  rows: Record<string, string | number>[];
};

const apiUrl = backendBaseUrl;

export default function QuickActions({ unit, category, month, showReports = true }: Props) {
  const [preview, setPreview] = useState<PreviewData>();
  const [pdfUrl, setPdfUrl] = useState<string>();
  const [previewFormat, setPreviewFormat] = useState<'excel' | 'pdf'>();
  const [errorMessage, setErrorMessage] = useState('');
  const reportCategory = category === 'Сургалт' || category === 'Үнэлгээ' ? category : 'Ирц';
  const reportQuery = new URLSearchParams({ unit: unit.trim().toUpperCase(), category: reportCategory, month }).toString();

  const requestReport = async (path: string) => {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) throw new Error('Дахин нэвтэрнэ үү.');
    const response = await fetchWithAuth(`${apiUrl}${path}`, { headers: { Authorization: `Bearer ${session.access_token}` } });
    if (!response.ok) {
      const result = await response.json();
      throw new Error(result.detail ?? 'Тайлан бэлэн болсонгүй.');
    }
    return response;
  };

  const downloadReport = async (format: 'excel' | 'pdf') => {
    setErrorMessage('');
    try {
      const response = await requestReport(`/api/reports/export/${format}?${reportQuery}`);
      const blobUrl = URL.createObjectURL(await response.blob());
      const link = document.createElement('a');
      link.href = blobUrl;
      link.download = `Report_${reportCategory}_${month}.${format === 'excel' ? 'xlsx' : 'pdf'}`;
      link.click();
      window.setTimeout(() => URL.revokeObjectURL(blobUrl), 60000);
      setPreview(undefined);
      if (pdfUrl) URL.revokeObjectURL(pdfUrl);
      setPdfUrl(undefined);
      setPreviewFormat(undefined);
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : 'Тайлан татаж чадсангүй.');
    }
  };

  const previewExcel = async () => {
    setErrorMessage('');
    try {
      const response = await requestReport(`/api/reports/preview?${reportQuery}`);
      const data = await response.json();
      const rows = data.rows as Record<string, string | number>[];
      setPreview({ title: `Excel тайлан · ${data.category} · ${data.month}`, columns: rows[0] ? Object.keys(rows[0]) : [], rows });
      setPreviewFormat('excel');
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : 'Тайлан харагдсангүй.');
    }
  };

  const previewPdf = async () => {
    setErrorMessage('');
    try {
      const response = await requestReport(`/api/reports/export/pdf?${reportQuery}&disposition=inline`);
      setPdfUrl(URL.createObjectURL(await response.blob()));
      setPreviewFormat('pdf');
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : 'PDF тайлан нээгдсэнгүй.');
    }
  };

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        gap: '12px',
      }}
    >
      {showReports && <button style={buttonStyle('#107c41')} onClick={() => void previewExcel()}>📊 Excel Тайлан татах</button>}

      {showReports && <button style={buttonStyle('#dc2626')} onClick={() => void previewPdf()}>📄 PDF Тайлан татах</button>}
      {showReports && errorMessage && <small role="alert" style={{ color: '#b91c1c' }}>{errorMessage}</small>}

      <button
        style={buttonStyle('#2563eb')}
        onClick={() =>
          window.open(
            LINKS.gmail,
            '_blank'
          )
        }
      >
        📧 Gmail
      </button>
      <ReportPreviewDialog
        report={preview}
        pdfUrl={pdfUrl}
        downloadLabel={previewFormat === 'pdf' ? 'PDF татах' : 'XLSX татах'}
        onDownload={previewFormat ? () => void downloadReport(previewFormat) : undefined}
        onClose={() => {
          setPreview(undefined);
          if (pdfUrl) URL.revokeObjectURL(pdfUrl);
          setPdfUrl(undefined);
          setPreviewFormat(undefined);
        }}
      />

      <button
        style={buttonStyle('#0f766e')}
        onClick={() =>
          window.open(
            LINKS.medle,
            '_blank'
          )
        }
      >
        🏢 Medle Office
      </button>

      <button
        style={buttonStyle('#ea580c')}
        onClick={() =>
          window.open(
            LINKS.mozaik,
            '_blank'
          )
        }
      >
        📖 Mozaik
      </button>

      <button
        style={buttonStyle('#7c3aed')}
        onClick={() =>
          window.open(
            LINKS.lms,
            '_blank'
          )
        }
      >
        📚 Их Нүүдэл LMS
      </button>
    </div>
  );
}
