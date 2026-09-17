// 相机模块公开接口
export * from '../../infrastructure/types';
export { CameraCapture } from './components/CameraCapture';
export { openStream, readCapabilities, captureFrame, applyControl, type CameraCaps } from './service';

// 启动期向基础设施注册表注入相机采集组件（quality 模块经 getCameraCapture() 使用，互不 import）
import { registerCameraCapture } from '../../infrastructure/capabilities';
import { CameraCapture } from './components/CameraCapture';
registerCameraCapture(CameraCapture);
