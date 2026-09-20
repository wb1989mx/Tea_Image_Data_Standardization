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

// 色彩矫正参数（上下限/步长/中性值见下方 PARAM_SPECS，勿在此处重复声明取值范围）
export interface ColorProfile {
  deviceModel: string;
  temperature: number; // 色温 K 偏移
  tint: number; // 色调偏移
  exposure: number; // 曝光 EV
  saturation: number; // 饱和度倍数
  contrast: number; // 对比度倍数
  presetName: string;
}

// 通配设备型号：色彩映射表中「未匹配到具体机型」时的兜底匹配符。
// 它是系统保证项 —— color-profile 的读取路径会补齐缺失的通配项，设置页也禁止删除它。
// 其它模块需要判断"是否走了兜底"时应引用本常量，不要写字面量 '*'。
export const WILDCARD_MODEL = '*';

// ===== 色彩参数定义表：单一事实来源 =====
// 参数的上下限、步长、中性值、单位、语义只在此处定义。
// 以下四处均从本表读取，新增参数只需在此追加一行：
//   ① 设置页参数区渲染（数字输入框 + 区间提示）  ② 输入钳制与精度规范化
//   ③ 旧数据迁移的逐字段回退值（normalizeProfile） ④ isIdentityProfile 的中性判定
export type ColorParamKey = 'temperature' | 'tint' | 'exposure' | 'saturation' | 'contrast';

export interface ParamSpec {
  key: ColorParamKey;
  label: string; // 展示名
  min: number; // 下限（含）
  max: number; // 上限（含）
  step: number; // 输入步长
  neutral: number; // 中性值：等于该值时不产生任何视觉效果
  decimals: number; // 展示与规范化的小数位
  unit: string; // 单位后缀（空字符串表示无单位）
  desc: string; // 语义说明（UI 提示与文档共用）
}

export const PARAM_SPECS: readonly ParamSpec[] = [
  {
    key: 'temperature',
    label: '色温',
    min: -500,
    max: 500,
    step: 10,
    neutral: 0,
    decimals: 0,
    unit: 'K',
    desc: '冷暖偏移（当前经亮度通道近似实现）'
  },
  {
    key: 'tint',
    label: '色调',
    min: -100,
    max: 100,
    step: 1,
    neutral: 0,
    decimals: 0,
    unit: '',
    desc: '绿—品红偏移（色相旋转）'
  },
  {
    key: 'exposure',
    label: '曝光',
    min: -2,
    max: 2,
    step: 0.05,
    neutral: 0,
    decimals: 2,
    unit: 'EV',
    desc: '整体明暗，按 2 的 EV 次方换算为亮度增益'
  },
  {
    key: 'saturation',
    label: '饱和度',
    min: 0.5,
    max: 1.5,
    step: 0.01,
    neutral: 1,
    decimals: 2,
    unit: '',
    desc: '颜色浓郁度'
  },
  {
    key: 'contrast',
    label: '对比度',
    min: 0.5,
    max: 1.5,
    step: 0.01,
    neutral: 1,
    decimals: 2,
    unit: '',
    desc: '明暗反差'
  }
];

export const COLOR_PARAM_KEYS: ColorParamKey[] = PARAM_SPECS.map((s) => s.key);

export const PARAM_SPEC = Object.fromEntries(PARAM_SPECS.map((s) => [s.key, s])) as Record<
  ColorParamKey,
  ParamSpec
>;

// 参数中性值集合：既是色彩矫正的「零位」，也是缺失字段的迁移回退值
export const NEUTRAL_COLOR_PARAMS = Object.fromEntries(
  PARAM_SPECS.map((s) => [s.key, s.neutral])
) as Record<ColorParamKey, number>;

// 区间文案，如 "-500 ~ 500 K"（UI 与文档共用，避免两处各写一份）
export function paramRangeText(spec: ParamSpec): string {
  return `${spec.min} ~ ${spec.max}${spec.unit ? ` ${spec.unit}` : ''}`;
}

// 数值规范化：非有限值回退中性值 → 钳制到上下限 → 按小数位取整。
// UI 失焦处理与数据迁移必须共用此函数，否则会出现「界面显示值 ≠ 实际烘焙值」。
export function clampParam(key: ColorParamKey, value: number): number {
  const spec = PARAM_SPEC[key];
  const n = Number.isFinite(value) ? value : spec.neutral;
  const clamped = Math.min(spec.max, Math.max(spec.min, n));
  const p = 10 ** spec.decimals;
  return Math.round(clamped * p) / p;
}

// 按定义表的小数位格式化，供输入框回显使用
export function formatParam(key: ColorParamKey, value: number): string {
  const v = clampParam(key, value);
  return v.toFixed(PARAM_SPEC[key].decimals);
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
