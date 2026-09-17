import { create } from 'zustand';
import type { DeviceInfo } from '../types';

// 根 Store：仅放跨模块共享态（设备/主题/在线状态）
// 各业务模块拥有自己的 store.ts，彼此不直读
// device 模块写入 deviceInfo，label 等模块只读，避免模块互 import
const EMPTY_DEVICE: DeviceInfo = {
  model: null,
  os: null,
  browser: null,
  exifMake: null,
  exifModel: null
};

interface RootState {
  online: boolean;
  themeId: string;
  deviceInfo: DeviceInfo;
  setOnline: (v: boolean) => void;
  setThemeId: (id: string) => void;
  setDeviceInfo: (d: DeviceInfo) => void;
}

export const useRootStore = create<RootState>((set) => ({
  online: typeof navigator !== 'undefined' ? navigator.onLine : true,
  themeId: 'ios', // 默认：极简 iOS 风
  deviceInfo: EMPTY_DEVICE,
  setOnline: (v) => set({ online: v }),
  setThemeId: (id) => set({ themeId: id }),
  setDeviceInfo: (d) => set({ deviceInfo: d })
}));
