import type { ImageAsset } from '../../../infrastructure/types';
import { useObjectURL } from '../../../infrastructure/utils';

// 单张缩略图（取编辑后图，回退原图）
export function SampleThumb({ asset, size = 64 }: { asset: ImageAsset | null; size?: number }) {
  const url = useObjectURL(asset?.editedFile ?? asset?.originalFile);
  return (
    <div
      style={{
        width: size,
        height: size,
        borderRadius: '50%',
        overflow: 'hidden',
        border: '1px solid var(--border)',
        background: 'var(--bg)',
        flexShrink: 0,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center'
      }}
    >
      {url ? (
        <img src={url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
      ) : (
        <span style={{ color: 'var(--muted)', fontSize: 11 }}>—</span>
      )}
    </div>
  );
}
