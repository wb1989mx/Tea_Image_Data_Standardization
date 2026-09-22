import type {
  ImageAsset,
  CropMeta,
  CropShape,
  OutputFormat,
  BackgroundMode,
  ColorProfile
} from '../../infrastructure/types';
import { COLOR_PARAM_KEYS, CROP_SHAPE_DEF, NEUTRAL_COLOR_PARAMS } from '../../infrastructure/types';
import { repositories } from '../../infrastructure/repository';
import { bus } from '../../infrastructure/event-bus';
import { getColorBake } from '../../infrastructure/capabilities';

// 图像编辑服务层：裁剪渲染（方形/圆形）+ 色彩烘焙 + 保存回写
// 仅依赖 infrastructure（repository / event-bus / capabilities），不触碰其它业务模块

export interface EditParams {
  outputSize: number; // 如 1024
  outputFormat: OutputFormat; // png | webp
  background: BackgroundMode; // transparent | white
  // 输出蒙版形状。与 background 同属「图像之外那部分怎么处理」，故并入本条参数。
  // 由定义表决定是否裁圆，新增形状无需改动本文件的绘制分支。
  shape: CropShape;
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

// 判断预设是否为「中性（不改动画面）」：用于默认是否应用矫正。
//
// 采用「遍历参数定义表」而非逐字段字面量比较：本函数是「是否执行烘焙」的闸门
// （见下方 drawCircleCrop），一旦漏判新增参数，仅调整该参数的预设会被当作中性
// 而整条跳过烘焙 —— 表现为开关已开、导出图却毫无变化。改为表驱动后，
// PARAM_SPECS 新增参数时此判定自动跟随。
export function isIdentityProfile(p: ColorProfile | null): boolean {
  if (!p) return true;
  return COLOR_PARAM_KEYS.every((key) => {
    const v = (p as unknown as Record<string, unknown>)[key];
    // 缺失/非有限值视为中性，与 filterString 的回退行为保持一致
    const n = typeof v === 'number' && Number.isFinite(v) ? v : NEUTRAL_COLOR_PARAMS[key];
    return n === NEUTRAL_COLOR_PARAMS[key];
  });
}

// 将裁剪框（自然像素）+ 旋转 + 缩放绘制到一个给定尺寸的 canvas
// 蒙版形状由 params.shape 经定义表决定：masked=true 走圆形裁切，false 走整幅方形。
// 若传入 profile（且非中性），在绘制后按色彩预设烘焙（原图不动，仅作用于输出）
//
// 形状切换为什么不需要换算裁剪框：裁剪框恒为 aspect=1 的正方形百分比选区，
// 两种形状用的是同一个选区，区别只在于「选区内的哪些像素被保留」。
//
// 关于旋转的一个已知边界（不擅自替用户抹平）：
//   旋转后的正方形无法覆盖画布四角，故「正方形 + 旋转≠0」会在四角露出底色（透明或白）；
//   圆形模式则不受影响 —— 旋转正方形的内切圆恒在旋转正方形内部。
//   界面在旋转滑块下方给出针对性提示，由用户决定是否提高缩放来填补。
export function drawCrop(
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
  // 蒙版只作用于画布坐标系，不受旋转影响
  if (CROP_SHAPE_DEF[params.shape].masked) {
    ctx.beginPath();
    ctx.arc(S / 2, S / 2, S / 2, 0, Math.PI * 2);
    ctx.clip();
  }

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

// 将原图按裁剪框（自然像素）+ 旋转 + 缩放，绘制为方形或圆形的输出图
export async function renderCrop(
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
  drawCrop(canvas, img, cropPx, params, rotation, scale, profile);
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
