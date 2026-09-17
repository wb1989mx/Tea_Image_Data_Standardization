import type { ImageAsset, CropMeta, OutputFormat, BackgroundMode, ColorProfile } from '../../infrastructure/types';
import { repositories } from '../../infrastructure/repository';
import { bus } from '../../infrastructure/event-bus';
import { getColorBake } from '../../infrastructure/capabilities';

// 图像编辑服务层：圆形裁剪渲染 + 色彩烘焙 + 保存回写
// 仅依赖 infrastructure（repository / event-bus / capabilities），不触碰其它业务模块

export interface EditParams {
  outputSize: number; // 如 1024
  outputFormat: OutputFormat; // png | webp
  background: BackgroundMode; // transparent | white
}

export interface PixelRect {
  x: number;
  y: number;
  width: number;
  height: number;
}

function canvasToBlob(canvas: HTMLCanvasElement, format: OutputFormat, quality = 0.92): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (b) => (b ? resolve(b) : reject(new Error('canvas.toBlob 失败'))),
      format === 'png' ? 'image/png' : 'image/webp',
      quality
    );
  });
}

// 判断预设是否为「中性（不改动画面）」：用于默认是否应用矫正
export function isIdentityProfile(p: ColorProfile | null): boolean {
  if (!p) return true;
  return p.temperature === 0 && p.tint === 0 && p.saturation === 1 && p.contrast === 1;
}

// 将裁剪框（自然像素）+ 旋转 + 缩放绘制到一个给定尺寸的 canvas（圆形蒙版）
// 若传入 profile（且非中性），在绘制后按色彩预设烘焙（原图不动，仅作用于输出）
export function drawCircleCrop(
  canvas: HTMLCanvasElement,
  img: HTMLImageElement,
  cropPx: PixelRect,
  params: EditParams,
  rotation: number,
  scale: number,
  profile?: ColorProfile | null
): void {
  const S = canvas.width; // 由调用方指定（预览 200 / 输出 outputSize）
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('无法获取 canvas 上下文');

  ctx.clearRect(0, 0, S, S);
  if (params.background === 'white') {
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, S, S);
  }

  ctx.save();
  // 圆形蒙版（画布坐标系，不受旋转影响）
  ctx.beginPath();
  ctx.arc(S / 2, S / 2, S / 2, 0, Math.PI * 2);
  ctx.clip();

  ctx.translate(S / 2, S / 2);
  ctx.rotate((rotation * Math.PI) / 180);
  const baseScale = S / Math.max(cropPx.width, cropPx.height);
  const total = baseScale * scale;
  ctx.scale(total, total);
  ctx.drawImage(
    img,
    cropPx.x,
    cropPx.y,
    cropPx.width,
    cropPx.height,
    -cropPx.width / 2,
    -cropPx.height / 2,
    cropPx.width,
    cropPx.height
  );
  ctx.restore();

  // 色彩矫正烘焙（保留原图，仅作用于导出/预览画布）
  if (profile && !isIdentityProfile(profile)) {
    const bake = getColorBake();
    if (bake) {
      const baked = bake(canvas, profile, S, S);
      ctx.clearRect(0, 0, S, S);
      ctx.drawImage(baked, 0, 0, S, S);
    }
  }
}

// 将原图按裁剪框（自然像素）+ 旋转 + 缩放，绘制为圆形输出图
export async function renderCircleCrop(
  img: HTMLImageElement,
  cropPx: PixelRect,
  params: EditParams,
  rotation: number,
  scale: number,
  profile?: ColorProfile | null
): Promise<Blob> {
  const canvas = document.createElement('canvas');
  canvas.width = params.outputSize;
  canvas.height = params.outputSize;
  drawCircleCrop(canvas, img, cropPx, params, rotation, scale, profile);
  return canvasToBlob(canvas, params.outputFormat);
}

// 将编辑结果写回资产并广播（quality 页订阅刷新槽位缩略图）
export async function saveEditedAsset(
  asset: ImageAsset,
  editedBlob: Blob,
  cropMeta: CropMeta
): Promise<void> {
  asset.editedFile = editedBlob;
  asset.cropMeta = cropMeta;
  asset.updatedAt = Date.now();
  await repositories.asset.put(asset);
  bus.emit('asset:updated', { assetId: asset.id, sampleId: asset.sampleId });
}
