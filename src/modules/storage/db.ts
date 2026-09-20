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

    // v2：引入「槽位」概念 —— 茶汤拆为第 1 冲 / 第 2 冲两个槽位。
    // 槽位 key 成为图像身份（存储键与文件名依据），dimension 退化为分组语义。
    // 迁移为**纯增量**：只补 slot 字段与 soup2 空位，不搬移任何既有键，
    // 因此幂等、可重入，且不会触碰 Blob 数据本身。
    this.version(2)
      .stores({
        samples: 'id, status, updatedAt, category',
        assets: 'id, sampleId, dimension, slot', // 新增 slot 索引
        options: 'key'
      })
      .upgrade(async (tx) => {
        // 1) 历史资产补 slot：单茶汤时期 dimension 即槽位（soup 保持 soup，无需改名）
        await tx
          .table('assets')
          .toCollection()
          .modify((a: Record<string, unknown>) => {
            if (!a.slot && typeof a.dimension === 'string') a.slot = a.dimension;
          });
        // 2) 历史样品补茶汤第2冲空位（选填槽位，缺省为 null）
        await tx
          .table('samples')
          .toCollection()
          .modify((s: Record<string, unknown>) => {
            const images = s.images as Record<string, unknown> | undefined;
            if (images && images.soup2 === undefined) images.soup2 = null;
          });
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
