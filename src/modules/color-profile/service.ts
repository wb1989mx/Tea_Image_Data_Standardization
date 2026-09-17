import type { ColorProfile } from '../../infrastructure/types';

// 色彩矫正服务层：可配置「设备型号 → 参数」映射表（localStorage 持久化，非硬编码）
// 仅依赖基础设施类型；映射表在设置中维护

const STORE_KEY = 'tea-color-profiles';

// 默认预设：含通配 '*' 作为未匹配时的回退；其余按设备型号匹配
export const DEFAULT_PROFILES: ColorProfile[] = [
  { deviceModel: '*', temperature: 0, tint: 0, saturation: 1, contrast: 1, presetName: '原图（默认）' },
  { deviceModel: 'iPhone', temperature: 120, tint: 0, saturation: 1.05, contrast: 1.02, presetName: 'iPhone 暖调' },
  { deviceModel: 'Xiaomi', temperature: -80, tint: 5, saturation: 1.1, contrast: 1.05, presetName: '小米 提饱和' }
];

export function loadProfiles(): ColorProfile[] {
  try {
    const raw = localStorage.getItem(STORE_KEY);
    if (raw) return JSON.parse(raw) as ColorProfile[];
  } catch {
    /* 忽略读取异常 */
  }
  return DEFAULT_PROFILES;
}

export function saveProfiles(list: ColorProfile[]): void {
  try {
    localStorage.setItem(STORE_KEY, JSON.stringify(list));
  } catch {
    /* 忽略写入异常 */
  }
}

// 按设备型号取参数；未命中则回退通配预设；都不存在返回 null
export function getProfile(deviceModel: string | null): ColorProfile | null {
  const list = loadProfiles();
  if (deviceModel) {
    const hit = list.find((p) => p.deviceModel === deviceModel);
    if (hit) return hit;
  }
  return list.find((p) => p.deviceModel === '*') ?? null;
}

// 转为 CSS filter 字符串（用于实时预览）
export function filterString(p: ColorProfile): string {
  const brightness = (100 + p.temperature / 10) / 100;
  const hue = p.tint * 0.4;
  return `contrast(${p.contrast}) saturate(${p.saturation}) brightness(${brightness}) hue-rotate(${hue}deg)`;
}

// 将色彩矫正烘焙到新 canvas（保留原图，结果另存）
export function bakeProfile(
  source: CanvasImageSource,
  profile: ColorProfile,
  w: number,
  h: number
): HTMLCanvasElement {
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('无法获取 canvas 上下文');
  ctx.filter = filterString(profile);
  ctx.drawImage(source, 0, 0, w, h);
  return canvas;
}
