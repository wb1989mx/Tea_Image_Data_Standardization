import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import type { DeviceInfo } from '../types';

// 根 Store：仅放跨模块共享态（设备/主题/在线状态）
// 各业务模块拥有自己的 store.ts，彼此不直读
// device 模块写入 deviceInfo，label 等模块只读，避免模块互 import
//
// 持久化策略（zustand/persist → localStorage，键 tea-root-store）：
// 只持久化「用户设置」类字段：themeId（主题选择）与 deviceInfo（含用户手动修正的型号）。
// online 属运行时状态，不持久化，每次启动由浏览器事件重新同步。
// 背景：此前根 Store 为纯内存，设置页选好的主题一刷新即回默认值，等于每次都要重设。
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

export const useRootStore = create<RootState>()(
  persist(
    (set) => ({
      online: typeof navigator !== 'undefined' ? navigator.onLine : true,
      themeId: 'ios', // 默认：极简 iOS 风
      deviceInfo: EMPTY_DEVICE,
      setOnline: (v) => set({ online: v }),
      setThemeId: (id) => set({ themeId: id }),
      setDeviceInfo: (d) => set({ deviceInfo: d })
    }),
    {
      name: 'tea-root-store',
      storage: createJSONStorage(() => localStorage),
      version: 1,
      // 白名单式持久化：仅这两项属于「设置」，避免把运行时状态写进存储
      partialize: (s) => ({ themeId: s.themeId, deviceInfo: s.deviceInfo })
    }
  )
);
