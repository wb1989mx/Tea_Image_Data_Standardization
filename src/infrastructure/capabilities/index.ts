import type { ComponentType } from 'react';
import type { Sample } from '../types';

// 能力注册表：业务模块经此拿到其它模块提供的「能力组件/函数」，避免模块互 import
// 例：camera 模块在启动时 registerCameraCapture；quality 经 getCameraCapture() 使用

export interface CaptureProps {
  preferRear?: boolean;
  onCaptured: (blob: Blob) => void;
  onCancel: () => void;
}

let CameraCaptureComp: ComponentType<CaptureProps> | null = null;

export function registerCameraCapture(c: ComponentType<CaptureProps>): void {
  CameraCaptureComp = c;
}

export function getCameraCapture(): ComponentType<CaptureProps> | null {
  return CameraCaptureComp;
}

// 导出能力：export 模块注册 packZip，record 模块经 getExporter() 调用，互不 import
export type PackZipFn = (samples: Sample[]) => Promise<Blob>;

let ExporterFn: PackZipFn | null = null;

export function registerExporter(fn: PackZipFn): void {
  ExporterFn = fn;
}

export function getExporter(): PackZipFn | null {
  return ExporterFn;
}

// EXIF 提取能力：device 模块注册 extractExifMakeModel，quality 模块经 getExifExtractor() 调用
export type ExifFn = (blob: Blob) => Promise<{ make: string | null; model: string | null } | null>;

let ExifExtractor: ExifFn | null = null;

export function registerExifExtractor(fn: ExifFn): void {
  ExifExtractor = fn;
}

export function getExifExtractor(): ExifFn | null {
  return ExifExtractor;
}

// 色彩矫正能力：color-profile 模块注册 bakeProfile，image-editor 等可经 getColorBake() 使用
export type ColorBakeFn = (
  source: CanvasImageSource,
  profile: import('../types').ColorProfile,
  w: number,
  h: number
) => HTMLCanvasElement;

let ColorBake: ColorBakeFn | null = null;

export function registerColorBake(fn: ColorBakeFn): void {
  ColorBake = fn;
}

export function getColorBake(): ColorBakeFn | null {
  return ColorBake;
}

// 色彩预设查找能力：color-profile 模块注册 getProfile，image-editor / quality 等经
// getColorProfileLookup() 按设备型号解析参数，互不 import
export type ColorProfileLookup = (deviceModel: string | null) => import('../types').ColorProfile | null;

let ColorProfileLookupFn: ColorProfileLookup | null = null;

export function registerColorProfileLookup(fn: ColorProfileLookup): void {
  ColorProfileLookupFn = fn;
}

export function getColorProfileLookup(): ColorProfileLookup | null {
  return ColorProfileLookupFn;
}
