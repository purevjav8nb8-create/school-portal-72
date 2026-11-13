'use client';

import LosslessCloudinaryUpload from '../../../../components/LosslessCloudinaryUpload';
import { ApprovalAssets } from './adminReviewTypes';

interface Props {
  open: boolean;
  assets: ApprovalAssets;
  saving: boolean;
  onChange: (assets: ApprovalAssets) => void;
  onClose: () => void;
  onSave: () => void;
}

export default function ApprovalAssetsDialog({
  open,
  assets,
  saving,
  onChange,
  onClose,
  onSave,
}: Props) {
  if (!open) return null;

  return (
    <div role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }} style={{ position: 'fixed', inset: 0, zIndex: 60, display: 'grid', placeItems: 'center', padding: 16, background: 'rgba(15,23,42,.5)' }}>
      <section role="dialog" aria-modal="true" aria-label="Гарын үсэг, тамганы тохиргоо" style={{ width: 'min(460px,100%)', display: 'grid', gap: 14, padding: 20, borderRadius: 14, background: '#fff', boxShadow: '0 24px 70px rgba(15,23,42,.3)' }}>
        <h3 style={{ margin: 0, color: '#172554' }}>Гарын үсэг, тамганы тохиргоо</h3>
        <AssetUpload label="Гарын үсэг (PNG/JPG)" url={assets.signature_url} onUploaded={(url) => onChange({ ...assets, signature_url: url })} />
        <AssetUpload label="Тамга (PNG/JPG)" url={assets.stamp_url} onUploaded={(url) => onChange({ ...assets, stamp_url: url })} />
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
          <button type="button" onClick={onClose} style={{ padding: '8px 12px', border: '1px solid #cbd5e1', borderRadius: 8, background: '#fff', cursor: 'pointer' }}>Болих</button>
          <button type="button" disabled={saving || !assets.signature_url || !assets.stamp_url} onClick={onSave} style={{ padding: '8px 12px', border: 0, borderRadius: 8, background: saving ? '#94a3b8' : '#2563eb', color: '#fff', fontWeight: 700, cursor: saving ? 'wait' : 'pointer' }}>
            {saving ? 'Хадгалж байна...' : 'Хадгалах'}
          </button>
        </div>
      </section>
    </div>
  );
}

function AssetUpload({ label, url, onUploaded }: { label: string; url: string; onUploaded: (url: string) => void }) {
  return (
    <>
      <LosslessCloudinaryUpload label={label} formats={['png', 'jpg', 'jpeg']} onUploaded={(file) => onUploaded(file.url)} />
      {url && <a href={url} target="_blank" rel="noreferrer">Оруулсан {label.toLowerCase()}-г харах</a>}
    </>
  );
}
