import type { DeviceInfo } from '../../infrastructure/types';
import { parse as exifParse } from 'exifr';

// 设备信息获取：UA Client Hints / User-Agent 解析；EXIF Make/Model 提取（图片）
// 仅依赖基础设施类型；不 import 其它业务模块

interface UAParse {
  os: string | null;
  browser: string | null;
}

export function parseUA(ua: string): UAParse {
  let os: string | null = null;
  let browser: string | null = null;
  if (/Windows NT/.test(ua)) os = 'Windows';
  else if (/iPhone|iPad|iPod/.test(ua)) os = 'iOS';
  else if (/Android/.test(ua)) os = 'Android';
  else if (/Mac OS X/.test(ua)) os = 'macOS';
  else if (/Linux/.test(ua)) os = 'Linux';

  if (/Edg\//.test(ua)) browser = 'Edge';
  else if (/Chrome\//.test(ua)) browser = 'Chrome';
  else if (/Safari\//.test(ua) && !/Chrome\//.test(ua)) browser = 'Safari';
  else if (/Firefox\//.test(ua)) browser = 'Firefox';
  return { os, browser };
}

// 综合获取设备信息（优先 Client Hints → UA 解析）
export async function getDeviceInfo(): Promise<DeviceInfo> {
  const ua = navigator.userAgent ?? '';
  const { os, browser } = parseUA(ua);
  let model: string | null = null;

  // UA Client Hints（仅安全上下文可用，可能缺失）
  const uaData = (navigator as unknown as { userAgentData?: { model?: string; brand?: string; mobile?: boolean } })
    .userAgentData;
  if (uaData?.model) model = uaData.model;
  else if (uaData?.mobile && uaData.brand) model = uaData.brand;

  // Android 设备型号常嵌于 UA
  if (!model && /Android/.test(ua)) {
    const m = ua.match(/Android[^;]*;\s*([^;)]+)/);
    if (m) model = m[1].trim();
  }

  return { model, os, browser, exifMake: null, exifModel: null };
}

export interface ExifMakeModel {
  make: string | null;
  model: string | null;
}

// 从图片 Blob 提取 EXIF Make/Model（失败返回 null，不阻断主流程）
export async function extractExifMakeModel(blob: Blob): Promise<ExifMakeModel | null> {
  try {
    const data = await exifParse(blob, { pick: ['Make', 'Model'] });
    if (!data) return null;
    return { make: data.Make ?? null, model: data.Model ?? null };
  } catch {
    return null;
  }
}
