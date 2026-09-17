import type { Sample, ImageAsset } from '../types';

// 数据访问抽象接口（依赖倒置）
// 业务模块只依赖此接口，具体实现在 modules/storage
export interface SampleRepository {
  list(): Promise<Sample[]>;
  get(id: string): Promise<Sample | undefined>;
  create(sample: Sample): Promise<void>;
  update(sample: Sample): Promise<void>;
  remove(id: string): Promise<void>;
}

export interface AssetRepository {
  get(id: string): Promise<ImageAsset | undefined>;
  listBySample(sampleId: string): Promise<ImageAsset[]>;
  put(asset: ImageAsset): Promise<void>;
  remove(id: string): Promise<void>;
}

// 自定义选项（类别/等级）持久化接口
export interface OptionRepository {
  getCategories(): Promise<string[]>;
  getGrades(): Promise<string[]>;
  addCategory(v: string): Promise<void>;
  addGrade(v: string): Promise<void>;
}

// ===== 仓储注册表（依赖注入）：业务模块经此读取具体实现，禁止互 import =====
// modules/storage 在启动时 registerRepositories；其余模块仅依赖本注册表。
interface RepoBundle {
  sample?: SampleRepository;
  asset?: AssetRepository;
  option?: OptionRepository;
}

let _sample: SampleRepository | null = null;
let _asset: AssetRepository | null = null;
let _option: OptionRepository | null = null;

export function registerRepositories(bundle: RepoBundle): void {
  if (bundle.sample) _sample = bundle.sample;
  if (bundle.asset) _asset = bundle.asset;
  if (bundle.option) _option = bundle.option;
}

function requireRepo<T>(repo: T | null, name: string): T {
  if (!repo) throw new Error(`[repository] ${name} 未注册，请确认 modules/storage 已加载`);
  return repo;
}

export const repositories = {
  get sample(): SampleRepository {
    return requireRepo(_sample, 'sampleRepo');
  },
  get asset(): AssetRepository {
    return requireRepo(_asset, 'assetRepo');
  },
  get option(): OptionRepository {
    return requireRepo(_option, 'optionRepo');
  }
};
