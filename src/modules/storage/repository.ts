import type {
  SampleRepository,
  AssetRepository,
  OptionRepository
} from '../../infrastructure/repository';
import type { Sample, ImageAsset } from '../../infrastructure/types';
import { db } from './db';

// ===== 数据访问实现（依赖倒置）：业务模块只依赖 infrastructure 接口 =====

export const sampleRepo: SampleRepository = {
  async list(): Promise<Sample[]> {
    // 按更新时间倒序，最新登记置顶
    return db.samples.orderBy('updatedAt').reverse().toArray();
  },
  async get(id: string): Promise<Sample | undefined> {
    return db.samples.get(id);
  },
  async create(sample: Sample): Promise<void> {
    await db.samples.put(sample);
  },
  async update(sample: Sample): Promise<void> {
    await db.samples.put(sample);
  },
  async remove(id: string): Promise<void> {
    // 删除样品同时级联删除其全部图像资产（含 Blob）
    await db.transaction('rw', db.samples, db.assets, async () => {
      await db.assets.where('sampleId').equals(id).delete();
      await db.samples.delete(id);
    });
  }
};

export const assetRepo: AssetRepository = {
  async get(id: string): Promise<ImageAsset | undefined> {
    return db.assets.get(id);
  },
  async listBySample(sampleId: string): Promise<ImageAsset[]> {
    return db.assets.where('sampleId').equals(sampleId).toArray();
  },
  async put(asset: ImageAsset): Promise<void> {
    await db.assets.put(asset);
  },
  async remove(id: string): Promise<void> {
    await db.assets.delete(id);
  }
};

export const optionRepo: OptionRepository = {
  async getCategories(): Promise<string[]> {
    return (await db.options.get('categories'))?.values ?? [];
  },
  async getGrades(): Promise<string[]> {
    return (await db.options.get('grades'))?.values ?? [];
  },
  async addCategory(v: string): Promise<void> {
    await appendOption('categories', v);
  },
  async addGrade(v: string): Promise<void> {
    await appendOption('grades', v);
  }
};

// 选项去重追加
async function appendOption(key: string, v: string): Promise<void> {
  const value = v.trim();
  if (!value) return;
  await db.transaction('rw', db.options, async () => {
    const row = await db.options.get(key);
    if (!row) {
      await db.options.put({ key, values: [value] });
      return;
    }
    if (!row.values.includes(value)) {
      row.values = [...row.values, value];
      await db.options.put(row);
    }
  });
}
