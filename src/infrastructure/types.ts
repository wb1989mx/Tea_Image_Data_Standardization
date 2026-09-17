// ===== 领域数据模型（全模块共用契约）=====
// 业务模块 types.ts 一律从此处 re-export，禁止在各模块重复定义领域类型

export type QualityDimension = 'shape' | 'soup' | 'leaf';
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
  dimension: QualityDimension;
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
  images: { shape: ImageAsset | null; soup: ImageAsset | null; leaf: ImageAsset | null };
  status: SampleStatus; // incomplete / pending / registered
  createdAt: number;
  updatedAt: number;
}

// 标准文件名规则（modules/record 的 renameRule 实现）
// 名称 + 年份 + 等级 + 质量维度 + 自由编号
// 例：西湖龙井_2024_特级_外形_001
export const DIMENSION_LABEL: Record<QualityDimension, string> = {
  shape: '外形',
  soup: '茶汤',
  leaf: '叶底'
};
