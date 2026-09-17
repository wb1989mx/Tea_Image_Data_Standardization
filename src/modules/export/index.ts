// 导出模块公开接口
export * from '../../infrastructure/types';
export { packZip, downloadSamples } from './service';

// 启动期向基础设施注册表注入导出能力（record 模块经 getExporter() 调用，互不 import）
import { registerExporter } from '../../infrastructure/capabilities';
import { packZip } from './service';
registerExporter(packZip);
