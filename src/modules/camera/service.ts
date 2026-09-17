// 相机服务层：打开视频流、探测专业能力、应用控制、抓帧
// 仅依赖浏览器 API 与基础设施类型；降级由组件层处理

export interface CameraCaps {
  zoom?: [number, number];
  focus?: boolean;
  exposure?: [number, number];
  whiteBalance?: boolean;
}

export async function openStream(preferRear: boolean): Promise<MediaStream> {
  if (!navigator.mediaDevices?.getUserMedia) {
    throw new Error('当前浏览器不支持 getUserMedia');
  }
  return navigator.mediaDevices.getUserMedia({
    video: { facingMode: preferRear ? 'environment' : 'user' },
    audio: false
  });
}

// 探测轨道可用专业能力（变焦/手动对焦/曝光补偿/手动白平衡）
export function readCapabilities(track: MediaStreamTrack): CameraCaps {
  const c = track.getCapabilities() as unknown as Record<string, unknown>;
  const caps: CameraCaps = {};
  if (typeof c.zoom === 'object' && c.zoom) {
    const z = c.zoom as { min: number; max: number };
    caps.zoom = [z.min, z.max];
  }
  if (Array.isArray(c.focusMode) && (c.focusMode as string[]).includes('manual')) caps.focus = true;
  if (typeof c.exposureCompensation === 'object' && c.exposureCompensation) {
    const e = c.exposureCompensation as { min: number; max: number };
    caps.exposure = [e.min, e.max];
  }
  if (Array.isArray(c.whiteBalanceMode) && (c.whiteBalanceMode as string[]).includes('manual')) {
    caps.whiteBalance = true;
  }
  return caps;
}

export async function applyControl(track: MediaStreamTrack, constraints: Record<string, unknown>): Promise<void> {
  await track.applyConstraints(constraints as MediaTrackConstraints);
}

// 从 video 元素抓取当前帧为 JPEG Blob
export function captureFrame(video: HTMLVideoElement): Promise<Blob> {
  const canvas = document.createElement('canvas');
  canvas.width = video.videoWidth || 1280;
  canvas.height = video.videoHeight || 720;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('无法获取 canvas 上下文');
  ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
  return new Promise((resolve, reject) => {
    canvas.toBlob((b) => (b ? resolve(b) : reject(new Error('抓帧失败'))), 'image/jpeg', 0.92);
  });
}
