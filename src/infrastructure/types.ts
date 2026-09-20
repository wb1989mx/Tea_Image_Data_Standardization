// ===== 领域数据模型（全模块共用契约）=====
// 业务模块 types.ts 一律从此处 re-export，禁止在各模块重复定义领域类型

// 审评维度：仅用于 UI 分组、CSV 列语义与拍摄说明，**不承担图像身份**
export type QualityDimension = 'shape' | 'soup' | 'leaf';

// 槽位键：Sample.images 的键，同时是 ImageAsset 的身份（存储键与标准文件名的依据）
// 采用「增量追加」策略 —— 保留 soup 作为第 1 冲的键，只在尾部追加 soup2，
// 使类型对已有数据向后兼容，从而改造可分批推进（S1~S5 每步都能编译通过）。
export type SlotKey = 'shape' | 'soup' | 'soup2' | 'leaf';

export type SampleStatus = 'incomplete' | 'pending' | 'registered';
export type OutputFormat = 'png' | 'webp';
export type BackgroundMode = 'transparent' | 'white';

export interface DeviceInfo {
  model: string | null;
  os: string | null;
  browser: string | null;
  exifMake: string | null;
  exifModel: string | null;
}

export interface ColorProfile {
  deviceModel: string;
  temperature: number; // 色温 K 偏移，如 -500..500
  tint: number; // 色调 -100..100
  saturation: number; // 0.5..1.5
  contrast: number; // 0.5..1.5
  presetName: string;
}

export interface CropMeta {
  x: number;
  y: number;
  width: number;
  height: number; // 源图像素裁剪框
  scale: number;
  rotation: number; // deg
  outputSize: number; // 如 1024
  outputFormat: OutputFormat;
  background: BackgroundMode;
}

export interface ImageAsset {
  id: string;
  sampleId: string;
  dimension: QualityDimension; // 归属维度（分组/列语义）
  // 槽位身份：存储键与标准文件名依据。
  // 声明为可选是为了兼容两类"无 slot"数据：① v1 迁移前的历史资产；
  // ② 被旧版 Service Worker 缓存写入的数据。读取时统一经 slotOf() 兜底。
  slot?: SlotKey;
  originalFile: Blob; // 保留原图
  editedFile: Blob | null; // 裁剪/矫正后
  fileName: string; // 标准文件名
  freeCode: string; // 自由编号，如 001
  cropMeta: CropMeta | null;
  colorProfile: ColorProfile | null; // 实际烘焙进 editedFile 的色彩矫正参数（null=未应用）
  createdAt: number;
  updatedAt: number;
}

export interface Sample {
  id: string;
  category: string;
  name: string;
  year: number;
  grade: string;
  deviceInfo: DeviceInfo;
  colorProfile: ColorProfile | null;
  images: SlotMap; // 槽位 → 资产快照（槽位定义见下方 SLOTS）
  status: SampleStatus; // incomplete / pending / registered
  createdAt: number;
  updatedAt: number;
}

// ===== 槽位定义表：单一事实来源 =====
// 增删槽位只需改这一张表，UI 布局、登记就绪判定、标准文件名、导出列名均自动跟随。
export interface SlotDef {
  key: SlotKey;
  dimension: QualityDimension; // 归属维度（分组用）
  label: string; // 展示名 & 标准文件名片段
  hint: string; // 拍摄/取材说明（UI 辅助文案）
  required: boolean; // 是否计入「登记就绪」判定
}

// 茶汤槽位语义为「冲泡次序」（同一样品第 1 冲 / 第 2 冲的汤色对比），非器具差异。
// 茶汤第2冲为选填：required=false，不阻塞「确认登记」。
export const SLOTS: readonly SlotDef[] = [
  { key: 'shape', dimension: 'shape', label: '外形', hint: '干茶匀整度', required: true },
  { key: 'soup', dimension: 'soup', label: '茶汤第1冲', hint: '第 1 冲泡汤色', required: true },
  {
    key: 'soup2',
    dimension: 'soup',
    label: '茶汤第2冲',
    hint: '第 2 冲泡汤色（选填）',
    required: false
  },
  { key: 'leaf', dimension: 'leaf', label: '叶底', hint: '叶底匀亮度', required: true }
];

export const SLOT_KEYS: SlotKey[] = SLOTS.map((s) => s.key);

// 按键索引：按槽位取定义（业务层按槽位分组/取名时使用）
export const SLOT_DEF = Object.fromEntries(SLOTS.map((s) => [s.key, s])) as Record<
  SlotKey,
  SlotDef
>;

export const SLOT_LABEL = Object.fromEntries(
  SLOTS.map((s) => [s.key, s.label])
) as Record<SlotKey, string>;

export const DIMENSIONS: QualityDimension[] = ['shape', 'soup', 'leaf'];

// 某维度下的全部槽位（质量页按维度分组渲染）
export const SLOTS_OF = (d: QualityDimension): SlotDef[] =>
  SLOTS.filter((s) => s.dimension === d);

// 计入「登记就绪」判定的槽位（茶汤第2冲不在其中）
export const REQUIRED_SLOTS: SlotDef[] = SLOTS.filter((s) => s.required);

// 槽位 → 资产快照映射（替代原先的三字段字面量）
export type SlotMap = Record<SlotKey, ImageAsset | null>;

export const emptySlotMap = (): SlotMap => ({
  shape: null,
  soup: null,
  soup2: null,
  leaf: null
});

// 读取资产所属槽位：老数据（v1 迁移前）可能没有 slot，回退到 dimension。
// 注意：dimension='soup' 时回退结果即第 1 冲，这只会发生在"单茶汤时期"的历史资产上。
export function slotOf(asset: { slot?: SlotKey; dimension: QualityDimension }): SlotKey {
  return asset.slot ?? asset.dimension;
}

// 兼容旧字段：仅为尚未迁移的展示层保留，新代码请统一用 SLOT_LABEL[slot]
// 例：西湖龙井_2024_特级_外形_001
export const DIMENSION_LABEL: Record<QualityDimension, string> = {
  shape: '外形',
  soup: '茶汤',
  leaf: '叶底'
};
