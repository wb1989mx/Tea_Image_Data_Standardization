// 设备模块公开接口
export * from '../../infrastructure/types';
export { getDeviceInfo, extractExifMakeModel, parseUA, type ExifMakeModel } from './service';
export { DeviceInfoCard } from './components/DeviceInfoCard';

// 启动期：注册 EXIF 提取能力 + 填充根 Store 设备信息（label 模块只读，互不 import）
import { registerExifExtractor } from '../../infrastructure/capabilities';
import { getDeviceInfo, extractExifMakeModel } from './service';
import { useRootStore } from '../../infrastructure/store';

registerExifExtractor(extractExifMakeModel);

// 启动期合并探测结果：已有值优先（来自持久化的用户手动修正），仅补空缺字段。
// 若直接整体覆盖，设置页中手改的型号会在每次刷新后被探测结果冲掉。
getDeviceInfo().then((detected) => {
  const store = useRootStore.getState();
  const cur = store.deviceInfo;
  store.setDeviceInfo({
    model: cur.model ?? detected.model,
    os: cur.os ?? detected.os,
    browser: cur.browser ?? detected.browser,
    exifMake: cur.exifMake ?? detected.exifMake,
    exifModel: cur.exifModel ?? detected.exifModel
  });
});
