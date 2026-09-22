import type { ImageAsset } from '../../../infrastructure/types';
import { cropShapeOf, cropShapeRadius } from '../../../infrastructure/types';
import { useObjectURL } from '../../../infrastructure/utils';

// 单张缩略图（取编辑后图，回退原图）
// 轮廓必须跟随产物的实际裁剪形状：此前硬编码为 50%，会把正方形产出在显示层
// 二次裁成圆，用户据此判断「正方形模式没生效」—— 显示与文件不一致。
export function SampleThumb({ asset, size = 64 }: { asset: ImageAsset | null; size?: number }) {
  const url = useObjectURL(asset?.editedFile ?? asset?.originalFile);
  return (
    <div
      style={{
        width: size,
        height: size,
        borderRadius: cropShapeRadius(cropShapeOf(asset?.cropMeta)),
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
