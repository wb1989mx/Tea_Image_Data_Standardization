import type {
  SampleRepository,
  AssetRepository,
  OptionRepository
} from '../../infrastructure/repository';
import type { Sample, ImageAsset } from '../../infrastructure/types';
import { slotOf } from '../../infrastructure/types';
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
    // 关键一致性约束：assets 表与 sample.images[slot] 内嵌快照是两份数据，
    // 而质量页槽位、记录页缩略图、导出打包全部读取 sample 内的快照。
    // 若只写 assets 表，编辑结果不会反映到界面（表现为「确认后无变化」）。
    // 因此同事务双写：asset 落表 + 回写所属样品的对应槽位快照。
    //
    // 注意这里是 **slot** 而非 dimension：茶汤拆为第 1 冲（soup）/ 第 2 冲（soup2）
    // 两个槽位，两者 dimension 同为 'soup'。若仍以 dimension 为键，后上传的那张
    // 会静默覆盖先上传的，界面上不报错、数据却已丢失。
    const slot = slotOf(asset);
    await db.transaction('rw', db.assets, db.samples, async () => {
      await db.assets.put(asset);
      const sample = await db.samples.get(asset.sampleId);
      if (sample && sample.images) {
        sample.images[slot] = asset;
        await db.samples.put(sample);
      }
    });
  },
  async remove(id: string): Promise<void> {
    // 同步摘除样品内嵌快照中的对应槽位，避免残留已删除资产
    await db.transaction('rw', db.assets, db.samples, async () => {
      const asset = await db.assets.get(id);
      await db.assets.delete(id);
      if (!asset) return;
      const slot = slotOf(asset);
      const sample = await db.samples.get(asset.sampleId);
      if (sample && sample.images && sample.images[slot]?.id === id) {
        sample.images[slot] = null;
        await db.samples.put(sample);
      }
    });
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
