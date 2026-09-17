import Dexie, { type Table } from 'dexie';
import type { Sample, ImageAsset } from '../../infrastructure/types';

// 选项键值表：categories / grades 各自一行，便于自定义新增持久化
export interface OptionRow {
  key: string; // 'categories' | 'grades'
  values: string[];
}

// Dexie 数据库：样品 + 图像资产（含 Blob 原图/编辑图）+ 自定义选项
// 业务模块只通过 infrastructure/repository 接口访问，绝不直接 import 本文件
export class TeaDB extends Dexie {
  samples!: Table<Sample, string>;
  assets!: Table<ImageAsset, string>;
  options!: Table<OptionRow, string>;

  constructor() {
    super('tea-image-pwa');
    this.version(1).stores({
      // 索引：id 主键；status/updatedAt/category 便于查询与排序
      samples: 'id, status, updatedAt, category',
      // 索引：id 主键；sampleId 便于按样品取三图；dimension 便于按维度查
      assets: 'id, sampleId, dimension',
      // 选项键值表
      options: 'key'
    });
  }
}

export const db = new TeaDB();

// 默认种子选项（仅在首次且库为空时写入，绝不覆盖用户已有数据）
const DEFAULT_OPTIONS: Record<string, string[]> = {
  categories: ['绿茶', '红茶', '乌龙茶', '白茶', '黄茶', '黑茶'],
  grades: ['特级', '一级', '二级', '三级']
};

let seeded = false;

export async function ensureSeed(): Promise<void> {
  if (seeded) return;
  seeded = true;
  await db.transaction('rw', db.options, async () => {
    for (const [key, values] of Object.entries(DEFAULT_OPTIONS)) {
      const exist = await db.options.get(key);
      if (!exist) await db.options.put({ key, values });
    }
  });
}
