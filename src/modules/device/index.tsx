// 设备模块公开接口
export * from '../../infrastructure/types';
export { getDeviceInfo, extractExifMakeModel, parseUA, type ExifMakeModel } from './service';
export { DeviceInfoCard } from './components/DeviceInfoCard';

// 启动期：注册 EXIF 提取能力 + 填充根 Store 设备信息（label 模块只读，互不 import）
import { registerExifExtractor } from '../../infrastructure/capabilities';
import { getDeviceInfo, extractExifMakeModel } from './service';
import { useRootStore } from '../../infrastructure/store';

registerExifExtractor(extractExifMakeModel);
getDeviceInfo().then((d) => useRootStore.getState().setDeviceInfo(d));
