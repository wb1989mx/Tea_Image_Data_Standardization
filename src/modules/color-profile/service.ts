import type { ColorProfile, ColorParamKey } from '../../infrastructure/types';
import { COLOR_PARAM_KEYS, clampParam, WILDCARD_MODEL } from '../../infrastructure/types';

// 色彩矫正服务层：可配置「设备型号 → 参数」映射表（localStorage 持久化，非硬编码）
// 仅依赖基础设施类型；映射表在设置中维护

const STORE_KEY = 'tea-color-profiles';

// 存储结构版本：v1 = 裸数组（无版本号）；v2 = { version, list } 信封。
// 提升版本号的目的不是结构美观，而是让「读取时迁移」有据可依（见 normalizeProfile）。
export const PROFILE_VERSION = 2;

interface StoredEnvelope {
  version: number;
  list: ColorProfile[];
}

// 默认预设：含通配项（WILDCARD_MODEL）作为未匹配时的回退；其余按设备型号匹配
export const DEFAULT_PROFILES: ColorProfile[] = [
  {
    deviceModel: WILDCARD_MODEL,
    temperature: 0,
    tint: 0,
    exposure: 0,
    saturation: 1,
    contrast: 1,
    presetName: '原图（默认）'
  },
  {
    deviceModel: 'iPhone',
    temperature: 120,
    tint: 0,
    exposure: 0,
    saturation: 1.05,
    contrast: 1.02,
    presetName: 'iPhone 暖调'
  },
  {
    deviceModel: 'Xiaomi',
    temperature: -80,
    tint: 5,
    exposure: 0,
    saturation: 1.1,
    contrast: 1.05,
    presetName: '小米 提饱和'
  }
];

// 逐字段规范化：缺失/非法字段回退到参数定义表的中性值，并钳制到上下限。
//
// 为什么必须做（P0）：老版本数据没有 exposure 字段，若直接使用会让 filterString
// 产出 brightness(NaN)。按 CSS filter 规范，只要列表中任一函数无效，整个 filter 值
// 即被判定为无效并被浏览器静默丢弃 —— 结果是**既有的色温/色调/饱和度/对比度四项矫正
// 同时失灵，且控制台无任何报错**。因此迁移必须在读取路径上强制执行。
export function normalizeProfile(input: unknown): ColorProfile {
  const raw = (input ?? {}) as Record<string, unknown>;
  const readNum = (v: unknown): number =>
    typeof v === 'number' && Number.isFinite(v) ? v : NaN;

  const params = {} as Record<ColorParamKey, number>;
  for (const key of COLOR_PARAM_KEYS) {
    params[key] = clampParam(key, readNum(raw[key]));
  }

  return {
    deviceModel: typeof raw.deviceModel === 'string' ? raw.deviceModel : WILDCARD_MODEL,
    presetName: typeof raw.presetName === 'string' ? raw.presetName : '未命名预设',
    ...params
  };
}

// 兼容两种存储形态，返回原始条目数组与「是否旧形态」标记；无法识别时返回 null
function extractList(parsed: unknown): { list: unknown[]; legacy: boolean } | null {
  if (Array.isArray(parsed)) return { list: parsed, legacy: true };
  if (parsed && typeof parsed === 'object') {
    const env = parsed as Partial<StoredEnvelope>;
    if (Array.isArray(env.list)) {
      return { list: env.list, legacy: env.version !== PROFILE_VERSION };
    }
  }
  return null;
}

// 通配预设：所有「未匹配到具体机型」的样品都走它，是色彩矫正的兜底出口。
//
// 它是**系统保证项**，不是普通数据行，理由是删掉它的后果不可自洽：
// 所有未匹配机型将落入「无预设」状态 —— 编辑页只剩一行提示、连「应用色彩矫正」
// 开关都不渲染，用户在该页无法自救，只能反直觉地猜到要去另一页补一行通配。
// 因此读取路径负责保证其存在（见 ensureWildcard），设置页也不允许删除它。
const WILDCARD_PROFILE: ColorProfile =
  DEFAULT_PROFILES.find((p) => p.deviceModel === WILDCARD_MODEL) ??
  ({
    deviceModel: WILDCARD_MODEL,
    temperature: 0,
    tint: 0,
    exposure: 0,
    saturation: 1,
    contrast: 1,
    presetName: '原图（默认）'
  } as ColorProfile);

// 补齐缺失的通配项：只追加、不删除也不重排，保证用户既有条目原样保留。
// 追加到末尾而非首位 —— 不打乱用户已保存的顺序，也避免设置页默认选中项被换掉。
function ensureWildcard(list: ColorProfile[]): { list: ColorProfile[]; patched: boolean } {
  if (list.some((p) => p.deviceModel === WILDCARD_MODEL)) return { list, patched: false };
  return { list: [...list, normalizeProfile(WILDCARD_PROFILE)], patched: true };
}

export function loadProfiles(): ColorProfile[] {
  try {
    const raw = localStorage.getItem(STORE_KEY);
    // 从未配置过：返回默认表（含通配）。刻意不写盘，让「未配置」与「已保存」保持可区分
    if (!raw) return DEFAULT_PROFILES.map(normalizeProfile);

    const parsed: unknown = JSON.parse(raw);
    const found = extractList(parsed);
    if (!found) return DEFAULT_PROFILES.map(normalizeProfile);

    const normalized = found.list.map(normalizeProfile);
    const { list, patched } = ensureWildcard(normalized);
    // 旧形态、或本轮补齐过通配项时回写，使迁移与自愈各自只发生一次
    if (found.legacy || patched) saveProfiles(list);
    return list;
  } catch {
    /* 读取异常（含 JSON 损坏）一律回退默认值，避免整页不可用 */
    return DEFAULT_PROFILES.map(normalizeProfile);
  }
}

export function saveProfiles(list: ColorProfile[]): void {
  try {
    const envelope: StoredEnvelope = {
      version: PROFILE_VERSION,
      list: list.map(normalizeProfile)
    };
    localStorage.setItem(STORE_KEY, JSON.stringify(envelope));
  } catch {
    /* 忽略写入异常 */
  }
}

// 按设备型号取参数：精确匹配 → 通配项 → null。
//
// 由于 loadProfiles 保证列表中始终存在通配项，实际只剩「列表被外部写坏」一种
// null 可能，返回值仍保留 null 以便调用方（quality 的元数据写入）保持原有的
// 「未匹配则不记录预设」语义，不把兜底值当成用户配置写进样品。
export function getProfile(deviceModel: string | null): ColorProfile | null {
  const list = loadProfiles();
  if (deviceModel) {
    const hit = list.find((p) => p.deviceModel === deviceModel);
    if (hit) return hit;
  }
  return list.find((p) => p.deviceModel === WILDCARD_MODEL) ?? null;
}

// 转为 CSS filter 字符串（设置页实时预览与烘焙共用，是唯一渲染出口）
//
// 亮度通道由两个参数共同决定，请注意二者并非正交：
//   色温：±500K 映射为 ±50% 亮度偏移（近似实现，非真实色温/白平衡）
//   曝光：EV 按 2^EV 换算为线性亮度增益
// 即 +500K 与 +0.5EV 在视觉上都表现为「整体变亮」。真正的通道级色温
// （R×kr / B×kb 增益矩阵）需逐像素处理，属后续可选项，不在本轮范围。
export function filterString(p: ColorProfile): string {
  const temperature = clampParam('temperature', p?.temperature);
  const exposure = clampParam('exposure', p?.exposure);
  const tint = clampParam('tint', p?.tint);

  const tempLift = (100 + temperature / 10) / 100;
  const expoGain = 2 ** exposure;
  // 防御性钳制：实际可达区间为 [0.125, 6.0]，此处仅保证永不为 0 或负
  const brightness = Math.min(8, Math.max(0.01, tempLift * expoGain));
  const brightnessText = String(Math.round(brightness * 10000) / 10000);
  const hue = tint * 0.4;

  return `contrast(${clampParam('contrast', p?.contrast)}) saturate(${clampParam(
    'saturation',
    p?.saturation
  )}) brightness(${brightnessText}) hue-rotate(${hue}deg)`;
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
