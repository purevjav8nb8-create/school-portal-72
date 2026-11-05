'use client';

import { TrainingItem } from './TrainingList';

interface Props {
  training: TrainingItem | null;
  onClose: () => void;
}

export default function TrainingModal({ training, onClose }: Props) {
  if (!training) return null;

  // PDF-ийг iframe ашиглан шинэ таб дээр найдвартай харуулах
  const handleOpenPdf = () => {
    if (!training.pdfUrl) return;

    const newWindow = window.open('', '_blank');
    if (!newWindow) {
      alert('Браузер дээр Pop-up нээхийг зөвшөөрнө үү!');
      return;
    }

    newWindow.document.write(`
      <!DOCTYPE html>
      <html>
        <head>
          <title>${training.pdfFileName || 'Сертификат'}</title>
          <style>
            body, html { margin: 0; padding: 0; height: 100%; overflow: hidden; background-color: #525659; }
            iframe { width: 100%; height: 100%; border: none; }
          </style>
        </head>
        <body>
          <iframe src="${training.pdfUrl}"></iframe>
        </body>
      </html>
    `);
    newWindow.document.close();
  };

  // PDF Татах
  const handleDownloadPdf = () => {
    if (!training.pdfUrl) return;

    const link = document.createElement('a');
    link.href = training.pdfUrl;
    link.download = training.pdfFileName || 'certificate.pdf';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Зураг татах
  const handleDownloadImage = () => {
    if (!training.imagePreview) return;
    const link = document.createElement('a');
    link.href = training.imagePreview;
    link.download = `${training.name}_зураг.png`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div
      role="presentation"
      onClick={onClose}
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 1000,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center', // justifyContent гэж зассан
        padding: '20px',
        backgroundColor: 'rgba(15, 23, 42, 0.6)'
      }}
    >
      <section
        role="dialog"
        aria-modal="true"
        aria-labelledby="training-details-title"
        onClick={(e) => e.stopPropagation()}
        style={{
          width: '100%',
          maxWidth: '600px',
          maxHeight: '90vh',
          overflowY: 'auto',
          padding: '24px',
          borderRadius: '12px',
          backgroundColor: '#ffffff',
          boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1)'
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid #e2e8f0', paddingBottom: '12px', marginBottom: '16px' }}>
          <h3 id="training-details-title" style={{ margin: 0, color: '#0f172a', fontSize: '18px' }}>
            📖 {training.name}
          </h3>
          <button
            type="button"
            onClick={onClose}
            aria-label="Хаах"
            style={{ border: 'none', background: '#f1f5f9', color: '#64748b', padding: '6px 12px', borderRadius: '6px', cursor: 'pointer', fontWeight: 'bold' }}
          >
            ✕ Хаах
          </button>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <div style={{ display: 'flex', gap: '24px', backgroundColor: '#f8fafc', padding: '12px', borderRadius: '8px' }}>
            <div>
              <label style={{ fontSize: '12px', color: '#64748b', fontWeight: 'bold', display: 'block' }}>Эхэлсэн огноо:</label>
              <span style={{ fontSize: '14px', fontWeight: 'bold', color: '#0f172a' }}>{training.startDate}</span>
            </div>
            <div>
              <label style={{ fontSize: '12px', color: '#64748b', fontWeight: 'bold', display: 'block' }}>Дууссан огноо:</label>
              <span style={{ fontSize: '14px', fontWeight: 'bold', color: '#0f172a' }}>{training.endDate}</span>
            </div>
          </div>

          {training.imagePreview && (
            <div style={{ border: '1px solid #e2e8f0', borderRadius: '8px', padding: '12px', backgroundColor: '#fafafa' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                <label style={{ fontSize: '12px', color: '#475569', fontWeight: 'bold' }}>🖼️ Хавсаргасан зураг:</label>
                <button 
                  onClick={handleDownloadImage}
                  style={{ backgroundColor: '#0284c7', color: 'white', border: 'none', padding: '4px 10px', borderRadius: '4px', fontSize: '12px', fontWeight: 'bold', cursor: 'pointer' }}
                >
                  📥 Зураг татах
                </button>
              </div>
              <img
                src={training.imagePreview}
                alt="Сургалтын сертификат"
                style={{ width: '100%', maxHeight: '280px', objectFit: 'contain', borderRadius: '6px', border: '1px solid #cbd5e1' }}
              />
            </div>
          )}

          {training.pdfUrl && (
            <div style={{ border: '1px solid #cbd5e1', borderRadius: '8px', padding: '14px', backgroundColor: '#f1f5f9' }}>
              <label style={{ fontSize: '13px', color: '#dc2626', fontWeight: 'bold', display: 'block', marginBottom: '8px' }}>
                📄 Сертификат (PDF):
              </label>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontSize: '13px', fontWeight: '500', color: '#334155' }}>
                  {training.pdfFileName || 'certificate.pdf'}
                </span>

                <div style={{ display: 'flex', gap: '8px' }}>
                  <button
                    onClick={handleOpenPdf}
                    style={{ backgroundColor: '#2563eb', color: 'white', border: 'none', padding: '6px 14px', borderRadius: '6px', fontSize: '12px', fontWeight: 'bold', cursor: 'pointer' }}
                  >
                    👁️ Нээж харах
                  </button>
                  <button
                    onClick={handleDownloadPdf}
                    style={{ backgroundColor: '#16a34a', color: 'white', border: 'none', padding: '6px 14px', borderRadius: '6px', fontSize: '12px', fontWeight: 'bold', cursor: 'pointer' }}
                  >
                    📥 PDF Татах
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>

        <div style={{ marginTop: '20px', textAlign: 'right', borderTop: '1px solid #e2e8f0', paddingTop: '12px' }}>
          <button
            type="button"
            onClick={onClose}
            style={{ backgroundColor: '#0f172a', color: 'white', border: 'none', padding: '8px 20px', borderRadius: '6px', fontWeight: 'bold', cursor: 'pointer' }}
          >
            Хаах
          </button>
        </div>
      </section>
    </div>
  );
}