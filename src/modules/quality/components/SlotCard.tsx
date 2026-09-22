import type { ImageAsset } from '../../../infrastructure/types';
import { cropShapeOf, cropShapeRadius } from '../../../infrastructure/types';
import { useObjectURL } from '../../../infrastructure/utils';

// 单个采集槽位卡片（外形 / 茶汤第1冲 / 茶汤第2冲 / 叶底 复用）
// 纯展示 + 事件回调：展示名与说明由外部按槽位定义表传入，卡片自身不认识槽位语义，
// 因此后续增删槽位无需改动本组件。
interface Props {
  label: string; // 槽位展示名，如「茶汤第2冲」
  hint: string; // 拍摄/取材说明
  required: boolean; // 必填槽位；选填槽位在未采集时显示「选填」而非「未采集」
  asset: ImageAsset | null;
  onCapture: () => void;
  onUpload: (blob: Blob) => void;
  onEdit: () => void;
}

export function SlotCard({ label, hint, required, asset, onCapture, onUpload, onEdit }: Props) {
  const thumb = useObjectURL(asset?.editedFile ?? asset?.originalFile);
  const confirmed = Boolean(asset?.editedFile);
  const badge = confirmed ? '已确认' : asset ? '待编辑' : required ? '未采集' : '选填';

  return (
    <div className="surface" style={{ padding: 14, display: 'flex', flexDirection: 'column', gap: 10 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 6 }}>
        <div style={{ fontWeight: 600 }}>{label}</div>
        <div
          style={{
            fontSize: 12,
            padding: '2px 8px',
            borderRadius: 999,
            whiteSpace: 'nowrap',
            color: confirmed ? '#fff' : 'var(--muted)',
            background: confirmed ? 'var(--primary)' : 'var(--border)'
          }}
        >
          {badge}
        </div>
      </div>

      <div
        style={{
          width: '100%',
          aspectRatio: '1 / 1',
          // 轮廓跟随产物裁剪形状：圆形产出的四角本就透明，用方形框会露出底色断层
          borderRadius: cropShapeRadius(cropShapeOf(asset?.cropMeta)),
          background: 'var(--bg)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          overflow: 'hidden',
          border: '1px dashed var(--border)',
          padding: 10,
          textAlign: 'center'
        }}
      >
        {thumb ? (
          <img src={thumb} alt={label} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
        ) : (
          <span style={{ color: 'var(--muted)', fontSize: 12, lineHeight: 1.5 }}>
            暂无图像
            <br />
            {hint}
          </span>
        )}
      </div>

      <div style={{ display: 'flex', gap: 8 }}>
        <button
          onClick={onCapture}
          style={{
            flex: 1,
            minWidth: 0,
            padding: '10px 4px',
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
            minWidth: 0,
            textAlign: 'center',
            padding: '10px 4px',
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
              minWidth: 0,
              padding: '10px 4px',
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
