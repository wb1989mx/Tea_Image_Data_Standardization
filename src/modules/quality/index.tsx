import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import type { Sample, QualityDimension } from '../../infrastructure/types';
import { repositories } from '../../infrastructure/repository';
import { bus } from '../../infrastructure/event-bus';
import { getCameraCapture } from '../../infrastructure/capabilities';
import { ensureAsset, isRegistrationReady, confirmRegistration } from './service';
import { SlotCard } from './components/SlotCard';

// 质量维度采集页（路由 /quality/:sampleId）
// 三槽位（外形/茶汤/叶底）；相机经 capabilities 注册表获取，绝不 import camera 模块
const DIMENSIONS: QualityDimension[] = ['shape', 'soup', 'leaf'];

export function QualityPage() {
  const { sampleId } = useParams();
  const navigate = useNavigate();
  const [sample, setSample] = useState<Sample | null>(null);
  const [error, setError] = useState('');
  const [captureFor, setCaptureFor] = useState<QualityDimension | null>(null);

  const CameraCapture = getCameraCapture();

  useEffect(() => {
    if (!sampleId) return;
    let active = true;
    const refresh = async () => {
      const s = await repositories.sample.get(sampleId);
      if (active && s) setSample(s);
    };
    refresh();
    const onAssetUpdated = () => refresh();
    bus.on('asset:updated', onAssetUpdated);
    return () => {
      active = false;
      bus.off('asset:updated', onAssetUpdated);
    };
  }, [sampleId]);

  const handleCaptured = async (dim: QualityDimension, blob: Blob) => {
    if (!sampleId) return;
    await ensureAsset(sampleId, dim, blob);
    const s = await repositories.sample.get(sampleId);
    if (s) setSample(s);
    setCaptureFor(null);
  };

  const handleUpload = async (dim: QualityDimension, blob: Blob) => {
    if (!sampleId) return;
    await ensureAsset(sampleId, dim, blob);
    const s = await repositories.sample.get(sampleId);
    if (s) setSample(s);
  };

  const handleConfirm = async () => {
    if (!sampleId || !sample) return;
    if (!isRegistrationReady(sample)) {
      setError('需完整填写标签，且外形/茶汤/叶底三图均完成编辑确认');
      return;
    }
    setError('');
    await confirmRegistration(sampleId);
    navigate('/record');
  };

  const onSlotCapture = (dim: QualityDimension) => {
    if (CameraCapture) setCaptureFor(dim);
    else setError('当前环境不支持相机采集，请使用「上传」');
  };

  if (!sample) {
    return (
      <div className="surface" style={{ padding: 16, color: 'var(--muted)' }}>
        加载样品中…
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <div
        className="surface"
        style={{ padding: 16, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}
      >
        <div style={{ fontWeight: 600 }}>
          {sample.name || '未命名样品'} · 质量维度采集
        </div>
        <div style={{ fontSize: 13, color: 'var(--muted)' }}>{sample.category} / {sample.grade}</div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {DIMENSIONS.map((dim) => (
          <SlotCard
            key={dim}
            dimension={dim}
            asset={sample.images[dim]}
            onCapture={() => onSlotCapture(dim)}
            onUpload={(b) => handleUpload(dim, b)}
            onEdit={() => sample.images[dim] && navigate(`/edit/${sample.images[dim]!.id}`)}
          />
        ))}
      </div>

      {error && <div style={{ color: '#c0392b', fontSize: 13 }}>{error}</div>}

      <button
        onClick={handleConfirm}
        style={{
          padding: '14px',
          borderRadius: 'var(--radius)',
          border: 'none',
          background: 'var(--primary)',
          color: '#fff',
          fontWeight: 600,
          fontSize: 16
        }}
      >
        确认登记
      </button>

      {captureFor && CameraCapture && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(0,0,0,0.6)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 50,
            padding: 16
          }}
        >
          <div className="surface" style={{ width: '100%', maxWidth: 480, padding: 16 }}>
            <CameraCapture
              preferRear
              onCaptured={(b) => handleCaptured(captureFor, b)}
              onCancel={() => setCaptureFor(null)}
            />
          </div>
        </div>
      )}
    </div>
  );
}
