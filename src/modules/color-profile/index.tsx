// 色彩矫正模块公开接口
export * from '../../infrastructure/types';
export { loadProfiles, saveProfiles, getProfile, filterString, bakeProfile, DEFAULT_PROFILES } from './service';
export { ColorProfileSettings } from './components/ColorProfileSettings';

// 启动期注册色彩能力（image-editor / quality 等可经 getColorBake() / getColorProfileLookup() 使用，互不 import）
import { registerColorBake, registerColorProfileLookup } from '../../infrastructure/capabilities';
import { bakeProfile, getProfile } from './service';
registerColorBake(bakeProfile);
registerColorProfileLookup(getProfile);
