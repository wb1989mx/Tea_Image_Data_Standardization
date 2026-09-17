// 模块公开接口（其余模块只可经由这些符号访问存储能力）
export * from '../../infrastructure/types';
export { db, ensureSeed, type OptionRow } from './db';
export { sampleRepo, assetRepo, optionRepo } from './repository';

// 启动期向基础设施注册表注入具体实现（依赖倒置；其它模块经 repositories 读取）
import { registerRepositories } from '../../infrastructure/repository';
import { sampleRepo, assetRepo, optionRepo } from './repository';
registerRepositories({ sample: sampleRepo, asset: assetRepo, option: optionRepo });

// storage 不在路由中直接呈现，仅作为数据底座被其它模块消费
