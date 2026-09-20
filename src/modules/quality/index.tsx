import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import type { Sample, SlotKey } from '../../infrastructure/types';
import { DIMENSIONS, SLOTS_OF } from '../../infrastructure/types';
import { repositories } from '../../infrastructure/repository';
import { bus } from '../../infrastructure/event-bus';
import { getCameraCapture } from '../../infrastructure/capabilities';
import {
  ensureAsset,
  isRegistrationReady,
  missingRequiredSlots,
  confirmRegistration
} from './service';
import { SlotCard } from './components/SlotCard';
import { SlotGroup } from './components/SlotGroup';

// 质量维度采集页（路由 /quality/:sampleId）
// 采集槽位由 infrastructure/types 的 SLOTS 定义表驱动（外形 / 茶汤第1冲 / 茶汤第2冲 / 叶底），
// 本页只负责按维度分组渲染，不含任何槽位硬编码；增删槽位只改定义表。
// 相机经 capabilities 注册表获取，绝不 import camera 模块。

export function QualityPage() {
  const { sampleId } = useParams();
  const navigate = useNavigate();
  const [sample, setSample] = useState<Sample | null>(null);
  const [error, setError] = useState('');
  const [captureFor, setCaptureFor] = useState<SlotKey | null>(null);

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

  const handleCaptured = async (slot: SlotKey, blob: Blob) => {
    if (!sampleId) return;
    await ensureAsset(sampleId, slot, blob);
    const s = await repositories.sample.get(sampleId);
    if (s) setSample(s);
    setCaptureFor(null);
  };

  const handleUpload = async (slot: SlotKey, blob: Blob) => {
    if (!sampleId) return;
    await ensureAsset(sampleId, slot, blob);
    const s = await repositories.sample.get(sampleId);
    if (s) setSample(s);
  };

  const handleConfirm = async () => {
    if (!sampleId || !sample) return;
    const missing = missingRequiredSlots(sample);
    if (!isRegistrationReady(sample)) {
      // 缺什么就说什么：提示里带上具体槽位名，避免"去猜还差哪张"
      setError(
        missing.length
          ? `以下必填槽位尚未完成采集与编辑确认：${missing.join('、')}`
          : '需完整填写标签（类别 / 名称 / 年份 / 等级）'
      );
      return;
    }
    setError('');
    await confirmRegistration(sampleId);
    navigate('/record');
  };

  const onSlotCapture = (slot: SlotKey) => {
    if (CameraCapture) setCaptureFor(slot);
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

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        {DIMENSIONS.map((dim) => {
          const slots = SLOTS_OF(dim);
          return (
            // span = 该维度下的槽位数：茶汤含 2 个槽位 → 跨 2 列，组内并排
            <SlotGroup key={dim} span={slots.length}>
              {slots.map((s) => (
                <SlotCard
                  key={s.key}
                  label={s.label}
                  hint={s.hint}
                  required={s.required}
                  asset={sample.images[s.key]}
                  onCapture={() => onSlotCapture(s.key)}
                  onUpload={(b) => handleUpload(s.key, b)}
                  onEdit={() => {
                    const a = sample.images[s.key];
                    if (a) navigate(`/edit/${a.id}`);
                  }}
                />
              ))}
            </SlotGroup>
          );
        })}
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
