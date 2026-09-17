import type { ImageAsset, QualityDimension } from '../../../infrastructure/types';
import { DIMENSION_LABEL } from '../../../infrastructure/types';
import { useObjectURL } from '../../../infrastructure/utils';

// 单个质量维度槽位卡片（外形/茶汤/叶底复用）
// 纯展示 + 事件回调，不读写其它模块内部状态
interface Props {
  dimension: QualityDimension;
  asset: ImageAsset | null;
  onCapture: () => void;
  onUpload: (blob: Blob) => void;
  onEdit: () => void;
}

export function SlotCard({ dimension, asset, onCapture, onUpload, onEdit }: Props) {
  const thumb = useObjectURL(asset?.editedFile ?? asset?.originalFile);
  const confirmed = Boolean(asset?.editedFile);

  return (
    <div className="surface" style={{ padding: 14, display: 'flex', flexDirection: 'column', gap: 10 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div style={{ fontWeight: 600 }}>{DIMENSION_LABEL[dimension]}</div>
        <div
          style={{
            fontSize: 12,
            padding: '2px 8px',
            borderRadius: 999,
            color: confirmed ? '#fff' : 'var(--muted)',
            background: confirmed ? 'var(--primary)' : 'var(--border)'
          }}
        >
          {confirmed ? '已确认' : asset ? '待编辑' : '未采集'}
        </div>
      </div>

      <div
        style={{
          width: '100%',
          aspectRatio: '1 / 1',
          borderRadius: 'var(--radius)',
          background: 'var(--bg)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          overflow: 'hidden',
          border: '1px dashed var(--border)'
        }}
      >
        {thumb ? (
          <img src={thumb} alt={dimension} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
        ) : (
          <span style={{ color: 'var(--muted)', fontSize: 13 }}>暂无图像</span>
        )}
      </div>

      <div style={{ display: 'flex', gap: 8 }}>
        <button
          onClick={onCapture}
          style={{
            flex: 1,
            padding: '10px',
            borderRadius: 'var(--radius)',
            border: '1px solid var(--primary)',
            background: 'var(--primary)',
            color: '#fff'
          }}
        >
          相机
        </button>
        <label
          style={{
            flex: 1,
            textAlign: 'center',
            padding: '10px',
            borderRadius: 'var(--radius)',
            border: '1px solid var(--border)',
            background: 'var(--surface)',
            color: 'var(--primary)',
            cursor: 'pointer'
          }}
        >
          上传
          <input
            type="file"
            accept="image/*"
            style={{ display: 'none' }}
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) onUpload(f);
              e.target.value = '';
            }}
          />
        </label>
        {asset && (
          <button
            onClick={onEdit}
            style={{
              flex: 1,
              padding: '10px',
              borderRadius: 'var(--radius)',
              border: '1px solid var(--border)',
              background: 'var(--surface)',
              color: 'var(--text)'
            }}
          >
            编辑
          </button>
        )}
      </div>
    </div>
  );
}
